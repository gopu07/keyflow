import * as React from 'react';
import './CompletedStats.css';

import { IKeystrokeLog } from '../lib/KeystrokeRecorder';
import CompletedSnippetAnalyzer from '../lib/CompletedSnippetAnalyzer';

interface IProps {
    snippetText: string;
    keystrokes: IKeystrokeLog[];
    isMultiplayer?: boolean;
    finalStats?: {
        wpm: number;
        accuracy: number;
        mistakes: number;
        elapsedSeconds: number;
    };
    onRestartSameSnippet?: () => void;
    lowercase?: boolean;
}

class CompletedStats extends React.Component<IProps, {}> {
    constructor(props: IProps) {
        super(props)
    }

    public completedSnippetAnalyzer() {
        return new CompletedSnippetAnalyzer(
            this.props.snippetText,
            this.props.keystrokes,
            this.props.lowercase
        )
    }

    public getAverageSpeed(): number {
        if (this.props.finalStats) {
            return this.props.finalStats.wpm;
        }
        return this.completedSnippetAnalyzer().averageSpeed()
    }

    public getMistakeCount(): number {
        if (this.props.finalStats) {
            return this.props.finalStats.mistakes;
        }
        return this.completedSnippetAnalyzer().mistakeCount()
    }

    public getAccuracy(): number {
        if (this.props.finalStats) {
            return this.props.finalStats.accuracy;
        }
        const logs = this.props.keystrokes;
        const charKeystrokes = logs.filter(log => log.key.type === "character").length;
        if (charKeystrokes === 0) {
            return 100;
        }
        return Math.min(100, Math.round((this.props.snippetText.length / charKeystrokes) * 100));
    }

    public getTimeString(): string {
        let durationSeconds = 0;
        if (this.props.finalStats) {
            durationSeconds = this.props.finalStats.elapsedSeconds;
        } else {
            const first = this.props.keystrokes[0];
            const last = this.props.keystrokes[this.props.keystrokes.length - 1];
            if (!first || !last) {
                return "00:00";
            }
            durationSeconds = Math.round((new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000);
        }
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
        const secsStr = secs < 10 ? `0${secs}` : `${secs}`;
        return `${minsStr}:${secsStr}`;
    }

    public render() {
        const accuracy = this.getAccuracy();
        const timeString = this.getTimeString();

        return (
            <div className="completed-stats-container">
                <h2 className="completed-stats-title">Test Results</h2>
                <div className="completed-stats-grid">
                    <div className="completed-stat-card">
                        <span className="stat-value">{this.getAverageSpeed()}</span>
                        <span className="stat-label">WPM</span>
                    </div>
                    <div className="completed-stat-card">
                        <span className="stat-value">{accuracy}%</span>
                        <span className="stat-label">Accuracy</span>
                    </div>
                    <div className="completed-stat-card">
                        <span className="stat-value">{timeString}</span>
                        <span className="stat-label">Time</span>
                    </div>
                    <div className="completed-stat-card">
                        <span className="stat-value">{this.getMistakeCount()}</span>
                        <span className="stat-label">Mistakes</span>
                    </div>
                </div>

                {!this.props.isMultiplayer && (
                    <div className="completed-actions">
                        <button 
                            className="minimal-retry-btn"
                            onClick={this.props.onRestartSameSnippet}
                            title="Retry same snippet"
                        >
                            <svg className="retry-icon" viewBox="0 0 24 24" width="24" height="24">
                                <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        );
    }
}

export default CompletedStats;
