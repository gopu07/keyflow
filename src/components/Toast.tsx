import * as React from 'react';

interface ToastProps {
    message: string;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 3000 }) => {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [message, duration, onClose]);

    return (
        <div className="toast-container" role="alert" aria-live="assertive">
            <div className="toast-content">
                {message}
            </div>
        </div>
    );
};
