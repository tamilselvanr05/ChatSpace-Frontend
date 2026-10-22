export function getCallConnectionAction(connectionState) {
    if (connectionState === "connected") return "active";
    if (connectionState === "failed") return "terminate";
    if (connectionState === "disconnected") return "wait";
    return "connecting";
}
