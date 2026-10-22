import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Cropper from "react-easy-crop";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { apiUrl } from "../config";
import { getCroppedImage } from "../utils/cropImage";
import { createWallpaperUpload } from "../utils/wallpaperUpload";
import { ProtectedImage } from "./ProtectedMedia";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function ConversationWallpaperDialog({ peer, onClose, onUpdated }) {
    const fileInputRef = useRef(null);
    const [savedWallpaper, setSavedWallpaper] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [editedPreview, setEditedPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const file = selectedImage?.file || null;
    const previewUrl = selectedImage?.previewUrl || null;

    useEffect(() => {
        let active = true;
        axios.get(apiUrl(`/conversations/${peer._id}/wallpaper`))
            .then(({ data }) => {
                if (active) setSavedWallpaper(data.wallpaper || null);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Wallpaper could not be loaded.");
            });
        return () => { active = false; };
    }, [peer._id]);

    useEffect(() => () => {
        if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl);
    }, [selectedImage]);

    useEffect(() => () => {
        if (editedPreview?.url) URL.revokeObjectURL(editedPreview.url);
    }, [editedPreview]);

    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key === "Escape" && !busy) onClose();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [busy, onClose]);

    const selectFile = (event) => {
        const selected = event.target.files?.[0] || null;
        event.target.value = "";
        setError("");
        if (!selected) return;
        if (!SUPPORTED_IMAGE_TYPES.has(selected.type)) {
            setError("Choose a JPEG, PNG, or WebP image.");
            return;
        }
        if (selected.size > MAX_IMAGE_SIZE) {
            setError("Choose an image smaller than 10 MB.");
            return;
        }
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
        setEditedPreview(null);
        setSelectedImage({ file: selected, previewUrl: URL.createObjectURL(selected) });
    };

    const resetEdits = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
        setEditedPreview(null);
        setError("");
    };

    const previewEditedWallpaper = async () => {
        if (!previewUrl || !croppedAreaPixels || busy) return;
        setBusy(true);
        setError("");
        try {
            const blob = await getCroppedImage(previewUrl, croppedAreaPixels, rotation, { width: 1280, height: 720 });
            setEditedPreview({ blob, url: URL.createObjectURL(blob) });
        } catch {
            setError("This image could not be prepared. Choose another image and try again.");
        } finally {
            setBusy(false);
        }
    };

    const applyWallpaper = async () => {
        if (!file || !editedPreview?.blob || busy) return;
        setBusy(true);
        setError("");
        try {
            const body = createWallpaperUpload(editedPreview.blob);
            const { data } = await axios.put(apiUrl(`/conversations/${peer._id}/wallpaper`), body);
            setSavedWallpaper(data.wallpaper);
            setSelectedImage(null);
            setEditedPreview(null);
            onUpdated(data.wallpaper);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Wallpaper could not be saved. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const resetWallpaper = async () => {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            await axios.delete(apiUrl(`/conversations/${peer._id}/wallpaper`));
            setSavedWallpaper(null);
            setSelectedImage(null);
            setEditedPreview(null);
            onUpdated(null);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Wallpaper could not be reset. Try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="cs-wallpaper-dialog-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) onClose();
        }}>
            <section className="cs-wallpaper-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-wallpaper-dialog-title">
                <h2 id="cs-wallpaper-dialog-title">Chat Wallpaper</h2>
                <p>Only you will see this wallpaper in your conversation with {peer.username}.</p>
                <div className={`cs-wallpaper-photo-preview${previewUrl && !editedPreview ? " cs-wallpaper-crop-area" : ""}`}>
                    {editedPreview ? (
                        <img className="cs-wallpaper-edited-preview" src={editedPreview.url} alt="Preview of edited chat wallpaper" />
                    ) : previewUrl ? (
                        <Cropper
                            image={previewUrl}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={16 / 9}
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                        />
                    ) : savedWallpaper ? (
                        <ProtectedImage
                            path={savedWallpaper.mediaPath}
                            refreshKey={savedWallpaper.version}
                            alt="Current chat wallpaper"
                            fallback="Wallpaper unavailable"
                        />
                    ) : (
                        <span>Default chat background</span>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={selectFile}
                    hidden
                />
                {previewUrl && !editedPreview && (
                    <>
                        <label className="cs-wallpaper-zoom">
                            <ZoomOut size={17} aria-hidden="true" />
                            <span>Zoom</span>
                            <input aria-label="Zoom chat wallpaper" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={busy} />
                            <ZoomIn size={17} aria-hidden="true" />
                        </label>
                        <div className="cs-wallpaper-rotate">
                            <button type="button" onClick={() => setRotation((value) => (value - 90 + 360) % 360)} disabled={busy}><RotateCcw size={17} /> Rotate left</button>
                            <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} disabled={busy}><RotateCw size={17} /> Rotate right</button>
                        </div>
                    </>
                )}
                <div className="cs-wallpaper-dialog-actions">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>Choose image</button>
                    <button type="button" onClick={resetWallpaper} disabled={busy || (!savedWallpaper && !file)}>Reset to default</button>
                    {file && <button type="button" onClick={resetEdits} disabled={busy}>Reset edits</button>}
                    {file && (editedPreview
                        ? <button type="button" onClick={() => setEditedPreview(null)} disabled={busy}>Adjust crop</button>
                        : <button type="button" onClick={previewEditedWallpaper} disabled={busy || !croppedAreaPixels}>{busy ? "Preparing…" : "Preview crop"}</button>)}
                    <span className="cs-wallpaper-dialog-spacer" />
                    <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="button" onClick={applyWallpaper} disabled={busy || !file || !editedPreview}>{busy ? editedPreview ? "Saving…" : "Preparing…" : "Apply"}</button>
                </div>
                {error && <p className="cs-wallpaper-dialog-error" role="alert">{error}</p>}
            </section>
        </div>
    );
}
