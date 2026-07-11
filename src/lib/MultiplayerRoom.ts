import { db, getSyncedTime } from "../firebase";
import { ref, set, update, onValue, get, Unsubscribe, onDisconnect, remove, query, orderByChild, endAt, runTransaction } from "firebase/database";
import { TestConfig } from "./TestConfig";

export interface PlayerData {
    id: string;
    displayName: string;
    progress: number;
    wpm: number;
    accuracy: number;
    finished: boolean;
    ready: boolean;
    ping?: number;
    leftRace?: boolean;
    errors?: number;
}

export interface RoomState {
    snippetText: string;
    snippetAuthor?: string;
    config: TestConfig;
    started: boolean;
    createdAt: number;
    players: { [id: string]: PlayerData };
    hostId: string;
    status: "waiting" | "countdown" | "running" | "finished";
    countdown?: number;
    elapsedSeconds: number;
    winnerId?: string;
    winnerName?: string;
    rankings?: string[]; // playerIds in finish order
    raceStartTimestamp?: number;
}

export function sortPlayers(players: PlayerData[], rankings: string[] = []): PlayerData[] {
    return [...players].sort((a, b) => {
        const aFinished = a.finished;
        const bFinished = b.finished;
        
        const aLeftActive = a.leftRace && !aFinished;
        const bLeftActive = b.leftRace && !bFinished;
        
        if (aLeftActive && !bLeftActive) return 1;
        if (!aLeftActive && bLeftActive) return -1;
        
        const aRank = rankings.indexOf(a.id);
        const bRank = rankings.indexOf(b.id);
        
        if (aRank !== -1 && bRank !== -1) {
            return aRank - bRank;
        }
        if (aRank !== -1) return -1;
        if (bRank !== -1) return 1;
        
        if (b.progress !== a.progress) {
            return b.progress - a.progress;
        }
        return b.wpm - a.wpm;
    });
}


export class MultiplayerRoom {
    public roomCode: string;
    public playerId: string;
    public displayName: string = "";
    public isHost: boolean;
    private unsubscribe: Unsubscribe | null = null;
    private _disconnected: boolean = false;

