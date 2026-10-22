import { Phone, Video } from "lucide-react";

function formatDuration(value) {
    const seconds = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function CallHistoryEntry({ call, currentUserId }) {
    const outgoing = call.callerId?.toString() === currentUserId?.toString();
    const callType = call.callType === "video" ? "Video" : "Audio";
    const statusLabels = {
        pending: "Calling",
        completed: "Completed",
        missed: "Missed",
        rejected: "Declined",
        cancelled: "Cancelled"
    };
    const date = new Date(call.initiatedAt);

    return (
        <div className="cs-call-history-entry" role="group" aria-label={`${callType} call, ${statusLabels[call.status] || "Call"}`}>
            <span className="cs-call-history-icon" aria-hidden="true">
                {call.callType === "video" ? <Video size={18} /> : <Phone size={18} />}
            </span>
            <div className="cs-call-history-copy">
                <strong>{callType} call - {statusLabels[call.status] || "Call"}</strong>
                <span>{outgoing ? "Outgoing" : "Incoming"} - {date.toLocaleString()}</span>
                {call.status === "completed" && <span>Duration - {formatDuration(call.durationSeconds)}</span>}
            </div>
        </div>
    );
}

export default CallHistoryEntry;
