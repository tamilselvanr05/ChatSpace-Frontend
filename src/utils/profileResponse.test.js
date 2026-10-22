import test from "node:test";
import assert from "node:assert/strict";
import { getProfileUser } from "./profileResponse.js";

const user = { _id: "user-1", username: "tamil", firebaseUid: "firebase-1" };

test("reads a user from the documented Axios profile response", () => {
    assert.equal(getProfileUser({ data: { user } }), user);
});

test("accepts an unwrapped profile body", () => {
    assert.equal(getProfileUser({ user }), user);
});

test("rejects missing or malformed profile identities", () => {
    assert.equal(getProfileUser({ data: {} }), null);
    assert.equal(getProfileUser({ data: { user: { username: "tamil" } } }), null);
});
