import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSummaryRequest, MAX_PASTED_SUMMARY_CHARACTERS } from "./chatSummaryRequest.js";

describe("buildSummaryRequest consent and source validation", () => {
    it("does not create a provider request before explicit confirmation", () => {
        assert.equal(buildSummaryRequest({ source: "text", summaryType: "full", text: "Private draft", consentConfirmed: false }), null);
    });

    it("sends only pasted text, source, and summary type after confirmation without requiring chat membership", () => {
        const request = buildSummaryRequest({
            source: "text", summaryType: "actions", text: " Assign Pat to update release notes. ", consentConfirmed: true,
            conversationType: "group", conversationId: "must-not-be-in-request", userId: "must-not-be-in-request"
        });
        assert.deepEqual(request, { source: "text", summaryType: "actions", text: "Assign Pat to update release notes." });
    });

    it("rejects empty or oversized pasted text", () => {
        assert.equal(buildSummaryRequest({ source: "text", summaryType: "full", text: "  ", consentConfirmed: true }), null);
        assert.equal(buildSummaryRequest({ source: "text", summaryType: "full", text: "x".repeat(MAX_PASTED_SUMMARY_CHARACTERS + 1), consentConfirmed: true }), null);
    });

    it("includes the target only for current-chat mode", () => {
        assert.deepEqual(buildSummaryRequest({ source: "chat", summaryType: "deadlines", conversationType: "private", conversationId: "peer-1", consentConfirmed: true }), {
            source: "chat", summaryType: "deadlines", conversationType: "private", conversationId: "peer-1"
        });
        assert.equal(buildSummaryRequest({ source: "chat", summaryType: "full", conversationType: "group", consentConfirmed: true }), null);
    });
});
