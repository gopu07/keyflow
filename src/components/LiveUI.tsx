import * as React from 'react';

import LiveSnippetBox from './LiveSnippetBox';
import HiddenTextInput from './HiddenTextInput';
import ProgressIndicator from './ProgressIndicator';
import { KeystrokeRecorder } from '../lib/KeystrokeRecorder';
import LiveSnippetAnalyzer from '../lib/LiveSnippetAnalyzer';
import { PlayerData, RoomState, sortPlayers } from '../lib/MultiplayerRoom';
import { getSyncedTime } from '../firebase';

import { IKeystrokeLog } from '../lib/KeystrokeRecorder';
import { TestConfig, TestMode, TimeOption, WordsOption } from '../lib/TestConfig';
import { QuoteService } from '../lib/QuoteService';

interface ILiveUIProps {
    snippetText: string;
    snippetAuthor?: string;
    config: TestConfig;
    onConfigChange: (config: TestConfig) => void;
    onFinish: (
        keystrokes: IKeystrokeLog[],
        finalSnippet?: string,
        wpm?: number,
        accuracy?: number,
        mistakes?: number,
        elapsedSeconds?: number
    ) => void;
    multiplayerRoomCode?: string;
    multiplayerStarted?: boolean;
    isHost?: boolean;
    onStart?: () => void;
    onProgressUpdate?: (progress: number, wpm: number, accuracy: number, errors: number) => void;
    onCreateRace?: () => void;
    onJoinRace?: () => void;
    mpPlayers?: PlayerData[];
    mpRoomState?: RoomState | null;
    currentPlayerId?: string;
    onToggleReady?: (ready: boolean) => void;
    onStartTyping?: () => void;
    previousRunKeystrokes?: IKeystrokeLog[];
    onRestartSameSnippet?: (keystrokes: IKeystrokeLog[]) => void;
}

interface ILiveUIState {
    typedText: string;
    elapsedSeconds: number;
    startTime: Date | null;
    isTouchDevice: boolean;
    copiedInviteLink: boolean;
    ghostCursorPos?: number;
}

class LiveUI extends React.Component<ILiveUIProps, ILiveUIState> {
    keystrokeRecorder: KeystrokeRecorder;
    private timerInterval: any = null;
    private textareaRef = React.createRef<HTMLTextAreaElement>();
    private ghostAnimFrameId: any = null;
    private ghostTimeline: { timeMs: number, cursorIndex: number }[] = [];

    constructor(props: ILiveUIProps) {
        super(props);
        this.state = {
            typedText: "",
            elapsedSeconds: 0,
            startTime: null,
            isTouchDevice: false,
            copiedInviteLink: false,
            ghostCursorPos: undefined
        };
        this.onTypedTextChange = this.onTypedTextChange.bind(this);
        this.handleCategorySelect = this.handleCategorySelect.bind(this);

        this.keystrokeRecorder = new KeystrokeRecorder();
        this.onCharacterKeypress = this.onCharacterKeypress.bind(this);
        this.onBackspaceKeypress = this.onBackspaceKeypress.bind(this);
    }

    private handleCategorySelect(category: string) {
        this.props.onConfigChange({
            ...this.props.config,
            quoteCategory: category
        });
    }

    public componentDidMount() {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.setState({ isTouchDevice: isTouch });
    }

    public componentDidUpdate(prevProps: ILiveUIProps, prevState: ILiveUIState) {
        // Single player timer start
        if (!this.props.multiplayerRoomCode && this.state.startTime !== null && this.timerInterval === null) {
            // Started typing
        }

        // Multiplayer auto finish on status transition
        if (this.props.multiplayerRoomCode && this.props.mpRoomState && this.props.mpRoomState.status === "finished" && (!prevProps.mpRoomState || prevProps.mpRoomState.status !== "finished")) {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            this.props.onFinish(
                this.keystrokeRecorder.getKeystrokes(),
                undefined,
                this.getWPM(),
                this.getAccuracy(),
                this.getMistakeCount(),
                this.state.elapsedSeconds
            );
        }

        // Multiplayer local timer start when status becomes "running"
        if (this.props.multiplayerRoomCode &&
            this.props.mpRoomState?.status === "running" &&
            this.props.mpRoomState?.raceStartTimestamp &&
            this.timerInterval === null) {
            this.startMultiplayerTimer(this.props.mpRoomState.raceStartTimestamp);
        }

        // Multiplayer local state reset when room is reset to "waiting"
        if (this.props.multiplayerRoomCode &&
            this.props.mpRoomState?.status === "waiting" &&
            prevProps.mpRoomState?.status !== "waiting") {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            if (this.ghostAnimFrameId) {
                cancelAnimationFrame(this.ghostAnimFrameId);
                this.ghostAnimFrameId = null;
            }
            this.setState({
                elapsedSeconds: 0,
                startTime: null,
                typedText: "",
                ghostCursorPos: undefined
            });
            this.keystrokeRecorder = new KeystrokeRecorder();
        }

        // Start ghost animation when startTime transitions from null to Date
        if (this.state.startTime !== null && prevState.startTime === null) {
            this.startGhostAnimation();
        }
    }

