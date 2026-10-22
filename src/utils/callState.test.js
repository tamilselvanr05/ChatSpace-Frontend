import test from "node:test";
import assert from "node:assert/strict";
import { getCallConnectionAction } from "./callState.js";

test("transient disconnected state waits for recovery; failed state is terminal", () => {
    assert.equal(getCallConnectionAction("disconnected"), "wait");
    assert.equal(getCallConnectionAction("failed"), "terminate");
    assert.equal(getCallConnectionAction("connecting"), "connecting");
    assert.equal(getCallConnectionAction("connected"), "active");
});
