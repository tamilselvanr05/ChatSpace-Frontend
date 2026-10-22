export const MAX_PASTED_SUMMARY_CHARACTERS = 12000;
export const SUMMARY_TYPES = ["full", "actions", "decisions", "deadlines"];

export function buildSummaryRequest({ source, summaryType, text, conversationType, conversationId, consentConfirmed }) {
    if (!consentConfirmed || !SUMMARY_TYPES.includes(summaryType)) return null;
    if (source === "text") {
        if (typeof text !== "string" || !text.trim() || text.length > MAX_PASTED_SUMMARY_CHARACTERS) return null;
        return { source: "text", summaryType, text: text.trim() };
    }
    if (source === "chat" && ["private", "group"].includes(conversationType) && conversationId) {
        return { source: "chat", summaryType, conversationType, conversationId };
    }
    return null;
}
