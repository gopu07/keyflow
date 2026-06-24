import * as React from 'react';

import CompletedSnippetBox from './CompletedSnippetBox';
import ProgressIndicator from './ProgressIndicator';
import CompletedStats from './CompletedStats';
import { IKeystrokeLog } from '../lib/KeystrokeRecorder';
import CompletedSnippetAnalyzer from '../lib/CompletedSnippetAnalyzer';
import { PlayerData } from '../lib/MultiplayerRoom';

interface ICompletedUIProps {
    snippetText: string;
    snippetAuthor?: string;
    keystrokes: IKeystrokeLog[];
    onRestart: () => void;
    multiplayerPlayersList?: PlayerData[];
}

interface ICompletedUIState {
    showDetails: boolean;
}

class CompletedUI extends React.Component<ICompletedUIProps, ICompletedUIState> {
    constructor(props: ICompletedUIProps) {
        super(props);
        this.state = {
            showDetails: false
        };
    }

    public render() {
        const { snippetText, keystrokes, onRestart } = this.props;
        const { showDetails } = this.state;
        
        const analyzer = new CompletedSnippetAnalyzer(snippetText, keystrokes);
        const errorCounts = analyzer.getErrorCounts();
        const consistency = analyzer.getConsistencyScore();
        const errorFrequencies = analyzer.getErrorFrequencyPerIndex();
        const mostMistyped = analyzer.getMostMistypedCharacters();

        return (
            <div className="completed-ui-container">
                <CompletedSnippetBox
                    snippetText={snippetText}
                    keystrokeLogs={keystrokes} />
                {this.props.snippetAuthor && this.props.snippetAuthor.trim() !== "" && (
                    <div className="snippet-author">
                        — {this.props.snippetAuthor.trim()}
                    </div>
                )}
                <ProgressIndicator percentage={100} />
                <CompletedStats
                    snippetText={snippetText}
                    keystrokes={keystrokes}
                    onRestart={onRestart} />

                {this.props.multiplayerPlayersList && (
                    <div className="leaderboard-container">
                        <div className="analytics-section-title">Race Leaderboard</div>
                        <div className="leaderboard-box">
                            <table className="leaderboard-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th>Speed</th>
                                        <th>Accuracy</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...this.props.multiplayerPlayersList]
                                        .sort((a, b) => b.wpm - a.wpm)
                                        .map((player, index) => {
                                            const rank = index + 1;
                                            return (
                                                <tr key={player.id} className="leaderboard-row">
                                                    <td>#{rank}</td>
                                                    <td>{player.displayName}</td>
                                                    <td>{player.wpm} WPM</td>
                                                    <td>{player.accuracy}%</td>
                                                    <td>
                                                        {player.leftRace ? (
                                                            <span className="player-status left-race" style={{ color: "var(--color-error)", borderColor: "var(--color-error-border)" }}>Left Race</span>
                                                        ) : player.finished ? (
                                                            <span className="player-status finished">Finished</span>
                                                        ) : (
                                                            <span className="player-status typing">Typing</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="analytics-toggle-container">
                    <a
                        href="#"
                        className="analytics-toggle-link"
                        onClick={(e) => {
                            e.preventDefault();
                            this.setState({ showDetails: !showDetails });
                        }}
                    >
                        {showDetails ? 'hide details' : 'show details'}
                    </a>
                </div>

                {showDetails && (
                    <div className="completed-analytics-details">
                        <div className="analytics-metrics-grid">
                            <div className="analytics-stat-card">
                                <span className="stat-value corrected-value">{errorCounts.corrected}</span>
                                <span className="stat-label">Corrected Errors</span>
                            </div>
                            <div className="analytics-stat-card">
                                <span className="stat-value uncorrected-value">{errorCounts.uncorrected}</span>
                                <span className="stat-label">Uncorrected Errors</span>
                            </div>
                            <div className="analytics-stat-card">
                                <span className="stat-value">
                                    {consistency.sd.toFixed(1)}
                                    <span className="unit">WPM</span>
                                </span>
                                <span className="stat-label">Consistency ({consistency.label})</span>
                            </div>
                        </div>

                        <div className="analytics-section-title">Error Heatmap</div>
                        <div className="heatmap-box">
                            <div className="heatmap-text">
                                {snippetText.split('').map((char, index) => {
                                    const count = errorFrequencies[index] || 0;
                                    let color = '#10b981'; // green (0 errors)
                                    let bg = 'rgba(16, 185, 129, 0.05)';
                                    let borderBottom = 'none';

                                    if (count === 1) {
                                        color = '#d97706'; // yellow/amber (1 error)
                                        bg = 'rgba(217, 119, 6, 0.05)';
                                    } else if (count >= 2) {
                                        color = 'var(--color-error)'; // red (2+ errors)
                                        bg = 'var(--color-error-light)';
                                        borderBottom = '2px solid var(--color-error-border)';
                                    }

                                    return (
                                        <span
                                            key={index}
                                            style={{
                                                color: color,
                                                backgroundColor: bg,
                                                borderBottom: borderBottom,
                                                borderRadius: '3px',
                                                padding: '0 1px'
                                            }}
                                        >
                                            {char}
                                        </span>
                                    );
                                })}
                            </div>
                            <div className="heatmap-legend">
                                <div className="legend-item">
                                    <span className="legend-dot green" />
                                    <span>0 errors</span>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-dot yellow" />
                                    <span>1 error</span>
                                </div>
                                <div className="legend-item">
                                    <span className="legend-dot red" />
                                    <span>2+ errors</span>
                                </div>
                            </div>
                        </div>

                        <div className="analytics-section-title">Most Mistyped Characters</div>
                        <div className="mistyped-list-container">
                            {mostMistyped.length === 0 ? (
                                <p className="no-analytics-data">No mistyped characters! Perfect accuracy.</p>
                            ) : (
                                <ul className="mistyped-list">
                                    {mostMistyped.map((item, index) => (
                                        <li key={index} className="mistyped-item">
                                            You typed <span className="typed-key">'{item.typed}'</span> instead of <span className="expected-key">'{item.expected}'</span>
                                            <span className="mistake-count">
                                                {item.count} {item.count === 1 ? 'time' : 'times'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default CompletedUI;
