import { useRef, useState } from "react";
import axios from "axios";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { apiUrl } from "../config";
import { buildSummaryRequest, MAX_PASTED_SUMMARY_CHARACTERS, SUMMARY_TYPES } from "../utils/chatSummaryRequest";

const typeOptions = [
    ["full", "Full Summary"],
    ["actions", "Action Items Only"],
    ["decisions", "Decisions Only"],
    ["deadlines", "Deadlines Only"]
];
const sectionsByType = {
    full: ["Key Points", "Decisions", "Action Items", "Deadlines"],
    actions: ["Action Items"],
    decisions: ["Decisions"],
    deadlines: ["Deadlines"]
};

function SummarySections({ summary, summaryType }) {
    const visibleSections = sectionsByType[summaryType] || sectionsByType.full;
    const sections = [];
    let current = null;
    summary.split("\n").forEach((line) => {
        const heading = line.match(/^\s*#{1,3}\s*(Key Points|Decisions|Action Items|Deadlines)\s*:?\s*$/i);
        if (heading && visibleSections.some((title) => title.toLowerCase() === heading[1].toLowerCase())) {
            current = { title: visibleSections.find((title) => title.toLowerCase() === heading[1].toLowerCase()), lines: [] };
            sections.push(current);
        } else if (current && line.trim()) {
            current.lines.push(line.replace(/^\s*[-*•]\s+/, ""));
        }
    });
    if (!sections.length) return <p className="cs-summary-fallback">{summary}</p>;
    return visibleSections.map((title) => {
        const section = sections.find((item) => item.title === title);
        return (
            <section className="cs-summary-section" key={title}>
                <h3>{title}</h3>
                {section?.lines.length
                    ? <ul>{section.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
                    : <p>None identified.</p>}
            </section>
        );
    });
}

export default function ChatSummaryDialog({ conversationType, conversationId, onClose }) {
    const hasCurrentChat = ["private", "group"].includes(conversationType) && Boolean(conversationId);
    const [source, setSource] = useState(hasCurrentChat ? "chat" : "text");
    const [summaryType, setSummaryType] = useState("full");
    const [pastedText, setPastedText] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState("");
    const [messageCount, setMessageCount] = useState(0);
    const [characterCount, setCharacterCount] = useState(0);
    const [error, setError] = useState("");
    const [submittedSource, setSubmittedSource] = useState("");
    const [submittedType, setSubmittedType] = useState("full");
    const requestInFlight = useRef(false);

    const summarize = async (payload = null) => {
        if (requestInFlight.current) return;
        const request = payload || buildSummaryRequest({
            source,
            summaryType,
            text: pastedText,
            conversationType,
            conversationId,
            consentConfirmed: true
        });
        if (!request) {
            setError(source === "text" ? "Enter text within the character limit before continuing." : "Choose an available chat to summarize.");
            return;
        }
        requestInFlight.current = true;
        setConfirmed(true);
        setLoading(true);
        setError("");
        setSummary("");
        setSubmittedSource(request.source);
        setSubmittedType(request.summaryType);
        try {
            const { data } = await axios.post(apiUrl("/ai/summarize"), request);
            setSummary(data.summary);
            setMessageCount(data.messageCount || 0);
            setCharacterCount(data.characterCount || 0);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "The summary could not be generated. Check your connection and retry.");
        } finally {
            requestInFlight.current = false;
            setLoading(false);
        }
    };

    const canConfirm = source === "chat"
        ? hasCurrentChat
        : Boolean(pastedText.trim()) && pastedText.length <= MAX_PASTED_SUMMARY_CHARACTERS;

    return (
        <div className="cs-summary-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
            <section className="cs-summary-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-summary-title">
                <header className="cs-summary-header">
                    <div className="cs-summary-title-icon"><Sparkles size={19} /></div>
                    <div><h2 id="cs-summary-title">Summarize</h2><p>Extract clear, supported information from your conversations or your own text.</p></div>
                    <button type="button" className="cs-summary-close" aria-label="Close summary" onClick={onClose} disabled={loading}><X size={18} /></button>
                </header>

                <section className="cs-summary-guidance" aria-label="Summarization usage guidance">
                    <article><h3>Usage limit</h3><p>Up to 5 summarization requests per user every 5 minutes.</p></article>
                    <article><h3>Use thoughtfully</h3><p>Save your requests for important text, key decisions, action items, and deadlines.</p></article>
                    <article className="cs-summary-guidance-availability"><h3>Availability</h3><p>Summarization may be temporarily unavailable when service capacity or Google Gemini API limits are reached.</p></article>
                </section>

                {!confirmed ? (
                    <div className="cs-summary-consent">
                        <div className="cs-summary-source-picker" role="group" aria-label="Summary source">
                            <button type="button" aria-pressed={source === "chat"} disabled={!hasCurrentChat} onClick={() => setSource("chat")}>Summarize Current Chat</button>
                            <button type="button" aria-pressed={source === "text"} onClick={() => setSource("text")}>Summarize My Own Text</button>
                        </div>
                        {!hasCurrentChat && source === "chat" && <p className="cs-summary-source-help">Open a private or group chat to use the current-chat source.</p>}

                        {source === "text" && (
                            <div className="cs-summary-text-entry">
                                <label htmlFor="cs-summary-pasted-text">Text to summarize</label>
                                <textarea
                                    id="cs-summary-pasted-text"
                                    value={pastedText}
                                    onChange={(event) => setPastedText(event.target.value)}
                                    placeholder="Paste meeting notes, an article, or other text…"
                                    maxLength={MAX_PASTED_SUMMARY_CHARACTERS}
                                    rows={7}
                                />
                                <div className="cs-summary-character-count" aria-live="polite">{pastedText.length.toLocaleString()} / {MAX_PASTED_SUMMARY_CHARACTERS.toLocaleString()} characters</div>
                            </div>
                        )}

                        <label className="cs-summary-type-label" htmlFor="cs-summary-type">Summary type</label>
                        <select id="cs-summary-type" value={summaryType} onChange={(event) => setSummaryType(event.target.value)}>
                            {typeOptions.filter(([value]) => SUMMARY_TYPES.includes(value)).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                        </select>

                        <p>{source === "text"
                            ? "The text you submit will be processed by Google Gemini. Only the text and summary type are sent; no chat is required."
                            : "Only up to 100 recent text messages that you can view in this chat will be sent to Google Gemini. Attachments and other conversations are excluded."}</p>
                        <p>Google’s free tier may use prompts to improve its products. Avoid passwords and other sensitive information.</p>
                        <button type="button" className="cs-summary-primary" onClick={() => summarize()} disabled={!canConfirm}>
                            <Sparkles size={16} /> {source === "text" ? "Confirm and summarize my text" : "Confirm and summarize current chat"}
                        </button>
                    </div>
                ) : (
                    <div className="cs-summary-body" aria-live="polite">
                        {loading && <div className="cs-summary-loading" role="status"><span /> Summarizing…</div>}
                        {error && <div className="cs-summary-error" role="alert"><p>{error}</p><button type="button" onClick={() => summarize(buildSummaryRequest({ source, summaryType, text: pastedText, conversationType, conversationId, consentConfirmed: true }))} disabled={loading}><RefreshCw size={14} /> Retry</button></div>}
                        {summary && <>
                            <p className="cs-summary-count">{submittedSource === "text" ? `Summary of ${characterCount.toLocaleString()} characters of your text` : `Summary of ${messageCount} text messages`}</p>
                            <SummarySections summary={summary} summaryType={submittedType} />
                            <p className="cs-summary-not-saved">This summary is temporary and hasn’t been added to chat history.</p>
                        </>}
                    </div>
                )}
            </section>
        </div>
    );
}
