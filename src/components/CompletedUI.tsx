import * as React from 'react';

import CompletedSnippetBox from './CompletedSnippetBox';
import ProgressIndicator from './ProgressIndicator';
import CompletedStats from './CompletedStats';
import { IKeystrokeLog } from '../lib/KeystrokeRecorder';
import CompletedSnippetAnalyzer from '../lib/CompletedSnippetAnalyzer';
import { PlayerData, RoomState, sortPlayers } from '../lib/MultiplayerRoom';
import { TestConfig } from '../lib/TestConfig';

interface ICompletedUIProps {
    snippetText: string;
    snippetAuthor?: string;
    keystrokes: IKeystrokeLog[];
    onRestart: () => void;
    multiplayerPlayersList?: PlayerData[];
    mpRoomState?: RoomState | null;
    currentPlayerId?: string;
    isHost?: boolean;
    onPlayAgain?: () => void;
    finalStats?: {
        wpm: number;
        accuracy: number;
        mistakes: number;
        elapsedSeconds: number;
    };
    onRestartSameSnippet?: () => void;
    config?: TestConfig;
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

    public getSortedPlayers(): PlayerData[] {
        return sortPlayers(this.props.multiplayerPlayersList || [], this.props.mpRoomState?.rankings || []);
    }

    public render() {
        const { snippetText, keystrokes } = this.props;
        const { showDetails } = this.state;
        
        const analyzer = new CompletedSnippetAnalyzer(snippetText, keystrokes, true);
        const errorCounts = analyzer.getErrorCounts();
        const consistency = analyzer.getConsistencyScore();
        const errorFrequencies = analyzer.getErrorFrequencyPerIndex();
        const mostMistyped = analyzer.getMostMistypedCharacters();

        const winnerId = this.props.mpRoomState?.winnerId;
        const winner = this.props.multiplayerPlayersList?.find(p => p.id === winnerId);

        return (
            <div className="completed-ui-container">
                {/* Winner Banner */}
                {winner && (
                    <div className="mp-winner-banner">
                        <span className="winner-crown">🥇</span>
                        <div className="winner-details">
                            <span className="winner-label">Winner</span>
                            <h3 className="winner-name">{winner.displayName}</h3>
                            <span className="winner-stats-summary">
                                {winner.wpm} WPM &nbsp;•&nbsp; {winner.accuracy}% Accuracy &nbsp;•&nbsp; {this.props.mpRoomState?.elapsedSeconds}s
                            </span>
                        </div>
                    </div>
                )}

                <CompletedSnippetBox
                    snippetText={snippetText}
                    keystrokeLogs={keystrokes}
                    errorFrequencies={errorFrequencies}
                    lowercase={true} />
                {this.props.snippetAuthor && this.props.snippetAuthor.trim() !== "" && (
                    <div className="snippet-author">
                        — {this.props.snippetAuthor.trim()}
                    </div>
                )}
                <ProgressIndicator percentage={100} />
                <CompletedStats
                    snippetText={snippetText}
                    keystrokes={keystrokes}
                    isMultiplayer={!!this.props.multiplayerPlayersList}
                    finalStats={this.props.finalStats}
                    onRestartSameSnippet={this.props.onRestartSameSnippet}
                    lowercase={true} />

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
                                        <th>Mistakes</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {this.getSortedPlayers().map((player, index) => {
                                        const rank = index + 1;
                                        const isWinner = player.id === winnerId;
                                        const isCurrent = player.id === this.props.currentPlayerId;
                                        return (
                                            <tr key={player.id} className={`leaderboard-row ${isWinner ? 'winner-row' : ''} ${isCurrent ? 'current-player-row' : ''}`}>
                                                <td>#{rank}</td>
                                                <td>
                                                    {player.displayName}
                                                    {isCurrent && <span className="leaderboard-you-tag"> (You)</span>}
                                                    {player.leftRace && player.finished && <span className="leaderboard-offline-tag" style={{ fontSize: "0.8em", opacity: 0.7 }}> (offline)</span>}
                                                </td>
                                                <td>{player.leftRace && !player.finished ? "—" : `${player.wpm} WPM`}</td>
                                                <td>{player.leftRace && !player.finished ? "—" : `${player.accuracy}%`}</td>
                                                <td>{player.leftRace && !player.finished ? "—" : (player.errors !== undefined ? player.errors : 0)}</td>
                                                <td>
                                                    {player.leftRace && !player.finished ? (
                                                        <span className="player-status left-race" style={{ color: "var(--color-error)", borderColor: "var(--color-error-border)" }}>DNF</span>
                                                    ) : player.finished ? (
                                                        <span className="player-status finished">Finished</span>
                                                    ) : (
                                                        <span className="player-status typing">Typing ({Math.round(player.progress)}%)</span>
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

                {this.props.multiplayerPlayersList && (
                    <div className="mp-completed-actions">
                        {this.props.isHost ? (
                            <button 
                                className="mp-action-btn play-again-btn"
                                onClick={this.props.onPlayAgain}
                            >
                                Play Again
                            </button>
                        ) : (
                            <button 
                                className="mp-action-btn play-again-btn"
                                onClick={this.props.onPlayAgain}
                            >
                                Return to Lobby
                            </button>
                        )}
                        <button 
                            className="mp-action-btn leave-btn"
                            onClick={this.props.onRestart}
                        >
                            Leave Room
                        </button>
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
                                    {consistency.percentage.toFixed(0)}%
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
