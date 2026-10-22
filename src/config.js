const localBackendUrl = "http://localhost:3030";
const configuredBackendUrl = import.meta.env.VITE_API_URL?.trim();

if (!configuredBackendUrl && import.meta.env.PROD) {
    throw new Error(
        "VITE_API_URL is required in production. Set it to the deployed ChatSpace backend origin."
    );
}

const backendUrl = configuredBackendUrl || localBackendUrl;
let parsedBackendUrl;

try {
    parsedBackendUrl = new URL(backendUrl);
} catch {
    throw new Error(
        "VITE_API_URL must be a valid HTTP or HTTPS backend URL, without a trailing slash."
    );
}

if (!new Set(["http:", "https:"]).has(parsedBackendUrl.protocol) ||
    parsedBackendUrl.username ||
    parsedBackendUrl.password ||
    parsedBackendUrl.search ||
    parsedBackendUrl.hash) {
    throw new Error(
        "VITE_API_URL must be a valid HTTP or HTTPS backend URL, without credentials, query parameters, or a fragment."
    );
}

if (import.meta.env.PROD &&
    new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]).has(parsedBackendUrl.hostname)) {
    throw new Error(
        "VITE_API_URL points to a local machine in a production build. Set it to the deployed ChatSpace backend origin."
    );
}

export const API_BASE_URL = backendUrl.replace(/\/+$/, "");
export const API_ORIGIN = parsedBackendUrl.origin;

export function apiUrl(path) {
    return `${API_BASE_URL}/${String(path).replace(/^\/+/, "")}`;
}
