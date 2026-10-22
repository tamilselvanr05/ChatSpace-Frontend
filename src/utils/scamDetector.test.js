import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectSuspiciousMessage } from "./scamDetector.js";

describe("detectSuspiciousMessage", () => {
    it("does not flag ordinary conversation or a normal external URL", () => {
        assert.equal(detectSuspiciousMessage("See you at lunch https://example.com/menu"), null);
        assert.equal(detectSuspiciousMessage("Thanks for sharing the project update."), null);
    });

    it("does not warn on ordinary security-related wording by itself", () => {
        assert.equal(detectSuspiciousMessage("Please send the OTP"), null);
        assert.equal(detectSuspiciousMessage("I forgot my password; can you help me reset it?"), null);
        assert.equal(detectSuspiciousMessage("I paid my rent through the bank app and got an OTP"), null);
        assert.equal(detectSuspiciousMessage("The bank link is in the project notes"), null);
    });

    it("warns tentatively when a sensitive request is combined with coercion or an authority claim", () => {
        const threat = detectSuspiciousMessage("Your bank account will be suspended immediately. Send your OTP now.");
        assert.equal(threat.risk, "High");
        assert.match(threat.reasons.join(" "), /combines a request.*pressure/);

        const impersonation = detectSuspiciousMessage("Bank security team: reply with your password to verify your account.");
        assert.equal(impersonation.risk, "High");
    });

    it("warns on urgent money pressure and prize fee patterns", () => {
        assert.equal(detectSuspiciousMessage("Urgent: transfer money immediately").risk, "High");
        assert.equal(detectSuspiciousMessage("You won a lottery prize, pay a processing fee to claim").risk, "Medium");
    });

    it("warns on URL shorteners and misleading displayed destinations", () => {
        assert.match(detectSuspiciousMessage("Open https://bit.ly/abc").reasons.join(" "), /URL-shortening/);
        assert.match(detectSuspiciousMessage("[https://example.com](https://attacker.test/path)").reasons.join(" "), /displayed link text/);
    });
});
