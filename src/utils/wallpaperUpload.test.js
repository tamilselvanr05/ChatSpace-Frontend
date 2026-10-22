import assert from "node:assert/strict";
import test from "node:test";
import { createWallpaperUpload } from "./wallpaperUpload.js";

test("wallpaper upload contains the edited crop rather than the source image", async () => {
    const editedCrop = new Blob(["cropped-and-rotated-bytes"], { type: "image/jpeg" });
    const upload = createWallpaperUpload(editedCrop);
    const file = upload.get("file");
    assert.equal(file.name, "chat-wallpaper.jpg");
    assert.equal(file.type, "image/jpeg");
    assert.equal(await file.text(), "cropped-and-rotated-bytes");
});
