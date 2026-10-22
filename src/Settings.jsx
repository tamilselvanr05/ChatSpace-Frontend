import { useEffect, useState } from "react";
import axios from "axios";
import {
    Bell,
    ChevronRight,
    Info,
    LogOut,
    Palette,
    Shield,
    UserRound,
    Volume2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import socket from "./socket";
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { apiUrl } from "./config";

const settingsSections = [
    {
        title: "ACCOUNT",
        rows: [
            {
                label: "Profile",
                description: "Manage your name, photo, and about",
                icon: UserRound,
                path: "/profile"
            },
            {
                label: "Privacy",
                description: "Control your visibility and conversations",
                icon: Shield,
                path: "/privacy"
            },
            {
                label: "Security",
                description: "Account access and session security",
                icon: Shield,
                path: "/security"
            }
        ]
    },
    {
        title: "APPEARANCE",
        rows: [
            {
                label: "Theme",
                description: "Choose how ChatSpace looks",
                icon: Palette,
                path: "/themes"
            },
            {
                label: "Chat background",
                description: "Personalize conversation surfaces",
                icon: Palette,
                path: "/chat-background"
            },
            {
                label: "Message style",
                description: "Adjust the look of message bubbles",
                icon: Info,
                path: "/message-style"
            }
        ]
    },
    {
        title: "NOTIFICATIONS",
        rows: [
            {
                label: "Notifications",
                description: "Manage message alerts",
                icon: Bell,
                path: "/notifications"
            },
            {
                label: "Sound",
                description: "Notification sounds and volume",
                icon: Volume2,
                path: "/sound"
            }
        ]
    },
    {
        title: "APPLICATION",
        rows: [
            {
                label: "About ChatSpace",
                description: "Real-Time Communication Platform",
                icon: Info,
                path: "/about"
            }
        ]
    }
];

function Settings() {
    const navigate = useNavigate();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [accountActionError, setAccountActionError] = useState("");
    const [accountDeletionPending, setAccountDeletionPending] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    useEffect(() => {
        axios.get(apiUrl("/blocked-users"))
            .then((response) => setBlockedUsers(response.data.users || []))
            .catch(() => {});
        axios.get(apiUrl("/account/deletion-status"))
            .then((response) => setAccountDeletionPending(Boolean(response.data.pending)))
            .catch(() => {});
    }, []);

    const logout = () => {
        socket.disconnect();
        signOut(auth);
        navigate("/");
    };

    const unblockUser = async (user) => {
        try {
            await axios.delete(apiUrl(`/users/${user._id}/block`));
            setBlockedUsers((previous) => previous.filter((blockedUser) => blockedUser._id !== user._id));
        } catch (error) {
            setAccountActionError(error.response?.data?.message || "User could not be unblocked.");
        }
    };

    const deleteAccount = async () => {
        const confirmed = window.confirm(
            "Permanently delete your ChatSpace account? Your profile and profile photo will be removed. Private and group messages and attachments will remain for other participants with your sender identity anonymized. You will be removed from groups; ownership transfers to another member. This cannot be undone."
        );
        if (!confirmed) return;

        setAccountActionError("");
        setDeletingAccount(true);
        try {
            if (!accountDeletionPending) {
                const currentUser = auth.currentUser;
                if (!currentUser?.email) throw new Error("Sign in again before deleting your account.");
                const password = window.prompt("Re-enter your password to confirm account deletion:");
                if (password === null) return;
                const credential = EmailAuthProvider.credential(currentUser.email, password);
                await reauthenticateWithCredential(currentUser, credential);
                await currentUser.getIdToken(true);
            }

            const response = await axios.delete(apiUrl("/account"));
            window.alert(response.data.message || "Your account has been deleted.");
            socket.disconnect();
            await signOut(auth);
            navigate("/");
        } catch (error) {
            const code = error.response?.data?.code;
            if (code === "ACCOUNT_DELETION_PENDING") setAccountDeletionPending(true);
            if (code === "REAUTHENTICATION_REQUIRED") setAccountDeletionPending(false);
            setAccountActionError(
                error.response?.data?.message ||
                (error.code?.startsWith("auth/")
                    ? "Reauthentication failed. Check your password and try again."
                    : error.message || "Account deletion failed.")
            );
        } finally {
            setDeletingAccount(false);
        }
    };

    return (
        <main className="cs-settings-page">
            <div className="cs-settings-shell">

                <header className="cs-page-header">
                    <button
                        type="button"
                        className="cs-back-button"
                        onClick={() => navigate(-1)}
                    >
                        <ChevronRight
                            size={17}
                            className="cs-back-chevron"
                        />
                        <span>Settings</span>
                    </button>

                    <div className="cs-page-brand">
                        ChatSpace
                    </div>
                </header>

                <div className="cs-settings-intro">
                    <span className="cs-page-eyebrow">
                        PREFERENCES
                    </span>

                    <h1>Settings</h1>

                    <p>
                        Configure your ChatSpace account and experience.
                    </p>
                </div>

                {settingsSections.map((section) => (
                    <section
                        className="cs-settings-section"
                        key={section.title}
                    >
                        <h2>{section.title}</h2>

                        <div className="cs-settings-card">
                            {section.rows.map((row) => {
                                const Icon = row.icon;

                                return (
                                    <button
                                        type="button"
                                        className="cs-settings-row"
                                        key={row.label}
                                        onClick={() =>
                                            navigate(row.path)
                                        }
                                    >
                                        <span className="cs-settings-icon">
                                            <Icon size={18} />
                                        </span>

                                        <span className="cs-settings-copy">
                                            <strong>
                                                {row.label}
                                            </strong>

                                            <small>
                                                {row.description}
                                            </small>
                                        </span>

                                        <ChevronRight
                                            size={17}
                                            className="cs-settings-chevron"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ))}

                <section className="cs-settings-section">
                    <h2>PRIVACY</h2>
                    <div className="cs-settings-card">
                        <div style={{ padding: "16px" }}>
                            <strong>Blocked users</strong>
                            {blockedUsers.length === 0 ? (
                                <p className="cs-info-muted">You have no blocked users.</p>
                            ) : blockedUsers.map((user) => (
                                <div key={user._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", paddingTop: "12px" }}>
                                    <span>{user.username}</span>
                                    <button type="button" onClick={() => unblockUser(user)}>Unblock</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {accountActionError && (
                    <p role="alert" style={{ color: "#b42318", padding: "0 16px" }}>{accountActionError}</p>
                )}

                <section className="cs-settings-section">
                    <h2>ACCOUNT ACTION</h2>

                    <div className="cs-settings-card">
                        <button
                            type="button"
                            className="cs-settings-row"
                            onClick={deleteAccount}
                            disabled={deletingAccount}
                            style={{ color: "#b42318" }}
                        >
                            <span className="cs-settings-copy">
                                <strong>{deletingAccount ? "Deleting account..." : accountDeletionPending ? "Retry account deletion" : "Delete my account"}</strong>
                                <small>Permanently remove your account and profile data</small>
                            </span>
                            <ChevronRight size={17} className="cs-settings-chevron" />
                        </button>
                        <button
                            type="button"
                            className="cs-settings-row cs-logout-row"
                            onClick={logout}
                        >
                            <span className="cs-settings-icon">
                                <LogOut size={18} />
                            </span>

                            <span className="cs-settings-copy">
                                <strong>Logout</strong>

                                <small>
                                    Sign out of this session
                                </small>
                            </span>

                            <ChevronRight
                                size={17}
                                className="cs-settings-chevron"
                            />
                        </button>
                    </div>
                </section>

            </div>
        </main>
    );
}

export default Settings;
