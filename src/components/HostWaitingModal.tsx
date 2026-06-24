import * as React from 'react';

interface HostWaitingModalProps {
    roomCode: string;
    playersCount: number;
    onStart: () => void;
}

export const HostWaitingModal: React.FC<HostWaitingModalProps> = ({
    roomCode,
    playersCount,
    onStart
}) => {
    const [copiedLink, setCopiedLink] = React.useState(false);
    const [copiedCode, setCopiedCode] = React.useState(false);

    const joinLink = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(joinLink);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (e) {
            console.error("Failed to copy link", e);
        }
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(roomCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (e) {
            console.error("Failed to copy code", e);
        }
    };

    const handleShare = async () => {
        if ("share" in navigator) {
            try {
                await navigator.share({
                    title: 'Typefast Race',
                    text: 'Join my typing race!',
                    url: joinLink,
                });
            } catch (e) {
                console.error("Failed to share", e);
            }
        } else {
            handleCopyLink();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2 className="modal-title">🎉 Room Created Successfully</h2>
                
                <div className="modal-room-code-section">
                    <span className="modal-label">Room Code</span>
                    <div className="modal-room-code">{roomCode}</div>
                </div>

                <div className="modal-actions">
                    <button className="modal-btn" onClick={handleCopyLink}>
                        {copiedLink ? "✓ Copied" : "Copy Link"}
                    </button>
                    <button className="modal-btn secondary" onClick={handleCopyCode}>
                        {copiedCode ? "✓ Copied" : "Copy Code"}
                    </button>
                    {"share" in navigator && (
                        <button className="modal-btn secondary" onClick={handleShare}>
                            Share
                        </button>
                    )}
                </div>

                <div className="modal-status">
                    <div className="loader-pulse"></div>
                    <span>Waiting for players... {playersCount} Joined</span>
                </div>

                <button 
                    className="modal-start-btn" 
                    onClick={onStart}
                    disabled={playersCount < 2}
                >
                    {playersCount < 2 ? "Waiting for players to join..." : "Start Race"}
                </button>
            </div>
        </div>
    );
};
