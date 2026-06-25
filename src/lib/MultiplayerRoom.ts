import { db } from "../firebase";
import { ref, set, update, onValue, get, Unsubscribe, onDisconnect, remove, query, orderByChild, endAt } from "firebase/database";
import { TestConfig } from "./TestConfig";

export interface PlayerData {
    id: string;
    displayName: string;
    progress: number;
    wpm: number;
    accuracy: number;
    finished: boolean;
    leftRace?: boolean;
}

export interface RoomState {
    snippetText: string;
    snippetAuthor?: string;
    config: TestConfig;
    started: boolean;
    createdAt: number;
    players: { [id: string]: PlayerData };
}

export class MultiplayerRoom {
    public roomCode: string;
    public playerId: string;
    public displayName: string = "";
    public isHost: boolean;
    private unsubscribe: Unsubscribe | null = null;

    constructor(roomCode?: string, isHost: boolean = false) {
        this.roomCode = roomCode ? roomCode.toUpperCase() : this.generateRoomCode();
        this.isHost = isHost;
        this.playerId = "usr_" + Math.random().toString(36).substring(2, 9);
    }

    private generateRoomCode(): string {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    public async create(displayName: string, snippetText: string, snippetAuthor: string, config: TestConfig): Promise<void> {
        this.displayName = displayName;
        const roomRef = ref(db, `rooms/${this.roomCode}`);
        
        const initialRoom: RoomState = {
            snippetText: snippetText,
            snippetAuthor: snippetAuthor,
            config: config,
            started: false,
            createdAt: Date.now(),
            players: {
                [this.playerId]: {
                    id: this.playerId,
                    displayName: displayName,
                    progress: 0,
                    wpm: 0,
                    accuracy: 100,
                    finished: false
                }
            }
        };

        await set(roomRef, initialRoom);

        // Clean up stale rooms in the background (fire-and-forget)
        MultiplayerRoom.cleanupStaleRooms();
        
        // FIX: The root cause of "ghost" players filling up the room was the lack of onDisconnect handling.
        // Firebase automatically runs this remove() command on the server side when the client's socket drops.
        const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
        await onDisconnect(playerRef).remove();
    }

    public async join(roomCode: string, displayName: string): Promise<{snippetText: string, snippetAuthor?: string, config: TestConfig}> {
        this.roomCode = roomCode.toUpperCase();
        this.displayName = displayName;
        const roomRef = ref(db, `rooms/${this.roomCode}`);
        
        const snapshot = await get(roomRef);
        if (!snapshot.exists()) {
            throw new Error("Room not found");
        }

        const roomData = snapshot.val() as RoomState;
        
        // Add player to the room
        const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
        const playerData: PlayerData = {
            id: this.playerId,
            displayName: displayName,
            progress: 0,
            wpm: 0,
            accuracy: 100,
            finished: false
        };

        await set(playerRef, playerData);
        await onDisconnect(playerRef).remove();
        
        return { snippetText: roomData.snippetText, snippetAuthor: roomData.snippetAuthor, config: roomData.config };
    }

    public listen(onUpdate: (roomState: RoomState | null) => void) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const roomRef = ref(db, `rooms/${this.roomCode}`);
        this.unsubscribe = onValue(roomRef, (snapshot) => {
            if (snapshot.exists()) {
                onUpdate(snapshot.val() as RoomState);
            } else {
                onUpdate(null);
            }
        });
    }

    public async updateProgress(progress: number, wpm: number, accuracy: number, finished: boolean): Promise<void> {
        const playerProgressRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
        await update(playerProgressRef, {
            progress,
            wpm,
            accuracy,
            finished
        });
    }

    public async startRace(): Promise<void> {
        const startedRef = ref(db, `rooms/${this.roomCode}`);
        await update(startedRef, {
            started: true
        });
    }

    public disconnect() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        try {
            const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            remove(playerRef);
            onDisconnect(playerRef).cancel();
        } catch (e) {
            console.error("Failed to remove player on disconnect", e);
        }
    }

    /**
     * Deletes rooms older than 1 hour.
     * Runs in the background whenever a new room is created.
     */
    private static async cleanupStaleRooms(): Promise<void> {
        try {
            const ONE_HOUR_MS = 60 * 60 * 1000;
            const cutoff = Date.now() - ONE_HOUR_MS;
            const roomsRef = ref(db, "rooms");
            const staleQuery = query(roomsRef, orderByChild("createdAt"), endAt(cutoff));
            const snapshot = await get(staleQuery);

            if (snapshot.exists()) {
                const staleRooms = snapshot.val();
                const deletePromises = Object.keys(staleRooms).map((roomCode) => {
                    return remove(ref(db, `rooms/${roomCode}`));
                });
                await Promise.all(deletePromises);
                console.log(`[Cleanup] Deleted ${Object.keys(staleRooms).length} stale room(s)`);
            }
        } catch (e) {
            // Non-critical — don't let cleanup failures break room creation
            console.error("[Cleanup] Failed to clean up stale rooms", e);
        }
    }

    public async leaveRoom(activeRace: boolean): Promise<void> {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        try {
            const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            if (activeRace) {
                // Mark as Left Race in Firebase so other players see it
                await update(playerRef, {
                    leftRace: true
                });
                // Cancel onDisconnect since we are handling leaving cleanly
                await onDisconnect(playerRef).cancel();
            } else {
                // Remove player node entirely from Firebase
                await remove(playerRef);
                await onDisconnect(playerRef).cancel();
            }
        } catch (e) {
            console.error("Failed to leave room", e);
        }
    }
}
