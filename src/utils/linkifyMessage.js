const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

function trimUrlPunctuation(value) {
    let url = value;
    let punctuation = "";
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] || "";
    if (trailing) {
        url = url.slice(0, -trailing.length);
        punctuation = trailing + punctuation;
    }
    for (const [closing, opening] of [[")", "("], ["]", "["]]) {
        while (url.endsWith(closing) &&
            (url.match(new RegExp(`\\${closing}`, "g")) || []).length >
            (url.match(new RegExp(`\\${opening}`, "g")) || []).length) {
            url = url.slice(0, -1);
            punctuation = closing + punctuation;
        }
    }
    return { url, punctuation };
}

function isSafeHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            Boolean(parsed.hostname) && !parsed.username && !parsed.password;
    } catch {
        return false;
    }
}

export function splitMessageLinks(message) {
    if (typeof message !== "string" || !message) return [];
    const parts = [];
    const appendText = (text) => {
        if (!text) return;
        const previous = parts.at(-1);
        if (previous && !previous.href) previous.text += text;
        else parts.push({ text });
    };
    let cursor = 0;
    for (const match of message.matchAll(URL_PATTERN)) {
        const start = match.index;
        const { url, punctuation } = trimUrlPunctuation(match[0]);
        if (!url || !isSafeHttpUrl(url)) continue;
        if (start > cursor) appendText(message.slice(cursor, start));
        parts.push({ text: url, href: url });
        if (punctuation) appendText(punctuation);
        cursor = start + match[0].length;
    }
    if (cursor < message.length) appendText(message.slice(cursor));
    return parts.length ? parts : [{ text: message }];
}
