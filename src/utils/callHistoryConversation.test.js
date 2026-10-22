import assert from "node:assert/strict";
import test from "node:test";
import { getCallHistoryPeerId } from "./callHistoryConversation.js";

const currentUserId = "6aca60f849ac0e7b263c577a";
const peerId = "7bca60f849ac0e7b263c577b";

test("does not request call history without a selected private conversation", () => {
    assert.equal(getCallHistoryPeerId({ selectedUserId: null, currentUserId }), null);
    assert.equal(getCallHistoryPeerId({ selectedUserId: peerId, selectedGroupId: "group-1", currentUserId }), null);
    assert.equal(getCallHistoryPeerId({ selectedUserId: "invalid-id", currentUserId }), null);
});

test("does not request call history for the current user", () => {
    assert.equal(getCallHistoryPeerId({ selectedUserId: currentUserId, currentUserId }), null);
});

test("returns the peer ID for a valid selected private conversation", () => {
    assert.equal(getCallHistoryPeerId({ selectedUserId: peerId, currentUserId }), peerId);
});
