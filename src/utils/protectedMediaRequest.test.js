import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createProtectedImageFallback, getProtectedImageFallback, requestProtectedMedia } from "./protectedMediaRequest.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("simultaneous profile photo requests share one in-flight request", async () => {
    let calls = 0;
    let resolveRequest;
    const load = () => {
        calls += 1;
        return new Promise((resolve) => { resolveRequest = resolve; });
    };
    const options = { key: "dedupe-1", path: "/media/profiles/dedupe-1", mediaKind: "image", load };
    const first = requestProtectedMedia(options);
    const second = requestProtectedMedia(options);
    await tick();
    assert.equal(calls, 1);
    resolveRequest({ data: "image" });
    assert.deepEqual(await Promise.all([first, second]), [{ data: "image" }, { data: "image" }]);
});

test("confirmed profile photo 404s are cached, while a changed version can load", async () => {
    const path = "/media/profiles/missing-1";
    let calls = 0;
    const missing = () => {
        calls += 1;
        return Promise.reject({ response: { status: 404 } });
    };
    const oldVersion = { key: "missing-1\u0000v1\u0000image", path, mediaKind: "image", load: missing };
    await assert.rejects(requestProtectedMedia(oldVersion));
    await assert.rejects(requestProtectedMedia(oldVersion), (error) => error.cached === true);
    assert.equal(calls, 1);

    const newer = await requestProtectedMedia({
        ...oldVersion,
        key: "missing-1\u0000v2\u0000image",
        load: async () => ({ data: "new photo" })
    });
    assert.equal(newer.data, "new photo");
});

test("profile photo failures use the avatar fallback and other images keep their generic fallback", () => {
    assert.equal(getProtectedImageFallback("/media/profiles/user-1"), "\u{1F464}");
    assert.equal(getProtectedImageFallback("/media/profiles/user-1", "This photo could not be loaded."), "\u{1F464}");
    assert.equal(getProtectedImageFallback("/media/messages/message-1"), "Image unavailable");
    assert.equal(getProtectedImageFallback("/media/messages/message-1", "Custom fallback"), "Custom fallback");
});

test("a profile-photo 404 visibly renders the avatar in the fallback span", async () => {
    await assert.rejects(requestProtectedMedia({
        key: "render-missing-photo\u0000v1\u0000image",
        path: "/media/profiles/render-missing-photo",
        mediaKind: "image",
        load: async () => { throw { response: { status: 404 } }; }
    }));

    const markup = renderToStaticMarkup(createProtectedImageFallback({
        path: "/media/profiles/missing-photo",
        fallback: "This photo could not be loaded.",
        className: "cs-photo-viewer-error",
        alt: "Profile photo"
    }));

    assert.match(markup, /<span[^>]*role="img"/);
    assert.match(markup, /class="cs-photo-viewer-error"/);
    assert.match(markup, /👤/);
    assert.doesNotMatch(markup, /This photo could not be loaded/);

    const profileMarkup = renderToStaticMarkup(createProtectedImageFallback({
        path: "/media/profiles/missing-photo",
        fallback: "👤",
        className: "cs-profile-photo-fallback",
        style: { width: "140px", height: "140px", borderRadius: "50%", objectFit: "cover" }
    }));
    assert.match(profileMarkup, /class="cs-profile-photo-fallback"/);
    assert.match(profileMarkup, /style="width:140px;height:140px;border-radius:50%;object-fit:cover"/);
    assert.match(profileMarkup, /👤/);
});
