import { useEffect, useState } from "react";
import axios from "axios";
import {
    ArrowLeft,
    Bell,
    Check,
    Info,
    Lock,
    Palette,
    Shield,
    Volume2
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "./config";
import { isNotificationSoundEnabled, playNotificationSound } from "./utils/notificationSound";

function SettingsDetail() {
    const navigate = useNavigate();
    const location = useLocation();

    const [notifications, setNotifications] = useState(
        localStorage.getItem("chatspace_notifications") !== "false"
    );

    const [messagePreview, setMessagePreview] = useState(
        localStorage.getItem("chatspace_message_preview") !== "false"
    );

    const [sound, setSound] = useState(
        localStorage.getItem("chatspace_sound") !== "false"
    );

    const [background, setBackground] = useState(
        localStorage.getItem("chatspace_background") || "default"
    );

    const [messageStyle, setMessageStyle] = useState(
        localStorage.getItem("chatspace_message_style") || "rounded"
    );
    const [messageFont, setMessageFont] = useState(
        localStorage.getItem("chatspace_message_font") || "default"
    );
    const [privacySettings, setPrivacySettings] = useState({
        showOnlineStatus: true,
        readReceiptsEnabled: true,
        typingIndicatorEnabled: true
    });
    const [privacyLoading, setPrivacyLoading] = useState(true);
    const [privacyLoadError, setPrivacyLoadError] = useState(false);
    const [privacySaving, setPrivacySaving] = useState(false);
    const [privacyError, setPrivacyError] = useState("");

    useEffect(() => {
        if (location.pathname !== "/privacy") return;
        let active = true;
        axios.get(apiUrl("/preferences/privacy"))
            .then((response) => {
                if (active) {
                    setPrivacySettings({
                        showOnlineStatus: response.data.showOnlineStatus !== false,
                        readReceiptsEnabled: response.data.readReceiptsEnabled !== false,
                        typingIndicatorEnabled: response.data.typingIndicatorEnabled !== false
                    });
                    setPrivacyLoadError(false);
                    setPrivacyError("");
                }
            })
            .catch((error) => {
                if (active) {
                    setPrivacyLoadError(true);
                    setPrivacyError(error.response?.data?.message || "Privacy settings could not be loaded.");
                }
            })
            .finally(() => {
                if (active) setPrivacyLoading(false);
            });
        return () => { active = false; };
    }, [location.pathname]);

    const pageData = {
        "/privacy": {
            title: "Privacy",
            description: "Control your visibility and conversations.",
            icon: Shield
        },

        "/security": {
            title: "Security",
            description: "Manage your account access and session security.",
            icon: Lock
        },

        "/chat-background": {
            title: "Chat background",
            description: "Personalize your conversation background.",
            icon: Palette
        },

        "/message-style": {
            title: "Message style",
            description: "Adjust the appearance of your message bubbles.",
            icon: Info
        },

        "/notifications": {
            title: "Notifications",
            description: "Manage your ChatSpace message alerts.",
            icon: Bell
        },

        "/sound": {
            title: "Sound",
            description: "Control notification sounds.",
            icon: Volume2
        },

        "/about": {
            title: "About ChatSpace",
            description: "Real-Time Communication Platform.",
            icon: Info
        }
    };

    const current = pageData[location.pathname];

    if (!current) {
        return null;
    }

    const Icon = current.icon;

    const saveNotifications = (value) => {
        setNotifications(value);
        localStorage.setItem(
            "chatspace_notifications",
            value
        );
    };

    const savePreview = (value) => {
        setMessagePreview(value);
        localStorage.setItem(
            "chatspace_message_preview",
            value
        );
    };

    const saveSound = (value) => {
        setSound(value);
        localStorage.setItem(
            "chatspace_sound",
            value
        );
    };

    const saveBackground = (value) => {
        setBackground(value);
        localStorage.setItem(
            "chatspace_background",
            value
        );

        window.dispatchEvent(
            new Event("chatspace-settings-change")
        );
    };

    const saveMessageStyle = (value) => {
        setMessageStyle(value);
        localStorage.setItem(
            "chatspace_message_style",
            value
        );

        window.dispatchEvent(
            new Event("chatspace-settings-change")
        );
    };

    const saveMessageFont = (value) => {
        setMessageFont(value);
        localStorage.setItem("chatspace_message_font", value);
        window.dispatchEvent(new Event("chatspace-settings-change"));
    };

    const savePrivacyPreference = async (preference, value) => {
        const previousValue = privacySettings[preference];
        setPrivacySettings((previous) => ({ ...previous, [preference]: value }));
        setPrivacyError("");
        setPrivacySaving(true);
        try {
            const response = await axios.patch(apiUrl("/preferences/privacy"), { preference, enabled: value });
            setPrivacySettings((previous) => ({ ...previous, [preference]: response.data.enabled !== false }));
        } catch (error) {
            setPrivacySettings((previous) => ({ ...previous, [preference]: previousValue }));
            setPrivacyError(error.response?.data?.message || "Privacy setting could not be saved. The previous setting was restored.");
        } finally {
            setPrivacySaving(false);
        }
    };

    return (
        <main className="cs-settings-page">
            <div className="cs-settings-shell">

                <header className="cs-page-header">
                    <button
                        type="button"
                        className="cs-back-button"
                        onClick={() => navigate("/settings")}
                    >
                        <ArrowLeft size={17} />
                        <span>Settings</span>
                    </button>

                    <div className="cs-page-brand">
                        ChatSpace
                    </div>
                </header>

                <div className="cs-settings-intro">
                    <span className="cs-page-eyebrow">
                        CHATSPACE
                    </span>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            marginTop: "12px"
                        }}
                    >
                        <div
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#fff1ec",
                                color: "#ef6b4f"
                            }}
                        >
                            <Icon size={22} />
                        </div>

                        <div>
                            <h1 style={{ margin: 0 }}>
                                {current.title}
                            </h1>

                            <p style={{ marginTop: "6px" }}>
                                {current.description}
                            </p>
                        </div>
                    </div>
                </div>

                {location.pathname === "/privacy" && (
                    <div className="cs-settings-card">

                        <SettingToggle
                            title="Show online status"
                            description="Allow other users to see when you are online."
                            checked={privacySettings.showOnlineStatus}
                            disabled={privacyLoading || privacySaving || privacyLoadError}
                            onChange={(value) => savePrivacyPreference("showOnlineStatus", value)}
                        />

                        <SettingToggle
                            title="Read receipts"
                            description="Allow other members to see when you have read their messages. Delivery ticks are unchanged."
                            checked={privacySettings.readReceiptsEnabled}
                            disabled={privacyLoading || privacySaving || privacyLoadError}
                            onChange={(value) => savePrivacyPreference("readReceiptsEnabled", value)}
                        />

                        <SettingToggle
                            title="Typing indicator"
                            description="Show when you are typing a message."
                            checked={privacySettings.typingIndicatorEnabled}
                            disabled={privacyLoading || privacySaving || privacyLoadError}
                            onChange={(value) => savePrivacyPreference("typingIndicatorEnabled", value)}
                        />
                        {privacyError && <p role="alert" className="cs-settings-error">{privacyError}</p>}

                    </div>
                )}

                {location.pathname === "/security" && (
                    <div className="cs-settings-card">

                        <div className="cs-detail-item">
                            <div>
                                <strong>Session security</strong>
                                <small>
                                    Your login session is protected using authentication tokens.
                                </small>
                            </div>

                            <Check size={19} />
                        </div>

                        <div className="cs-detail-item">
                            <div>
                                <strong>Password protection</strong>
                                <small>
                                    Passwords are securely processed by the server.
                                </small>
                            </div>

                            <Check size={19} />
                        </div>

                        <button
                            className="cs-action-button"
                            type="button"
                            onClick={() => alert("Password reset feature can be connected here.")}
                        >
                            Manage password
                        </button>

                    </div>
                )}

                {location.pathname === "/chat-background" && (
                    <div className="cs-settings-card cs-wallpaper-grid">

                        <BackgroundOption
                            label="Default"
                            value="default"
                            selected={background}
                            onClick={saveBackground}
                            preview
                        />

                        <BackgroundOption
                            label="Soft"
                            value="soft"
                            selected={background}
                            onClick={saveBackground}
                            preview
                        />

                        <BackgroundOption
                            label="Midnight"
                            value="midnight"
                            selected={background}
                            onClick={saveBackground}
                            preview
                        />

                        <BackgroundOption
                            label="Lavender"
                            value="lavender"
                            selected={background}
                            onClick={saveBackground}
                            preview
                        />

                    </div>
                )}

                {location.pathname === "/message-style" && (
                    <>
                        <div className="cs-appearance-section">
                            <h2>Message style</h2>
                            <div className="cs-appearance-options">
                                <AppearanceOption label="Rounded" value="rounded" selected={messageStyle} onClick={saveMessageStyle} />
                                <AppearanceOption label="Compact" value="compact" selected={messageStyle} onClick={saveMessageStyle} />
                                <AppearanceOption label="Modern" value="modern" selected={messageStyle} onClick={saveMessageStyle} />
                            </div>
                        </div>
                        <div className="cs-appearance-section">
                            <h2>Chat font</h2>
                            <div className="cs-appearance-options">
                                <AppearanceOption label="Default" value="default" selected={messageFont} onClick={saveMessageFont} />
                                <AppearanceOption label="Clean" value="clean" selected={messageFont} onClick={saveMessageFont} />
                                <AppearanceOption label="Serif" value="serif" selected={messageFont} onClick={saveMessageFont} />
                                <AppearanceOption label="Monospace" value="monospace" selected={messageFont} onClick={saveMessageFont} />
                            </div>
                        </div>
                    </>
                )}

                {location.pathname === "/notifications" && (
                    <div className="cs-settings-card">

                        <SettingToggle
                            title="Message notifications"
                            description="Receive notifications when a new message arrives."
                            checked={notifications}
                            onChange={saveNotifications}
                        />

                        <SettingToggle
                            title="Message preview"
                            description="Show message content in notifications."
                            checked={messagePreview}
                            onChange={savePreview}
                        />

                    </div>
                )}

               {location.pathname === "/sound" && (
    <div className="cs-settings-card">

        <SettingToggle
            title="Notification sound"
            description="Play a sound when a new message arrives."
            checked={sound}
            onChange={saveSound}
        />

       
<button
    type="button"
    className="cs-action-button"
    disabled={!sound}
    onClick={() => {
        if (!sound || !isNotificationSoundEnabled()) return;
        const played = playNotificationSound();

        if (!played) {
            alert("Audio is not supported in this browser.");
        }
    }}
>
    Test notification sound
</button>

    </div>
)}

                {location.pathname === "/about" && (
                    <div className="cs-settings-card">

                        <div className="cs-about-box">
                            <div className="cs-about-logo">
                                C
                            </div>

                            <h2>ChatSpace</h2>

                            <p>
                                Real-Time Communication Platform
                            </p>

                            <span>
                                Built with MERN Stack,
                                Socket.IO and MongoDB.
                            </span>

                            <small>
                                Version 1.0.0
                            </small>
                        </div>

                    </div>
                )}

            </div>
        </main>
    );
}

