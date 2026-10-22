import test from "node:test";
import assert from "node:assert/strict";
import { playIncomingNotificationSound, playNotificationSound } from "./notificationSound.js";

function createAudioContext() {
    const calls = { oscillators: 0, closes: 0 };
    return {
        calls,
        context: {
            currentTime: 1,
            destination: {},
            resume: () => Promise.resolve(),
            close: () => { calls.closes += 1; return Promise.resolve(); },
            createOscillator: () => {
                calls.oscillators += 1;
                return {
                    frequency: { setValueAtTime() {} },
                    connect() {}, start() {}, stop() {}
                };
            },
            createGain: () => ({
                gain: {
                    setValueAtTime() {},
                    exponentialRampToValueAtTime() {}
                },
                connect() {}
            })
        }
    };
}

test("notification sound Off suppresses playback", () => {
    const storage = { getItem: () => "false" };
    const result = playNotificationSound({
        storage,
        getAudioContext: () => { throw new Error("Audio context should not be created"); }
    });

    assert.equal(result, false);
});

test("notification sound On plays the shared test/incoming sound", async () => {
    const storage = { getItem: () => "true" };
    const audio = createAudioContext();
    const result = playNotificationSound({
        storage,
        getAudioContext: () => function AudioContext() { return audio.context; },
        schedule: () => {}
    });

    assert.equal(result, true);
    await Promise.resolve();
    assert.equal(audio.calls.oscillators, 2);
});

test("incoming-message sound respects notification and sound preferences", async () => {
    const audio = createAudioContext();
    const getAudioContext = () => function AudioContext() { return audio.context; };
    const disabledNotifications = {
        getItem: (key) => key === "chatspace_notifications" ? "false" : "true"
    };
    assert.equal(playIncomingNotificationSound({
        storage: disabledNotifications,
        getAudioContext
    }), false);

    const disabledSound = {
        getItem: (key) => key === "chatspace_sound" ? "false" : "true"
    };
    assert.equal(playIncomingNotificationSound({
        storage: disabledSound,
        getAudioContext
    }), false);
    await Promise.resolve();
    assert.equal(audio.calls.oscillators, 0);

    const enabled = { getItem: () => "true" };
    assert.equal(playIncomingNotificationSound({
        storage: enabled,
        getAudioContext,
        schedule: () => {}
    }), true);
    await Promise.resolve();
    assert.equal(audio.calls.oscillators, 2);
});

test("sound disabled while audio is resuming does not play", async () => {
    let enabled = true;
    let resolveResume;
    const audio = createAudioContext();
    audio.context.resume = () => new Promise((resolve) => { resolveResume = resolve; });
    const storage = { getItem: () => enabled ? "true" : "false" };

    playNotificationSound({
        storage,
        getAudioContext: () => function AudioContext() { return audio.context; },
        schedule: () => {}
    });
    enabled = false;
    resolveResume();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(audio.calls.oscillators, 0);
    assert.equal(audio.calls.closes, 1);
});
