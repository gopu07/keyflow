import * as React from "react";
import { PlayerData, sortPlayers } from "../lib/MultiplayerRoom";

interface IMultiplayerFooterProps {
    players: PlayerData[];
    currentPlayerId: string;
    rankings?: string[];
}

export default class MultiplayerFooter extends React.Component<IMultiplayerFooterProps> {
    public render() {
        const sortedPlayers = sortPlayers(this.props.players, this.props.rankings || []);
        const otherPlayers = sortedPlayers.filter(
            (p) => p.id !== this.props.currentPlayerId
        );

        if (otherPlayers.length === 0) {
            return null;
        }

        return (
            <div className="multiplayer-footer-bar">
                <div className="multiplayer-footer-title">Opponents</div>
                <div className="multiplayer-opponents-list">
                    {otherPlayers.map((player) => (
                        <div 
                            key={player.id} 
                            className={`opponent-progress-row${player.leftRace ? ' opponent-has-left' : ''}`}
                            style={player.leftRace ? { opacity: 0.5 } : {}}
                        >
                            <span className="opponent-name">
                                {player.displayName}
                                {player.leftRace && <span style={{ fontSize: "11px", color: "var(--color-error)", marginLeft: "6px" }}>(left)</span>}
                            </span>
                            <div className="opponent-progress-bar-container">
                                <div
                                    className="opponent-progress-bar-fill"
                                    style={{ width: `${player.progress}%`, backgroundColor: player.leftRace ? "var(--text-muted)" : "var(--color-accent)" }}
                                />
                            </div>
                            <span className="opponent-wpm">
                                {player.leftRace ? "Left Race" : `${player.wpm} WPM`}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}
