import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const themes = [
    { id: "midnight", name: "Midnight", primary: "#8da3ff", sidebar: "#0d1424", background: "#172237", sent: "#324670" },
    { id: "ocean", name: "Ocean", primary: "#5269df", sidebar: "#111a2d", background: "#f4f6fa", sent: "#e0e8ff" },
    { id: "violet", name: "Violet", primary: "#7653d6", sidebar: "#21183a", background: "#f8f5fc", sent: "#e9e0fb" },
    { id: "emerald", name: "Emerald", primary: "#14866d", sidebar: "#102720", background: "#f3f8f5", sent: "#dcefe7" },
    { id: "sunset", name: "Sunset", primary: "#d05c46", sidebar: "#34202a", background: "#fbf5f1", sent: "#ffe4d7" },
    { id: "rose", name: "Rose", primary: "#bf4f78", sidebar: "#321e2a", background: "#fbf4f6", sent: "#f8e1e9" },
    { id: "light", name: "Light", primary: "#435ab8", sidebar: "#f5f7fb", background: "#f7f8fb", sent: "#e0e7fb" },
    { id: "dark", name: "Dark", primary: "#91a4ff", sidebar: "#151922", background: "#202630", sent: "#36445f" }
];

function Themes() {
    const navigate = useNavigate();
    const [selectedTheme, setSelectedTheme] = useState(
        () => localStorage.getItem("chatspace-theme") || "ocean"
    );

    useEffect(() => {
        document.documentElement.dataset.theme = selectedTheme;
        localStorage.setItem("chatspace-theme", selectedTheme);
    }, [selectedTheme]);

    return (
        <main className="cs-theme-page">
            <div className="cs-theme-shell">
                <header className="cs-page-header">
                    <button
                        type="button"
                        className="cs-back-button"
                        onClick={() => navigate("/settings")}
                    >
                        <ChevronRight size={17} className="cs-back-chevron" />
                        <span>Themes</span>
                    </button>
                    <div className="cs-page-brand">ChatSpace</div>
                </header>

                <div className="cs-settings-intro">
                    <span className="cs-page-eyebrow">APPEARANCE</span>
                    <h1>Choose a theme</h1>
                    <p>Your selection is saved on this device.</p>
                </div>

                <div className="cs-theme-grid">
                    {themes.map((theme) => (
                        <button
                            type="button"
                            className="cs-theme-card"
                            key={theme.id}
                            aria-pressed={selectedTheme === theme.id}
                            onClick={() => setSelectedTheme(theme.id)}
                        >
                            <div
                                className="cs-theme-preview"
                                style={{
                                    background: theme.background,
                                    border: `1px solid ${theme.primary}33`
                                }}
                            >
                                <div className="cs-theme-preview-head">
                                    <span
                                        className="cs-theme-preview-mark"
                                        style={{ background: theme.sidebar }}
                                    >
                                        C
                                    </span>
                                    <strong>ChatSpace</strong>
                                </div>
                                <div className="cs-theme-preview-message is-received">
                                    Hello 👋
                                </div>
                                <div
                                    className="cs-theme-preview-message is-sent"
                                    style={{ background: theme.sent }}
                                >
                                    How are you?
                                </div>
                                <div
                                    className="cs-theme-preview-accent"
                                    style={{ background: theme.primary }}
                                />
                            </div>
                            <span className="cs-theme-name">{theme.name}</span>
                            {selectedTheme === theme.id && (
                                <span className="cs-theme-selected">
                                    <Check size={15} /> Selected
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </main>
    );
}

export default Themes;
