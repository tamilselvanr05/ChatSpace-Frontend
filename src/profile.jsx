import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cropper from "react-easy-crop";
import { RotateCcw, RotateCw, Settings, ZoomIn, ZoomOut } from "lucide-react";
import { apiUrl } from "./config";
import { ProtectedImage } from "./components/ProtectedMedia";
import PhotoViewer from "./components/PhotoViewer";
import { getCroppedImage } from "./utils/cropImage";
import { getProfileUser } from "./utils/profileResponse";

const SUPPORTED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function Profile() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [about, setAbout] = useState("");
    const [editing, setEditing] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [photoEditorSource, setPhotoEditorSource] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const photoPreviewUrl = photoPreview?.url || null;
    const [photoError, setPhotoError] = useState("");
    const [photoSaving, setPhotoSaving] = useState(false);
    const [showProfilePhoto, setShowProfilePhoto] = useState(false);

    const fileInputRef = useRef(null);

    useEffect(() => () => {
        if (photoEditorSource) URL.revokeObjectURL(photoEditorSource);
    }, [photoEditorSource]);

    useEffect(() => () => {
        if (photoPreview?.url) URL.revokeObjectURL(photoPreview.url);
    }, [photoPreview]);

    useEffect(() => {
        if (!photoEditorSource) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === "Escape" && !photoSaving) {
                setPhotoEditorSource(null);
                setPhotoPreview(null);
                setPhotoError("");
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [photoEditorSource, photoSaving]);

    useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {

        try {
            const response =
                await axios.get(
                    apiUrl("/profile")
                );

            const profile = getProfileUser(response);
            if (!profile) throw new Error("Profile response has no user ID");

            setUser(profile);

            setNewUsername(
                profile.username
            );

            setAbout(
                profile.about ||
                ""
            );

            setProfilePhoto(
                profile.profilePhoto
            );

        } catch (error) {

            console.log(
                error.response?.data ||
                error.message
            );

        }

    }

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";

        if (!file) {
            return;
        }

        if (!SUPPORTED_PROFILE_PHOTO_TYPES.has(file.type)) {
            setPhotoError("Choose a JPEG, PNG, or WebP image.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setPhotoError("Image must be smaller than 10 MB.");
            return;
        }
        setPhotoError("");
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setPhotoPreview(null);
        setPhotoEditorSource(URL.createObjectURL(file));
    };

    const closePhotoEditor = () => {
        if (photoSaving) return;
        setPhotoEditorSource(null);
        setPhotoPreview(null);
        setPhotoError("");
    };

    const previewCroppedPhoto = async () => {
        if (!photoEditorSource || !croppedAreaPixels) return;
        try {
            const blob = await getCroppedImage(photoEditorSource, croppedAreaPixels, rotation);
            setPhotoPreview({ blob, url: URL.createObjectURL(blob) });
            setPhotoError("");
        } catch {
            setPhotoError("This image could not be prepared. Choose another image and try again.");
        }
    };

    const saveCroppedPhoto = async () => {
        if (!photoPreview || photoSaving) return;
        setPhotoSaving(true);
        setPhotoError("");
        try {
            const formData = new FormData();
            formData.append("file", new File([photoPreview.blob], "profile-photo.jpg", { type: "image/jpeg" }));
            const response = await axios.put(apiUrl("/profile/photo"), formData);
            setProfilePhoto(response.data.profilePhoto);
            setUser((previous) => previous ? { ...previous, profilePhoto: response.data.profilePhoto } : previous);
            setShowProfilePhoto(false);
            setPhotoEditorSource(null);
            setPhotoPreview(null);
        } catch (error) {
            setPhotoError(error.response?.data?.message || "Profile photo upload failed. You can retry without selecting the image again.");
        } finally {
            setPhotoSaving(false);
        }
    };

    const updateProfile = async () => {

        try {
            await axios.put(
                apiUrl("/profile"),
                {
                    username:
                        newUsername,
                    about:
                        about
                }
            );

            alert(
                "Profile updated successfully"
            );

            setEditing(false);

            fetchProfile();

        } catch (error) {

            console.log(
                error.response?.data ||
                error.message
            );

            alert(
                error.response?.data?.message ||
                "Profile update failed"
            );

        }

    };

    if (!user) {

        return (
            <div
                style={{
                    padding: "30px"
                }}
            >
                Loading profile...
            </div>
        );

    }

    return (
            <main
                className="cs-profile-page"
            style={{
                width: "100%",
                minHeight: "100vh"
            }}
        >

            <div
                className="cs-profile-card"
                style={{
                    maxWidth: "500px",
                    margin: "0 auto",
                    minHeight: "100vh"
                }}
            >

                <div
                    className="cs-profile-header"
                    style={{
                        padding: "18px",
                        fontSize: "20px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigate("/chat")}
                        style={{
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            padding: 0,
                            font: "inherit",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px"
                        }}
                    >
                        <span aria-hidden="true">←</span>
                        Profile
                    </button>

                    <button
                        type="button"
                        aria-label="Settings"
                        title="Settings"
                        onClick={() => navigate("/settings")}
                        style={{
                            border: "1px solid rgba(255,255,255,0.35)",
                            background: "rgba(255,255,255,0.1)",
                            color: "inherit",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px"
                        }}
                    >
                        <Settings size={17} /> Settings
                    </button>
                </div>

                <div
                    className="cs-profile-photo-section"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "30px"
                    }}
                >

                    <div
                        style={{
                            position: "relative"
                        }}
                    >

                        {profilePhoto ? (
                            <button type="button" className="cs-profile-photo-view-trigger" aria-label="View profile photo" onClick={() => setShowProfilePhoto(true)}>
                                <ProtectedImage
                                    path={`/media/profiles/${user._id}`}
                                    refreshKey={profilePhoto}
                                    alt="Profile photo"
                                    className="cs-profile-photo-fallback"
                                    fallback="👤"
                                    style={{ width: "140px", height: "140px", borderRadius: "50%", objectFit: "cover" }}
                                />
                            </button>
                        ) : (
                            <div className="cs-profile-photo-fallback" aria-label="No profile photo">👤</div>
                        )}

                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            fileInputRef.current.click()
                        }
                        style={{
                            marginTop: "12px",
                            border: "none",
                            background: "transparent",
                            color: "var(--cs-brand)",
                            fontSize: "15px",
                            cursor: "pointer"
                        }}
                    >
                        📷 Change photo
                    </button>

                    <input
                        id="profile-photo-upload"
                        name="profilePhoto"
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                            handlePhotoChange
                        }
                        style={{
                            display: "none"
                        }}
                    />

                </div>

                {photoError && !photoEditorSource && <p className="cs-profile-photo-error" role="alert">{photoError}</p>}

                <div
                    className="cs-profile-details"
                    style={{
                        padding: "0 25px"
                    }}
                >

                    <p className="cs-profile-label">
                        Your name
                    </p>

                    {editing ? (

                        <input
                            id="profile-username"
                            name="username"
                            value={newUsername}
                            onChange={(e) =>
                                setNewUsername(
                                    e.target.value
                                )
                            }
                            className="cs-profile-input"
                        />

                    ) : (

                        <h3 className="cs-profile-value cs-profile-name">
                            {user.username}
                        </h3>

                    )}

                    <hr />

                    <p className="cs-profile-label">
                        About
                    </p>

                    {editing ? (

                        <input
                            id="profile-about"
                            name="about"
                            value={about}
                            onChange={(e) =>
                                setAbout(
                                    e.target.value
                                )
                            }
                            className="cs-profile-input"
                        />

                    ) : (

                        <p className="cs-profile-value cs-profile-about">
                            {about}
                        </p>

                    )}

                    <hr />

                    <p className="cs-profile-label">
                        Email
                    </p>

                    <p className="cs-profile-value cs-profile-email">
                        {user.email}
                    </p>

                    <br />

                    {editing ? (

                        <button
                            className="cs-profile-action"
                            onClick={
                                updateProfile
                            }
                            style={{
                                padding:
                                    "12px 20px",
                                border: "none",
                                borderRadius:
                                    "8px",
                                background:
                                    "var(--cs-brand)",
                                color: "#fff",
                                cursor:
                                    "pointer"
                            }}
                        >
                            Save Changes
                        </button>

                    ) : (

                        <button
                            className="cs-profile-action"
                            onClick={() =>
                                setEditing(true)
                            }
                            style={{
                                padding:
                                    "12px 20px",
                                border: "none",
                                borderRadius:
                                    "8px",
                                background:
                                    "var(--cs-brand)",
                                color: "#fff",
                                cursor:
                                    "pointer"
                            }}
                        >
                            Edit Profile
                        </button>

                    )}

                </div>

            </div>

        {photoEditorSource && (
            <div className="cs-photo-editor-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) closePhotoEditor();
            }}>
                <section className="cs-photo-editor" role="dialog" aria-modal="true" aria-labelledby="cs-photo-editor-title">
                    <h2 id="cs-photo-editor-title">Edit profile photo</h2>
                    <p>Drag to reposition, zoom, and rotate your square crop.</p>
                    <div className="cs-photo-editor-crop-area">
                        {photoPreviewUrl ? (
                            <img className="cs-photo-editor-final-preview" src={photoPreviewUrl} alt="Preview of the cropped profile photo" />
                        ) : (
                            <Cropper
                                image={photoEditorSource}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                            />
                        )}
                    </div>
                    {!photoPreviewUrl && (
                        <>
                            <label className="cs-photo-editor-zoom">
                                <ZoomOut size={17} aria-hidden="true" />
                                <span>Zoom</span>
                                <input aria-label="Zoom profile photo" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                                <ZoomIn size={17} aria-hidden="true" />
                            </label>
                            <div className="cs-photo-editor-rotate">
                                <button type="button" onClick={() => setRotation((value) => (value - 90 + 360) % 360)}><RotateCcw size={17} /> Rotate left</button>
                                <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw size={17} /> Rotate right</button>
                            </div>
                        </>
                    )}
                    <div className="cs-photo-editor-actions">
                        <button type="button" onClick={closePhotoEditor} disabled={photoSaving}>Cancel</button>
                        {photoPreviewUrl ? (
                            <>
                                <button type="button" onClick={() => setPhotoPreview(null)} disabled={photoSaving}>Adjust crop</button>
                                <button type="button" onClick={saveCroppedPhoto} disabled={photoSaving}>{photoSaving ? "Saving…" : "Save photo"}</button>
                            </>
                        ) : (
                            <button type="button" onClick={previewCroppedPhoto} disabled={!croppedAreaPixels || photoSaving}>Preview crop</button>
                        )}
                    </div>
                    {photoError && <p className="cs-photo-editor-error" role="alert">{photoError}</p>}
                </section>
            </div>
        )}

        <PhotoViewer
            images={showProfilePhoto && profilePhoto ? [{ _id: user._id, mediaPath: `/media/profiles/${user._id}`, refreshKey: profilePhoto, fileName: user.username }] : []}
            activeIndex={0}
            onClose={() => setShowProfilePhoto(false)}
        />
        </main>
    );

}

export default Profile;