    public startMultiplayerTimer(raceStartTimestamp: number) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        const updateTimer = () => {
            const now = getSyncedTime();
            const elapsed = Math.floor((now - raceStartTimestamp) / 1000);

            const isMeFinished = this.props.mpPlayers?.find(p => p.id === this.props.currentPlayerId)?.finished;
            if (isMeFinished) {
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
                return;
            }

            this.setState({ elapsedSeconds: Math.max(0, elapsed) }, () => {
                if (this.props.onProgressUpdate && this.state.typedText.length > 0) {
                    this.props.onProgressUpdate(
                        this.percentageCompleted(),
                        this.getWPM(),
                        this.getAccuracy(),
                        this.getMistakeCount()
                    );
                }
            });
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 500);
    }

    private handleContainerClick = () => {
        if (this.state.isTouchDevice && this.textareaRef.current) {
            this.textareaRef.current.focus();
        }
    };

    private handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const oldValue = this.state.typedText;

        if (newValue.length > this.props.snippetText.length) {
            return;
        }

        const diff = newValue.length - oldValue.length;
        if (diff > 0) {
            for (let i = oldValue.length; i < newValue.length; i++) {
                this.onCharacterKeypress(newValue[i]);
            }
        } else if (diff < 0) {
            for (let i = 0; i < -diff; i++) {
                this.onBackspaceKeypress();
            }
        }
        this.onTypedTextChange(newValue);
    };

    public componentWillUnmount() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        if (this.ghostAnimFrameId) {
            cancelAnimationFrame(this.ghostAnimFrameId);
            this.ghostAnimFrameId = null;
        }
    }

    public startTimer() {
        this.setState({ startTime: new Date() });
        this.timerInterval = setInterval(() => {
            if (this.state.startTime) {
                const elapsed = Math.floor((new Date().getTime() - this.state.startTime.getTime()) / 1000);

                if (this.props.config.mode === 'time' && elapsed >= this.props.config.timeOption) {
                    this.setState({ elapsedSeconds: this.props.config.timeOption }, () => {
                        this.finishTimeModeTest();
                    });
                    return;
                }

                this.setState({ elapsedSeconds: elapsed });
            }
        }, 1000);
    }

    private finishTimeModeTest() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        const typedLength = this.state.typedText.length;
        const truncatedSnippet = this.props.snippetText.substring(0, typedLength);
        this.props.onFinish(
            this.keystrokeRecorder.getKeystrokes(),
            truncatedSnippet,
            this.getWPM(),
            this.getAccuracy(),
            this.getMistakeCount(),
            this.state.elapsedSeconds
        );
    }

    public liveSnippetAnalyzer(): LiveSnippetAnalyzer {
        return new LiveSnippetAnalyzer(
            this.props.snippetText,
            this.state.typedText,
            true
        );
    }

    public onTypedTextChange(newText: string) {
        this.setState({ typedText: newText }, () => {
            this.checkFinish();
            if (this.props.onProgressUpdate) {
                this.props.onProgressUpdate(
                    this.percentageCompleted(),
                    this.getWPM(),
                    this.getAccuracy(),
                    this.getMistakeCount()
                );
            }
        });
    }

    public checkFinish() {
        if (this.liveSnippetAnalyzer().isFinished()) {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.props.onFinish(
                this.keystrokeRecorder.getKeystrokes(),
                undefined,
                this.getWPM(),
                this.getAccuracy(),
                this.getMistakeCount(),
                this.state.elapsedSeconds
            );
        }
    }

    private handleModeSelect(mode: TestMode) {
        const customText = mode === 'custom' ? "" : this.props.config.customText;
        this.props.onConfigChange({
            ...this.props.config,
            mode,
            customText
        });
    }

    private handleTimeOptionSelect(option: TimeOption) {
        this.props.onConfigChange({
            ...this.props.config,
            timeOption: option
        });
    }

    private handleWordsOptionSelect(option: WordsOption) {
        this.props.onConfigChange({
            ...this.props.config,
            wordsOption: option
        });
    }



    public onCharacterKeypress(character: string) {
        if (this.state.startTime === null) {
            if (!this.props.multiplayerRoomCode) {
                this.startTimer();
            } else {
                this.setState({ startTime: new Date() });
            }
            if (this.props.onStartTyping) {
                this.props.onStartTyping();
            }
        }
        this.keystrokeRecorder.recordCharacter(character);
    }

    public onBackspaceKeypress() {
        if (this.state.startTime === null) {
            if (!this.props.multiplayerRoomCode) {
                this.startTimer();
            } else {
                this.setState({ startTime: new Date() });
            }
            if (this.props.onStartTyping) {
                this.props.onStartTyping();
            }
        }
        this.keystrokeRecorder.recordBackspace();
    }

    public percentageCompleted() {
        return this.liveSnippetAnalyzer().percentageCompleted();
    }

    public getWPM(): number {
        const elapsed = this.state.elapsedSeconds;

        if (elapsed <= 0) {
            return 0;
        }
        const elapsedMinutes = elapsed / 60;
        const typedLength = this.state.typedText.length;
        return Math.round((typedLength / 5) / elapsedMinutes);
    }

    public getAccuracy(): number {
        const logs = this.keystrokeRecorder.getKeystrokes();
        const charKeystrokes = logs.filter(log => log.key.type === "character").length;
        if (charKeystrokes === 0) {
            return 100;
        }

        let correctCount = 0;
        const actualChars = this.props.snippetText.split('');
        const typedChars = this.state.typedText.split('');
        for (let i = 0; i < typedChars.length; i++) {
            if (typedChars[i].toLowerCase() === actualChars[i].toLowerCase()) {
                correctCount++;
            }
        }

        return Math.min(100, Math.round((correctCount / charKeystrokes) * 100));
    }

    public getMistakeCount(): number {
        const logs = this.keystrokeRecorder.getKeystrokes();
        let mistakes = 0;
        let currentCursor = 0;
        for (let log of logs) {
            if (log.key.type === "character") {
                if (currentCursor < this.props.snippetText.length) {
                    let expectedChar = this.props.snippetText[currentCursor];
                    if (log.key.character.toLowerCase() !== expectedChar.toLowerCase()) {
                        mistakes++;
                    }
                    currentCursor++;
                }
            } else if (log.key.type === "backspace") {
                if (currentCursor > 0) {
                    currentCursor--;
                }
            }
        }
        return mistakes;
    }

    private initGhostTimeline() {
        if (!this.props.previousRunKeystrokes || this.props.previousRunKeystrokes.length === 0) {
            this.ghostTimeline = [];
            return;
        }

        const firstLogTime = new Date(this.props.previousRunKeystrokes[0].timestamp).getTime();
        const timeline: { timeMs: number, cursorIndex: number }[] = [];
        let currentCursor = 0;

        timeline.push({ timeMs: 0, cursorIndex: 0 });

        for (const log of this.props.previousRunKeystrokes) {
            const relativeTime = new Date(log.timestamp).getTime() - firstLogTime;
            if (log.key.type === "character") {
                currentCursor++;
            } else if (log.key.type === "backspace") {
                currentCursor = Math.max(0, currentCursor - 1);
            }
            timeline.push({ timeMs: relativeTime, cursorIndex: currentCursor });
        }

        this.ghostTimeline = timeline;
    }

    private startGhostAnimation() {
        if (this.ghostAnimFrameId) {
            cancelAnimationFrame(this.ghostAnimFrameId);
        }

        this.initGhostTimeline();
        if (this.ghostTimeline.length === 0) return;

        const updateGhost = () => {
            if (!this.state.startTime) {
                this.ghostAnimFrameId = requestAnimationFrame(updateGhost);
                return;
            }

            const elapsedMs = Date.now() - this.state.startTime.getTime();

            // Binary search to find the correct cursor position at elapsedMs
            let low = 0;
            let high = this.ghostTimeline.length - 1;
            let bestIndex = 0;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                if (this.ghostTimeline[mid].timeMs <= elapsedMs) {
                    bestIndex = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            const ghostCursorPos = this.ghostTimeline[bestIndex].cursorIndex;
            this.setState({ ghostCursorPos });

            this.ghostAnimFrameId = requestAnimationFrame(updateGhost);
        };

        this.ghostAnimFrameId = requestAnimationFrame(updateGhost);
    }

    public formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
        const secsStr = secs < 10 ? `0${secs}` : `${secs}`;
        return `${minsStr}:${secsStr}`;
    }

    public getSortedPlayers(): PlayerData[] {
        return sortPlayers(this.props.mpPlayers || [], this.props.mpRoomState?.rankings || []);
    }

    public getRank(): number {
        if (!this.props.multiplayerRoomCode || !this.props.mpPlayers) {
            return 1;
        }

        const sorted = this.getSortedPlayers();
        const rank = sorted.findIndex(p => p.id === this.props.currentPlayerId) + 1;
        return rank > 0 ? rank : 1;
    }

    public formatRank(rank: number): string {
        if (rank === 1) return "1st";
        if (rank === 2) return "2nd";
        if (rank === 3) return "3rd";
        return `${rank}th`;
    }

    public render() {
        const wpm = this.getWPM();
        const accuracy = this.getAccuracy();
        const { config } = this.props;

        const isCountdown = this.props.mpRoomState?.status === "countdown";
        const isWaiting = this.props.mpRoomState?.status === "waiting";
        const isFinished = this.props.mpRoomState?.status === "finished";
        const isDisabled = !!this.props.multiplayerRoomCode && (isCountdown || isWaiting || isFinished);

        let timeString: string;
        if (this.props.multiplayerRoomCode) {
            timeString = this.formatTime(this.props.mpRoomState?.elapsedSeconds || 0);
        } else if (config.mode === 'time') {
            const remaining = Math.max(0, config.timeOption - this.state.elapsedSeconds);
            timeString = this.formatTime(remaining);
        } else {
            timeString = this.formatTime(this.state.elapsedSeconds);
        }

        // Render Lobby if room is waiting
        if (this.props.multiplayerRoomCode && isWaiting && this.props.mpRoomState) {
            const players = this.props.mpPlayers || [];
            const me = players.find(p => p.id === this.props.currentPlayerId);
            const isReady = me?.ready || false;

            const joinLink = `${window.location.origin}${window.location.pathname}?room=${this.props.multiplayerRoomCode}`;

            // Start button conditions: >=2 players and all guest players are ready
            const guests = players.filter(p => p.id !== this.props.mpRoomState?.hostId);
            const allGuestsReady = guests.length > 0 && guests.every(p => p.ready);
            const canStart = players.length >= 2 && allGuestsReady;

            const copied = this.state.copiedInviteLink;
            const handleCopy = async () => {
                try {
                    await navigator.clipboard.writeText(joinLink);
                    this.setState({ copiedInviteLink: true });
                    setTimeout(() => this.setState({ copiedInviteLink: false }), 2000);
                } catch (e) {
                    console.error(e);
                }
            };

            return (
                <div className="mp-lobby-container">
                    <div className="mp-lobby-header">
                        <div className="lobby-title-section">
                            <span className="lobby-room-label">ROOM CODE</span>
                            <h2 className="lobby-room-code">{this.props.multiplayerRoomCode}</h2>
                        </div>
                        <button className="copy-link-btn" onClick={handleCopy}>
                            {copied ? "✓ Link Copied" : "Copy Invite Link"}
                        </button>
                    </div>

                    <div className="mp-lobby-players-grid">
                        {players.map((player) => {
                            const isHostPlayer = player.id === this.props.mpRoomState?.hostId;
                            return (
                                <div key={player.id} className="mp-lobby-player-card">
                                    <div className="mp-player-avatar">
                                        {player.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="mp-player-details">
                                        <div className="mp-player-name-row">
                                            <span className="mp-player-name">{player.displayName}</span>
                                            {isHostPlayer && <span className="mp-badge-host">Host</span>}
                                        </div>
                                        <div className="mp-player-meta">
                                            <span className={`mp-ready-status ${player.ready ? 'ready' : 'not-ready'}`}>
                                                {player.ready ? "Ready" : "Waiting"}
                                            </span>
                                            {player.ping !== undefined && (
                                                <span className="mp-player-ping">⚡ {player.ping}ms</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mp-lobby-actions">
                        {!this.props.isHost ? (
                            <button
                                className={`lobby-action-btn ${isReady ? 'cancel-btn' : 'ready-btn'}`}
                                onClick={() => this.props.onToggleReady && this.props.onToggleReady(!isReady)}
                            >
                                {isReady ? "Cancel Ready" : "I'm Ready"}
                            </button>
                        ) : (
                            <button
                                className="lobby-action-btn start-btn"
                                onClick={() => this.props.onStart && this.props.onStart()}
                                disabled={!canStart}
                            >
                                {players.length < 2
                                    ? "Waiting for players to join..."
                                    : !allGuestsReady
                                        ? "Waiting for players to get ready..."
                                        : "Start Race"}
                            </button>
                        )}

                        {!this.props.isHost && isReady && (
                            <div className="waiting-host-msg">
                                <span className="waiting-spinner-pulse">●</span> Waiting for host to start...
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="live-ui-container" onClick={this.handleContainerClick}>
                {/* Countdown Overlay */}
                {this.props.multiplayerRoomCode && isCountdown && this.props.mpRoomState && (
                    <div className="countdown-overlay">
                        <div className="countdown-number">
                            {(this.props.mpRoomState.countdown === 0) ? "GO!" : this.props.mpRoomState.countdown}
                        </div>
                    </div>
                )}

                {!this.state.startTime && !this.props.multiplayerRoomCode && (
                    <div className="test-config-selector">
                        <div className="mode-selector">
                            <span className={config.mode === 'quote' ? 'active' : ''} onClick={() => this.handleModeSelect('quote')}>quote</span>
                            <span className={config.mode === 'time' ? 'active' : ''} onClick={() => this.handleModeSelect('time')}>time</span>
                            <span className={config.mode === 'words' ? 'active' : ''} onClick={() => this.handleModeSelect('words')}>words</span>
                            <span className={config.mode === 'custom' ? 'active' : ''} onClick={() => this.handleModeSelect('custom')}>custom</span>
                        </div>

                        {(config.mode === 'time' || config.mode === 'words' || config.mode === 'quote') && <div className="divider" />}
                        {config.mode === 'time' && (
                            <div className="option-selector">
                                <span className={config.timeOption === 15 ? 'active' : ''} onClick={() => this.handleTimeOptionSelect(15)}>15</span>
                                <span className={config.timeOption === 30 ? 'active' : ''} onClick={() => this.handleTimeOptionSelect(30)}>30</span>
                                <span className={config.timeOption === 60 ? 'active' : ''} onClick={() => this.handleTimeOptionSelect(60)}>60</span>
                            </div>
                        )}
                        {config.mode === 'words' && (
                            <div className="option-selector">
                                <span className={config.wordsOption === 25 ? 'active' : ''} onClick={() => this.handleWordsOptionSelect(25)}>25</span>
                                <span className={config.wordsOption === 50 ? 'active' : ''} onClick={() => this.handleWordsOptionSelect(50)}>50</span>
                                <span className={config.wordsOption === 100 ? 'active' : ''} onClick={() => this.handleWordsOptionSelect(100)}>100</span>
                            </div>
                        )}
                        {config.mode === 'quote' && (
                            <div className="option-selector theme-selector" style={{ flexWrap: "wrap", rowGap: "8px", maxWidth: "80%" }}>
                                {QuoteService.getInstance().getCategories().map(cat => (
                                    <span
                                        key={cat}
                                        className={config.quoteCategory === cat ? 'active' : ''}
                                        onClick={() => this.handleCategorySelect(cat)}
                                        style={{ textTransform: "lowercase" }}
                                    >
                                        {cat}
                                    </span>
                                ))}
                                <span
                                    className={(config.quoteCategory === 'random' || !config.quoteCategory) ? 'active' : ''}
                                    onClick={() => this.handleCategorySelect('random')}
                                >
                                    random
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {this.props.multiplayerRoomCode && (
                    <div className="multiplayer-room-info" style={{ marginBottom: "16px" }}>
                        Room: <span className="room-code-tag">{this.props.multiplayerRoomCode}</span>
                    </div>
                )}

                <div className="live-stats-header">
                    <div className="stat-item">
                        <span className="stat-value">{wpm}</span>
                        <span className="stat-label">WPM</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{accuracy}%</span>
                        <span className="stat-label">Accuracy</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{timeString}</span>
                        <span className="stat-label">Time</span>
                    </div>
                    {this.props.multiplayerRoomCode && (
                        <div className="stat-item">
                            <span className="stat-value">{this.formatRank(this.getRank())}</span>
                            <span className="stat-label">Rank</span>
                        </div>
                    )}
                </div>

                {this.state.isTouchDevice ? (
                    <textarea
                        ref={this.textareaRef}
                        className="hidden-mobile-textarea"
                        value={this.state.typedText}
                        onChange={this.handleTextareaChange}
                        disabled={isDisabled}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                ) : (
                    <HiddenTextInput
                        maxLength={this.props.snippetText.length}
                        onChange={this.onTypedTextChange}
                        onCharacterKeypress={this.onCharacterKeypress}
                        onBackspaceKeypress={this.onBackspaceKeypress}
                        disabled={isDisabled}
                    />
                )}

                <LiveSnippetBox
                    actualText={this.props.snippetText}
                    typedText={this.state.typedText}
                    ghostCursorPos={this.state.ghostCursorPos}
                    lowercase={true} />
                {this.props.snippetAuthor && this.props.snippetAuthor.trim() !== "" && (
                    <div className="snippet-author" style={{ marginBottom: "20px" }}>
                        — {this.props.snippetAuthor.trim()}
                    </div>
                )}

                {/* Progress Indicators */}
                {!this.props.multiplayerRoomCode ? (
                    <ProgressIndicator percentage={this.percentageCompleted()} />
                ) : (
                    this.props.mpPlayers && (
                        <div className="mp-race-progress-container">
                            {this.getSortedPlayers().map((player) => {
                                const isCurrent = player.id === this.props.currentPlayerId;
                                return (
                                    <div key={player.id} className={`mp-player-progress-row ${isCurrent ? 'current-player' : ''}`}>
                                        <div className="mp-player-progress-info">
                                            <span className="mp-player-progress-name">
                                                {player.displayName} {isCurrent && "(You)"}
                                                {player.leftRace && (player.finished ? <span className="left-tag"> (offline)</span> : <span className="left-tag" style={{ color: "var(--color-error)" }}> (DNF)</span>)}
                                            </span>
                                            <span className="mp-player-progress-stats">
                                                {player.leftRace && !player.finished ? "DNF" : `${player.wpm} WPM | ${player.accuracy}% Acc`}
                                            </span>
                                        </div>
                                        <div className="mp-player-progress-bar-wrapper">
                                            <div className="mp-player-progress-bar">
                                                <div
                                                    className="mp-player-progress-bar-fill"
                                                    style={{ width: `${player.progress}%`, backgroundColor: player.leftRace ? "var(--text-muted)" : (isCurrent ? "var(--color-accent)" : "#3b82f6") }}
                                                />
                                            </div>
                                            <span className="mp-player-progress-percentage">{Math.round(player.progress)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}

                {!this.state.startTime && !this.props.multiplayerRoomCode && (
                    <div className="multiplayer-home-links" style={{ display: "flex", gap: "24px", justifyContent: "center", marginTop: "24px" }}>
                        <a href="#" role="button" className="analytics-toggle-link" onClick={(e) => { e.preventDefault(); this.props.onCreateRace && this.props.onCreateRace(); }}>create race</a>
                        <a href="#" role="button" className="analytics-toggle-link" onClick={(e) => { e.preventDefault(); this.props.onJoinRace && this.props.onJoinRace(); }}>join race</a>
                    </div>
                )}
            </div>
        );
    }
}

export default LiveUI;
