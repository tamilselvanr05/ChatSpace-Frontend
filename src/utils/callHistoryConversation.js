const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function getCallHistoryPeerId({ selectedUserId, selectedGroupId, currentUserId }) {
    if (selectedGroupId || !selectedUserId || !currentUserId) return null;

    const peerId = selectedUserId.toString();
    const currentId = currentUserId.toString();
    if (!OBJECT_ID_PATTERN.test(peerId) || !OBJECT_ID_PATTERN.test(currentId) || peerId.toLowerCase() === currentId.toLowerCase()) {
        return null;
    }
    return peerId;
}
