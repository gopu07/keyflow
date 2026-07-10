import * as React from "react";
import { Toast } from "./components/Toast";
import "./App.css";

import LiveUI from "./components/LiveUI";
import CompletedUI from "./components/CompletedUI";
import { IKeystrokeLog } from "./lib/KeystrokeRecorder";
import SnippetGenerator from "./lib/SnippetGenerator";
import { TestConfig } from "./lib/TestConfig";
import words from "../data/words.json";
import { MultiplayerRoom, PlayerData, RoomState } from "./lib/MultiplayerRoom";
import MultiplayerFooter from "./components/MultiplayerFooter";
import { isFirebaseConfigured, db } from "./firebase";
import { QuoteService } from "./lib/QuoteService";
import { ref, get } from "firebase/database";

interface IAppProps {
    snippetText: string;
}
interface IAppState {
    state: "live" | "completed" | "multiplayer";
    keystrokeLogs?: IKeystrokeLog[];
    snippetText: string;
    snippetAuthor?: string;
    config: TestConfig;
    isCustomSetup: boolean;
    
    // Multiplayer State
    mpRoom: MultiplayerRoom | null;
    mpPlayers: PlayerData[];
    mpRoomState: RoomState | null;
    mpStarted: boolean;
    mpRole: "host" | "guest" | null;
    mpLobbyState: "name_entry" | "lobby" | "completed";
    mpNameInput: string;
    mpRoomCodeInput: string;
    mpError: string;
    mpLoading: boolean;
    toastMessage: string | null;
    isTyping: boolean;
}

class App extends React.Component<IAppProps, IAppState> {
    private customTextareaRef = React.createRef<HTMLTextAreaElement>();
    private _isMounted = false;
    private pingInterval: any = null;

    constructor(props: IAppProps) {
        super(props);
        const initialCategory = localStorage.getItem("keyflow_quote_category") || "random";
        this.state = {
            state: "live",
            snippetText: this.props.snippetText,
            snippetAuthor: "",
            config: {
                mode: "quote",
                timeOption: 30,
                wordsOption: 50,
                customText: "",
                quoteCategory: initialCategory
            },
            isCustomSetup: false,
            mpRoom: null,
            mpPlayers: [],
            mpRoomState: null,
            mpStarted: false,
            mpRole: null,
            mpLobbyState: "name_entry",
            mpNameInput: "",
            mpRoomCodeInput: "",
            mpError: "",
            mpLoading: false,
            toastMessage: null,
            isTyping: false
        };
        this.onLiveUIFinish = this.onLiveUIFinish.bind(this);
        this.onRestart = this.onRestart.bind(this);
        this.onConfigChange = this.onConfigChange.bind(this);
        this.handleCreateRace = this.handleCreateRace.bind(this);
        this.handleJoinRace = this.handleJoinRace.bind(this);
        this.onStartMultiplayerRace = this.onStartMultiplayerRace.bind(this);
        this.onMultiplayerProgressUpdate = this.onMultiplayerProgressUpdate.bind(this);
        this.showToast = this.showToast.bind(this);
        this.handleBackClick = this.handleBackClick.bind(this);
        this.handlePlayAgain = this.handlePlayAgain.bind(this);
    }

    private showToast(message: string) {
        this.setState({ toastMessage: message });
    }

