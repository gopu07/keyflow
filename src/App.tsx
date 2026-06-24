import * as React from "react";
import { Toast } from "./components/Toast";
import "./App.css";

import LiveUI from "./components/LiveUI";
import CompletedUI from "./components/CompletedUI";
import { IKeystrokeLog } from "./lib/KeystrokeRecorder";
import SnippetGenerator from "./lib/SnippetGenerator";
import { TestConfig } from "./lib/TestConfig";
import words from "../data/words.json";
import { MultiplayerRoom, PlayerData } from "./lib/MultiplayerRoom";
import MultiplayerFooter from "./components/MultiplayerFooter";
import { isFirebaseConfigured } from "./firebase";
import { QuoteService } from "./lib/QuoteService";

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
    mpStarted: boolean;
    mpRole: "host" | "guest" | null;
    mpLobbyState: "name_entry" | "lobby" | "completed";
    mpNameInput: string;
    mpRoomCodeInput: string;
    mpError: string;
    mpLoading: boolean;
    toastMessage: string | null;
    isTyping: boolean;
    showLeaveConfirmation: boolean;
}

class App extends React.Component<IAppProps, IAppState> {
    private customTextareaRef = React.createRef<HTMLTextAreaElement>();

    constructor(props: IAppProps) {
        super(props);
        const initialCategory = localStorage.getItem("typefast_quote_category") || "random";
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
            mpStarted: false,
            mpRole: null,
            mpLobbyState: "name_entry",
            mpNameInput: "",
            mpRoomCodeInput: "",
            mpError: "",
            mpLoading: false,
            toastMessage: null,
            isTyping: false,
            showLeaveConfirmation: false
        };
        this.onLiveUIFinish = this.onLiveUIFinish.bind(this);
        this.onRestart = this.onRestart.bind(this);
        this.onConfigChange = this.onConfigChange.bind(this);
        this.handleCreateRace = this.handleCreateRace.bind(this);
        this.handleJoinRace = this.handleJoinRace.bind(this);
        this.onStartMultiplayerRace = this.onStartMultiplayerRace.bind(this);
        this.onMultiplayerProgressUpdate = this.onMultiplayerProgressUpdate.bind(this);
        this.showToast = this.showToast.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBackClick = this.handleBackClick.bind(this);
        this.confirmLeave = this.confirmLeave.bind(this);
        this.cancelLeave = this.cancelLeave.bind(this);
    }

    private showToast(message: string) {
        this.setState({ toastMessage: message });
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            const isTypingSession = (this.state.state === "live" && this.state.isTyping) ||
                                     (this.state.state === "multiplayer" && this.state.mpLobbyState === "lobby" && this.state.mpStarted);
            if (isTypingSession) {
                this.setState({ showLeaveConfirmation: !this.state.showLeaveConfirmation });
            }
        }
    }

    private handleBackClick() {
        const isTypingSession = (this.state.state === "live" && this.state.isTyping) ||
                                 (this.state.state === "multiplayer" && this.state.mpLobbyState === "lobby" && this.state.mpStarted);
        if (isTypingSession) {
            this.setState({ showLeaveConfirmation: true });
        } else {
            this.confirmLeave();
        }
    }

    private async confirmLeave() {
        this.setState({ showLeaveConfirmation: false });
        if (this.state.mpRoom) {
            const isRaceActive = this.state.mpLobbyState === "lobby" && this.state.mpStarted;
            await this.state.mpRoom.leaveRoom(isRaceActive);
        }
        this.setState({
            isTyping: false,
            showLeaveConfirmation: false
        }, () => {
            this.onRestart();
        });
    }

    private cancelLeave() {
        this.setState({ showLeaveConfirmation: false });
    }

    public async componentDidMount() {
        window.addEventListener("keydown", this.handleKeyDown);
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
                this.setState({
                    snippetText: quote.text,
                    snippetAuthor: QuoteService.getInstance().formatAuthor(quote)
                });
            } catch (e) {
                console.error("Failed to load initial quote", e);
            }
        }
    }

    public componentWillUnmount() {
        window.removeEventListener("keydown", this.handleKeyDown);
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

        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }

        this.setState({ mpLoading: true, mpError: "" });

        try {
            const mpRoom = new MultiplayerRoom(undefined, true);
            const { text: snippet, author: snippetAuthor } = await this.generateSnippet(this.state.config);
            await mpRoom.create(displayName, snippet, snippetAuthor || "", this.state.config);

            console.log(`[Multiplayer] Created room ${mpRoom.roomCode}. Passage length: ${snippet.length}, Config mode: ${this.state.config.mode}`);

            // Remove alert here since we have HostWaitingModal now.
            // this.showToast(`Room code: ${mpRoom.roomCode} created!`);

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
                    finished: false
                }],
                mpStarted: false,
                mpError: "",
                mpLoading: false
            }, () => {
                this.listenToRoom();
            });
        } catch (err: any) {
            this.setState({ mpError: err.message || "Failed to create race", mpLoading: false });
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

        if (this.state.mpRoom) {
            this.state.mpRoom.disconnect();
        }

        this.setState({ mpLoading: true, mpError: "" });

        try {
            const mpRoom = new MultiplayerRoom(roomCode, false);
            const { snippetText, snippetAuthor, config } = await mpRoom.join(roomCode, displayName);

            console.log(`[Multiplayer] Joined room ${roomCode}. Loaded passage length: ${snippetText.length}, Config mode: ${config.mode}`);

            this.setState({
                state: "multiplayer",
                mpRoom,
                mpLobbyState: "lobby",
                mpRole: "guest",
                snippetText: snippetText,
                snippetAuthor: snippetAuthor || "",
                config: config,
                mpPlayers: [],
                mpStarted: false,
                mpError: "",
                mpLoading: false
            }, () => {
                this.listenToRoom();
            });
        } catch (err: any) {
            this.setState({ mpError: err.message || "Failed to join race", mpLoading: false });
        }
    }

    private listenToRoom() {
        if (!this.state.mpRoom) return;

        this.state.mpRoom.listen((roomState) => {
            if (!roomState) {
                this.setState({ mpError: "Room was deleted or is invalid" });
                return;
            }

            // FIX: When the last player leaves or if players is empty, Firebase completely omits the 'players' object.
            // Previously, Object.keys(undefined) would crash the app. This safely defaults to an empty object.
            const playersObj = roomState.players || {};
            const playersArray = Object.keys(playersObj).map(
                (key) => playersObj[key]
            );

            if (roomState.config) {
                console.log(`[Multiplayer] Received sync from Firebase. Passage length: ${roomState.snippetText.length}, Config mode: ${roomState.config.mode}`);
            }

            // Detect player left notifications
            const prevPlayers = this.state.mpPlayers;
            playersArray.forEach((p) => {
                const prev = prevPlayers.find((prevP) => prevP.id === p.id);
                // If they are marked as left now, and weren't marked as left before (and it is not the current player)
                if (p.leftRace && (!prev || !prev.leftRace) && p.id !== this.state.mpRoom!.playerId) {
                    this.showToast(`${p.displayName} has left the race`);
                }
            });

            this.setState({
                mpPlayers: playersArray,
                mpStarted: roomState.started,
                snippetText: roomState.snippetText,
                snippetAuthor: roomState.snippetAuthor || "",
                config: roomState.config || this.state.config
            });
        });
    }

    private onStartMultiplayerRace() {
        if (this.state.mpRoom && this.state.mpRole === "host") {
            this.state.mpRoom.startRace();
        }
    }

    private onMultiplayerProgressUpdate(progress: number, wpm: number, accuracy: number) {
        if (this.state.mpRoom) {
            this.state.mpRoom.updateProgress(progress, wpm, accuracy, false);
        }
    }

    public onLiveUIFinish(keystrokeLogs: IKeystrokeLog[], finalSnippet?: string) {
        if (this.state.state === "multiplayer" && this.state.mpRoom) {
            const me = this.state.mpPlayers.find(p => p.id === this.state.mpRoom!.playerId);
            const wpm = me ? me.wpm : 0;
            const accuracy = me ? me.accuracy : 100;
            this.state.mpRoom.updateProgress(100, wpm, accuracy, true);

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

    public async onRestart() {
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

        this.setState({
            state: "live",
            keystrokeLogs: undefined,
            snippetText: nextSnippet,
            snippetAuthor: nextAuthor,
            isCustomSetup: isCustomSetup,
            mpRoom: null,
            mpPlayers: [],
            mpStarted: false,
            mpRole: null,
            mpLobbyState: "name_entry",
            mpNameInput: "",
            mpRoomCodeInput: "",
            mpError: "",
            mpLoading: false,
            toastMessage: null,
            isTyping: false,
            showLeaveConfirmation: false
        });
    }

    public async onConfigChange(newConfig: TestConfig) {
        const isCustomSetup = newConfig.mode === "custom" && newConfig.customText === "";
        let nextSnippet = this.state.snippetText;
        let nextAuthor = this.state.snippetAuthor || "";

        if (newConfig.quoteCategory) {
            localStorage.setItem("typefast_quote_category", newConfig.quoteCategory);
        }

        if (!isCustomSetup) {
            const res = await this.generateSnippet(newConfig);
            nextSnippet = res.text;
            nextAuthor = res.author || "";
        }

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
                                    this.onRestart();
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
                        mpPlayersCount={this.state.mpPlayers.length}
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
                        multiplayerPlayersList={this.state.mpPlayers}
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
                             this.state.mpRoom !== null;

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

                {this.state.showLeaveConfirmation && (
                    <div className="modal-overlay" onClick={this.cancelLeave}>
                        <div className="modal-content confirmation-modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Leave this typing test?</h3>
                            <p className="modal-subtitle">Your current progress will be lost.</p>
                            <div className="modal-actions">
                                <button className="modal-btn secondary" onClick={this.cancelLeave}>Cancel</button>
                                <button className="modal-btn danger" onClick={this.confirmLeave}>Leave</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default App;
