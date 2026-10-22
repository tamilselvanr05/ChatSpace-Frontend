import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { getWrappedImageIndex } from "../utils/photoNavigation";
import { ProtectedDownload, ProtectedImage } from "./ProtectedMedia";

const downloadableImageTypes = new Set([
    "image/avif", "image/bmp", "image/gif", "image/jpeg", "image/png", "image/webp"
]);
const downloadableImageExtensions = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "webp"]);

function PhotoViewer({ images, activeIndex, onClose, onNavigate }) {
    const closeButtonRef = useRef(null);
    const previousButtonRef = useRef(null);
    const nextButtonRef = useRef(null);
    const closeRef = useRef(onClose);
    const navigateRef = useRef(onNavigate);
    const navigationRef = useRef({ activeIndex, length: images.length });
    const image = images[activeIndex];
    const isOpen = Boolean(image);

    useEffect(() => {
        closeRef.current = onClose;
        navigateRef.current = onNavigate;
        navigationRef.current = { activeIndex, length: images.length };
    }, [activeIndex, images.length, onClose, onNavigate]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeRef.current();
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const direction = event.key === "ArrowRight" ? 1 : -1;
                const nextIndex = getWrappedImageIndex(
                    navigationRef.current.activeIndex,
                    direction,
                    navigationRef.current.length
                );
                if (nextIndex >= 0) navigateRef.current(nextIndex);
            } else if (event.key === "Tab") {
                const buttons = [
                    closeButtonRef.current,
                    previousButtonRef.current,
                    nextButtonRef.current
                ].filter((button) => button && !button.disabled);
                if (!buttons.length) return;
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [isOpen]);

    if (!image) return null;

    const multipleImages = images.length > 1;
    const imageType = String(image.fileType || "").split(";")[0].trim().toLowerCase();
    const imageExtension = String(image.fileName || "").split(".").pop().toLowerCase();
    const canDownloadImage = image.messageType === "image" &&
        (downloadableImageTypes.has(imageType) || downloadableImageExtensions.has(imageExtension));
    const navigate = (direction) => {
        const nextIndex = getWrappedImageIndex(activeIndex, direction, images.length);
        if (nextIndex >= 0) onNavigate(nextIndex);
    };

    return (
        <div
            className="cs-photo-viewer-backdrop"
            role="presentation"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="cs-photo-viewer" role="dialog" aria-modal="true" aria-label="Photo viewer">
                <button
                    ref={closeButtonRef}
                    type="button"
                    className="cs-photo-viewer-close"
                    aria-label="Close photo viewer"
                    onClick={onClose}
                >
                    <X size={24} />
                </button>
                {multipleImages && (
                    <>
                        <button
                            ref={previousButtonRef}
                            type="button"
                            className="cs-photo-viewer-nav is-previous"
                            aria-label="Previous photo"
                            onClick={() => navigate(-1)}
                        >
                            <ChevronLeft size={28} />
                        </button>
                        <button
                            ref={nextButtonRef}
                            type="button"
                            className="cs-photo-viewer-nav is-next"
                            aria-label="Next photo"
                            onClick={() => navigate(1)}
                        >
                            <ChevronRight size={28} />
                        </button>
                    </>
                )}
                <div className="cs-photo-viewer-content" onClick={(event) => event.stopPropagation()}>
                    <ProtectedImage
                        key={image._id}
                        path={image.mediaPath || `/media/messages/${image._id}`}
                        refreshKey={image.refreshKey}
                        alt={image.fileName || "Shared photo"}
                        className="cs-photo-viewer-error"
                        loadingLabel="Loading photo…"
                    />
                    {multipleImages && (
                        <span className="cs-photo-viewer-count" aria-live="polite">
                            {activeIndex + 1} / {images.length}
                        </span>
                    )}
                    {image.fileName && <span className="cs-photo-viewer-caption">{image.fileName}</span>}
                    {!image.mediaPath?.startsWith("/media/profiles/") && canDownloadImage && (
                        <ProtectedDownload
                            className="cs-photo-viewer-download"
                            path={image.mediaPath || `/media/messages/${image._id}`}
                            fileName={image.fileName || `shared-photo-${activeIndex + 1}.jpg`}
                        >
                            <Download size={16} />
                            Download photo
                        </ProtectedDownload>
                    )}
                </div>
            </section>
        </div>
    );
}

export default PhotoViewer;
