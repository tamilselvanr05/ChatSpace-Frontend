import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMessageMenuPosition } from "./messageMenuPosition.js";

const containerRect = { top: 100, bottom: 500, left: 100, right: 500 };

describe("calculateMessageMenuPosition", () => {
    it("opens above a message when the menu does not fit below it", () => {
        const position = calculateMessageMenuPosition({
            containerRect,
            triggerRect: { top: 430, bottom: 450, left: 430, right: 470 },
            menuWidth: 180,
            menuHeight: 240,
            viewportWidth: 1000,
            viewportHeight: 800
        });
        assert.equal(position.top, 184);
        assert.equal(position.left, 290);
        assert.ok(position.top + 240 < containerRect.bottom);
    });

    it("clamps the menu inside a narrow chat container and limits height", () => {
        const position = calculateMessageMenuPosition({
            containerRect: { top: 300, bottom: 400, left: 100, right: 330 },
            triggerRect: { top: 350, bottom: 370, left: 110, right: 150 },
            menuWidth: 180,
            menuHeight: 300,
            viewportWidth: 360,
            viewportHeight: 420
        });
        assert.equal(position.left, 110);
        assert.equal(position.width, 180);
        assert.equal(position.maxHeight, 84);
        assert.ok(position.left + position.width <= 322);
        assert.ok(position.top >= 308);
        assert.ok(position.top + position.maxHeight <= 392);
    });

    it("does not position a menu when its message is outside the visible chat area", () => {
        assert.equal(calculateMessageMenuPosition({
            containerRect,
            triggerRect: { top: 510, bottom: 530, left: 200, right: 240 },
            menuWidth: 180,
            menuHeight: 220,
            viewportWidth: 1000,
            viewportHeight: 800
        }), null);
    });
});
