import assert from "node:assert/strict";
import test from "node:test";
import { getWrappedImageIndex } from "./photoNavigation.js";

test("photo navigation moves through images and wraps at either end", () => {
    assert.equal(getWrappedImageIndex(0, -1, 3), 2);
    assert.equal(getWrappedImageIndex(0, 1, 3), 1);
    assert.equal(getWrappedImageIndex(2, 1, 3), 0);
    assert.equal(getWrappedImageIndex(4, 1, 0), -1);
});
