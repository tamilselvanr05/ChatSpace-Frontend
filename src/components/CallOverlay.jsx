import { useEffect, useRef } from "react";
import {
    Mic,
    Phone,
    PhoneOff,
    Video
} from "lucide-react";

function CallOverlay({
    callState,
    incomingCall,
    localStream,
    remoteStream,
    callError,
    canFallbackToAudio,
    onRetryVideo,
    onAudioFallback,
    onAccept,
    onReject,
    onEnd
}) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const call = callState || incomingCall;

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => {});
        }

        if (
            call?.callType === "video" &&
            remoteVideoRef.current &&
            remoteStream
        ) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
        }

        if (
            call?.callType === "audio" &&
            remoteAudioRef.current &&
            remoteStream
        ) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
        }
    }, [call?.callType, localStream, remoteStream]);

    if (!call && !callError) {
        return null;
    }

    const isIncoming = Boolean(incomingCall);
    const peerName = call?.peerName || call?.fromName || "ChatSpace user";
    const callType = call?.callType || "audio";

    return (
        <div className="cs-call-layer">
            {callError && (
                <div className="cs-call-error" role="alert">
                    {callError}
                    {canFallbackToAudio && (
                        <div className="cs-call-error-actions">
                            <button type="button" onClick={onRetryVideo}>Retry video</button>
                            <button type="button" onClick={onAudioFallback}>Start audio call</button>
                        </div>
                    )}
                </div>
            )}

            {call && (
                <section
                    className="cs-call-window"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${callType} call with ${peerName}`}
                >
                    <header className="cs-call-header">
                        <div>
                            <strong>{peerName}</strong>
                            <span>
                                {isIncoming
                                    ? `Incoming ${callType} call`
                                    : callState?.status === "calling"
                                        ? "Calling…"
                                        : callState?.status === "active"
                                            ? "Connected"
                                            : "Connecting…"}
                            </span>
                        </div>
                        {callType === "video" ? (
                            <Video size={18} aria-hidden="true" />
                        ) : (
                            <Mic size={18} aria-hidden="true" />
                        )}
                    </header>

                    {callType === "video" ? (
                        <div className="cs-call-video-stage">
                            {remoteStream ? (
                                <video
                                    ref={remoteVideoRef}
                                    className="cs-call-remote-video"
                                    autoPlay
                                    playsInline
                                />
                            ) : (
                                <div className="cs-call-waiting">
                                    <div className="cs-call-avatar">
                                        {peerName.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span>
                                        {isIncoming
                                            ? "Incoming video call"
                                            : "Waiting for the other person…"}
                                    </span>
                                </div>
                            )}

                            {localStream && (
                                <video
                                    ref={localVideoRef}
                                    className="cs-call-local-video"
                                    autoPlay
                                    muted
                                    playsInline
                                />
                            )}
                        </div>
                    ) : (
                        <div className="cs-call-audio-stage">
                            <audio
                                ref={remoteAudioRef}
                                autoPlay
                            />
                            <div className="cs-call-avatar">
                                {peerName.slice(0, 1).toUpperCase()}
                            </div>
                            <strong>{peerName}</strong>
                            <span>
                                {isIncoming
                                    ? "Incoming voice call"
                                    : callState?.status === "calling"
                                        ? "Ringing…"
                                        : callState?.status === "active"
                                            ? "Voice call connected"
                                            : "Connecting…"}
                            </span>
                        </div>
                    )}

                    <footer className="cs-call-controls">
                        {isIncoming ? (
                            <>
                                <button
                                    type="button"
                                    className="cs-call-button is-decline"
                                    onClick={onReject}
                                    aria-label="Decline call"
                                >
                                    <PhoneOff size={20} />
                                    <span>Decline</span>
                                </button>
                                <button
                                    type="button"
                                    className="cs-call-button is-accept"
                                    onClick={onAccept}
                                    aria-label="Accept call"
                                >
                                    <Phone size={20} />
                                    <span>Accept</span>
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="cs-call-button is-decline"
                                onClick={onEnd}
                                aria-label="End call"
                            >
                                <PhoneOff size={20} />
                                <span>End call</span>
                            </button>
                        )}
                    </footer>
                </section>
            )}
        </div>
    );
}

export default CallOverlay;