    private countdownInterval: any = null;
    private timerInterval: any = null;

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
            hostId: this.playerId,
            status: "waiting",
            elapsedSeconds: 0,
            players: {
                [this.playerId]: {
                    id: this.playerId,
                    displayName: displayName,
                    progress: 0,
                    wpm: 0,
                    accuracy: 100,
                    finished: false,
                    ready: true
                }
            }
        };

        await set(roomRef, initialRoom);

        // Clean up stale rooms in the background (fire-and-forget)
        MultiplayerRoom.cleanupStaleRooms();
        
        const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
        await onDisconnect(playerRef).remove();
    }

    public async join(roomCode: string, displayName: string): Promise<{snippetText: string, snippetAuthor?: string, config: TestConfig}> {
        this.roomCode = roomCode.toUpperCase();
        this.displayName = displayName;
        const roomRef = ref(db, `rooms/${this.roomCode}`);
        
        let snippetText = "";
        let snippetAuthor = "";
        let config: TestConfig | null = null;
        
        const result = await runTransaction(roomRef, (currentRoomState) => {
            if (!currentRoomState) {
                return undefined; // aborts transaction
            }

            if (currentRoomState.status && currentRoomState.status !== "waiting") {
                return undefined; // aborts transaction
            }
            
            if (!currentRoomState.players) {
                currentRoomState.players = {};
            }
            
            currentRoomState.players[this.playerId] = {
                id: this.playerId,
                displayName: displayName,
                progress: 0,
                wpm: 0,
                accuracy: 100,
                finished: false,
                ready: false
            };
            
            snippetText = currentRoomState.snippetText;
            snippetAuthor = currentRoomState.snippetAuthor || "";
            config = currentRoomState.config;
            
            return currentRoomState;
        });

        if (!result.committed || !config) {
            throw new Error("Room not found or race has already started/finished");
        }
        
        // Add player onDisconnect handler
        const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
        await onDisconnect(playerRef).remove();
        
        return { snippetText, snippetAuthor: snippetAuthor, config };
    }

    public listen(onUpdate: (roomState: RoomState | null) => void) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const roomRef = ref(db, `rooms/${this.roomCode}`);
        this.unsubscribe = onValue(roomRef, (snapshot) => {
            if (this._disconnected) return;
            if (snapshot.exists()) {
                onUpdate(snapshot.val() as RoomState);
            } else {
                onUpdate(null);
            }
        }, (error) => {
            console.error("[Multiplayer] Firebase listener error:", error);
            onUpdate(null);
        });
    }

    public async updateProgress(progress: number, wpm: number, accuracy: number, errors: number, finished: boolean): Promise<void> {
        if (this._disconnected) return;
        try {
            const playerProgressRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            await update(playerProgressRef, {
                progress,
                wpm,
                accuracy,
                errors,
                finished
            });
        } catch (e) {
            console.error("[Multiplayer] Failed to update progress (room may be gone)", e);
        }
    }

    public async toggleReady(ready: boolean): Promise<void> {
        if (this._disconnected) return;
        try {
            const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            await update(playerRef, { ready });
        } catch (e) {
            console.error("[Multiplayer] Failed to toggle ready status", e);
        }
    }

    public async updatePing(ping: number): Promise<void> {
        if (this._disconnected) return;
        try {
            const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            await update(playerRef, { ping });
        } catch (e) {
            // Room may be gone
        }
    }

    public async claimHost(newHostId: string): Promise<void> {
        if (this._disconnected) return;
        try {
            const roomRef = ref(db, `rooms/${this.roomCode}`);
            await update(roomRef, {
                hostId: newHostId
            });
            if (newHostId === this.playerId) {
                this.isHost = true;
            }
        } catch (e) {
            console.error("[Multiplayer] Failed to claim host", e);
        }
    }

    public async startCountdown(): Promise<void> {
        if (this._disconnected || !this.isHost) return;
        try {
            const roomRef = ref(db, `rooms/${this.roomCode}`);
            await update(roomRef, {
                status: "countdown",
                countdown: 3,
                started: true
            });

            this.cleanup();

            let currentCountdown = 3;
            this.countdownInterval = setInterval(async () => {
                if (this._disconnected) {
                    clearInterval(this.countdownInterval);
                    return;
                }
                currentCountdown--;
                if (currentCountdown >= 0) {
                    await update(roomRef, {
                        countdown: currentCountdown
                    });
                }
                
                if (currentCountdown === 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    await update(roomRef, {
                        status: "running",
                        elapsedSeconds: 0,
                        countdown: 0,
                        raceStartTimestamp: getSyncedTime()
                    });
                }
            }, 1000);
        } catch (e) {
            console.error("[Multiplayer] Failed to start countdown", e);
        }
    }

    public resumeCountdown(currentValue: number): void {
        if (this._disconnected || !this.isHost) return;
        if (this.countdownInterval) return;

        console.log(`[Host Migration] Resuming countdown from ${currentValue}`);
        const roomRef = ref(db, `rooms/${this.roomCode}`);
        let currentCountdown = currentValue;
        
        this.countdownInterval = setInterval(async () => {
            if (this._disconnected) {
                clearInterval(this.countdownInterval);
                return;
            }
            currentCountdown--;
            if (currentCountdown >= 0) {
                await update(roomRef, {
                    countdown: currentCountdown
                });
            }
            
            if (currentCountdown === 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                await update(roomRef, {
                    status: "running",
                    elapsedSeconds: 0,
                    countdown: 0,
                    raceStartTimestamp: getSyncedTime()
                });
            }
        }, 1000);
    }

    public startRaceTimer(): void {
        // Timer runs locally synced to raceStartTimestamp
    }

    public resumeRaceTimer(currentElapsed: number): void {
        // Timer runs locally synced to raceStartTimestamp
    }

    public async finishRace(wpm: number, accuracy: number, errors: number): Promise<void> {
        if (this._disconnected) return;
        
        const roomRef = ref(db, `rooms/${this.roomCode}`);
        const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
        
        try {
            await onDisconnect(playerRef).cancel();
        } catch (e) {
            console.error("[Multiplayer] Failed to cancel onDisconnect on race finish", e);
        }
        
        try {
            await runTransaction(roomRef, (currentRoomState) => {
                if (!currentRoomState) return currentRoomState;
                
                if (currentRoomState.players && currentRoomState.players[this.playerId]) {
                    const p = currentRoomState.players[this.playerId];
                    if (p.finished) {
                        return currentRoomState;
                    }
                    
                    p.progress = 100;
                    p.wpm = wpm;
                    p.accuracy = accuracy;
                    p.errors = errors;
                    p.finished = true;
                    
                    if (!currentRoomState.rankings) {
                        currentRoomState.rankings = [];
                    }
                    
                    if (!currentRoomState.rankings.includes(this.playerId)) {
                        currentRoomState.rankings.push(this.playerId);
                        p.finishOrder = currentRoomState.rankings.length;
                    }
                    
                    if (!currentRoomState.winnerId && currentRoomState.rankings.length > 0) {
                        const firstFinishedId = currentRoomState.rankings[0];
                        currentRoomState.winnerId = firstFinishedId;
                        currentRoomState.winnerName = currentRoomState.players[firstFinishedId]?.displayName || "";
                    }
                }
                
                const players = currentRoomState.players || {};
                const playersArray = Object.keys(players).map(k => players[k]);
                const activePlayers = playersArray.filter(p => !p.leftRace);
                const allFinished = activePlayers.length > 0 && activePlayers.every(p => p.finished);
                
                if (allFinished) {
                    currentRoomState.status = "finished";
                    currentRoomState.started = false;
                    if (currentRoomState.raceStartTimestamp) {
                        currentRoomState.elapsedSeconds = Math.max(0, Math.round((getSyncedTime() - currentRoomState.raceStartTimestamp) / 1000));
                    }
                }
                
                return currentRoomState;
            });
        } catch (e) {
            console.error("[Multiplayer] Failed to complete transaction for finishRace", e);
        }
    }

    public async resetRoom(newSnippet: string, newAuthor: string, config: TestConfig): Promise<void> {
        if (this._disconnected || !this.isHost) return;
        this.cleanup();
        
        try {
            const roomRef = ref(db, `rooms/${this.roomCode}`);
            const snapshot = await get(roomRef);
            if (!snapshot.exists()) return;
            
            const currentRoom = snapshot.val() as RoomState;
            const updatedPlayers: { [id: string]: PlayerData } = {};
            
            Object.keys(currentRoom.players || {}).forEach((id) => {
                const p = currentRoom.players[id];
                if (p.leftRace) return; // filter out players who left the race
                
                updatedPlayers[id] = {
                    id: p.id,
                    displayName: p.displayName,
                    progress: 0,
                    wpm: 0,
                    accuracy: 100,
                    finished: false,
                    ready: id === this.playerId
                };
            });
            
            const resetState: RoomState = {
                snippetText: newSnippet,
                snippetAuthor: newAuthor,
                config: config,
                started: false,
                createdAt: Date.now(),
                players: updatedPlayers,
                hostId: this.playerId,
                status: "waiting",
                elapsedSeconds: 0
            };
            
            await set(roomRef, resetState);
        } catch (e) {
            console.error("[Multiplayer] Failed to reset room", e);
        }
    }

    public disconnect() {
        this._disconnected = true;
        this.cleanup();
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

    public cleanup() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

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
            console.error("[Cleanup] Failed to clean up stale rooms", e);
        }
    }

    public async leaveRoom(activeRace: boolean): Promise<void> {
        this._disconnected = true;
        this.cleanup();
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        try {
            const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            if (activeRace) {
                await update(playerRef, {
                    leftRace: true
                });
                await onDisconnect(playerRef).cancel();
            } else {
                await remove(playerRef);
                await onDisconnect(playerRef).cancel();
            }
        } catch (e) {
            console.error("Failed to leave room", e);
        }
    }

    public async handleRaceStartedOnDisconnect(): Promise<void> {
        if (this._disconnected) return;
        try {
            const playerRef = ref(db, `rooms/${this.roomCode}/players/${this.playerId}`);
            await onDisconnect(playerRef).cancel();
            await onDisconnect(playerRef).update({
                leftRace: true
            });
        } catch (e) {
            console.error("[Multiplayer] Failed to update onDisconnect handler to leftRace", e);
        }
    }

    public async checkAndTransitionRoomFinished(): Promise<void> {
        if (this._disconnected) return;
        const roomRef = ref(db, `rooms/${this.roomCode}`);
        try {
            await runTransaction(roomRef, (currentRoomState) => {
                if (!currentRoomState) return currentRoomState;
                if (currentRoomState.status !== "running") return undefined; // abort transaction if not running
                
                const players = currentRoomState.players || {};
                const playersArray = Object.keys(players).map(k => players[k]);
                
                const activePlayers = playersArray.filter(p => !p.leftRace);
                const allFinishedOrLeft = activePlayers.length === 0 || activePlayers.every(p => p.finished);
                
                if (allFinishedOrLeft) {
                    currentRoomState.status = "finished";
                    currentRoomState.started = false;
                    
                    // Set winner if not set
                    if (!currentRoomState.winnerId && currentRoomState.rankings && currentRoomState.rankings.length > 0) {
                        const firstFinishedId = currentRoomState.rankings[0];
                        currentRoomState.winnerId = firstFinishedId;
                        currentRoomState.winnerName = players[firstFinishedId]?.displayName || "";
                    }
                    
                    if (currentRoomState.raceStartTimestamp) {
                        currentRoomState.elapsedSeconds = Math.max(0, Math.round((getSyncedTime() - currentRoomState.raceStartTimestamp) / 1000));
                    }
                }
                
                return currentRoomState;
            });
        } catch (e) {
            console.error("[Multiplayer] Failed to transition room to finished", e);
        }
    }
}
