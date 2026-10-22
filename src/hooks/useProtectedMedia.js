import { useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../config";
import { requestProtectedMedia } from "../utils/protectedMediaRequest";

const safeImageTypes = new Set([
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp"
]);
export function useProtectedMedia(path, refreshKey = "", mediaKind = "") {
    const requestKey = `${path || ""}\u0000${refreshKey || ""}\u0000${mediaKind}`;
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!path) return undefined;
        let active = true;
        let objectUrl = null;

        requestProtectedMedia({
            key: requestKey,
            path,
            mediaKind,
            load: () => axios.get(apiUrl(path), { responseType: "blob" })
        }).then((response) => {
            const contentType = (response.headers["content-type"] || response.data.type || "")
                .split(";", 1)[0].trim().toLowerCase();
            if ((mediaKind === "image" && !safeImageTypes.has(contentType)) ||
                (mediaKind === "audio" && !contentType.startsWith("audio/"))) {
                throw new Error("Unsupported media type");
            }
            objectUrl = URL.createObjectURL(response.data);
            if (!active) {
                URL.revokeObjectURL(objectUrl);
                return;
            }
            setResult({ requestKey, url: objectUrl, error: null });
        }).catch(() => {
            if (active) {
                setResult({ requestKey, url: null, error: "Media could not be loaded." });
            }
        });

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [path, requestKey, mediaKind]);

    const currentResult = result?.requestKey === requestKey ? result : null;
    return {
        url: currentResult?.url || null,
        error: currentResult?.error || null,
        loading: Boolean(path) && !currentResult
    };
}
