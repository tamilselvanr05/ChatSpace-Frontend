import { useState } from "react";
import axios from "axios";
import { apiUrl } from "../config";
import { useProtectedMedia } from "../hooks/useProtectedMedia";
import { createProtectedImageFallback } from "../utils/protectedMediaRequest";

function safeDownloadName(value) {
    return [...String(value || "download")]
        .filter((character) => character !== "/" && character !== "\\" &&
            character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
        .join("");
}

export function ProtectedImage({ path, refreshKey, alt = "", className, style, onClick, fallback, loadingLabel = "Loading media…" }) {
    const { url, error, loading } = useProtectedMedia(path, refreshKey, "image");
    const [failedUrl, setFailedUrl] = useState(null);

    if (error || (url && failedUrl === url)) {
        return createProtectedImageFallback({ path, fallback, alt, className, style });
    }
    if (!url) {
        return <span className={className} role="status" aria-label={loading ? loadingLabel : "Image unavailable"} style={style}>{loading ? loadingLabel : ""}</span>;
    }
    return (
        <img
            src={url}
            alt={alt}
            className={className}
            style={onClick ? { ...style, cursor: "pointer" } : style}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={onClick ? `View ${alt || "profile photo"}` : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick(event);
                }
            } : undefined}
            onError={() => setFailedUrl(url)}
        />
    );
}

export function ProtectedAudio({ path, style }) {
    const { url, error, loading } = useProtectedMedia(path, "", "audio");
    if (error) return <span role="alert">Audio could not be loaded.</span>;
    if (!url) return <span role="status">{loading ? "Loading audio…" : "Audio unavailable"}</span>;
    return <audio controls preload="metadata" src={url} style={style} />;
}

export function ProtectedDownload({ path, fileName, children, className, style }) {
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");

    const download = async () => {
        if (status === "loading") return;
        setStatus("loading");
        setError("");
        let objectUrl;
        try {
            const response = await axios.get(apiUrl(path), { responseType: "blob" });
            objectUrl = URL.createObjectURL(response.data);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = safeDownloadName(fileName);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
            setStatus("idle");
        } catch {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setError("Download failed. Check your connection and try again.");
            setStatus("idle");
        }
    };

    return (
        <>
            <button type="button" className={className || "cs-message-download"} style={style} onClick={download} disabled={status === "loading"}>
                {status === "loading" ? "Loading…" : children || "Download"}
            </button>
            {error && <span role="alert">{error}</span>}
        </>
    );
}
