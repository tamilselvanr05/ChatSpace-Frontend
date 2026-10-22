export const isNotificationSoundEnabled = (storage = globalThis.localStorage) =>
    storage?.getItem("chatspace_sound") !== "false";

export const playIncomingNotificationSound = (options = {}) => {
    const storage = options.storage || globalThis.localStorage;
    if (storage?.getItem("chatspace_notifications") === "false") return false;
    return playNotificationSound({ ...options, storage });
};

export const playNotificationSound = ({
    storage = globalThis.localStorage,
    getAudioContext = () => globalThis.AudioContext || globalThis.webkitAudioContext,
    schedule = globalThis.setTimeout,
    logger = console
} = {}) => {
    if (!isNotificationSoundEnabled(storage)) return false;

    const AudioContext = getAudioContext();
    if (!AudioContext) return false;

    const audioContext = new AudioContext();
    audioContext.resume().then(() => {
        // The preference can change while the browser is resuming audio.
        if (!isNotificationSoundEnabled(storage)) {
            return audioContext.close();
        }

        const playTone = (frequency, delay, duration) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const start = audioContext.currentTime + delay;

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime(0.2, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(start);
            oscillator.stop(start + duration);
        };

        playTone(880, 0, 0.12);
        playTone(1174.66, 0.14, 0.18);
        schedule(() => audioContext.close(), 700);
    }).catch((error) => {
        logger.error("Notification sound error:", error);
    });

    return true;
};
