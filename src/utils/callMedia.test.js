import test from "node:test";
import assert from "node:assert/strict";
import { acquireCallMedia, getCallMediaErrorMessage } from "./callMedia.js";

test("unsupported media capture is reported distinctly", () => {
    assert.match(getCallMediaErrorMessage({ name: "NotSupportedError" }, "audio"), /does not support/);
});

test("device errors receive distinct, call-type-specific guidance", () => {
    const message = (name, type = "video") => getCallMediaErrorMessage({ name }, type);
    assert.match(message("NotAllowedError"), /camera and microphone access/);
    assert.match(message("NotFoundError"), /camera or microphone was not found/);
    assert.match(message("NotReadableError"), /Close other apps/);
    assert.match(message("OverconstrainedError"), /requirements/);
    assert.match(message("TypeError", "audio"), /localhost or HTTPS/);
    assert.match(getCallMediaErrorMessage({ name: "NotAllowedError" }, "audio", "answer"), /answer this call/);
});

test("audio call requests only the microphone", async () => {
    const requests = [];
    const audioStream = { getAudioTracks: () => ["mic"], getTracks: () => [] };
    const stream = await acquireCallMedia("audio", {
        getUserMedia: async (constraints) => { requests.push(constraints); return audioStream; }
    });
    assert.equal(stream, audioStream);
    assert.deepEqual(requests, [{ audio: true, video: false }]);
});

test("video call distinguishes microphone and camera denial and releases microphone on camera failure", async () => {
    const requests = [];
    let stopped = false;
    const audioStream = {
        getAudioTracks: () => ["mic"],
        getTracks: () => [{ stop: () => { stopped = true; } }]
    };
    const mediaDevices = { getUserMedia: async (constraints) => {
        requests.push(constraints);
        if (constraints.audio) return audioStream;
        const error = new Error("denied");
        error.name = "NotAllowedError";
        throw error;
    } };
    await assert.rejects(acquireCallMedia("video", mediaDevices), (error) => {
        assert.equal(error.callDevice, "camera");
        assert.match(getCallMediaErrorMessage(error, "video"), /switch to an audio call/);
        return true;
    });
    assert.deepEqual(requests, [{ audio: true, video: false }, { audio: false, video: true }]);
    assert.equal(stopped, true);
});

test("microphone denial is identified as required for calls", async () => {
    const error = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    await assert.rejects(acquireCallMedia("audio", { getUserMedia: async () => { throw error; } }), (reason) => {
        assert.equal(reason.callDevice, "microphone");
        assert.match(getCallMediaErrorMessage(reason, "audio"), /Microphone access is required/);
        return true;
    });
});
