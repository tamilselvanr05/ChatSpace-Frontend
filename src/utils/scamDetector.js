const SHORTENERS = new Set([
    "bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rebrand.ly", "shorturl.at", "ow.ly"
]);

const patterns = [
    {
        risk: "High",
        reason: "This message combines a request for a password or verification code with pressure, secrecy, or an authority claim.",
        test: (text) => {
            const requestsSecret = /\b(?:send|share|give|provide|reply\s+with|tell\s+me|enter|confirm)\b/i.test(text) && /\b(?:password|passcode|otp|one[ -]?time(?:\s+password)?|verification\s+code|security\s+code|login credentials?|recovery code|card number|banking pin)\b/i.test(text);
            const pressureOrSecrecy = /\b(?:urgent(?:ly)?|immediately|act\s+now|within\s+\d+\s*(?:minutes?|hours?)|account\s+(?:will\s+be\s+)?(?:suspended|locked|closed)|final\s+warning|do\s+not\s+tell|keep\s+this\s+(?:secret|private)|bypass\s+(?:security|verification))\b/i.test(text);
            const authorityClaim = /\b(?:bank|security|support|police|government|it)\s+(?:team|department|officer|agent|representative)\b/i.test(text) || /\b(?:i am|this is)\s+(?:your\s+)?(?:bank|security|support|it\s+support)\b/i.test(text);
            return requestsSecret && (pressureOrSecrecy || authorityClaim);
        }
    },
    {
        risk: "High",
        reason: "Urgent pressure or a threat is paired with a request to send money.",
        test: (text) => /\b(?:urgent(?:ly)?|immediately|act\s+now|within\s+\d+\s*(?:minutes?|hours?)|account\s+(?:will\s+be\s+)?suspended|final\s+warning|arrest|police)\b/i.test(text) && /\b(?:transfer|send|pay|wire|crypto(?:currency)?|gift\s+cards?|money|payment)\b/i.test(text)
    },
    {
        risk: "Medium",
        reason: "A prize or guaranteed reward is paired with a claim, fee, or payment request.",
        test: (text) => /\b(?:prize|lottery|giveaway|winner|won|guaranteed\s+(?:reward|return|profit)|free\s+reward)\b/i.test(text) && /\b(?:claim|processing\s+fee|fee|deposit|pay|payment|transfer)\b/i.test(text)
    }
];

function urlRisk(text) {
    const reasons = [];
    const deceptiveMarkdown = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
    for (const match of text.matchAll(deceptiveMarkdown)) {
        const labelHost = match[1].match(/(?:https?:\/\/)?(?:www\.)?([^\s/]+)/i)?.[1]?.toLowerCase();
        try {
            const actualHost = new URL(match[2]).hostname.toLowerCase().replace(/^www\./, "");
            if (labelHost && labelHost.includes(".") && labelHost.replace(/^www\./, "") !== actualHost) {
                reasons.push("The displayed link text does not match its destination domain.");
                break;
            }
        } catch { /* malformed links are handled as plain text */ }
    }
    const urls = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    for (const rawUrl of urls) {
        try {
            const url = new URL(rawUrl.replace(/[),.!?]+$/, ""));
            const host = url.hostname.toLowerCase();
            if (SHORTENERS.has(host)) reasons.push("This message contains a URL-shortening service that hides the final destination.");
            if (host.startsWith("xn--") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || url.username || url.password) {
                reasons.push("This link uses an unusual or obscured destination format.");
            }
        } catch { /* ignore malformed or incomplete URLs */ }
    }
    return [...new Set(reasons)];
}

export function detectSuspiciousMessage(message) {
    if (typeof message !== "string" || !message.trim()) return null;
    const reasons = patterns.filter((rule) => rule.test(message)).map((rule) => rule.reason);
    reasons.push(...urlRisk(message));
    if (!reasons.length) return null;
    const risk = reasons.some((reason) => reason.startsWith("This message combines") || reason.startsWith("Urgent pressure"))
        ? "High"
        : reasons.some((reason) => reason.includes("URL-shortening") || reason.includes("unusual or obscured"))
            ? "Medium"
            : "Medium";
    return { risk, reasons: [...new Set(reasons)] };
}