function SettingToggle({
    title,
    description,
    checked,
    onChange,
    disabled = false
}) {
    return (
        <div className="cs-detail-item">

            <div>
                <strong>{title}</strong>

                <small>
                    {description}
                </small>
            </div>

            <div className="cs-toggle-control">
                <button
                    type="button"
                    className="cs-toggle"
                    disabled={disabled}
                    aria-label={`${title}: ${checked ? "On" : "Off"}`}
                    aria-pressed={checked}
                    onClick={() => onChange && onChange(!checked)}
                >
                    <span className="cs-toggle-knob" />
                </button>
                <span className="cs-toggle-state">{checked ? "On" : "Off"}</span>
            </div>

        </div>
    );
}

function BackgroundOption({
    label,
    value,
    selected,
    onClick,
    preview = false
}) {
    return (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={`cs-detail-option${preview ? " cs-wallpaper-option" : ""}`}
            aria-pressed={selected === value}
        >
            {preview && (
                <span className="cs-wallpaper-preview" data-wallpaper-preview={value} aria-hidden="true">
                    <span />
                    <span />
                </span>
            )}
            {preview ? (
                <span className="cs-wallpaper-option-label">
                    {label}
                    {selected === value && <Check size={18} aria-hidden="true" />}
                </span>
            ) : (
                <span>{label}</span>
            )}

            {!preview && selected === value && (
                <Check size={18} aria-hidden="true" />
            )}
        </button>
    );
}

function AppearanceOption({ label, value, selected, onClick }) {
    return (
        <button type="button" className="cs-appearance-option" aria-pressed={selected === value} onClick={() => onClick(value)}>
            <span className={`cs-appearance-preview is-${value}`} aria-hidden="true">
                <span />
                <span>Chat message</span>
            </span>
            <span className="cs-wallpaper-option-label">
                {label}
                {selected === value && <Check size={18} aria-hidden="true" />}
            </span>
        </button>
    );
}

export default SettingsDetail;
