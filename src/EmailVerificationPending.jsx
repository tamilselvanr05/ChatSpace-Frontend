import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { MailCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { reload, sendEmailVerification, signOut } from "firebase/auth";
import { auth, authReady } from "./firebase";
import { apiUrl } from "./config";
import ChatSpaceLogo from "./components/ChatSpaceLogo";

const RESEND_COOLDOWN_SECONDS = 60;

function isExpiredSession(error) {
    return [
        "auth/user-token-expired",
        "auth/invalid-user-token",
        "auth/user-disabled",
        "auth/user-not-found"
    ].includes(error?.code);
}

function EmailVerificationPending() {
    const location = useLocation();
    const navigate = useNavigate();
    const initialState = location.state || {};
    const [email, setEmail] = useState(initialState.email || auth.currentUser?.email || "");
    const [screenState, setScreenState] = useState("loading");
    const [feedback, setFeedback] = useState(initialState.verificationError || "");
    const [checking, setChecking] = useState(false);
    const [resending, setResending] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [cooldown, setCooldown] = useState(
        initialState.verificationEmailSent ? RESEND_COOLDOWN_SECONDS : 0
    );
    const actionInProgressRef = useRef(false);

    const checkVerification = useCallback(async ({ initial = false } = {}) => {
        if (actionInProgressRef.current) return;
        actionInProgressRef.current = true;
        setChecking(true);
        if (!initial) setFeedback("");

        try {
            await authReady;
            const user = auth.currentUser;
            if (!user) {
                setScreenState("expired");
                return;
            }

            setEmail(user.email || "");
            await reload(user);
            if (auth.currentUser?.uid !== user.uid) {
                setScreenState("expired");
                return;
            }

            if (!user.emailVerified) {
                setScreenState("pending");
                if (!initial) {
                    setFeedback("Your email is not verified yet. Open the link in your inbox, then check again.");
                }
                return;
            }

            const token = await user.getIdToken(true);
            if (auth.currentUser?.uid !== user.uid) {
                setScreenState("expired");
                return;
            }

            await axios.post(apiUrl("/signup"), {}, {
                headers: { Authorization: `Bearer ${token}` },
                useProvidedAuthToken: true
            });

            if (auth.currentUser?.uid === user.uid) {
                navigate("/chat", { replace: true });
            } else {
                setScreenState("expired");
            }
        } catch (error) {
            if (isExpiredSession(error)) {
                setScreenState("expired");
                setFeedback("Your verification session has expired. Sign in again to continue.");
            } else if (error.response?.data?.code === "EMAIL_NOT_VERIFIED") {
                setScreenState("pending");
                setFeedback("Firebase has not confirmed the verification yet. Wait a moment and check again.");
            } else {
                setScreenState("pending");
                setFeedback(
                    error.response?.data?.message ||
                    error.message ||
                    "We could not check verification right now. Please try again."
                );
            }
        } finally {
            actionInProgressRef.current = false;
            setChecking(false);
        }
    }, [navigate]);

    useEffect(() => {
        const timer = window.setTimeout(() => checkVerification({ initial: true }), 0);
        return () => window.clearTimeout(timer);
    }, [checkVerification]);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
        return () => window.clearTimeout(timer);
    }, [cooldown]);

    const resendVerification = async () => {
        if (actionInProgressRef.current || cooldown > 0 || screenState === "expired") return;
        actionInProgressRef.current = true;
        setResending(true);
        setFeedback("");

        try {
            await authReady;
            const user = auth.currentUser;
            if (!user) {
                setScreenState("expired");
                setFeedback("Your verification session has expired. Sign in again to continue.");
                return;
            }

            await reload(user);
            if (auth.currentUser?.uid !== user.uid) {
                setScreenState("expired");
                return;
            }
            if (user.emailVerified) {
                actionInProgressRef.current = false;
                setResending(false);
                await checkVerification();
                return;
            }

            await sendEmailVerification(user);
            setEmail(user.email || "");
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setFeedback("A new verification email has been sent. Check your inbox and spam folder.");
        } catch (error) {
            if (isExpiredSession(error)) {
                setScreenState("expired");
                setFeedback("Your verification session has expired. Sign in again to continue.");
            } else if (error.code === "auth/too-many-requests") {
                setCooldown(RESEND_COOLDOWN_SECONDS);
                setFeedback("Too many emails were requested. Please wait before trying again.");
            } else {
                setFeedback(error.message || "The verification email could not be sent. Please try again.");
            }
        } finally {
            actionInProgressRef.current = false;
            setResending(false);
        }
    };

    const returnToSignIn = async () => {
        if (signingOut) return;
        setSigningOut(true);
        try {
            await authReady;
            if (auth.currentUser) await signOut(auth);
            navigate("/", { replace: true });
        } catch (error) {
            setFeedback(error.message || "Could not end this verification session.");
            setSigningOut(false);
        }
    };

    const isBusy = checking || resending || signingOut;

    return (
        <main className="auth-page">
            <section className="auth-form-side">
                <div className="auth-card verify-card">
                    <ChatSpaceLogo className="auth-logo" />

                    <div className="verify-icon" aria-hidden="true">
                        <MailCheck size={30} strokeWidth={1.8} />
                    </div>

                    <div className="auth-heading verify-heading">
                        <span className="eyebrow">ONE QUICK STEP</span>
                        <h2>Check your email</h2>
                        <p>We sent a verification link to:</p>
                        <p className="verify-email">{email || "your email address"}</p>
                    </div>

                    <p className="verify-instructions">
                        Open the link in that email to verify your account. If you don't see it, check your spam or junk folder.
                    </p>

                    {screenState === "loading" && (
                        <p className="verify-feedback" role="status">Checking your verification session...</p>
                    )}

                    {feedback && (
                        <div className="auth-error verify-feedback" role="status" aria-live="polite">
                            {feedback}
                        </div>
                    )}

                    {screenState === "expired" ? (
                        <button
                            type="button"
                            className="auth-submit verify-primary"
                            onClick={returnToSignIn}
                            disabled={isBusy}
                        >
                            {signingOut ? "Signing out..." : "Return to sign in"}
                        </button>
                    ) : (
                        <div className="verify-actions">
                            <button
                                type="button"
                                className="auth-submit verify-primary"
                                onClick={() => checkVerification()}
                                disabled={isBusy || screenState === "loading"}
                            >
                                {checking ? "Checking..." : "I've verified my email"}
                            </button>
                            <button
                                type="button"
                                className="verify-resend"
                                onClick={resendVerification}
                                disabled={isBusy || cooldown > 0 || screenState === "loading"}
                            >
                                {resending
                                    ? "Sending email..."
                                    : cooldown > 0
                                        ? `Resend available in ${cooldown}s`
                                        : "Resend verification email"}
                            </button>
                        </div>
                    )}

                    <p className="auth-switch verify-switch">
                        Wrong email? <Link to="/signup">Create a new account</Link>
                    </p>
                </div>
            </section>
        </main>
    );
}

export default EmailVerificationPending;
