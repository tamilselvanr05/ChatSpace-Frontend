export const getGroupMessagePreview = (message = {}) => {
    if (message.messageType === "image") return "Photo";
    if (message.messageType === "file") return message.fileName || "File";
    if (message.messageType === "audio") return "Voice message";
    return message.message || "";
};

export const getGroupMessageNotification = ({ message, userId, activeGroupId, groupName }) => {
    const senderId = message?.senderId?.toString();
    const groupId = message?.groupId?.toString();
    const currentUserId = userId?.toString();
    if (!message?._id || !groupId || !senderId) return null;

    const preview = getGroupMessagePreview(message);
    const isActive = groupId === activeGroupId?.toString();
    const isOwn = senderId === currentUserId;
    return {
        groupId,
        preview,
        isActive,
        isOwn,
        notification: !isOwn && !isActive && localStorage.getItem("chatspace_notifications") !== "false"
            ? {
                groupId,
                senderId,
                senderName: groupName || "Group chat",
                message: localStorage.getItem("chatspace_message_preview") === "false"
                    ? "You received a new message"
                    : preview
            }
            : null
    };
};
