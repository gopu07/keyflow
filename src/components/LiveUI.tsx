import * as React from 'react';

import LiveSnippetBox from './LiveSnippetBox';
import HiddenTextInput from './HiddenTextInput';
import ProgressIndicator from './ProgressIndicator';
import { KeystrokeRecorder } from '../lib/KeystrokeRecorder';
import LiveSnippetAnalyzer from '../lib/LiveSnippetAnalyzer';
import { HostWaitingModal } from './HostWaitingModal';

import { IKeystrokeLog } from '../lib/KeystrokeRecorder';
import { TestConfig, TestMode, TimeOption, WordsOption } from '../lib/TestConfig';
import { QuoteService } from '../lib/QuoteService';

interface ILiveUIProps {
    snippetText: string;
    snippetAuthor?: string;
    config: TestConfig;
    onConfigChange: (config: TestConfig) => void;
    onFinish: (keystrokes: IKeystrokeLog[], finalSnippet?: string) => void;
    multiplayerRoomCode?: string;
    multiplayerStarted?: boolean;
    isHost?: boolean;
    onStart?: () => void;
    onProgressUpdate?: (progress: number, wpm: number, accuracy: number) => void;
    onCreateRace?: () => void;
    onJoinRace?: () => void;
    mpPlayersCount?: number;
    onStartTyping?: () => void;
}

interface ILiveUIState {
    typedText: string;
    elapsedSeconds: number;
    startTime: Date | null;
    isTouchDevice: boolean;
}

class LiveUI extends React.Component<ILiveUIProps, ILiveUIState> {
    keystrokeRecorder: KeystrokeRecorder;
    private timerInterval: any = null;
    private textareaRef = React.createRef<HTMLTextAreaElement>();

    constructor(props: ILiveUIProps) {
        super(props);
        this.state = {
            typedText: "",
            elapsedSeconds: 0,
            startTime: null,
            isTouchDevice: false
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

    public componentDidUpdate(prevProps: ILiveUIProps) {
        if (this.props.multiplayerRoomCode && this.props.multiplayerStarted && !prevProps.multiplayerStarted) {
            if (this.state.startTime === null) {
                this.startTimer();
            }
        }
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
        this.props.onFinish(this.keystrokeRecorder.getKeystrokes(), truncatedSnippet);
    }

    public liveSnippetAnalyzer(): LiveSnippetAnalyzer {
        return new LiveSnippetAnalyzer(
            this.props.snippetText,
            this.state.typedText
        );
    }

    public onTypedTextChange(newText: string) {
        this.setState({typedText: newText}, () => {
            this.checkFinish();
            if (this.props.onProgressUpdate) {
                this.props.onProgressUpdate(
                    this.percentageCompleted(),
                    this.getWPM(),
                    this.getAccuracy()
                );
            }
        });
    }

    public checkFinish() {
        if (this.liveSnippetAnalyzer().isFinished()) {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.props.onFinish(this.keystrokeRecorder.getKeystrokes());
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
            this.startTimer();
            if (this.props.onStartTyping) {
                this.props.onStartTyping();
            }
        }
        this.keystrokeRecorder.recordCharacter(character);
    }

    public onBackspaceKeypress() {
        if (this.state.startTime === null) {
            this.startTimer();
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
        if (!this.state.startTime || this.state.elapsedSeconds === 0) {
            return 0;
        }
        const elapsedMinutes = this.state.elapsedSeconds / 60;
        const firstMistakeIndex = this.liveSnippetAnalyzer().firstMistakeIndex();
        const correctCharsCount = firstMistakeIndex !== null ? firstMistakeIndex : this.state.typedText.length;
        return Math.round((correctCharsCount / 5) / elapsedMinutes);
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

    public formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
        const secsStr = secs < 10 ? `0${secs}` : `${secs}`;
        return `${minsStr}:${secsStr}`;
    }

    public render() {
        const wpm = this.getWPM();
        const accuracy = this.getAccuracy();
        const { config } = this.props;
        const isTyping = this.state.startTime !== null;

        let timeString: string;
        if (config.mode === 'time') {
            const remaining = Math.max(0, config.timeOption - this.state.elapsedSeconds);
            timeString = this.formatTime(remaining);
        } else {
            timeString = this.formatTime(this.state.elapsedSeconds);
        }

        const isDisabled = !!this.props.multiplayerRoomCode && !this.props.isHost && !this.props.multiplayerStarted;

        return (
            <div className="live-ui-container" onClick={this.handleContainerClick}>
                {!isTyping && !this.props.multiplayerRoomCode && (
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

                {this.props.multiplayerRoomCode && !this.props.isHost && (
                    <div className="multiplayer-room-info">
                        Room: <span className="room-code-tag">{this.props.multiplayerRoomCode}</span>
                    </div>
                )}

                {this.props.multiplayerRoomCode && this.props.isHost && !this.props.multiplayerStarted && (
                    <HostWaitingModal 
                        roomCode={this.props.multiplayerRoomCode}
                        playersCount={this.props.mpPlayersCount || 1}
                        onStart={() => this.props.onStart && this.props.onStart()}
                    />
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

                {isDisabled && (
                    <div className="multiplayer-waiting-overlay">
                        <span className="waiting-spinner-pulse">●</span> Waiting for host to start the race...
                    </div>
                )}

                <LiveSnippetBox
                    actualText={this.props.snippetText}
                    typedText={this.state.typedText} />
                {this.props.snippetAuthor && this.props.snippetAuthor.trim() !== "" && (
                    <div className="snippet-author">
                        — {this.props.snippetAuthor.trim()}
                    </div>
                )}
                <ProgressIndicator percentage={this.percentageCompleted()} />

                {!isTyping && !this.props.multiplayerRoomCode && (
                    <div className="multiplayer-home-links" style={{ display: "flex", gap: "24px", justifyContent: "center", marginTop: "24px" }}>
                        <span className="analytics-toggle-link" onClick={(e) => { e.preventDefault(); this.props.onCreateRace && this.props.onCreateRace(); }}>create race</span>
                        <span className="analytics-toggle-link" onClick={(e) => { e.preventDefault(); this.props.onJoinRace && this.props.onJoinRace(); }}>join race</span>
                    </div>
                )}
            </div>
        );
    }
}

export default LiveUI;
