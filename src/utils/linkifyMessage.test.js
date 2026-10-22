import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitMessageLinks } from "./linkifyMessage.js";

describe("splitMessageLinks", () => {
    it("links standalone HTTP and HTTPS URLs", () => {
        assert.deepEqual(splitMessageLinks("https://www.wikipedia.org"), [
            { text: "https://www.wikipedia.org", href: "https://www.wikipedia.org" }
        ]);
        assert.deepEqual(splitMessageLinks("http://example.com"), [
            { text: "http://example.com", href: "http://example.com" }
        ]);
    });

    it("preserves text before and after embedded URLs", () => {
        assert.deepEqual(splitMessageLinks("Check this website: https://www.wikipedia.org today"), [
            { text: "Check this website: " },
            { text: "https://www.wikipedia.org", href: "https://www.wikipedia.org" },
            { text: " today" }
        ]);
    });

    it("leaves common trailing punctuation outside the link", () => {
        assert.deepEqual(splitMessageLinks("Read https://example.com/path, then https://example.org."), [
            { text: "Read " },
            { text: "https://example.com/path", href: "https://example.com/path" },
            { text: ", then " },
            { text: "https://example.org", href: "https://example.org" },
            { text: "." }
        ]);
        assert.deepEqual(splitMessageLinks("(https://example.com/path)."), [
            { text: "(" },
            { text: "https://example.com/path", href: "https://example.com/path" },
            { text: ")." }
        ]);
    });

    it("does not link unsafe schemes or interpret HTML", () => {
        const value = "javascript:alert(1) data:text/html,<b>hi</b> ftp://example.com";
        assert.deepEqual(splitMessageLinks(value), [{ text: value }]);
    });

    it("preserves newlines and does not link URLs containing credentials", () => {
        assert.deepEqual(splitMessageLinks("first line\nhttps://user:pass@example.com"), [
            { text: "first line\nhttps://user:pass@example.com" }
        ]);
    });
});
