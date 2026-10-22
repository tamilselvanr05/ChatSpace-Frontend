export default function ChatSpaceLogo({ className = "", showTagline = false }) {
    return (
        <div className={`cs-logo-lockup ${className}`.trim()} role="img" aria-label="ChatSpace">
            <img src="/logo.jpg" alt="" />
            <span className="cs-logo-copy">
                <strong>Chat<span>Space</span></strong>
                {showTagline && <small>Real-Time Communication Platform</small>}
            </span>
        </div>
    );
}
