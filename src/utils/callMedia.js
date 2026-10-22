export function getCallMediaErrorMessage(error, callType, action = "start") {
    if (error?.callDevice === "camera") {
        return `Camera access was denied or unavailable. Allow camera access and retry video, or switch to an audio call using the microphone.`;
    }
    if (error?.callDevice === "microphone") {
        return `Microphone access is required for ${callType === "video" ? "video and audio" : "audio"} calls. Allow microphone access, then retry.`;
    }
    const devices = callType === "video" ? "camera and microphone" : "microphone";
    const verb = action === "answer" ? "answer this call" : "start a call";
    switch (error?.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return `Allow ${devices} access in Chrome site settings and your operating system privacy settings. Use localhost or HTTPS, then try again to ${verb}.`;
        case "NotFoundError":
            return `A ${callType === "video" ? "camera or microphone" : "microphone"} was not found. Connect or enable the required device, then try again.`;
        case "NotReadableError":
            return `The ${callType === "video" ? "camera or microphone" : "microphone"} could not be opened. Close other apps using the device and try again.`;
        case "OverconstrainedError":
            return `The available ${devices} do not meet this call's requirements. Check your connected devices and try again.`;
        case "NotSupportedError":
            return "This browser does not support microphone or camera calls. Try a current version of Chrome, Edge, Firefox, or Safari.";
        case "TypeError":
            return `This page cannot access media devices. Open ChatSpace on localhost or HTTPS to ${verb}.`;
        case "SecurityError":
            return "Media access is blocked by the browser's security settings. Check site permissions and use localhost or HTTPS.";
        case "AbortError":
            return `${devices[0].toUpperCase()}${devices.slice(1)} access was interrupted. Check the device connection and try again.`;
        default:
            return `Could not access the ${devices} needed to ${verb}. Check browser and device permissions, then try again.`;
    }
}

export async function acquireCallMedia(callType, mediaDevices = navigator.mediaDevices) {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
        const error = new Error("Media capture requires a secure context");
        error.name = "SecurityError";
        throw error;
    }
    if (!mediaDevices?.getUserMedia) {
        const error = new Error("Media capture is not available in this context");
        error.name = typeof window !== "undefined" && !window.isSecureContext ? "SecurityError" : "NotSupportedError";
        throw error;
    }

    let audioStream;
    try {
        audioStream = await mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
        error.callDevice = "microphone";
        throw error;
    }

    if (callType !== "video") return audioStream;

    try {
        const videoStream = await mediaDevices.getUserMedia({ audio: false, video: true });
        return new MediaStream([...audioStream.getAudioTracks(), ...videoStream.getVideoTracks()]);
    } catch (error) {
        audioStream.getTracks().forEach((track) => track.stop());
        error.callDevice = "camera";
        throw error;
    }
}