    private startPingLoop() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.checkPing();
        this.pingInterval = setInterval(() => {
            this.checkPing();
        }, 5000);
    }

    private async checkPing() {
        if (!this.state.mpRoom) return;
        const start = Date.now();
        try {
            await get(ref(db, `.info/serverTimeOffset`));
            const ping = Date.now() - start;
            await this.state.mpRoom.updatePing(ping);
        } catch (e) {
            // Ignore
        }
    }

    private stopPingLoop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Back button: simple immediate navigation back.
     * No popups, no confirmations. Just leave and go home.
     */
    private async handleBackClick() {
        this.stopPingLoop();
        if (this.state.mpRoom) {
            try {
                const isRaceActive = this.state.mpLobbyState === "lobby" && this.state.mpRoomState?.status === "running";
                await this.state.mpRoom.leaveRoom(isRaceActive);
            } catch (e) {
                console.error("Failed to leave room on back", e);
            }
        }
        // Clear any room URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        this.resetToHome();
    }

    /**
     * Resets all state to the home screen without any async snippet generation blocking.
     * Generates a new snippet in the background after state reset.
     */
    private resetToHome() {
        this.stopPingLoop();
        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }

        this.setState({
            state: "live",
            keystrokeLogs: undefined,
            isCustomSetup: false,
            mpRoom: null,
            mpPlayers: [],
            mpRoomState: null,
            mpStarted: false,
            mpRole: null,
            mpLobbyState: "name_entry",
            mpNameInput: "",
            mpRoomCodeInput: "",
            mpError: "",
            mpLoading: false,
            toastMessage: null,
            isTyping: false
        }, async () => {
            // Generate a fresh snippet in the background after resetting UI
            try {
                const res = await this.generateSnippet(this.state.config);
                if (this._isMounted) {
                    this.setState({
                        snippetText: res.text,
                        snippetAuthor: res.author || ""
                    });
                }
            } catch (e) {
                console.error("Failed to generate snippet on reset", e);
            }
        });
    }

    public async componentDidMount() {
        this._isMounted = true;
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get("room");
        if (roomCode) {
            this.setState({
                state: "multiplayer",
                mpLobbyState: "name_entry",
                mpRole: "guest",
                mpRoomCodeInput: roomCode.toUpperCase()
            });
        } else {
            try {
                const category = this.state.config.quoteCategory || "random";
                const quote = await QuoteService.getInstance().getRandomQuote(category);
                if (this._isMounted) {
                    this.setState({
                        snippetText: quote.text,
                        snippetAuthor: QuoteService.getInstance().formatAuthor(quote)
                    });
                }
            } catch (e) {
                console.error("Failed to load initial quote", e);
            }
        }
    }

    public componentWillUnmount() {
        this._isMounted = false;
        this.stopPingLoop();
        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }
    }

    private async handleCreateRace(displayName: string) {
        if (!isFirebaseConfigured) {
            this.setState({ mpError: "Firebase Database URL is not configured. Please open src/firebase.ts and configure your Firebase credentials." });
            return;
        }
        if (!displayName.trim()) {
            this.setState({ mpError: "Please enter your display name" });
            return;
        }

        // Prevent double-click race condition
        if (this.state.mpLoading) return;

        // Disconnect any previous room
        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }

        this.setState({ mpLoading: true, mpError: "" });

        try {
            const mpRoom = new MultiplayerRoom(undefined, true);
            const { text: snippet, author: snippetAuthor } = await this.generateSnippet(this.state.config);
            await mpRoom.create(displayName, snippet, snippetAuthor || "", this.state.config);

            console.log(`[Multiplayer] Created room ${mpRoom.roomCode}. Passage length: ${snippet.length}, Config mode: ${this.state.config.mode}`);

            if (!this._isMounted) {
                mpRoom.disconnect();
                return;
            }

            this.setState({
                state: "multiplayer",
                mpRoom,
                mpLobbyState: "lobby",
                mpRole: "host",
                snippetText: snippet,
                snippetAuthor: snippetAuthor || "",
                mpPlayers: [{
                    id: mpRoom.playerId,
                    displayName,
                    progress: 0,
                    wpm: 0,
                    accuracy: 100,
                    finished: false,
                    ready: true
                }],
                mpRoomState: null,
                mpStarted: false,
                mpError: "",
                mpLoading: false
            }, () => {
                this.listenToRoom();
                this.startPingLoop();
            });
        } catch (err: any) {
            if (this._isMounted) {
                this.setState({ mpError: err.message || "Failed to create race", mpLoading: false });
            }
        }
    }

    private async handleJoinRace(roomCode: string, displayName: string) {
        if (!isFirebaseConfigured) {
            this.setState({ mpError: "Firebase Database URL is not configured. Please open src/firebase.ts and configure your Firebase credentials." });
            return;
        }
        if (!roomCode.trim()) {
            this.setState({ mpError: "Please enter a room code" });
            return;
        }
        if (!displayName.trim()) {
            this.setState({ mpError: "Please enter your display name" });
            return;
        }

        // Prevent double-click race condition
        if (this.state.mpLoading) return;

        // Disconnect any previous room
        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }

        this.setState({ mpLoading: true, mpError: "" });

        try {
            const mpRoom = new MultiplayerRoom(roomCode, false);
            const { snippetText, snippetAuthor, config } = await mpRoom.join(roomCode, displayName);

            console.log(`[Multiplayer] Joined room ${roomCode}. Loaded passage length: ${snippetText.length}, Config mode: ${config.mode}`);

            if (!this._isMounted) {
                mpRoom.disconnect();
                return;
            }

            this.setState({
                state: "multiplayer",
                mpRoom,
                mpLobbyState: "lobby",
                mpRole: "guest",
                snippetText: snippetText,
                snippetAuthor: snippetAuthor || "",
                config: config,
                mpPlayers: [],
                mpRoomState: null,
                mpStarted: false,
                mpError: "",
                mpLoading: false
            }, () => {
                this.listenToRoom();
                this.startPingLoop();
            });
        } catch (err: any) {
            if (this._isMounted) {
                this.setState({ mpError: err.message || "Failed to join race", mpLoading: false });
            }
        }
    }

    private listenToRoom() {
        if (!this.state.mpRoom) return;

        this.state.mpRoom.listen((roomState) => {
            if (!this._isMounted) return;

            if (!roomState) {
                this.showToast("Room was deleted or is no longer available");
                this.resetToHome();
                return;
            }

            const playersObj = roomState.players || {};
            const playersArray = Object.keys(playersObj).map(
                (key) => playersObj[key]
            );

            if (roomState.config) {
                console.log(`[Multiplayer] Received sync from Firebase. Status: ${roomState.status}, Passage length: ${roomState.snippetText.length}`);
            }

            // Check if current player was removed from room
            if (this.state.mpRoom && !playersObj[this.state.mpRoom.playerId] && this.state.mpLobbyState !== "completed") {
                this.showToast("You were removed from the room");
                this.resetToHome();
                return;
            }

            // Host migration logic
            let currentHostId = roomState.hostId;
            const activePlayers = playersArray.filter(p => !p.leftRace);
            const activePlayerIds = activePlayers.map(p => p.id);
            
            if (activePlayerIds.length > 0) {
                const hostExists = activePlayers.some(p => p.id === currentHostId);
                if (!currentHostId || !hostExists) {
                    activePlayerIds.sort();
                    const newHostId = activePlayerIds[0];
                    if (newHostId === this.state.mpRoom!.playerId) {
                        console.log(`[Host Migration] Claiming host status for player ${newHostId}`);
                        this.state.mpRoom!.claimHost(newHostId);
                    }
                }
            }

            // If I am the host (or just became the host), handle timers
            if (roomState.hostId === this.state.mpRoom!.playerId) {
                if (roomState.status === "countdown" && roomState.countdown !== undefined) {
                    this.state.mpRoom!.resumeCountdown(roomState.countdown);
                }
            } else {
                // Guests clear local timers
                this.state.mpRoom!.cleanup();
            }

            // Detect player left notifications
            const prevPlayers = this.state.mpPlayers;
            playersArray.forEach((p) => {
                const prev = prevPlayers.find((prevP) => prevP.id === p.id);
                if (p.leftRace && (!prev || !prev.leftRace) && p.id !== this.state.mpRoom!.playerId) {
                    this.showToast(`${p.displayName} has left the race`);
                }
            });

            // Transition lobby state to completed if status shifts to finished
            if (roomState.status === "finished" && this.state.mpLobbyState !== "completed") {
                this.setState({
                    mpLobbyState: "completed"
                });
            }

            // If a room is reset back to waiting, take players back to lobby if they are in completed
            let nextLobbyState = this.state.mpLobbyState;
            if (roomState.status === "waiting" && this.state.mpLobbyState === "completed") {
                nextLobbyState = "lobby";
            }

            const isCurrentUserHost = roomState.hostId === this.state.mpRoom!.playerId;

            this.setState({
                mpPlayers: playersArray,
                mpRoomState: roomState,
                mpStarted: roomState.status === "running",
                mpRole: isCurrentUserHost ? "host" : "guest",
                mpLobbyState: nextLobbyState,
                snippetText: roomState.snippetText,
                snippetAuthor: roomState.snippetAuthor || "",
                config: roomState.config || this.state.config
            });
        });
    }

    private onStartMultiplayerRace() {
        if (this.state.mpRoom && this.state.mpRole === "host") {
            this.state.mpRoom.startCountdown();
        }
    }

    private onMultiplayerProgressUpdate(progress: number, wpm: number, accuracy: number) {
        if (this.state.mpRoom) {
            this.state.mpRoom.updateProgress(progress, wpm, accuracy, false);
        }
    }

    public onLiveUIFinish(keystrokeLogs: IKeystrokeLog[], finalSnippet?: string, wpm?: number, accuracy?: number) {
        if (this.state.state === "multiplayer" && this.state.mpRoom) {
            const finalWpm = wpm !== undefined ? wpm : 0;
            const finalAccuracy = accuracy !== undefined ? accuracy : 100;
            
            if (this.state.mpRoomState && this.state.mpRoomState.status === "running") {
                this.state.mpRoom.finishRace(finalWpm, finalAccuracy);
            }

            this.setState({
                mpLobbyState: "completed",
                keystrokeLogs: keystrokeLogs,
                snippetText: finalSnippet || this.state.snippetText
            });
        } else {
            this.setState({
                state: "completed",
                keystrokeLogs: keystrokeLogs,
                snippetText: finalSnippet || this.state.snippetText
            });
        }
    }

    private async handlePlayAgain() {
        if (this.state.mpRoom) {
            if (this.state.mpRole === "host") {
                const { text: newSnippet, author: newAuthor } = await this.generateSnippet(this.state.config);
                await this.state.mpRoom.resetRoom(newSnippet, newAuthor || "", this.state.config);
            }
            this.setState({
                mpLobbyState: "lobby",
                keystrokeLogs: undefined
            });
        }
    }

    public async onRestart() {
        this.stopPingLoop();
        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }

        let nextSnippet = "";
        let nextAuthor = "";
        let isCustomSetup = false;

        if (this.state.config.mode === "custom") {
            if (this.state.config.customText) {
                const res = await this.generateSnippet(this.state.config);
                nextSnippet = res.text;
                nextAuthor = res.author || "";
                isCustomSetup = false;
            } else {
                isCustomSetup = true;
            }
        } else {
            const res = await this.generateSnippet(this.state.config);
            nextSnippet = res.text;
            nextAuthor = res.author || "";
        }

        if (!this._isMounted) return;

        this.setState({
            state: "live",
            keystrokeLogs: undefined,
            snippetText: nextSnippet,
            snippetAuthor: nextAuthor,
            isCustomSetup: isCustomSetup,
            mpRoom: null,
            mpPlayers: [],
            mpRoomState: null,
            mpStarted: false,
            mpRole: null,
            mpLobbyState: "name_entry",
            mpNameInput: "",
            mpRoomCodeInput: "",
            mpError: "",
            mpLoading: false,
            toastMessage: null,
            isTyping: false
        });
    }

    public async onConfigChange(newConfig: TestConfig) {
        const isCustomSetup = newConfig.mode === "custom" && newConfig.customText === "";
        let nextSnippet = this.state.snippetText;
        let nextAuthor = this.state.snippetAuthor || "";

        if (newConfig.quoteCategory) {
            localStorage.setItem("keyflow_quote_category", newConfig.quoteCategory);
        }

        if (!isCustomSetup) {
            const res = await this.generateSnippet(newConfig);
            nextSnippet = res.text;
            nextAuthor = res.author || "";
        }

        if (!this._isMounted) return;

        this.setState({
            config: newConfig,
            isCustomSetup: isCustomSetup,
            snippetText: nextSnippet,
            snippetAuthor: nextAuthor,
            state: "live",
            keystrokeLogs: undefined
        });
    }

    private async generateSnippet(config: TestConfig): Promise<{ text: string; author?: string }> {
        if (config.mode === "quote") {
            const category = config.quoteCategory || "random";
            try {
                const quote = await QuoteService.getInstance().getRandomQuote(category);
                return { text: quote.text, author: QuoteService.getInstance().formatAuthor(quote) };
            } catch (e) {
                console.error("Failed to load quote", e);
                return { text: new SnippetGenerator().getRandomSnippet(), author: "Original" };
            }
        } else if (config.mode === "words") {
            return { text: this.generateWordsSnippet(config.wordsOption), author: "" };
        } else if (config.mode === "time") {
            return { text: this.generateWordsSnippet(250), author: "" };
        } else if (config.mode === "custom") {
            return { text: config.customText.replace(/\s+/gm, " ").toLowerCase().trim(), author: "" };
        }
        return { text: "", author: "" };
    }

    private generateWordsSnippet(count: number): string {
        const selectedWords: string[] = [];
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * words.length);
            selectedWords.push(words[randomIndex]);
        }
        return selectedWords.join(" ").toLowerCase();
    }

    private handleCustomSetupSubmit = () => {
        if (this.customTextareaRef.current) {
            const val = this.customTextareaRef.current.value.trim();
            if (val) {
                this.onConfigChange({
                    ...this.state.config,
                    customText: val
                });
            } else {
                this.showToast("Please enter some text to start the test!");
            }
        }
    };

    public isLive() {
        return this.state.state === "live";
    }

    public render() {
        let mainUI: JSX.Element;

        if (this.state.state === "multiplayer") {
            if (this.state.mpLobbyState === "name_entry") {
                mainUI = (
                    <div className="custom-setup-container">
                        <h2 className="custom-setup-title">
                            {this.state.mpRole === "host" ? "Create Multiplayer Race" : "Join Multiplayer Race"}
                        </h2>
                        <p className="custom-setup-subtitle">
                            {this.state.mpRole === "host" 
                                ? "Enter your display name to start a new typing room."
                                : "Enter the room code and your display name to join the race."}
                        </p>
                        
                        {this.state.mpRole === "guest" && (
                            <div className="mp-input-group" style={{ marginBottom: "16px" }}>
                                <label className="mp-input-label" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Room Code</label>
                                <input
                                    type="text"
                                    className="custom-setup-textarea mp-text-input"
                                    style={{ height: "45px", padding: "10px 16px", textTransform: "uppercase" }}
                                    placeholder="e.g. AB12XY"
                                    value={this.state.mpRoomCodeInput}
                                    onChange={(e) => this.setState({ mpRoomCodeInput: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="mp-input-group" style={{ marginBottom: "16px" }}>
                            <label className="mp-input-label" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Display Name</label>
                            <input
                                type="text"
                                className="custom-setup-textarea mp-text-input"
                                style={{ height: "45px", padding: "10px 16px" }}
                                placeholder="Enter your name..."
                                value={this.state.mpNameInput}
                                onChange={(e) => this.setState({ mpNameInput: e.target.value })}
                                maxLength={15}
                            />
                        </div>

                        {this.state.mpError && (
                            <div className="mp-error-message" style={{ color: "var(--color-error)", fontSize: "13px", marginTop: "8px", marginBottom: "8px" }}>
                                {this.state.mpError}
                            </div>
                        )}

                        <div className="custom-setup-actions" style={{ gap: "12px" }}>
                            <button 
                                className="custom-setup-btn cancel-btn" 
                                style={{ backgroundColor: "var(--text-secondary)" }}
                                onClick={() => {
                                    if (this.state.mpRoom) {
                                        this.state.mpRoom.disconnect();
                                    }
                                    window.history.replaceState({}, document.title, window.location.pathname);
                                    this.resetToHome();
                                }}
                                disabled={this.state.mpLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                className="custom-setup-btn" 
                                onClick={() => {
                                    if (this.state.mpRole === "host") {
                                        this.handleCreateRace(this.state.mpNameInput);
                                    } else {
                                        this.handleJoinRace(this.state.mpRoomCodeInput, this.state.mpNameInput);
                                    }
                                }}
                                disabled={this.state.mpLoading}
                            >
                                {this.state.mpLoading ? "Loading..." : (this.state.mpRole === "host" ? "Create" : "Join")}
                            </button>
                        </div>
                    </div>
                );
            } else if (this.state.mpLobbyState === "lobby") {
                mainUI = (
                    <LiveUI
                        snippetText={this.state.snippetText}
                        snippetAuthor={this.state.snippetAuthor}
                        config={this.state.config}
                        onConfigChange={this.onConfigChange}
                        onFinish={this.onLiveUIFinish}
                        multiplayerRoomCode={this.state.mpRoom ? this.state.mpRoom.roomCode : undefined}
                        multiplayerStarted={this.state.mpStarted}
                        isHost={this.state.mpRole === "host"}
                        onStart={this.onStartMultiplayerRace}
                        onProgressUpdate={this.onMultiplayerProgressUpdate}
                        mpPlayers={this.state.mpPlayers}
                        mpRoomState={this.state.mpRoomState}
                        currentPlayerId={this.state.mpRoom ? this.state.mpRoom.playerId : ""}
                        onToggleReady={(ready) => this.state.mpRoom?.toggleReady(ready)}
                        onStartTyping={() => this.setState({ isTyping: true })}
                    />
                );
            } else {
                mainUI = (
                    <CompletedUI
                        snippetText={this.state.snippetText}
                        snippetAuthor={this.state.snippetAuthor}
                        keystrokes={this.state.keystrokeLogs || []}
                        onRestart={this.onRestart}
                        multiplayerPlayersList={this.state.mpPlayers}
                        mpRoomState={this.state.mpRoomState}
                        currentPlayerId={this.state.mpRoom ? this.state.mpRoom.playerId : ""}
                        isHost={this.state.mpRole === "host"}
                        onPlayAgain={this.handlePlayAgain}
                    />
                );
            }
        } else if (this.state.isCustomSetup) {
            mainUI = (
                <div className="custom-setup-container">
                    <h2 className="custom-setup-title">Custom Text Setup</h2>
                    <p className="custom-setup-subtitle">Paste or type your text below to start a custom typing test.</p>
                    <textarea
                        className="custom-setup-textarea"
                        placeholder="Type or paste your text here..."
                        ref={this.customTextareaRef}
                        defaultValue={this.state.config.customText}
                    />
                    <div className="custom-setup-actions">
                        <button className="custom-setup-btn" onClick={this.handleCustomSetupSubmit}>
                            Start Test
                        </button>
                    </div>
                </div>
            );
        } else if (this.isLive()) {
            mainUI = (
                <LiveUI
                    snippetText={this.state.snippetText}
                    snippetAuthor={this.state.snippetAuthor}
                    config={this.state.config}
                    onConfigChange={this.onConfigChange}
                    onFinish={this.onLiveUIFinish}
                    onCreateRace={() => this.setState({ state: "multiplayer", mpLobbyState: "name_entry", mpRole: "host", mpError: "", mpNameInput: "", mpRoomCodeInput: "" })}
                    onJoinRace={() => this.setState({ state: "multiplayer", mpLobbyState: "name_entry", mpRole: "guest", mpError: "", mpNameInput: "", mpRoomCodeInput: "" })}
                    onStartTyping={() => this.setState({ isTyping: true })}
                />
            );
        } else {
            mainUI = (
                <CompletedUI
                    snippetText={this.state.snippetText}
                    snippetAuthor={this.state.snippetAuthor}
                    keystrokes={this.state.keystrokeLogs!}
                    onRestart={this.onRestart}
                />
            );
        }

        const showMpFooter = this.state.state === "multiplayer" && 
                             this.state.mpLobbyState === "lobby" && 
                             this.state.mpRoom !== null &&
                             this.state.mpRoomState?.status === "running";

        const showBackButton = (this.state.state === "live" && (this.state.isTyping || (this.state.config.mode === "custom" && !this.state.isCustomSetup))) ||
                               (this.state.state === "multiplayer" && this.state.mpLobbyState === "lobby");

        return (
            <div className="app-container">
                <input
                    type="hidden"
                    value={this.state.snippetText}
                    id="raw-snippet"
                />

                {showBackButton && (
                    <div className="back-button-container">
                        <button className="back-btn" onClick={this.handleBackClick}>
                            <span className="back-btn-icon">←</span>
                            <span className="back-btn-text">back</span>
                        </button>
                    </div>
                )}

                {mainUI}

                {showMpFooter && (
                    <MultiplayerFooter
                        players={this.state.mpPlayers}
                        currentPlayerId={this.state.mpRoom!.playerId}
                        rankings={this.state.mpRoomState?.rankings || []}
                    />
                )}

                <footer className="app-footer">
                    Built by Devrajsinh Solanki
                </footer>

                {this.state.toastMessage && (
                    <Toast 
                        message={this.state.toastMessage} 
                        onClose={() => this.setState({ toastMessage: null })} 
                    />
                )}
            </div>
        );
    }
}

export default App;
