import assert from "node:assert/strict";
import test from "node:test";
import { getCroppedImage, rotateSize } from "./cropImage.js";

test("rotateSize keeps right-angle rotations bounded without stretching", () => {
    assert.deepEqual(rotateSize(400, 200, 0), { width: 400, height: 200 });
    const quarterTurn = rotateSize(400, 200, 90);
    assert.ok(Math.abs(quarterTurn.width - 200) < 1e-9);
    assert.ok(Math.abs(quarterTurn.height - 400) < 1e-9);
});

test("getCroppedImage renders the selected rotated crop at the requested wallpaper dimensions", async () => {
    const originalImage = globalThis.Image;
    const originalDocument = globalThis.document;
    const canvases = [];
    const drawCalls = [];
    class FakeImage {
        width = 400;
        height = 200;
        set src(_source) { queueMicrotask(() => this.onload()); }
    }
    globalThis.Image = FakeImage;
    globalThis.document = {
        createElement: () => {
            const canvas = {
                width: 0,
                height: 0,
                getContext: () => ({
                    translate() {},
                    rotate() {},
                    drawImage: (...args) => drawCalls.push({ canvas, args })
                }),
                toBlob: (callback, type) => callback(new Blob(["edited-crop"], { type }))
            };
            canvases.push(canvas);
            return canvas;
        }
    };

    try {
        const blob = await getCroppedImage("blob:source", { x: 10, y: 20, width: 300, height: 168 }, 90, { width: 1280, height: 720 });
        assert.equal(blob.type, "image/jpeg");
        assert.deepEqual([canvases[0].width, canvases[0].height], [200, 400]);
        assert.deepEqual([canvases[1].width, canvases[1].height], [1280, 720]);
        assert.deepEqual(drawCalls[1].args.slice(1), [10, 20, 300, 168, 0, 0, 1280, 720]);
    } finally {
        if (originalImage === undefined) delete globalThis.Image;
        else globalThis.Image = originalImage;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});
