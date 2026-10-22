export function getProfileUser(response) {
    // Accept an Axios response or an already-unwrapped API body.
    const body = response?.data ?? response;
    const user = body?.user ?? body;
    return user && typeof user === "object" && user._id ? user : null;
}
