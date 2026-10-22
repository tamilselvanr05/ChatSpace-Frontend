import { createElement } from "react";

const inFlightRequests = new Map();
const missingProfilePhotos = new Set();

function isProfilePhoto(path, mediaKind) {
    return mediaKind === "image" && path.startsWith("/media/profiles/");
}

export function getProtectedImageFallback(path, fallback) {
    if (path?.startsWith("/media/profiles/")) return "\u{1F464}";
    return fallback ?? "Image unavailable";
}

export function createProtectedImageFallback({ path, fallback, alt, className, style }) {
    return createElement("span", {
        className,
        role: "img",
        "aria-label": alt || "Image unavailable",
        style
    }, getProtectedImageFallback(path, fallback));
}

export function requestProtectedMedia({ key, path, mediaKind, load }) {
    const cacheMissingPhoto = isProfilePhoto(path, mediaKind);
    if (cacheMissingPhoto && missingProfilePhotos.has(key)) {
        return Promise.reject({ response: { status: 404 }, cached: true });
    }
    const existingRequest = inFlightRequests.get(key);
    if (existingRequest) return existingRequest;

    const request = Promise.resolve().then(load).catch((error) => {
        if (cacheMissingPhoto && error.response?.status === 404) missingProfilePhotos.add(key);
        throw error;
    }).finally(() => {
        if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
    });
    inFlightRequests.set(key, request);
    return request;
}
