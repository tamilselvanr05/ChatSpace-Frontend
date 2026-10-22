import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { apiUrl } from "./config";
import { getCallHistoryPeerId } from "./utils/callHistoryConversation";
import { getProfileUser } from "./utils/profileResponse";
import socket from "./socket";
import CallOverlay from "./components/CallOverlay";
import CallHistoryEntry from "./components/CallHistoryEntry";
import PhotoViewer from "./components/PhotoViewer";
import { ProtectedAudio, ProtectedDownload, ProtectedImage } from "./components/ProtectedMedia";
import { useProtectedMedia } from "./hooks/useProtectedMedia";
import GroupEvents from "./components/GroupEvents";
import ChatSpaceLogo from "./components/ChatSpaceLogo";
import ChatSummaryDialog from "./components/ChatSummaryDialog";
import ConversationWallpaperDialog from "./components/ConversationWallpaperDialog";
import {
    ArrowLeft,
    ChevronRight,
    FileText,
    LogOut,
    MessageCircle,
    Mic,
    Phone,
    LockKeyhole,
    Image as ImageIcon,
    Search,
    Send,
    Sparkles,
    Square,
    Settings,
    UserRound,
    UsersRound,
    Video,
    X,
    Info,
    AlertTriangle
} from "lucide-react";
import { detectSuspiciousMessage } from "./utils/scamDetector";
import { splitMessageLinks } from "./utils/linkifyMessage";
import { calculateMessageMenuPosition } from "./utils/messageMenuPosition";
import { playIncomingNotificationSound } from "./utils/notificationSound";
import { acquireCallMedia, getCallMediaErrorMessage } from "./utils/callMedia";
import { getCallConnectionAction } from "./utils/callState";


function App() {
    const navigate = useNavigate();

    const [userId, setUserId] = useState("");
    const [profileUser, setProfileUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [directorySearchResults, setDirectorySearchResults] = useState([]);
    const [blockedUserIds, setBlockedUserIds] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [memberSearch, setMemberSearch] = useState("");
    const [addingMembers, setAddingMembers] = useState(false);
    const [addMembersError, setAddMembersError] = useState("");
    const [addMembersNotice, setAddMembersNotice] = useState("");
    const [memberDirectoryLoading, setMemberDirectoryLoading] = useState(true);
    const [memberDirectoryError, setMemberDirectoryError] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [showChatSummary, setShowChatSummary] = useState(false);
    const [messages, setMessages] = useState([]);
    const [callHistory, setCallHistory] = useState([]);
    const [photoViewerMessageId, setPhotoViewerMessageId] = useState(null);
    const [photoViewerProfile, setPhotoViewerProfile] = useState(null);
    const [showWallpaperDialog, setShowWallpaperDialog] = useState(false);
    const [conversationWallpaper, setConversationWallpaper] = useState(null);
    const [conversationWallpaperLoading, setConversationWallpaperLoading] = useState(false);
    const { url: conversationWallpaperImage } = useProtectedMedia(
        conversationWallpaper?.mediaPath,
        conversationWallpaper?.version,
        "image"
    );
    const [message, setMessage] = useState("");
    const [messageSendError, setMessageSendError] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [groupTypingUsers, setGroupTypingUsers] = useState({});
    const [sidebarTyping, setSidebarTyping] = useState({});
    const [search, setSearch] = useState("");
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastMessages, setLastMessages] = useState({});
    const [messageNotification, setMessageNotification] = useState(null);
    const [messageSearch, setMessageSearch] = useState("");
    const [showMessageSearch, setShowMessageSearch] = useState(false);
    const [showAttachment, setShowAttachment] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [voicePreview, setVoicePreview] = useState(null);
    const [voiceSending, setVoiceSending] = useState(false);
    const [openMenu, setOpenMenu] = useState(null);
    const [messageMenuPosition, setMessageMenuPosition] = useState(null);
    const messageMenuRef = useRef(null);
    const messageMenuTriggerRefs = useRef(new Map());
    const [openWarningId, setOpenWarningId] = useState(null);
    const [reportDraft, setReportDraft] = useState(null);
    const [reportReason, setReportReason] = useState("suspected_scam");
    const [reportDetails, setReportDetails] = useState("");
    const [reportStatus, setReportStatus] = useState({});
    const reportRequestInFlightRef = useRef(false);

    useLayoutEffect(() => {
        if (!openMenu) {
            setMessageMenuPosition(null);
            return undefined;
        }

        const menu = messageMenuRef.current;
        const trigger = messageMenuTriggerRefs.current.get(openMenu);
        const container = trigger?.closest(".cs-message-list");
        if (!menu || !trigger || !container) return undefined;

        const positionMenu = () => {
            const containerRect = container.getBoundingClientRect();
            const triggerRect = trigger.getBoundingClientRect();
            const position = calculateMessageMenuPosition({
                containerRect,
                triggerRect,
                menuWidth: menu.scrollWidth,
                menuHeight: menu.scrollHeight,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight
            });
            if (!position) {
                setOpenMenu(null);
                return;
            }
            setMessageMenuPosition(position);
        };

        const onPointerDown = (event) => {
            if (!menu.contains(event.target) && !trigger.contains(event.target)) setOpenMenu(null);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setOpenMenu(null);
                trigger.focus();
            }
        };

        positionMenu();
        container.addEventListener("scroll", positionMenu);
        window.addEventListener("resize", positionMenu);
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            container.removeEventListener("scroll", positionMenu);
            window.removeEventListener("resize", positionMenu);
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [openMenu]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMembers, setNewGroupMembers] = useState([]);
    const [activeFilter, setActiveFilter] = useState("all");
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [theme] = useState(
        () => localStorage.getItem("chatspace-theme") || "ocean"
    );
    const [chatBackground] = useState(
        () => localStorage.getItem("chatspace_background") || "default"
    );
    const [messageStyle] = useState(
        () => localStorage.getItem("chatspace_message_style") || "rounded"
    );
    const [messageFont] = useState(
        () => localStorage.getItem("chatspace_message_font") || "default"
    );
    const [callState, setCallState] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callError, setCallError] = useState("");
    const [canFallbackToAudio, setCanFallbackToAudio] = useState(false);

    const messageEndRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const pendingIceCandidatesRef = useRef([]);
    const pendingLocalIceCandidatesRef = useRef([]);
    const currentCallIdRef = useRef(null);
    const callGenerationRef = useRef(0);
    const callConnectionTimerRef = useRef(null);
    const callSnapshotRef = useRef({ callState: null, incomingCall: null });
    const callCleanupRef = useRef(null);
    const callAttemptSequenceRef = useRef(0);
    const authRequestVersionRef = useRef(0);
    const typingStateRef = useRef({ key: null, isTyping: false });
    const typingTimersRef = useRef(new Map());
    const typingHeartbeatRef = useRef(null);
    const typingStopTimeoutRef = useRef(null);
    const activeTypingKeyRef = useRef(null);
    const recordingStartedAtRef = useRef(0);
    const voicePreviewRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const discardRecordingRef = useRef(false);

    callSnapshotRef.current = { callState, incomingCall };

    useEffect(() => {
        activeTypingKeyRef.current = selectedGroup
            ? `group:${selectedGroup._id}`
            : selectedUser
                ? `private:${selectedUser._id}`
                : null;
    }, [selectedGroup, selectedUser]);

    useEffect(() => {
        if (!isRecording) return undefined;
        const timer = window.setInterval(() => {
            setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
        }, 250);
        return () => window.clearInterval(timer);
    }, [isRecording]);

    useEffect(() => {
        voicePreviewRef.current = voicePreview;
    }, [voicePreview]);

    useEffect(() => () => {
        discardRecordingRef.current = true;
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
        mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
        if (voicePreviewRef.current?.url) URL.revokeObjectURL(voicePreviewRef.current.url);
        typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        typingTimersRef.current.clear();
        window.clearInterval(typingHeartbeatRef.current);
        window.clearTimeout(typingStopTimeoutRef.current);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("chatspace-theme", theme);
    }, [theme]);

useEffect(() => {
    if (!messageNotification) {
        return;
    }

    const timer = setTimeout(() => {
        setMessageNotification(null);
    }, 15000);

    return () => {
        clearTimeout(timer);
    };
}, [messageNotification]);

    useEffect(() => {
        const syncInfoPanel = () => {
            setShowInfoPanel(window.innerWidth > 1180);
        };

        window.addEventListener("resize", syncInfoPanel);
        return () => window.removeEventListener("resize", syncInfoPanel);
    }, []);

    const markMessagesAsRead = (messageList) => {
        messageList.forEach((msg) => {
            if (
                msg.senderId?.toString() !==
                    userId?.toString() &&
                msg._id
            ) {
                socket.emit("messageRead", {
                    messageId: msg._id,
                    userId: userId
                });
            }
        });
    };

    const closeCall = useCallback((source, notifyPeer = false) => {
        const { callState: activeCall, incomingCall: pendingCall } = callSnapshotRef.current;
        const peerId = activeCall?.peerId || pendingCall?.from;
        const callId = activeCall?.callId || pendingCall?.callId || currentCallIdRef.current;

        if (import.meta.env.DEV) console.info("[call diagnostic] terminating", {
            callId,
            source,
            notifyPeer,
            peerConnectionState: peerConnectionRef.current?.connectionState || null,
            iceConnectionState: peerConnectionRef.current?.iceConnectionState || null,
            signalingState: peerConnectionRef.current?.signalingState || null
        });
        if (notifyPeer && peerId && callId) {
            socket.emit("call:end", {
                from: userId,
                to: peerId,
                callId
            });
        }

        callGenerationRef.current += 1;
        clearTimeout(callConnectionTimerRef.current);
        callConnectionTimerRef.current = null;
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        pendingIceCandidatesRef.current = [];
        pendingLocalIceCandidatesRef.current = [];
        localStreamRef.current?.getTracks().forEach((track) => {
            track.stop();
        });
        localStreamRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        setIncomingCall(null);
        setCallState(null);
        currentCallIdRef.current = null;
    }, [userId]);

    callCleanupRef.current = closeCall;

    useEffect(() => () => {
        const { callState: activeCall, incomingCall: pendingCall } = callSnapshotRef.current;
        if (activeCall || pendingCall || peerConnectionRef.current || localStreamRef.current) {
            callCleanupRef.current?.("app-component-unmount", true);
        }
    }, []);

    const createPeerConnection = (peerId, callId = null) => {
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                }
            ]
        });

        peerConnectionRef.current = peerConnection;

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const activeCallId = callId || currentCallIdRef.current;
                if (!activeCallId) {
                    pendingLocalIceCandidatesRef.current.push(event.candidate);
                    return;
                }
                socket.emit("call:ice-candidate", {
                    from: userId,
                    to: peerId,
                    callId: activeCallId,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        const logCallStates = (eventName) => {
            if (import.meta.env.DEV) console.info("[call diagnostic] state", {
                callId: callId || currentCallIdRef.current,
                eventName,
                connectionState: peerConnection.connectionState,
                iceConnectionState: peerConnection.iceConnectionState,
                signalingState: peerConnection.signalingState
            });
        };
        peerConnection.onsignalingstatechange = () => logCallStates("signalingstatechange");
        peerConnection.oniceconnectionstatechange = () => logCallStates("iceconnectionstatechange");

        peerConnection.onconnectionstatechange = () => {
            logCallStates("connectionstatechange");
            const connectionAction = getCallConnectionAction(peerConnection.connectionState);
            if (connectionAction === "active") {
                clearTimeout(callConnectionTimerRef.current);
                callConnectionTimerRef.current = null;
                setCallState((previousCall) =>
                    previousCall
                        ? { ...previousCall, status: "active" }
                        : previousCall
                );
                const activeCallId = callId || currentCallIdRef.current;
                if (activeCallId) {
                    socket.emit("call:connected", { to: peerId, callId: activeCallId });
                }
            } else if (connectionAction === "terminate") {
                const activeCallId = callId || currentCallIdRef.current;
                if (import.meta.env.DEV) console.warn("[call diagnostic] WebRTC failed", { callId: activeCallId, iceConnectionState: peerConnection.iceConnectionState, signalingState: peerConnection.signalingState });
                if (activeCallId) socket.emit("call:end", { to: peerId, callId: activeCallId });
                closeCall("webrtc-connection-failed");
            } else if (connectionAction === "wait") {
                clearTimeout(callConnectionTimerRef.current);
                callConnectionTimerRef.current = setTimeout(() => {
                    if (peerConnection.connectionState !== "disconnected") return;
                    const activeCallId = callId || currentCallIdRef.current;
                    if (import.meta.env.DEV) console.warn("[call diagnostic] disconnect grace expired", { callId: activeCallId, connectionState: peerConnection.connectionState, iceConnectionState: peerConnection.iceConnectionState });
                    if (activeCallId) socket.emit("call:end", { to: peerId, callId: activeCallId });
                    closeCall("webrtc-disconnected-timeout");
                }, 30000);
            }
        };

        return peerConnection;
    };

    const addPendingIceCandidates = useCallback(async (peerConnection) => {
        const candidates = pendingIceCandidatesRef.current;
        pendingIceCandidatesRef.current = [];

        for (const candidate of candidates) {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        }
    }, []);

    const startCall = async (callType, targetUser = selectedUser) => {
        if (!targetUser || blockedUserIds.includes(targetUser._id?.toString()) || targetUser.isDeleted || callState || incomingCall) {
            return;
        }

        const callGeneration = ++callGenerationRef.current;
        const attemptId = `${Date.now()}-${++callAttemptSequenceRef.current}`;
        currentCallIdRef.current = null;
        setCallError("");
        setCanFallbackToAudio(false);
        setCallState({
            status: "calling",
            callType,
            attemptId,
            peerId: targetUser._id,
            peerName: targetUser.username
        });

        let stream;
        try {
            stream = await acquireCallMedia(callType);
        } catch (error) {
            if (callGeneration !== callGenerationRef.current) return;
            console.warn("Call media unavailable:", error?.name || "UnknownError");
            setCallError(getCallMediaErrorMessage(error, callType));
            setCanFallbackToAudio(callType === "video" && error?.callDevice === "camera");
            closeCall("outgoing-media-acquisition-failed");
            return;
        }

        if (callGeneration !== callGenerationRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        try {
            const peerConnection = createPeerConnection(
                targetUser._id
            );

            stream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, stream);
            });

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            if (callGeneration !== callGenerationRef.current) return;

            socket.emit("call:offer", {
                from: userId,
                to: targetUser._id,
                fromName: profileUser?.username || "ChatSpace user",
                callType,
                attemptId,
                offer: peerConnection.localDescription
            });

        } catch (error) {
            if (callGeneration !== callGenerationRef.current) return;
            console.error("Could not start call:", error);
            setCallError("The call could not be started. Check your connection and try again.");
            closeCall("outgoing-offer-creation-failed");
        }
    };

    const acceptCall = async () => {
        if (!incomingCall) {
            return;
        }

        const call = incomingCall;
        const callGeneration = ++callGenerationRef.current;
        currentCallIdRef.current = call.callId;
        setCallError("");
        setCanFallbackToAudio(false);
        setCallState({
            status: "connecting",
            callType: call.callType,
            peerId: call.from,
            peerName: call.fromName
        });

        let stream;
        try {
            stream = await acquireCallMedia(call.callType);
        } catch (error) {
            if (callGeneration !== callGenerationRef.current) return;
            console.warn("Call media unavailable while answering:", error?.name || "UnknownError");
            setCallError(getCallMediaErrorMessage(error, call.callType, "answer"));
            setCanFallbackToAudio(call.callType === "video" && error?.callDevice === "camera");
            socket.emit("call:reject", {
                from: userId,
                to: call.from,
                callId: call.callId
            });
            closeCall("incoming-media-acquisition-failed");
            return;
        }

        if (callGeneration !== callGenerationRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        try {
            const peerConnection = createPeerConnection(call.from, call.callId);
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(call.offer)
            );
            if (callGeneration !== callGenerationRef.current) return;
            await addPendingIceCandidates(peerConnection);

            stream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, stream);
            });

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            if (callGeneration !== callGenerationRef.current) return;

            socket.emit("call:answer", {
                from: userId,
                to: call.from,
                callId: call.callId,
                answer: peerConnection.localDescription
            });

            setIncomingCall(null);

        } catch (error) {
            if (callGeneration !== callGenerationRef.current) return;
            console.error("Could not accept call:", error);
            setCallError("The call could not be answered. Check your connection and try again.");
            socket.emit("call:reject", {
                from: userId,
                to: call.from,
                callId: call.callId
            });
            closeCall("incoming-answer-creation-failed");
        }
    };

    const rejectCall = () => {
        if (incomingCall) {
            socket.emit("call:reject", {
                from: userId,
                to: incomingCall.from,
                callId: incomingCall.callId
            });
        }

        closeCall("user-rejected-incoming-call");
    };


    useEffect(() => {
        let disposed = false;

        const handleConnect = () => {
            console.log("Connected:", socket.id);
        };

        const handleDisconnect = (reason) => {
            if (import.meta.env.DEV) console.warn("[call diagnostic] socket disconnected", {
                reason,
                callId: callSnapshotRef.current.callState?.callId || callSnapshotRef.current.incomingCall?.callId || currentCallIdRef.current
            });
        };

        const handleConnectError = (error) => {
            if (disposed) {
                return;
            }

            if (["AUTH_REQUIRED", "AUTH_INVALID"].includes(error.data?.code)) {
                socket.disconnect();
                signOut(auth);
                window.location.href = "/";
                return;
            }

            console.error("Socket connection error:", error.message);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            const requestVersion = ++authRequestVersionRef.current;
            socket.disconnect();
            typingStateRef.current = { key: null, payload: null, isTyping: false };
            window.clearInterval(typingHeartbeatRef.current);
            window.clearTimeout(typingStopTimeoutRef.current);
            typingHeartbeatRef.current = null;
            typingStopTimeoutRef.current = null;
            typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
            typingTimersRef.current.clear();
            setSidebarTyping({});
            setGroupTypingUsers({});
            setIsTyping(false);
            if (voicePreviewRef.current?.url) URL.revokeObjectURL(voicePreviewRef.current.url);
            voicePreviewRef.current = null;
            setVoicePreview(null);
            setUserId("");
            setProfileUser(null);
            setUsers([]);
            setBlockedUserIds([]);
            setGroups([]);
            setSelectedGroup(null);
            setSelectedUser(null);
            setMessages([]);
            setReplyingTo(null);
            setUnreadCounts({});
            setLastMessages({});
            setMessageNotification(null);
            callCleanupRef.current?.("auth-session-reset", false);

            if (!firebaseUser) {
                if (!disposed) navigate("/");
                return;
            }

            try {
                if (
                    disposed ||
                    requestVersion !== authRequestVersionRef.current ||
                    auth.currentUser?.uid !== firebaseUser.uid
                ) return;

                const response = await axios.get(apiUrl("/profile"));
                if (
                    disposed ||
                    requestVersion !== authRequestVersionRef.current ||
                    auth.currentUser?.uid !== firebaseUser.uid
                ) return;

                const authenticatedUser = getProfileUser(response);
                if (!authenticatedUser) throw new Error("Authenticated profile has no user ID");
                setUserId(authenticatedUser._id);
                setProfileUser(authenticatedUser);
                socket.connect();
            } catch (error) {
                if (disposed || requestVersion !== authRequestVersionRef.current) return;
                if (error.response?.status === 401 || error.response?.status === 404) {
                    socket.disconnect();
                    await signOut(auth);
                    navigate("/");
                } else {
                    console.error("Authenticated profile could not be loaded:", error.message);
                }
            }
        }, (error) => {
            socket.disconnect();
            if (!disposed) {
                console.error("Firebase authentication initialization failed:", error.code || "unknown");
                navigate("/");
            }
        });

        return () => {
            disposed = true;
            authRequestVersionRef.current += 1;
            unsubscribeAuth();
            socket.disconnect();
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
        };
    }, [navigate]);

    useEffect(() => {
        const handleCallCreated = (data) => {
            const { callState: activeCall, incomingCall: pendingCall } = callSnapshotRef.current;
            if (import.meta.env.DEV) console.info("[call diagnostic] socket call:created", { callId: data.callId, peerId: data.peerId, callState: activeCall?.status || null });
            if (data.attemptId && activeCall?.attemptId !== data.attemptId) return;
            if (
                activeCall?.status !== "calling" ||
                activeCall?.peerId?.toString() !== data.peerId?.toString()
            ) {
                if (!activeCall && !pendingCall) {
                    socket.emit("call:end", { to: data.peerId, callId: data.callId });
                }
                return;
            }
            currentCallIdRef.current = data.callId;
            for (const candidate of pendingLocalIceCandidatesRef.current) {
                socket.emit("call:ice-candidate", {
                    to: data.peerId,
                    callId: data.callId,
                    candidate
                });
            }
            pendingLocalIceCandidatesRef.current = [];
            setCallState((previousCall) =>
                previousCall?.peerId?.toString() === data.peerId?.toString()
                    ? { ...previousCall, callId: data.callId }
                    : previousCall
            );
        };

        const handleCallOffer = (data) => {
            if (import.meta.env.DEV) console.info("[call diagnostic] socket call:offer", { callId: data.callId, from: data.from, callType: data.callType });
            if (callSnapshotRef.current.callState || callSnapshotRef.current.incomingCall) {
                socket.emit("call:busy", {
                    from: userId,
                    to: data.from,
                    callId: data.callId
                });
                return;
            }

            currentCallIdRef.current = data.callId;
            pendingIceCandidatesRef.current = [];
            setIncomingCall(data);
            setCallState({
                status: "incoming",
                callType: data.callType,
                callId: data.callId,
                peerId: data.from,
                peerName: data.fromName
            });
        };

        const handleCallOffline = (data) => {
            const activeCall = callSnapshotRef.current.callState;
            if (import.meta.env.DEV) console.warn("[call diagnostic] recipient offline", { callId: data.callId, attemptId: data.attemptId });
            if (
                activeCall?.status !== "calling" ||
                activeCall.peerId?.toString() !== data.from?.toString() ||
                (data.attemptId && activeCall.attemptId !== data.attemptId)
            ) return;

            currentCallIdRef.current = data.callId;
            setCallError("This user is offline and cannot receive calls right now.");
            closeCall("recipient-offline");
        };

        const handleCallTimeout = (data) => {
            const activeCall = callSnapshotRef.current.callState;
            if (import.meta.env.DEV) console.warn("[call diagnostic] invitation timed out", { callId: data.callId });
            if (
                activeCall?.callId !== data.callId ||
                activeCall.peerId?.toString() !== data.from?.toString()
            ) return;

            const timeoutSeconds = Math.round((data.timeoutMs || 60_000) / 1000);
            setCallError(`No answer or connection was established within ${timeoutSeconds} seconds.`);
            closeCall("unanswered-invitation-timeout");
        };

        const handleCallAnswer = async (data) => {
            if (import.meta.env.DEV) console.info("[call diagnostic] socket call:answer", { callId: data.callId, from: data.from });
            const peerConnection = peerConnectionRef.current;
            const activeCall = callSnapshotRef.current.callState;

            if (
                !peerConnection ||
                activeCall?.peerId?.toString() !== data.from?.toString() ||
                activeCall?.callId !== data.callId
            ) {
                return;
            }

            try {
                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );
                await addPendingIceCandidates(peerConnection);
                setCallState((previousCall) =>
                    previousCall
                        ? { ...previousCall, status: "connecting" }
                        : previousCall
                );
            } catch (error) {
                console.error("Could not connect call:", error);
                setCallError("Unable to connect this call.");
                const activeCallId = currentCallIdRef.current;
                if (activeCallId) socket.emit("call:end", { to: data.from, callId: activeCallId });
                closeCall("remote-answer-application-failed");
            }
        };

        const handleCallIceCandidate = async (data) => {
            const { callState: activeCall, incomingCall: pendingCall } = callSnapshotRef.current;
            const expectedPeer = activeCall?.peerId || pendingCall?.from;

            if (
                expectedPeer?.toString() !==
                data.from?.toString() ||
                (data.callId && currentCallIdRef.current && data.callId !== currentCallIdRef.current)
            ) {
                return;
            }

            const peerConnection = peerConnectionRef.current;

            if (!peerConnection?.remoteDescription) {
                pendingIceCandidatesRef.current.push(
                    data.candidate
                );
                return;
            }

            try {
                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(data.candidate)
                );
            } catch (error) {
                console.error("ICE candidate error:", error);
            }
        };

        const handleCallReject = (data) => {
            if (import.meta.env.DEV) console.warn("[call diagnostic] socket call:reject", { callId: data.callId, from: data.from });
            const activeCall = callSnapshotRef.current.callState;
            if (
                activeCall?.peerId?.toString() ===
                    data.from?.toString() &&
                activeCall?.callId === data.callId
            ) {
                setCallError("The call was declined.");
                closeCall("remote-participant-rejected");
            }
        };

        const handleCallBusy = (data) => {
            if (import.meta.env.DEV) console.warn("[call diagnostic] socket call:busy", { callId: data.callId, from: data.from });
            const activeCall = callSnapshotRef.current.callState;
            if (
                activeCall?.peerId?.toString() ===
                    data.from?.toString() &&
                activeCall?.callId === data.callId
            ) {
                setCallError("This person is on another call.");
                closeCall("remote-participant-busy");
            }
        };

        const handleCallEnd = (data) => {
            const { callState: activeCall, incomingCall: pendingCall } = callSnapshotRef.current;
            if (import.meta.env.DEV) console.warn("[call diagnostic] socket call:end received", { callId: data.callId, from: data.from, activeCallId: activeCall?.callId || pendingCall?.callId || currentCallIdRef.current });
            if (
                activeCall?.peerId?.toString() ===
                    data.from?.toString() ||
                pendingCall?.from?.toString() ===
                    data.from?.toString()
            ) {
                if ((activeCall?.callId || pendingCall?.callId) !== data.callId) return;
                closeCall("remote-call-end-event");
            }
        };

        socket.on("call:created", handleCallCreated);
        socket.on("call:offer", handleCallOffer);
        socket.on("call:offline", handleCallOffline);
        socket.on("call:timeout", handleCallTimeout);
        socket.on("call:answer", handleCallAnswer);
        socket.on("call:ice-candidate", handleCallIceCandidate);
        socket.on("call:reject", handleCallReject);
        socket.on("call:busy", handleCallBusy);
        socket.on("call:end", handleCallEnd);

        return () => {
            if (import.meta.env.DEV) console.info("[call diagnostic] signaling handlers detached", {
                callId: callSnapshotRef.current.callState?.callId || callSnapshotRef.current.incomingCall?.callId || currentCallIdRef.current,
                callStatus: callSnapshotRef.current.callState?.status || null
            });
            socket.off("call:created", handleCallCreated);
            socket.off("call:offer", handleCallOffer);
            socket.off("call:offline", handleCallOffline);
            socket.off("call:timeout", handleCallTimeout);
            socket.off("call:answer", handleCallAnswer);
            socket.off("call:ice-candidate", handleCallIceCandidate);
            socket.off("call:reject", handleCallReject);
            socket.off("call:busy", handleCallBusy);
            socket.off("call:end", handleCallEnd);
        };
    }, [userId, closeCall, addPendingIceCandidates]);

    useEffect(() => {
        setCallHistory([]);
        const selectedPeerId = getCallHistoryPeerId({
            selectedUserId: selectedUser?._id?.toString(),
            selectedGroupId: selectedGroup?._id?.toString(),
            currentUserId: userId?.toString()
        });
        if (!selectedPeerId) return undefined;

        let active = true;

        const mergeCall = (call) => {
            if (!active || !call) return;
            const callerId = call.callerId?.toString();
            const calleeId = call.calleeId?.toString();
            if (![callerId, calleeId].includes(userId.toString()) ||
                ![callerId, calleeId].includes(selectedPeerId)) return;

            setCallHistory((previousCalls) => {
                const existing = previousCalls.find((item) => item.callId === call.callId);
                const incomingUpdatedAt = new Date(call.updatedAt || call.createdAt || 0).getTime();
                const existingUpdatedAt = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
                const latestCall = existing && existingUpdatedAt > incomingUpdatedAt ? existing : call;
                return [
                    ...previousCalls.filter((item) => item.callId !== call.callId),
                    latestCall
                ].sort((first, second) => new Date(first.initiatedAt) - new Date(second.initiatedAt));
            });
        };

        const handleCallHistoryUpdated = (event) => mergeCall(event.call);
        socket.on("callHistory:updated", handleCallHistoryUpdated);

        axios.get(apiUrl(`/users/${selectedPeerId}/calls`))
            .then((response) => {
                if (!active) return;
                response.data.calls.forEach(mergeCall);
            })
            .catch((error) => {
                if (active) console.error("Call history could not be loaded:", error.response?.data?.message || error.message);
            });

        return () => {
            active = false;
            socket.off("callHistory:updated", handleCallHistoryUpdated);
        };
    }, [selectedUser?._id, selectedGroup?._id, userId]);

    useEffect(() => {
        if (!userId) return undefined;
        let active = true;
        const firebaseUid = auth.currentUser?.uid;
        const getUsers = async () => {
            try {
                const response = await axios.get(apiUrl("/users"));
                if (active && auth.currentUser?.uid === firebaseUid) {
                    setUsers(response.data.users);
                    setMemberDirectoryError("");
                }

            } catch (error) {
                if (active) setMemberDirectoryError(error.response?.data?.message || "People could not be loaded.");
            } finally {
                if (active) setMemberDirectoryLoading(false);
            }
        };

        getUsers();

        const handleStatusChange = (data) => {
            const visibleOnline = data.userId?.toString() === userId?.toString()
                ? true
                : data.isOnline;
            setUsers((previousUsers) =>
                previousUsers.map((user) =>
                    user._id === data.userId
                        ? {
                            ...user,
                            isOnline: visibleOnline
                        }
                        : user
                )
            );

            setSelectedUser((previousUser) => {
                if (
                    previousUser &&
                    previousUser._id === data.userId
                ) {
                    return {
                        ...previousUser,
                        isOnline: visibleOnline
                    };
                }

                return previousUser;
            });
            const updateGroupMembers = (group) => ({
                ...group,
                members: group.members.map((member) => member._id?.toString() === data.userId?.toString()
                    ? { ...member, isOnline: visibleOnline }
                    : member)
            });
            setGroups((previousGroups) => previousGroups.map(updateGroupMembers));
            setSelectedGroup((previousGroup) => previousGroup ? updateGroupMembers(previousGroup) : previousGroup);
        };

        socket.on(
            "userStatusChanged",
            handleStatusChange
        );

        const handleProfilePhotoUpdated = ({ userId: changedUserId, profilePhoto }) => {
            const updatePhoto = (user) => user?._id?.toString() === changedUserId?.toString()
                ? { ...user, profilePhoto }
                : user;
            setProfileUser(updatePhoto);
            setSelectedUser(updatePhoto);
            setUsers((previousUsers) => previousUsers.map(updatePhoto));
            const updateGroup = (group) => group ? {
                ...group,
                members: group.members.map(updatePhoto)
            } : group;
            setGroups((previousGroups) => previousGroups.map(updateGroup));
            setSelectedGroup(updateGroup);
            setPhotoViewerProfile((previous) => previous?.userId?.toString() === changedUserId?.toString()
                ? { ...previous, profilePhoto }
                : previous);
        };
        socket.on("profilePhotoUpdated", handleProfilePhotoUpdated);

        return () => {
            active = false;
            socket.off(
                "userStatusChanged",
                handleStatusChange
            );
            socket.off("profilePhotoUpdated", handleProfilePhotoUpdated);
        };
    }, [userId]);

    useEffect(() => {
        const query = search.trim();
        if (!userId || !query || activeFilter === "groups") {
            setDirectorySearchResults([]);
            return undefined;
        }

        let active = true;
        setDirectorySearchResults([]);
        const timeoutId = window.setTimeout(() => {
            axios.get(apiUrl("/users"), { params: { search: query } })
                .then((response) => {
                    if (active) setDirectorySearchResults(response.data.users || []);
                })
                .catch(() => {
                    if (active) setDirectorySearchResults([]);
                });
        }, 180);

        return () => {
            active = false;
            window.clearTimeout(timeoutId);
        };
    }, [search, userId, activeFilter]);

    useEffect(() => {
        const peerId = selectedUser?._id?.toString();
        if (!userId || !peerId || peerId === userId.toString()) {
            setConversationWallpaper(null);
            setConversationWallpaperLoading(false);
            return undefined;
        }

        let active = true;
        setConversationWallpaper(null);
        setConversationWallpaperLoading(true);
        axios.get(apiUrl(`/conversations/${peerId}/wallpaper`))
            .then(({ data }) => {
                if (active && data.wallpaper) setConversationWallpaper({ peerId, ...data.wallpaper });
            })
            .catch(() => {
                if (active) setConversationWallpaper(null);
            })
            .finally(() => {
                if (active) setConversationWallpaperLoading(false);
            });
        return () => { active = false; };
    }, [userId, selectedUser?._id]);

    useEffect(() => {
        if (!userId) return undefined;
        let active = true;
        const firebaseUid = auth.currentUser?.uid;
        const getGroups = async () => {
            try {
                const response = await axios.get(apiUrl("/groups"));
                if (active && auth.currentUser?.uid === firebaseUid) setGroups(response.data.groups);

            } catch (error) {
                console.log(
                    error.response?.data ||
                    error.message
                );
            }
        };

        getGroups();
        return () => { active = false; };
    }, [userId]);

    useEffect(() => {
        if (!userId) return undefined;
        let active = true;
        const firebaseUid = auth.currentUser?.uid;
        axios.get(apiUrl("/blocked-users"))
            .then((response) => {
                if (active && auth.currentUser?.uid === firebaseUid) setBlockedUserIds(response.data.users.map((user) => user._id.toString()));
            })
            .catch((error) => {
                if (active) console.log(error.response?.data || error.message);
            });
        return () => { active = false; };
    }, [userId]);

    useEffect(() => {
        const handleConversationRemoved = (data) => {
            if (selectedUser?._id?.toString() === data.userId?.toString()) {
                setSelectedUser(null);
                setMessages([]);
                setReplyingTo(null);
            }
            setUsers((previous) => previous.filter((user) => user._id.toString() !== data.userId?.toString()));
        };
        const handleConversationRestored = async () => {
            try {
                const response = await axios.get(apiUrl("/users"));
                setUsers(response.data.users);
            } catch (error) {
                console.log(error.response?.data || error.message);
            }
        };
        socket.on("conversationRemoved", handleConversationRemoved);
        socket.on("conversationRestored", handleConversationRestored);
        return () => {
            socket.off("conversationRemoved", handleConversationRemoved);
            socket.off("conversationRestored", handleConversationRestored);
        };
    }, [selectedUser]);

    useEffect(() => {
        const handleGroupMembersUpdated = (group) => {
            if (!group?._id) return;
            setGroups((previousGroups) => {
                const alreadyListed = previousGroups.some((item) => item._id?.toString() === group._id.toString());
                return alreadyListed
                    ? previousGroups.map((item) => item._id?.toString() === group._id.toString() ? group : item)
                    : [...previousGroups, group];
            });
            setSelectedGroup((previousGroup) =>
                previousGroup?._id?.toString() === group._id.toString() ? group : previousGroup
            );
        };
        socket.on("groupMembersUpdated", handleGroupMembersUpdated);
        return () => socket.off("groupMembersUpdated", handleGroupMembersUpdated);
    }, []);

    useEffect(() => {
        const handleReceiveMessage = (data) => {
            const sender =
                data.senderId?.toString();

            const receiver =
                data.receiverId?.toString();

            const currentUser =
                userId?.toString();

           if (receiver === currentUser) {
    socket.emit("messageDelivered", {
        messageId: data._id,
        userId: userId
    });

    if (sender !== currentUser) {
        playIncomingNotificationSound();
    }
}

            if (
                receiver === currentUser &&
                sender !== currentUser &&
                sender !== selectedUser?._id?.toString()
            ) {
                const senderUser = users.find(
                    (user) =>
                        user._id?.toString() === sender
                );
                const preview =
                    data.messageType === "image"
                        ? "Photo"
                        : data.messageType === "file"
                            ? data.fileName || "File"
                            : data.message || "";

                setUnreadCounts((previousCounts) => ({
                    ...previousCounts,
                    [sender]: (previousCounts[sender] || 0) + 1
                }));
                setLastMessages((previousMessages) => ({
                    ...previousMessages,
                    [sender]: preview
                }));
              
const showPreview = localStorage.getItem("chatspace_message_preview") !== "false";

   setMessageNotification({
    senderId: sender,
    senderName: senderUser?.username || "New message",
    message: showPreview ? preview : "You received a new message"
});
            }

            if (!selectedUser) {
                return;
            }

            const selectedId =
                selectedUser._id.toString();

            const isCurrentChat =
                (
                    sender === currentUser &&
                    receiver === selectedId
                ) ||
                (
                    sender === selectedId &&
                    receiver === currentUser
                );

            if (!isCurrentChat) {
                return;
            }

            if (sender !== currentUser) {
                socket.emit("messageRead", {
                    messageId: data._id,
                    userId: userId
                });
            }

            setMessages((previousMessages) => {
                const alreadyExists =
                    previousMessages.some(
                        (msg) =>
                            msg._id === data._id
                    );

                if (alreadyExists) {
                    return previousMessages;
                }

                return [
                    ...previousMessages,
                    data
                ];
            });
        };

        socket.on(
            "receiveMessage",
            handleReceiveMessage
        );

        return () => {
            socket.off(
                "receiveMessage",
                handleReceiveMessage
            );
        };
    }, [userId, selectedUser, users]);

    useEffect(() => {
        const handleReceiveGroupMessage = (data) => {
            if (
                !selectedGroup ||
                data.groupId?.toString() !==
                    selectedGroup._id?.toString()
            ) {
                return;
            }
if (
    data.senderId?.toString() !==
    userId?.toString()
) {
    socket.emit("messageRead", {
        messageId: data._id,
        userId: userId
    });

    
    playIncomingNotificationSound();
}

            setMessages((previousMessages) => {
                const alreadyExists =
                    previousMessages.some(
                        (msg) =>
                            msg._id === data._id
                    );

                if (alreadyExists) {
                    return previousMessages;
                }

                return [
                    ...previousMessages,
                    data
                ];
            });
        };

        socket.on(
            "receiveGroupMessage",
            handleReceiveGroupMessage
        );

        return () => {
            socket.off(
                "receiveGroupMessage",
                handleReceiveGroupMessage
            );
        };
    }, [selectedGroup, userId]);

    useEffect(() => {
        const handleUserTyping = (data) => {
            const isGroupEvent = Boolean(data.groupId);
            if (data.senderId?.toString() === userId?.toString()) return;

            const conversationKey = isGroupEvent
                ? `group:${data.groupId}`
                : `private:${data.senderId}`;
            const timerKey = `${conversationKey}:${data.senderId}`;
            const existingTimer = typingTimersRef.current.get(timerKey);
            if (existingTimer) window.clearTimeout(existingTimer);

            setSidebarTyping((previous) => {
                const next = { ...previous };
                if (isGroupEvent) {
                    const groupTypers = { ...(next[conversationKey] || {}) };
                    if (data.isTyping) groupTypers[data.senderId] = data.username || "A member";
                    else delete groupTypers[data.senderId];
                    if (Object.keys(groupTypers).length) next[conversationKey] = groupTypers;
                    else delete next[conversationKey];
                } else if (data.isTyping) {
                    next[conversationKey] = true;
                } else {
                    delete next[conversationKey];
                }
                return next;
            });

            const isActiveConversation = activeTypingKeyRef.current === conversationKey;
            if (isActiveConversation && isGroupEvent) {
                setGroupTypingUsers((previous) => {
                    const next = { ...previous };
                    if (data.isTyping) next[data.senderId] = data.username || "A member";
                    else delete next[data.senderId];
                    return next;
                });
            } else if (isActiveConversation) {
                setIsTyping(Boolean(data.isTyping));
            }

            if (data.isTyping) {
                const timer = window.setTimeout(() => {
                    setSidebarTyping((previous) => {
                        const next = { ...previous };
                        if (isGroupEvent) {
                            const groupTypers = { ...(next[conversationKey] || {}) };
                            delete groupTypers[data.senderId];
                            if (Object.keys(groupTypers).length) next[conversationKey] = groupTypers;
                            else delete next[conversationKey];
                        } else {
                            delete next[conversationKey];
                        }
                        return next;
                    });
                    if (activeTypingKeyRef.current === conversationKey) {
                    if (isGroupEvent) {
                        setGroupTypingUsers((previous) => {
                            const next = { ...previous };
                            delete next[data.senderId];
                            return next;
                        });
                    } else {
                        setIsTyping(false);
                    }
                    }
                    typingTimersRef.current.delete(timerKey);
                }, 4000);
                typingTimersRef.current.set(timerKey, timer);
            } else {
                typingTimersRef.current.delete(timerKey);
            }
        };

        socket.on(
            "userTyping",
            handleUserTyping
        );

        return () => {
            socket.off(
                "userTyping",
                handleUserTyping
            );
        };
    }, [selectedUser, selectedGroup, userId]);

    useEffect(() => {
        const handleMessageDeleted = (data) => {
            setMessages(
                (previousMessages) =>
                    previousMessages.filter(
                        (msg) =>
                            msg._id !==
                            data.messageId
                    )
            );
        };

        const handleMessageDeletedForMe = (data) => {
            setMessages(
                (previousMessages) =>
                    previousMessages.filter(
                        (msg) =>
                            msg._id !==
                            data.messageId
                    )
            );
        };

        const handleMessageStatusUpdated = (data) => {
            setMessages((previousMessages) =>
                previousMessages.map((msg) =>
                    msg._id?.toString() ===
                    data.messageId?.toString()
                        ? {
                            ...msg,
                            deliveredTo: data.deliveredTo,
                            readBy: data.readBy
                        }
                        : msg
                )
            );
        };

        const handleMessageStarUpdated = (data) => {
            setMessages((previousMessages) =>
                previousMessages.map((msg) =>
                    msg._id?.toString() ===
                    data.messageId?.toString()
                        ? {
                            ...msg,
                            starredBy: data.starredBy
                        }
                        : msg
                )
            );
        };

        socket.on(
            "messageDeleted",
            handleMessageDeleted
        );

        socket.on(
            "messageDeletedForMe",
            handleMessageDeletedForMe
        );

        socket.on(
            "messageStatusUpdated",
            handleMessageStatusUpdated
        );

        socket.on(
            "messageStarUpdated",
            handleMessageStarUpdated
        );

        return () => {
            socket.off(
                "messageDeleted",
                handleMessageDeleted
            );

            socket.off(
                "messageDeletedForMe",
                handleMessageDeletedForMe
            );

            socket.off(
                "messageStatusUpdated",
                handleMessageStatusUpdated
            );

            socket.off(
                "messageStarUpdated",
                handleMessageStarUpdated
            );
        };
    }, []);

    useEffect(() => {
        if (!messageNotification) {
            return;
        }

        const timeoutId = window.setTimeout(
            () => setMessageNotification(null),
            5000
        );

        return () => window.clearTimeout(timeoutId);
    }, [messageNotification]);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [messages]);

    const selectUser = async (user) => {
        clearTypingForCurrentChat();
        setSelectedUser(user);
        setSelectedGroup(null);
        setUnreadCounts((previousCounts) => ({
            ...previousCounts,
            [user._id]: 0
        }));
        setMessages([]);
        setCallHistory([]);
        setPhotoViewerMessageId(null);
        setMessageSearch("");
        setShowMessageSearch(false);
        setReplyingTo(null);
        setIsTyping(false);
        setShowAttachment(false);
        setOpenMenu(null);

        try {
            if (user.isHiddenConversation) {
                await axios.post(apiUrl(`/users/${user._id}/restore`));
            }
            const response = await axios.get(
                apiUrl(`/messages/${user._id}`)
            );

            const loadedMessages =
                response.data.messages;

            setMessages(loadedMessages);
            markMessagesAsRead(loadedMessages);

        } catch (error) {
            console.log(
                error.response?.data ||
                error.message
            );
        }
    };

    const isSelectedUserBlocked = Boolean(
        selectedUser && blockedUserIds.includes(selectedUser._id.toString())
    );
    const isSelfChat = Boolean(selectedUser && selectedUser._id?.toString() === userId?.toString());

    const setSelectedUserBlocked = async (shouldBlock) => {
        if (!selectedUser) return;
        if (shouldBlock && !window.confirm(`Block ${selectedUser.username} from private messages and calls? Group chats will continue to work.`)) {
            return;
        }

        try {
            const url = apiUrl(`/users/${selectedUser._id}/block`);
            if (shouldBlock) {
                await axios.post(url);
                setBlockedUserIds((ids) => ids.includes(selectedUser._id.toString()) ? ids : [...ids, selectedUser._id.toString()]);
            } else {
                await axios.delete(url);
                setBlockedUserIds((ids) => ids.filter((id) => id !== selectedUser._id.toString()));
            }
        } catch (error) {
            window.alert(error.response?.data?.message || "Privacy settings could not be updated.");
        }
    };

    const removeSelectedConversation = async () => {
        if (!selectedUser || !window.confirm("Remove this conversation from your view? The other person’s history will not be changed.")) {
            return;
        }

        try {
            await axios.delete(apiUrl(`/conversations/${selectedUser._id}`));
            setMessages([]);
            setUsers((previous) => previous.filter((user) => user._id !== selectedUser._id));
            setSelectedUser(null);
            setShowInfoPanel(false);
            setReplyingTo(null);
            setLastMessages((previous) => {
                const next = { ...previous };
                delete next[selectedUser._id];
                return next;
            });
            setUnreadCounts((previous) => {
                const next = { ...previous };
                delete next[selectedUser._id];
                return next;
            });
        } catch (error) {
            window.alert(error.response?.data?.message || "Conversation could not be removed.");
        }
    };

    const selectGroup = async (group) => {
        clearTypingForCurrentChat();
        setSelectedGroup(group);
        setSelectedUser(null);
        setMessages([]);
        setCallHistory([]);
        setPhotoViewerMessageId(null);
        setMessageSearch("");
        setShowMessageSearch(false);
        setReplyingTo(null);
        setIsTyping(false);
        setShowAttachment(false);
        setOpenMenu(null);

        try {
            const response = await axios.get(
                apiUrl(`/groups/${group._id}/messages`)
            );

            const loadedMessages =
                response.data.messages;

            setMessages(loadedMessages);
            markMessagesAsRead(loadedMessages);

        } catch (error) {
            console.log(
                error.response?.data ||
                error.message
            );
        }
    };

    const addMembersToGroup = async () => {
        if (
            !selectedGroup ||
            selectedMembers.length === 0 ||
            addingMembers
        ) {
            return;
        }

        setAddingMembers(true);
        setAddMembersError("");
        setAddMembersNotice("");
        try {
            const response = await axios.put(
                apiUrl(`/groups/${selectedGroup._id}/members`),
                {
                    members: selectedMembers
                }
            );

            const updatedGroup =
                response.data.group;

            setSelectedGroup(
                updatedGroup
            );

            setGroups((previousGroups) =>
                previousGroups.map((group) =>
                    group._id ===
                    updatedGroup._id
                        ? updatedGroup
                        : group
                )
            );

            setSelectedMembers([]);
            setAddMembersNotice("Members were added to the group.");

        } catch (error) {
            setAddMembersError(error.response?.data?.message || "Members could not be added. Try again.");
        } finally {
            setAddingMembers(false);
        }
    };

    const createGroup = async () => {
        const groupName = newGroupName.trim();

        if (!groupName) {
            alert("Please enter a group name");
            return;
        }

        if (newGroupMembers.length === 0) {
            alert("Please select at least one member");
            return;
        }

        try {
            const response = await axios.post(
                apiUrl("/groups"),
                {
                    name: groupName,
                    members: newGroupMembers
                }
            );

            const currentGroupMember = profileUser || {
                _id: userId,
                username: "You"
            };
            const selectedGroupMembers = users.filter(
                (user) => newGroupMembers.includes(user._id)
            );
            const createdGroup = {
                ...response.data.group,
                members: [
                    currentGroupMember,
                    ...selectedGroupMembers
                ]
            };

            setGroups((previousGroups) => [
                ...previousGroups,
                createdGroup
            ]);
            setNewGroupName("");
            setNewGroupMembers([]);
            setShowCreateGroup(false);
            setSelectedGroup(createdGroup);
            setSelectedUser(null);
            setMessages([]);

        } catch (error) {
            console.log(
                error.response?.data ||
                error.message
            );

            alert(
                error.response?.data?.message ||
                "Group creation failed"
            );
        }
    };

    const toggleNewGroupMember = (memberId) => {
        setNewGroupMembers((previousMembers) =>
            previousMembers.includes(memberId)
                ? previousMembers.filter(
                    (id) => id !== memberId
                )
                : [...previousMembers, memberId]
        );
    };

    const toggleMemberSelection = (
        memberId
    ) => {
        setSelectedMembers(
            (previousMembers) => {
                if (
                    previousMembers.includes(
                        memberId
                    )
                ) {
                    return previousMembers.filter(
                        (id) =>
                            id !== memberId
                    );
                }

                return [
                    ...previousMembers,
                    memberId
                ];
            }
        );
    };

    const handleTyping = (e) => {
        const value =
            e.target.value;

        setMessage(value);
        setMessageSendError("");

        const payload = selectedGroup
            ? { senderId: userId, groupId: selectedGroup._id }
            : selectedUser
                ? (isSelfChat ? null : { senderId: userId, receiverId: selectedUser._id })
                : null;
        if (!payload) return;
        const key = selectedGroup ? `group:${selectedGroup._id}` : `private:${selectedUser._id}`;
        const nextTyping = value.length > 0;
        if (!nextTyping) {
            if (typingStateRef.current.isTyping && typingStateRef.current.payload) {
                socket.emit("typing", { ...typingStateRef.current.payload, isTyping: false });
            }
            window.clearInterval(typingHeartbeatRef.current);
            window.clearTimeout(typingStopTimeoutRef.current);
            typingHeartbeatRef.current = null;
            typingStopTimeoutRef.current = null;
            typingStateRef.current = { key: null, payload: null, isTyping: false };
            return;
        }

        const alreadyTypingHere = typingStateRef.current.key === key && typingStateRef.current.isTyping;
        typingStateRef.current = { key, payload, isTyping: true };
        if (!alreadyTypingHere) {
            socket.emit("typing", { ...payload, isTyping: true });
            window.clearInterval(typingHeartbeatRef.current);
            typingHeartbeatRef.current = window.setInterval(() => {
                socket.emit("typing", { ...payload, isTyping: true });
            }, 2500);
        }
        window.clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = window.setTimeout(() => {
            if (typingStateRef.current.key !== key || !typingStateRef.current.isTyping) return;
            socket.emit("typing", { ...payload, isTyping: false });
            typingStateRef.current = { key: null, payload: null, isTyping: false };
            window.clearInterval(typingHeartbeatRef.current);
            typingHeartbeatRef.current = null;
        }, 3500);
    };

    const clearTypingForCurrentChat = () => {
        if (typingStateRef.current.isTyping && typingStateRef.current.payload) {
            socket.emit("typing", { ...typingStateRef.current.payload, isTyping: false });
        }
        window.clearInterval(typingHeartbeatRef.current);
        window.clearTimeout(typingStopTimeoutRef.current);
        typingHeartbeatRef.current = null;
        typingStopTimeoutRef.current = null;
        typingStateRef.current = { key: null, payload: null, isTyping: false };
        setIsTyping(false);
        setGroupTypingUsers({});
    };

    const sendMessage = () => {
        if (selectedUser && (isSelectedUserBlocked || selectedUser.isDeleted)) {
            alert("Private messaging is unavailable for this user.");
            return;
        }

        if (
            !message.trim() ||
            !selectedUser
        ) {
            return;
        }

        if (!socket.connected) {
            setMessageSendError("Reconnect before sending this message.");
            return;
        }

        setMessageSendError("");
        socket.emit(
            "sendMessage",
            {
                senderId: userId,
                receiverId:
                    selectedUser._id,
                message:
                    message.trim(),
                replyTo: getReplyPayload()
            },
            (result) => {
                if (!result?.ok) {
                    setMessageSendError(result?.message || "The message could not be sent. Your text is still here to retry.");
                    return;
                }
                clearTypingForCurrentChat();
                setMessage("");
                setReplyingTo(null);
            }
        );
    };

    const sendGroupMessage = () => {
        if (
            !message.trim() ||
            !selectedGroup
        ) {
            return;
        }

        socket.emit(
            "sendGroupMessage",
            {
                senderId: userId,
                groupId:
                    selectedGroup._id,
                message:
                    message.trim(),
                replyTo: getReplyPayload()
            }
        );

        clearTypingForCurrentChat();

        setMessage("");
        setReplyingTo(null);
    };

    const handleSendMessage = () => {
        if (selectedGroup) {
            sendGroupMessage();
            return;
        }

        sendMessage();
    };

    const deleteForMe = (msg) => {
        socket.emit(
            "deleteMessage",
            {
                messageId: msg._id,
                senderId: userId,
                receiverId:
                    selectedUser?._id,
                groupId:
                    selectedGroup?._id,
                deleteFor: "me"
            }
        );

        setOpenMenu(null);
    };

    const copyMessage = async (msg) => {
        try {
            await navigator.clipboard.writeText(
                msg.message || msg.fileName || ""
            );
        } catch (error) {
            console.log("Copy message error:", error);
        }

        setOpenMenu(null);
    };

    const deleteForEveryone = (msg) => {
        if (
            msg.senderId?.toString() !==
            userId?.toString()
        ) {
            return;
        }

        socket.emit(
            "deleteMessage",
            {
                messageId: msg._id,
                senderId: userId,
                receiverId:
                    selectedUser?._id,
                groupId:
                    selectedGroup?._id,
                deleteFor: "everyone"
            }
        );

        setOpenMenu(null);
    };

    const handleAttachment = async (e) => {
        const input = e.target;
        const file = input.files?.[0];

        if (!file) {
            return;
        }

        if (selectedUser && (isSelectedUserBlocked || selectedUser.isDeleted)) {
            alert("Private attachments are unavailable for this user.");
            input.value = "";
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be less than 10 MB");
            input.value = "";
            return;
        }

        try {

            const formData = new FormData();

            formData.append("file", file);

            const response = await axios.post(
                apiUrl("/upload"),
                formData
            );

            const uploadedFile = response.data.file;
            const attachmentMessage = {
                senderId: userId,
                message: uploadedFile.fileName,
                messageType: uploadedFile.messageType,
                fileName: uploadedFile.fileName,
                fileUrl: uploadedFile.fileUrl,
                fileType: uploadedFile.fileType,
                fileSize: uploadedFile.fileSize,
                replyTo: getReplyPayload()
            };

            const sendWithAcknowledgement = (eventName, payload) => new Promise((resolve, reject) => {
                if (!socket.connected) {
                    reject(new Error("Reconnect before sending this attachment."));
                    return;
                }
                const timeout = window.setTimeout(() => reject(new Error("The server did not confirm the attachment. Try again.")), 15000);
                socket.emit(eventName, payload, (result) => {
                    window.clearTimeout(timeout);
                    if (result?.ok) resolve();
                    else reject(new Error(result?.message || "The attachment could not be sent. Try again."));
                });
            });

            if (selectedGroup) {
                await sendWithAcknowledgement("sendGroupMessage", {
                    ...attachmentMessage,
                    groupId: selectedGroup._id
                });
            } else if (selectedUser) {
                await sendWithAcknowledgement("sendMessage", {
                    ...attachmentMessage,
                    receiverId: selectedUser._id
                });
            } else {
                return;
            }

            setShowAttachment(false);
            setReplyingTo(null);
            input.value = "";

        } catch (error) {

            console.log("Attachment send error:", error.response?.data || error.message);
            alert(error.response?.data?.message || error.message || "Attachment could not be sent. Select it again to retry.");

        }
    };

    const startRecording = async () => {
        if (voicePreview) return;
        if (selectedUser && (isSelectedUserBlocked || selectedUser.isDeleted)) {
            alert("Private voice messages are unavailable for this user.");
            return;
        }

        let stream;

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Microphone recording is unavailable");
            }

            stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            const mimeTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/mp4"
            ];
            if (typeof MediaRecorder === "undefined") throw new Error("Voice recording is not supported by this browser");
            const mimeType = mimeTypes.find((type) =>
                MediaRecorder.isTypeSupported?.(type)
            );
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            const audioChunks = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            recorder.onerror = () => {
                discardRecordingRef.current = true;
                stream.getTracks().forEach((track) => track.stop());
                mediaRecorderRef.current = null;
                setMediaRecorder(null);
                setIsRecording(false);
                alert("Recording stopped because of a microphone error. Please try again.");
            };

            recorder.onstop = async () => {
                const audioType =
                    recorder.mimeType || mimeType || "audio/webm";
                const audioBlob = new Blob(audioChunks, {
                    type: audioType
                });

                stream.getTracks().forEach((track) => {
                    track.stop();
                });
                mediaRecorderRef.current = null;
                setMediaRecorder(null);
                setIsRecording(false);

                if (discardRecordingRef.current) {
                    discardRecordingRef.current = false;
                    return;
                }

                if (!audioBlob.size) {
                    alert("No audio was recorded. Please try again.");
                    return;
                }

                if (audioBlob.size > 10 * 1024 * 1024) {
                    alert("Voice message must be less than 10 MB");
                    return;
                }

                const extension = audioType.includes("mp4")
                    ? "mp4"
                    : "webm";
                const fileName = `voice-${Date.now()}.${extension}`;
                const target = selectedGroup
                    ? { groupId: selectedGroup._id, label: selectedGroup.name }
                    : selectedUser
                        ? { receiverId: selectedUser._id, label: selectedUser.username }
                        : null;
                if (!target) return;
                const preview = {
                    url: URL.createObjectURL(audioBlob),
                    file: audioBlob,
                    fileName,
                    duration: Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)),
                    target,
                    replyTo: getReplyPayload(),
                    uploadedFile: null,
                    error: ""
                };
                setVoicePreview(preview);
            };

            recorder.start();
            discardRecordingRef.current = false;
            mediaRecorderRef.current = recorder;
            setMediaRecorder(recorder);
            recordingStartedAtRef.current = Date.now();
            setRecordingSeconds(0);
            setIsRecording(true);
            setShowAttachment(false);

        } catch (error) {
            stream?.getTracks().forEach((track) => {
                track.stop();
            });
            console.log("Microphone error:", error);
            alert(error.message === "Microphone recording is unavailable" || error.message.startsWith("Voice recording is not supported")
                ? error.message
                : "Microphone permission is required to record a voice message.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder?.state === "recording") {
            mediaRecorder.stop();
        }
    };

    const cancelRecording = () => {
        if (!mediaRecorder || mediaRecorder.state !== "recording") return;
        discardRecordingRef.current = true;
        mediaRecorder.stop();
    };

    const discardVoicePreview = () => {
        setVoicePreview((previous) => {
            if (previous?.url) URL.revokeObjectURL(previous.url);
            return null;
        });
    };

    const sendVoicePreview = async () => {
        if (!voicePreview || voiceSending) return;
        if (!socket.connected) {
            setVoicePreview((previous) => ({ ...previous, error: "Reconnect to send this recording." }));
            return;
        }
        setVoiceSending(true);
        setVoicePreview((previous) => ({ ...previous, error: "" }));
        try {
            let uploadedFile = voicePreview.uploadedFile;
            if (!uploadedFile) {
                const formData = new FormData();
                formData.append("file", voicePreview.file, voicePreview.fileName);
                const response = await axios.post(apiUrl("/upload"), formData);
                uploadedFile = response.data.file;
                setVoicePreview((previous) => ({ ...previous, uploadedFile }));
            }

            const payload = {
                message: "Voice message",
                messageType: "audio",
                fileName: uploadedFile.fileName,
                fileUrl: uploadedFile.fileUrl,
                fileType: uploadedFile.fileType,
                fileSize: uploadedFile.fileSize,
                replyTo: voicePreview.replyTo,
                ...voicePreview.target
            };
            const eventName = voicePreview.target.groupId ? "sendGroupMessage" : "sendMessage";
            await new Promise((resolve, reject) => {
                const timeout = window.setTimeout(() => reject(new Error("The server did not confirm the message.")), 15000);
                socket.emit(eventName, payload, (acknowledgement) => {
                    window.clearTimeout(timeout);
                    if (acknowledgement?.ok) resolve();
                    else reject(new Error(acknowledgement?.message || "The voice message could not be sent."));
                });
            });
            discardVoicePreview();
            setReplyingTo(null);
        } catch (error) {
            setVoicePreview((previous) => ({ ...previous, error: error.response?.data?.message || error.message || "The voice message could not be sent." }));
        } finally {
            setVoiceSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const toggleMessageSearch = () => {
        if (showMessageSearch) {
            setMessageSearch("");
        }

        setShowMessageSearch(!showMessageSearch);
    };

    const formatTime = (date) => {
        if (!date) {
            return "";
        }

        return new Date(
            date
        ).toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    };

    const searchValue =
        search.trim().toLowerCase();

    const searchableUsers = searchValue
        ? [...new Map([...users, ...directorySearchResults].map((user) => [user._id?.toString(), user])).values()]
        : users;

    const filteredUsers =
        searchableUsers.filter(
            (user) =>
                user._id?.toString() !==
                userId?.toString() &&
                activeFilter !== "groups" &&
                (activeFilter !== "friends" || user.isOnline) &&
                (
                    user.username
                        ?.toLowerCase()
                        .includes(searchValue)
                )
        );

    const filteredGroups =
        groups.filter(
            (group) =>
                (activeFilter === "all" ||
                    activeFilter === "groups") &&
                group.name
                    ?.toLowerCase()
                    .includes(searchValue)
        );

    const messageSearchValue =
        messageSearch.trim().toLowerCase();

    const filteredMessages =
        messages.filter((msg) =>
            !messageSearchValue ||
            msg.message
                ?.toLowerCase()
                .includes(messageSearchValue) ||
            msg.fileName
                ?.toLowerCase()
                .includes(messageSearchValue)
        );

    const filteredCallHistory = selectedUser
        ? callHistory.filter((call) =>
            !messageSearchValue ||
            `${call.callType} ${call.status} ${call.callerId === userId ? "outgoing" : "incoming"}`
                .toLowerCase()
                .includes(messageSearchValue)
        )
        : [];

    const conversationItems = [
        ...filteredMessages.map((record) => ({ kind: "message", record, date: record.createdAt })),
        ...filteredCallHistory.map((record) => ({ kind: "call", record, date: record.initiatedAt }))
    ].sort((first, second) => new Date(first.date) - new Date(second.date));

    const photoImages = messages.filter((msg) => msg.messageType === "image" && msg.fileUrl);
    const openPhotoViewer = (messageId) => {
        if (photoImages.some((image) => image._id === messageId)) {
            setPhotoViewerMessageId(messageId);
        }
    };

    const openProfilePhotoViewer = (user) => {
        if (!user?.profilePhoto || !user?._id) return;
        setPhotoViewerProfile({
            userId: user._id,
            username: user.username,
            profilePhoto: user.profilePhoto
        });
    };

    const handleConversationWallpaperUpdated = (wallpaper) => {
        setConversationWallpaper(wallpaper && selectedUser
            ? { peerId: selectedUser._id.toString(), ...wallpaper }
            : null);
    };

    const memberSearchValue =
        memberSearch
            .trim()
            .toLowerCase();

    const availableMembers =
        selectedGroup
            ? users
                .filter(
                    (user) =>
                        user.isDeleted !== true &&
                        user.isDeleting !== true &&
                        !selectedGroup.members.some(
                            (member) =>
                                member._id?.toString() ===
                                user._id?.toString()
                        )
                )
                .filter(
                    (user) =>
                        user.username
                            ?.toLowerCase()
                            .includes(
                                memberSearchValue
                            )
                )
            : [];

    const getSenderName = (msg) => {
        if (!selectedGroup) {
            return "";
        }

        return (
            msg.senderName ||
            selectedGroup.members.find(
                (member) =>
                    member._id?.toString() ===
                    msg.senderId?.toString()
            )?.username ||
            "Unknown"
        );
    };

    const getReplyPayload = () => {
        if (!replyingTo) {
            return null;
        }

        return {
            messageId: replyingTo._id,
            message: replyingTo.message,
            senderName:
                replyingTo.senderName ||
                getReplySenderName(replyingTo),
            messageType:
                replyingTo.messageType || "text"
        };
    };

    const getReplySenderName = (msg) => {
        if (msg.senderName) {
            return msg.senderName;
        }

        if (selectedGroup) {
            return getSenderName(msg);
        }

        if (
            msg.senderId?.toString() ===
            userId?.toString()
        ) {
            return profileUser?.username || "You";
        }

        return selectedUser?.username || "User";
    };

    const isOwnMessage = (msg) =>
        msg.senderId?.toString() ===
        userId?.toString();

    const openMessageReport = (message) => {
        setReportDraft(message);
        setReportReason("suspected_scam");
        setReportDetails("");
        setOpenMenu(null);
    };

    const submitMessageReport = async () => {
        if (!reportDraft || reportRequestInFlightRef.current || reportStatus[reportDraft._id]?.success) return;
        reportRequestInFlightRef.current = true;
        setReportStatus((previous) => ({ ...previous, [reportDraft._id]: { loading: true, message: "" } }));
        try {
            await axios.post(apiUrl(`/messages/${reportDraft._id}/report`), {
                reason: reportReason,
                details: reportDetails
            });
            setReportStatus((previous) => ({ ...previous, [reportDraft._id]: { loading: false, success: true, message: "Report submitted." } }));
            setReportDetails("");
        } catch (error) {
            setReportStatus((previous) => ({ ...previous, [reportDraft._id]: { loading: false, message: error.response?.data?.message || "Report could not be submitted. Try again." } }));
        } finally {
            reportRequestInFlightRef.current = false;
        }
    };

    return (
        <>
        <div
            className="cs-app"
            data-theme={theme}
            data-chat-open={Boolean(selectedUser || selectedGroup)}
            data-info-open={showInfoPanel}
            style={{
                display: "flex",
                height: "100vh",
                width: "100%",
                fontFamily:
                    "Arial, sans-serif",
                background: "#efeae2",
                overflow: "hidden"
            }}
        >
            {messageNotification && (
    <div
        role="status"
        onClick={() => {
            const senderUser = users.find(
                (user) =>
                    user._id?.toString() ===
                    messageNotification.senderId
            );

            if (senderUser) {
                selectUser(senderUser);
            }

            setMessageNotification(null);
        }}
        style={{
            position: "fixed",
            top: "18px",
            right: "18px",
            zIndex: 3000,
            width: "min(390px, calc(100vw - 36px))",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: "13px",
            padding: "13px 14px",
            background: "rgba(255, 255, 255, 0.97)",
            border: "1px solid rgba(20, 20, 40, 0.08)",
            borderRadius: "18px",
            boxShadow:
                "0 14px 40px rgba(20, 20, 40, 0.18)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            cursor: "pointer",
            animation: "chatspaceNotificationIn 0.3s ease-out"
        }}
    >
        {/* Avatar */}
        <div
            style={{
                width: "46px",
                height: "46px",
                minWidth: "46px",
                borderRadius: "15px",
                background: "var(--cs-brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "17px",
                overflow: "hidden"
            }}
        >
            {(() => {
                const senderUser = users.find(
                    (user) =>
                        user._id?.toString() ===
                        messageNotification.senderId
                );

                if (senderUser?.profilePhoto) {
                    return (
                        <ProtectedImage
                            path={`/media/profiles/${senderUser._id}`}
                            refreshKey={senderUser.profilePhoto}
                            alt=""
                                        fallback="👤"
                            onClick={(event) => {
                                event.stopPropagation();
                                openProfilePhotoViewer(senderUser);
                            }}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover"
                            }}
                        />
                    );
                }

                return (
                    messageNotification.senderName
                        ?.charAt(0)
                        ?.toUpperCase() || "C"
                );
            })()}
        </div>

        {/* Notification content */}
        <div
            style={{
                flex: 1,
                minWidth: 0
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px"
                }}
            >
                <strong
                    style={{
                        fontSize: "14px",
                        color: "#171725",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {messageNotification.senderName}
                </strong>

                <span
                    style={{
                        fontSize: "11px",
                        color: "#9292a3",
                        whiteSpace: "nowrap"
                    }}
                >
                    Now
                </span>
            </div>

            <div
                style={{
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#686879",
                    fontSize: "13px",
                    overflow: "hidden"
                }}
            >
                <span
                    style={{
                        width: "7px",
                        height: "7px",
                        minWidth: "7px",
                        borderRadius: "50%",
                        background: "var(--cs-brand)"
                    }}
                />

                <span
                    style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {messageNotification.message}
                </span>
            </div>
        </div>

        {/* Close */}
        <button
            type="button"
            aria-label="Dismiss notification"
            onClick={(event) => {
                event.stopPropagation();
                setMessageNotification(null);
            }}
            style={{
                width: "28px",
                height: "28px",
                minWidth: "28px",
                border: "none",
                borderRadius: "50%",
                background: "#f2f2f6",
                color: "#777787",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
            }}
        >
            <X size={15} />
        </button>
    </div>
)}

            <CallOverlay
                callState={callState}
                incomingCall={incomingCall}
                localStream={localStream}
                remoteStream={remoteStream}
                callError={callError}
                canFallbackToAudio={canFallbackToAudio}
                onRetryVideo={() => startCall("video", incomingCall
                    ? { _id: incomingCall.from, username: incomingCall.fromName }
                    : selectedUser)}
                onAudioFallback={() => startCall("audio", incomingCall
                    ? { _id: incomingCall.from, username: incomingCall.fromName }
                    : selectedUser)}
                onAccept={acceptCall}
                onReject={rejectCall}
                onEnd={() => closeCall("user-hangup-button", true)}
            />

            <PhotoViewer
                images={photoImages}
                activeIndex={photoImages.findIndex((image) => image._id === photoViewerMessageId)}
                onClose={() => setPhotoViewerMessageId(null)}
                onNavigate={(index) => setPhotoViewerMessageId(photoImages[index]?._id || null)}
            />
            <PhotoViewer
                images={photoViewerProfile ? [{
                    _id: photoViewerProfile.userId,
                    fileName: photoViewerProfile.username,
                    mediaPath: `/media/profiles/${photoViewerProfile.userId}`,
                    refreshKey: photoViewerProfile.profilePhoto
                }] : []}
                activeIndex={0}
                onClose={() => setPhotoViewerProfile(null)}
            />

            <div
                className="cs-sidebar"
                style={{
                    width: "340px",
                    minWidth: "340px",
                    background: "#ffffff",
                    borderRight:
                        "1px solid #d1d7db",
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                <div
                    className="cs-sidebar-top"
                    style={{
                        padding: "16px",
                        background: "#f0f2f5",
                        borderBottom:
                            "1px solid #d1d7db"
                    }}
                >
                    <div
                        className="cs-sidebar-account-row"
                        style={{
                            display: "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "center"
                        }}
                    >
                        <div className="cs-brand-lockup">
                            <ChatSpaceLogo className="cs-sidebar-logo" showTagline />
                        </div>

                        <div className="cs-profile-menu-wrap">
                            <button
                                type="button"
                                className="cs-account-trigger"
                                aria-label="Open account menu"
                                aria-expanded={showProfileMenu}
                                onClick={() =>
                                    setShowProfileMenu((previous) => !previous)
                                }
                            >
                                {profileUser?.profilePhoto ? (
                                    <ProtectedImage
                                        path={`/media/profiles/${profileUser._id}`}
                                        refreshKey={profileUser.profilePhoto}
                                        alt=""
                                        fallback="👤"
                                    />
                                ) : (
                                    <>👤</>
                                )}
                            </button>

                            {showProfileMenu && (
                                <div className="cs-account-menu">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowProfileMenu(false);
                                            navigate("/profile");
                                        }}
                                    >
                                        <UserRound size={16} /> Profile
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowProfileMenu(false);
                                            navigate("/settings");
                                        }}
                                    >
                                        <Settings size={16} /> Settings
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (callState) {
                                                closeCall("user-logout", true);
                                            }
                                            socket.disconnect();
                                            signOut(auth);
                                            navigate("/");
                                        }}
                                    >
                                        <LogOut size={16} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className="cs-search-wrap"
                        style={{
                            marginTop:
                                "14px",
                            position:
                                "relative"
                        }}
                    >
                        <Search size={17} aria-hidden="true" />

                        <input
                            id="conversation-search"
                            name="conversationSearch"
                            aria-label="Search conversations, people, and groups"
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                            placeholder="Search conversations, people, groups..."
                            className="cs-chat-search"
                            style={{
                                width: "100%",
                                boxSizing:
                                    "border-box",
                                padding:
                                    "11px 15px 11px 40px",
                                border: "none",
                                borderRadius:
                                    "8px",
                                background:
                                    "#ffffff",
                                outline:
                                    "none"
                            }}
                        />

                        {search && (
                            <button
                                type="button"
                                className="cs-search-clear"
                                aria-label="Clear search"
                                onClick={() => setSearch("")}
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    <nav className="cs-filter-tabs" aria-label="Conversation filters">
                        {[
                            ["all", "All"],
                            ["chats", "Chats"],
                            ["groups", "Groups"],
                            ["friends", "Friends"]
                        ].map(([filter, label]) => (
                            <button
                                key={filter}
                                type="button"
                                aria-pressed={activeFilter === filter}
                                onClick={() => setActiveFilter(filter)}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    <button
                        type="button"
                        className="cs-summary-sidebar-trigger"
                        onClick={() => setShowChatSummary(true)}
                    >
                        <Sparkles size={15} /> Summarize text
                    </button>
                </div>

                <div
                    className="cs-sidebar-scroll"
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding:
                            "8px 0"
                    }}
                >
                    <div
                        className="cs-section-label"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding:
                                "10px 16px 6px",
                            color:
                                "#667781",
                            fontSize:
                                "13px",
                            fontWeight:
                                "bold"
                        }}
                    >
                        <span>GROUPS</span>
                        <button
                            type="button"
                            aria-label="Create group"
                            title="Create group"
                            onClick={() => {
                                setNewGroupName("");
                                setNewGroupMembers([]);
                                setShowCreateGroup(true);
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--cs-brand)",
                                fontSize: "24px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                lineHeight: "20px"
                            }}
                        >
                            +
                        </button>
                    </div>

                    {filteredGroups.map(
                        (group) => (
                            <div
                                key={
                                    group._id
                                }
                                className="cs-conversation-item"
                                data-active={selectedGroup?._id === group._id}
                                onClick={() =>
                                    selectGroup(
                                        group
                                    )
                                }
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    gap: "12px",
                                    padding:
                                        "12px 16px",
                                    cursor:
                                        "pointer",
                                    background:
                                        selectedGroup?._id ===
                                        group._id
                                            ? "#f0f2f5"
                                            : "#ffffff"
                                }}
                            >
                                <div
                                    style={{
                                        width:
                                            "48px",
                                        height:
                                            "48px",
                                        borderRadius:
                                            "50%",
                                        background:
                                            "#dfe5e7",
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        justifyContent:
                                            "center",
                                        fontSize:
                                            "22px"
                                    }}
                                >
                                    👥
                                </div>

                                <div
                                    style={{
                                        flex: 1,
                                        minWidth:
                                            0
                                    }}
                                >
                                    <strong
                                        style={{
                                            display:
                                                "block",
                                            overflow:
                                                "hidden",
                                            textOverflow:
                                                "ellipsis",
                                            whiteSpace:
                                                "nowrap"
                                        }}
                                    >
                                        {group.name}
                                    </strong>

                                    <small
                                        className="cs-sidebar-group-meta"
                                        data-typing={Object.keys(sidebarTyping[`group:${group._id}`] || {}).length > 0}
                                    >
                                        {Object.keys(sidebarTyping[`group:${group._id}`] || {}).length > 0
                                            ? Object.keys(sidebarTyping[`group:${group._id}`] || {}).length === 1
                                                ? `${Object.values(sidebarTyping[`group:${group._id}`] || {})[0]} is typing…`
                                                : `${Object.keys(sidebarTyping[`group:${group._id}`] || {}).length} people typing…`
                                            : `${group.members.length} members`}
                                    </small>
                                </div>
                            </div>
                        )
                    )}

                    <div
                        className="cs-section-label"
                        style={{
                            padding:
                                "15px 16px 6px",
                            color:
                                "#667781",
                            fontSize:
                                "13px",
                            fontWeight:
                                "bold"
                        }}
                    >
                        CHATS
                    </div>

                    {profileUser && !["groups", "friends"].includes(activeFilter) &&
                        (!searchValue || ["you", "message yourself", "my notes", profileUser.username?.toLowerCase()]
                            .some((label) => label?.includes(searchValue))) && (
                        <div
                            role="button"
                            tabIndex={0}
                            className="cs-conversation-item"
                            data-active={isSelfChat}
                            onClick={() => selectUser(profileUser)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    selectUser(profileUser);
                                }
                            }}
                            aria-label="Open Message yourself"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "12px 16px",
                                cursor: "pointer"
                            }}
                        >
                            <div style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "50%",
                                background: "#dfe5e7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "21px",
                                position: "relative",
                                overflow: "hidden"
                            }}>
                            {profileUser.profilePhoto ? (
                                <ProtectedImage style={{ width: "100%", height: "100%", objectFit: "cover" }} path={`/media/profiles/${profileUser._id}`} refreshKey={profileUser.profilePhoto} alt="" fallback="👤" onClick={(event) => { event.stopPropagation(); openProfilePhotoViewer(profileUser); }} />
                            ) : (
                                <span className="cs-profile-photo-fallback" style={{ width: "48px", height: "48px", fontSize: "21px" }} aria-hidden="true">👤</span>
                            )}
                            </div>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <strong>You</strong>
                                <div className="cs-sidebar-user-presence">Save messages</div>
                            </span>
                        </div>
                    )}

                    {filteredUsers.map(
                        (user) => (
                            <div
                                key={
                                    user._id
                                }
                                className="cs-conversation-item"
                                data-active={selectedUser?._id === user._id}
                                onClick={() =>
                                    selectUser(
                                        user
                                    )
                                }
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    gap: "12px",
                                    padding:
                                        "12px 16px",
                                    cursor:
                                        "pointer",
                                    background:
                                        selectedUser?._id ===
                                        user._id
                                            ? "#f0f2f5"
                                            : "#ffffff"
                                }}
                            >
                                <div
                                    style={{
                                        width:
                                            "48px",
                                        height:
                                            "48px",
                                        borderRadius:
                                            "50%",
                                        background:
                                            "#dfe5e7",
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        justifyContent:
                                            "center",
                                        fontSize:
                                            "21px",
                                        position:
                                            "relative",
                                        overflow: "hidden"
                                    }}
                                >
                                    {user.profilePhoto ? (
                                        <ProtectedImage
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            path={`/media/profiles/${user._id}`}
                                            refreshKey={user.profilePhoto}
                                            alt={`${user.username} profile photo`}
                                            fallback="👤"
                                            onClick={(event) => { event.stopPropagation(); openProfilePhotoViewer(user); }}
                                        />
                                    ) : <>👤</>}

                                </div>

                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0
                                    }}
                                >
                                    <strong>{user.username}</strong>

                                    <div className="cs-sidebar-user-presence" data-typing={Boolean(sidebarTyping[`private:${user._id}`])} data-online={Boolean(user.isOnline)}>
                                        {sidebarTyping[`private:${user._id}`] ? "typing..." : user.isOnline ? "Online" : "Offline"}
                                    </div>
                                    {lastMessages[user._id] && (
                                        <small className="cs-sidebar-last-message">{lastMessages[user._id]}</small>
                                    )}
                                </div>

                                {unreadCounts[user._id] > 0 && (
                                    <span
                                        style={{
                                            background: "var(--cs-brand)",
                                            color: "#ffffff",
                                            borderRadius: "50%",
                                            minWidth: "20px",
                                            height: "20px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "11px",
                                            fontWeight: "bold",
                                            padding: "0 3px",
                                            boxSizing: "border-box"
                                        }}
                                    >
                                        {unreadCounts[user._id]}
                                    </span>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>

            <div
                className="cs-main"
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection:
                        "column",
                    minWidth: 0
                }}
            >
                <div
                    className="cs-chat-header"
                    style={{
                        minHeight:
                            "72px",
                        padding:
                            "12px 20px",
                        background:
                            "#f0f2f5",
                        borderBottom:
                            "1px solid #d1d7db",
                        display:
                            "flex",
                        alignItems:
                            "center"
                    }}
                >
                    {selectedGroup ? (
                        <div
                            className="cs-header-content"
                            style={{
                                width:
                                    "100%",
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                justifyContent:
                                    "space-between"
                            }}
                        >
                            <button
                                type="button"
                                className="cs-mobile-back"
                                aria-label="Back to conversations"
                                onClick={() => {
                                    clearTypingForCurrentChat();
                                    setSelectedGroup(null);
                                    setMessages([]);
                                }}
                            >
                                <ArrowLeft size={19} />
                            </button>

                            <div
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    gap:
                                        "12px"
                                }}
                            >
                                <div
                                    style={{
                                        width:
                                            "48px",
                                        height:
                                            "48px",
                                        borderRadius:
                                            "50%",
                                        background:
                                            "#dfe5e7",
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        justifyContent:
                                            "center",
                                        fontSize:
                                            "22px"
                                    }}
                                >
                                    👥
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <strong>
                                        {selectedGroup.name}
                                    </strong>

                                    <div
                                        className="cs-group-header-meta"
                                        style={{
                                            marginTop:
                                                "4px",
                                            fontSize:
                                                "13px"
                                        }}
                                    >
                                        {Object.keys(groupTypingUsers).length === 1
                                            ? `${Object.values(groupTypingUsers)[0]} is typing…`
                                            : Object.keys(groupTypingUsers).length > 1
                                                ? `${Object.keys(groupTypingUsers).length} members are typing…`
                                                : `${selectedGroup.members.length} members`}
                                    </div>
                                </div>
                            </div>

                            {selectedGroup.admin?.toString() ===
                                userId?.toString() && (
                                <button
                                    type="button"
                                    className="cs-add-members-trigger"
                                    aria-haspopup="dialog"
                                    onClick={() => {
                                        setSelectedMembers(
                                            []
                                        );
                                        setMemberSearch(
                                            ""
                                        );
                                        setShowAddMembers(
                                            true
                                        );
                                        setAddMembersError("");
                                        setAddMembersNotice("");
                                    }}
                                    style={{
                                        border:
                                            "none",
                                        background:
                                            "var(--cs-brand)",
                                        color:
                                            "#ffffff",
                                        padding:
                                            "10px 15px",
                                        borderRadius:
                                            "20px",
                                        cursor:
                                            "pointer",
                                        fontWeight:
                                            "bold"
                                    }}
                                >
                                    + Add members
                                </button>
                            )}

                            <div className="cs-chat-actions">
                                <button
                                    type="button"
                                    aria-label="Summarize chat"
                                    title="Summarize chat"
                                    onClick={() => setShowChatSummary(true)}
                                >
                                    <Sparkles size={18} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Search messages"
                                    title="Search messages"
                                    onClick={toggleMessageSearch}
                                >
                                    <Search size={18} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Group information"
                                    title="Group information"
                                    onClick={() => setShowInfoPanel(true)}
                                >
                                    <Info size={18} />
                                </button>
                            </div>
                        </div>
                    ) : selectedUser ? (
                        <div
                            className="cs-header-content"
                            style={{
                                width: "100%",
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                justifyContent:
                                    "space-between",
                                gap:
                                    "12px"
                            }}
                        >
                            <button
                                type="button"
                                className="cs-mobile-back"
                                aria-label="Back to conversations"
                                onClick={() => {
                                    clearTypingForCurrentChat();
                                    setSelectedUser(null);
                                    setMessages([]);
                                }}
                            >
                                <ArrowLeft size={19} />
                            </button>

                           <button
    type="button"
    onClick={() => setShowInfoPanel(true)}
    style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: "0",
        textAlign: "left"
    }}
>
    <div
        style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "#dfe5e7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "21px",
            overflow: "hidden"
        }}
    >
        {selectedUser.profilePhoto ? (
            <ProtectedImage
                path={`/media/profiles/${selectedUser._id}`}
                refreshKey={selectedUser.profilePhoto}
                alt={`${selectedUser.username} profile photo`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                fallback="👤"
                onClick={(event) => { event.stopPropagation(); openProfilePhotoViewer(selectedUser); }}
            />
        ) : <>👤</>}
    </div>

    <div>
        <strong>
            {isSelfChat ? "You" : selectedUser.username}
        </strong>

        <div
            className="cs-chat-presence"
            data-state={isTyping ? "typing" : selectedUser.isOnline ? "online" : "offline"}
            style={{ marginTop: "4px", fontSize: "13px" }}
        >
            {isSelfChat
                ? "Message yourself"
                : isTyping
                ? "typing..."
                : selectedUser.isOnline
                    ? "online"
                    : "offline"}
        </div>
    </div>
</button>

                            <div className="cs-chat-actions">
                                {!isSelfChat && <button
                                    type="button"
                                    aria-label="Chat wallpaper"
                                    title={conversationWallpaperLoading ? "Loading chat wallpaper" : "Chat wallpaper"}
                                    onClick={() => setShowWallpaperDialog(true)}
                                    disabled={conversationWallpaperLoading}
                                >
                                    <ImageIcon size={18} />
                                </button>}
                                {!isSelfChat && <button
                                    type="button"
                                    aria-label="Summarize chat"
                                    title="Summarize chat"
                                    onClick={() => setShowChatSummary(true)}
                                >
                                    <Sparkles size={18} />
                                </button>}
                                <button
                                    type="button"
                                    aria-label="Search messages"
                                    title="Search messages"
                                    onClick={toggleMessageSearch}
                                >
                                    <Search size={18} />
                                </button>
                                {!isSelfChat && <button
                                    type="button"
                                    aria-label="Start voice call"
                                    title="Voice call"
                                    onClick={() => startCall("audio")}
                                    disabled={Boolean(callState || incomingCall || isSelectedUserBlocked || selectedUser?.isDeleted)}
                                >
                                    <Phone size={18} />
                                </button>}
                                {!isSelfChat && <button
                                    type="button"
                                    aria-label="Start video call"
                                    title="Video call"
                                    onClick={() => startCall("video")}
                                    disabled={Boolean(callState || incomingCall || isSelectedUserBlocked || selectedUser?.isDeleted)}
                                >
                                    <Video size={18} />
                                </button>}
                                <button
                                    type="button"
                                    aria-label="Chat information"
                                    title="Chat information"
                                    onClick={() => setShowInfoPanel(true)}
                                >
                                    <Info size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <strong>
                                Real-Time Chat
                            </strong>

                            <div
                                className="cs-chat-header-hint"
                                style={{
                                    fontSize:
                                        "13px",
                                    marginTop:
                                        "4px"
                                }}
                            >
                                Select a chat to start messaging
                            </div>
                        </div>
                    )}
                </div>

                {showMessageSearch && (
                    <div
                        className="cs-message-search-bar"
                        style={{
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <input
                            id="message-search"
                            name="messageSearch"
                            type="text"
                            placeholder="Search messages..."
                            value={messageSearch}
                            onChange={(event) =>
                                setMessageSearch(event.target.value)
                            }
                            autoFocus
                            style={{
                                flex: 1,
                                border: "none",
                                outline: "none",
                                borderRadius: "20px",
                                padding: "9px 14px",
                                fontSize: "14px"
                            }}
                        />

                        <button
                            type="button"
                            className="cs-message-search-close"
                            aria-label="Close message search"
                            onClick={() => {
                                setMessageSearch("");
                                setShowMessageSearch(false);
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                fontSize: "20px",
                                color: "#54656f"
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}

                {selectedGroup && (
                    <details
                        className="cs-group-members-disclosure"
                        style={{
                            padding:
                                "8px 20px"
                        }}
                    >
                        <summary
                            style={{
                                cursor:
                                    "pointer",
                                color:
                                    "var(--cs-brand)",
                                fontWeight:
                                    "600"
                            }}
                        >
                            View group members
                        </summary>

                        <div className="cs-group-members-list">
                            {selectedGroup.members.map(
                                (member) => (
                                    <span
                                        className="cs-group-member-row"
                                        key={
                                            member._id
                                        }
                                    >
                                        {member.profilePhoto ? (
                                            <ProtectedImage className="cs-group-member-avatar" path={`/media/profiles/${member._id}`} refreshKey={member.profilePhoto} alt={`${member.username} profile photo`} fallback="👤" onClick={(event) => { event.stopPropagation(); openProfilePhotoViewer(member); }} />
                                        ) : (
                                            <span className="cs-group-member-avatar cs-group-member-fallback" aria-hidden="true">👤</span>
                                        )}
                                        <span className="cs-group-member-name">{member.username}</span>
                                        <span className="cs-group-member-status" data-online={Boolean(member.isOnline)}><i aria-hidden="true" />{member.isOnline ? "Online" : "Offline"}</span>

                                        {member._id?.toString() ===
                                            selectedGroup.admin?.toString()
                                            ? " 👑"
                                            : ""}
                                        {member._id?.toString() === selectedGroup.admin?.toString() && <span className="cs-admin-badge">Admin</span>}
                                    </span>
                                )
                            )}
                        </div>
                    </details>
                )}

                <div
                    className="cs-message-list"
                    data-wallpaper={chatBackground}
                    data-custom-wallpaper={Boolean(conversationWallpaperImage && conversationWallpaper?.peerId === selectedUser?._id?.toString())}
                    data-message-style={messageStyle}
                    data-message-font={messageFont}
                    onClick={() => {
                        setOpenMenu(null);
                        setShowAttachment(false);
                    }}
                    style={{
                        flex: 1,
                        overflowY:
                            "auto",
                        padding:
                            "24px",
                        "--cs-custom-wallpaper-image": conversationWallpaperImage && conversationWallpaper?.peerId === selectedUser?._id?.toString()
                            ? `url("${conversationWallpaperImage}")`
                            : "none"
                    }}
                >
                    {!selectedUser &&
                    !selectedGroup ? (
                        <div
                            style={{
                                height:
                                    "100%",
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                justifyContent:
                                    "center",
                                textAlign:
                                    "center"
                            }}
                        >
                            <div className="cs-empty-welcome">
                                <span className="cs-welcome-product">Real-Time Chat</span>
                                <span className="cs-welcome-eyebrow">YOUR SPACE TO CONNECT</span>
                                <div className="cs-welcome-icon" aria-hidden="true">
                                    <MessageCircle size={31} strokeWidth={1.8} />
                                </div>
                                <h1>Welcome to Real-Time Chat</h1>
                                <h2>Conversations that bring people closer.</h2>
                                <p className="cs-welcome-lead">Select a chat to start messaging</p>
                                <p className="cs-welcome-copy">Select a person or group to start chatting.</p>
                                <p className="cs-welcome-copy">Your people, your groups, your moments. Everything you need to stay connected in one place.</p>
                                <div className="cs-welcome-features">
                                    <article>
                                        <strong>Private conversations</strong>
                                        <span>Chat one-to-one in real time.</span>
                                    </article>
                                    <article>
                                        <strong>Groups that feel connected</strong>
                                        <span>Bring your people together.</span>
                                    </article>
                                    <article>
                                        <strong>More than messages</strong>
                                        <span>Share files, images and voice messages.</span>
                                    </article>
                                </div>
                                <p className="cs-welcome-footer">A little closer, wherever you are.</p>
                            </div>
                        </div>
                    ) : messages.length === 0 && callHistory.length === 0 ? (
                        <div
                            style={{
                                textAlign:
                                    "center",
                                marginTop:
                                    "30px",
                                color:
                                    "#667781"
                            }}
                        >
                            <div
                                style={{
                                    background:
                                        "#fff3c4",
                                    display:
                                        "inline-block",
                                    padding:
                                        "8px 14px",
                                    borderRadius:
                                        "8px",
                                    fontSize:
                                        "13px"
                                }}
                            >
                                🔒 Messages are private and
                                protected
                            </div>

                            <p>
                                No messages yet.
                                Start chatting!
                            </p>
                        </div>
                    ) : conversationItems.length === 0 ? (
                        <p
                            style={{
                                textAlign: "center",
                                color: "#667781"
                            }}
                        >
                            No matching messages.
                        </p>
                    ) : (
                        conversationItems.map(
                            ({ kind, record }) => {
                                if (kind === "call") {
                                    return (
                                        <CallHistoryEntry
                                            key={`call-${record.callId}`}
                                            call={record}
                                            currentUserId={userId}
                                        />
                                    );
                                }

                                const msg = record;
                                const own =
                                    isOwnMessage(
                                        msg
                                    );
                                const warning = msg.messageType === "text"
                                    ? detectSuspiciousMessage(msg.message)
                                    : null;

                                return (
                                    <div
                                        className="cs-message-row"
                                        data-own={own}
                                        key={
                                            msg._id
                                        }
                                        style={{
                                            marginBottom:
                                                "8px",
                                            display:
                                                "flex",
                                            justifyContent:
                                                own
                                                    ? "flex-end"
                                                    : "flex-start"
                                        }}
                                    >
                                        <div
                                            className="cs-message-bubble"
                                            data-own={own}
                                            style={{
                                                maxWidth:
                                                    "65%",
                                                minWidth:
                                                    "80px",
                                                position:
                                                    "relative"
                                            }}
                                        >
                                            <div
                                                className="cs-message-content"
                                                data-own={own}
                                                style={{
                                                    padding:
                                                        "8px 10px 6px",
                                                    borderRadius:
                                                        own
                                                            ? "8px 0 8px 8px"
                                                            : "0 8px 8px 8px",
                                                    boxShadow:
                                                        "0 1px 2px rgba(0,0,0,0.15)"
                                                }}
                                            >
                                                    {msg.replyTo?.messageId && (
                                                        <div
                                                            className="cs-message-reply-preview"
                                                            style={{
                                                                borderLeft: "3px solid var(--cs-brand)",
                                                                borderRadius: "4px",
                                                                padding: "5px 8px",
                                                                marginBottom: "7px",
                                                                minWidth: 0
                                                            }}
                                                        >
                                                            <div
                                                                className="cs-message-reply-sender"
                                                                style={{
                                                                    fontWeight: "bold",
                                                                    fontSize: "12px"
                                                                }}
                                                            >
                                                                {msg.replyTo.senderName || "User"}
                                                            </div>
                                                            <div
                                                                className="cs-message-reply-text"
                                                                style={{
                                                                    fontSize: "12px",
                                                                    whiteSpace: "nowrap",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis"
                                                                }}
                                                            >
                                                                {msg.replyTo.messageType === "image"
                                                                    ? "Photo"
                                                                    : msg.replyTo.messageType === "file"
                                                                        ? `File: ${msg.replyTo.message || "Attachment"}`
                                                                        : msg.replyTo.message}
                                                            </div>
                                                        </div>
                                                    )}

                                                {selectedGroup &&
                                                    !own && (
                                                        <div
                                                            className="cs-message-sender"
                                                            style={{
                                                                color:
                                                                    "var(--cs-message-link)",
                                                                fontWeight:
                                                                    "bold",
                                                                fontSize:
                                                                    "13px",
                                                                marginBottom:
                                                                    "3px"
                                                            }}
                                                        >
                                                            {getSenderName(
                                                                msg
                                                            )}
                                                        </div>
                                                    )}

                                                <div
                                                    className="cs-message-layout"
                                                    style={{
                                                        display:
                                                            "flex",
                                                        alignItems:
                                                            "flex-start",
                                                        gap:
                                                            "8px"
                                                    }}
                                                >
                                                    <div
                                                        className="cs-message-body"
                                                        style={{
                                                            flex:
                                                                1,
                                                            wordBreak:
                                                                "break-word",
                                                            lineHeight:
                                                                "1.4",
                                                            whiteSpace:
                                                                msg.messageType === "text"
                                                                    ? "pre-wrap"
                                                                    : undefined
                                                        }}
                                                    >
                                                            {msg.messageType === "audio" && msg.fileUrl ? (
                                                                <ProtectedAudio
                                                                    path={`/media/messages/${msg._id}`}
                                                                    style={{
                                                                        width: "240px",
                                                                        maxWidth: "100%"
                                                                    }}
                                                                />
                                                            ) : msg.messageType === "image" && msg.fileUrl ? (
                                                                <div>
                                                                    <button
                                                                        type="button"
                                                                        className="cs-message-image-trigger"
                                                                        aria-label={`View ${msg.fileName || "shared photo"}`}
                                                                        onClick={() => openPhotoViewer(msg._id)}
                                                                    >
                                                                        <ProtectedImage
                                                                            path={`/media/messages/${msg._id}`}
                                                                            alt={msg.fileName || "Image"}
                                                                            style={{
                                                                                width: "220px",
                                                                                maxWidth: "100%",
                                                                                borderRadius: "8px",
                                                                                display: "block"
                                                                            }}
                                                                        />
                                                                    </button>

                                                                    <div
                                                                        style={{
                                                                            fontSize: "12px",
                                                                            marginTop: "5px",
                                                                            wordBreak: "break-word"
                                                                        }}
                                                                    >
                                                                        {msg.fileName}
                                                                    </div>
                                                                </div>
                                                            ) : msg.messageType === "file" && msg.fileUrl ? (
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "10px",
                                                                        minWidth: "200px"
                                                                    }}
                                                                >
                                                                    <div style={{ fontSize: "32px" }}>
                                                                        📄
                                                                    </div>

                                                                    <div
                                                                        style={{
                                                                            flex: 1,
                                                                            minWidth: 0
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                fontWeight: "600",
                                                                                wordBreak: "break-word"
                                                                            }}
                                                                        >
                                                                            {msg.fileName}
                                                                        </div>

                                                                        <div
                                                                            className="cs-message-file-meta"
                                                                            style={{
                                                                                fontSize: "12px",
                                                                                marginTop: "3px"
                                                                            }}
                                                                        >
                                                                            {msg.fileSize
                                                                                ? `${(
                                                                                    msg.fileSize /
                                                                                    1024 /
                                                                                    1024
                                                                                ).toFixed(2)} MB`
                                                                                : ""}
                                                                        </div>

                                                                        <ProtectedDownload
                                                                            path={`/media/messages/${msg._id}`}
                                                                            fileName={msg.fileName}
                                                                            style={{
                                                                                display: "inline-block",
                                                                                marginTop: "5px"
                                                                            }}
                                                                        >
                                                                            Open / Download
                                                                        </ProtectedDownload>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                splitMessageLinks(msg.message).map((part, index) => part.href ? (
                                                                    <a
                                                                        key={`${msg._id}-link-${index}`}
                                                                        className="cs-message-link"
                                                                        href={part.href}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{ overflowWrap: "anywhere" }}
                                                                    >
                                                                        {part.text}
                                                                    </a>
                                                                ) : part.text)
                                                            )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        aria-label="Message actions"
                                                        aria-haspopup="menu"
                                                        aria-expanded={openMenu === msg._id}
                                                        ref={(element) => {
                                                            if (element) messageMenuTriggerRefs.current.set(msg._id, element);
                                                            else messageMenuTriggerRefs.current.delete(msg._id);
                                                        }}
                                                        onClick={(
                                                            e
                                                        ) => {
                                                            e.stopPropagation();

                                                            setOpenMenu(
                                                                openMenu ===
                                                                    msg._id
                                                                    ? null
                                                                    : msg._id
                                                            );
                                                        }}
                                                        style={{
                                                            border:
                                                                "none",
                                                            background:
                                                                "transparent",
                                                            cursor:
                                                                "pointer",
                                                            fontSize:
                                                                "17px",
                                                            color:
                                                                "var(--cs-readable-muted)",
                                                            padding:
                                                                "0",
                                                            lineHeight:
                                                                "15px"
                                                        }}
                                                    >
                                                        ⋮
                                                    </button>
                                                </div>

                                                {warning && (
                                                    <div className="cs-scam-warning">
                                                        <button
                                                            type="button"
                                                            className="cs-scam-warning-toggle"
                                                            aria-expanded={openWarningId === msg._id}
                                                            onClick={() => setOpenWarningId(openWarningId === msg._id ? null : msg._id)}
                                                        >
                                                            <AlertTriangle size={14} />
                                                            <span>Potentially suspicious message</span>
                                                        </button>
                                                        {openWarningId === msg._id && (
                                                            <div className="cs-scam-warning-detail">
                                                                <strong>Why this warning appeared</strong>
                                                                <ul>{warning.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                                                                <p>This automated warning is only a possible risk signal. It can be wrong and does not establish that the message or sender is fraudulent.</p>
                                                                {reportStatus[msg._id]?.success ? (
                                                                    <div className="cs-report-success" role="status">{reportStatus[msg._id].message}</div>
                                                                ) : (
                                                                    <>
                                                                        {reportStatus[msg._id]?.message && <div className="cs-report-error" role="alert">{reportStatus[msg._id].message}</div>}
                                                                        <button type="button" className="cs-report-button" onClick={() => openMessageReport(msg)}>Report message</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div
                                                    style={{
                                                        display:
                                                            "flex",
                                                        justifyContent:
                                                            "flex-end",
                                                        alignItems:
                                                            "center",
                                                        gap:
                                                            "4px",
                                                        marginTop:
                                                            "2px"
                                                    }}
                                                >
                                                    <span className="cs-message-timestamp"
                                                        style={{
                                                            fontSize:
                                                                "10px"
                                                        }}
                                                    >
                                                        {formatTime(
                                                            msg.createdAt
                                                        )}
                                                    </span>

                                                    {msg.starredBy?.some(
                                                        (id) =>
                                                            id?.toString() ===
                                                            userId?.toString()
                                                    ) && (
                                                        <span
                                                            style={{
                                                                marginLeft: "6px",
                                                                fontSize: "12px"
                                                            }}
                                                        >
                                                            ⭐
                                                        </span>
                                                    )}

                                                    {own && (
                                                        <span
                                                            className="cs-message-status"
                                                            data-read={Boolean(msg.readBy?.length)}
                                                            style={{
                                                                fontSize:
                                                                    "13px",
                                                                fontWeight:
                                                                    "bold"
                                                            }}
                                                        >
                                                            {msg.deliveredTo?.length
                                                                ? "✓✓"
                                                                : "✓"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {openMenu ===
                                                msg._id && createPortal(
                                                <div
                                                    className="cs-message-menu"
                                                    ref={messageMenuRef}
                                                    role="group"
                                                    aria-label="Message actions"
                                                    onClick={(
                                                        e
                                                    ) =>
                                                        e.stopPropagation()
                                                    }
                                                    style={{
                                                        position: "fixed",
                                                        left: messageMenuPosition?.left ?? 0,
                                                        top: messageMenuPosition?.top ?? 0,
                                                        width: messageMenuPosition?.width ?? 180,
                                                        maxHeight: messageMenuPosition?.maxHeight ?? "min(70vh, 520px)",
                                                        overflowY: "auto",
                                                        visibility: messageMenuPosition ? "visible" : "hidden",
                                                        background:
                                                            "#ffffff",
                                                        borderRadius:
                                                            "8px",
                                                        boxShadow:
                                                            "0 4px 12px rgba(0, 0, 0, 0.18)",
                                                        padding:
                                                            "6px 0",
                                                        zIndex:
                                                            1000
                                                    }}
                                                >
                                                    <button
                                                        className="cs-message-menu-item"
                                                        onClick={() => {
                                                            setReplyingTo({
                                                                ...msg,
                                                                senderName:
                                                                    getReplySenderName(msg)
                                                            });
                                                            setOpenMenu(null);
                                                        }}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            padding: "11px 16px",
                                                            border: "none",
                                                            background: "#ffffff",
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                            color: "#111111",
                                                            fontSize: "14px",
                                                            fontWeight: "500"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#f0f2f5";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "#ffffff";
                                                        }}
                                                    >
                                                        Reply
                                                    </button>

                                                    <button
                                                        className="cs-message-menu-item"
                                                        onClick={() => copyMessage(msg)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            padding: "11px 16px",
                                                            border: "none",
                                                            background: "#ffffff",
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                            color: "#111111",
                                                            fontSize: "14px",
                                                            fontWeight: "500"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#f0f2f5";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "#ffffff";
                                                        }}
                                                    >
                                                        Copy
                                                    </button>

                                                    <button
                                                        className="cs-message-menu-item"
                                                        type="button"
                                                        disabled={Boolean(reportStatus[msg._id]?.success)}
                                                        onClick={() => openMessageReport(msg)}
                                                    >
                                                        {reportStatus[msg._id]?.success ? "Report submitted" : "Report message"}
                                                    </button>

                                                    <button
                                                        className="cs-message-menu-item"
                                                        onClick={() => {
                                                            socket.emit(
                                                                "starMessage",
                                                                {
                                                                    messageId: msg._id,
                                                                    userId: userId
                                                                }
                                                            );
                                                            setOpenMenu(null);
                                                        }}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            padding: "11px 16px",
                                                            border: "none",
                                                            background: "#ffffff",
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                            color: "#111111",
                                                            fontSize: "14px",
                                                            fontWeight: "500"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#f0f2f5";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "#ffffff";
                                                        }}
                                                    >
                                                        {msg.starredBy?.some(
                                                            (id) =>
                                                                id?.toString() ===
                                                                userId?.toString()
                                                        )
                                                            ? "Unstar"
                                                            : "Star"}
                                                    </button>

                                                    <button
                                                        className="cs-message-menu-item cs-message-menu-danger"
                                                        onClick={() =>
                                                            deleteForMe(
                                                                msg
                                                            )
                                                        }
                                                        style={{
                                                            display: "block",
                                                            width:
                                                                "100%",
                                                            padding:
                                                                "11px 16px",
                                                            border:
                                                                "none",
                                                            background:
                                                                "#ffffff",
                                                            cursor:
                                                                "pointer",
                                                            textAlign:
                                                                "left",
                                                            color:
                                                                "#d32f2f",
                                                            fontSize: "14px",
                                                            fontWeight: "500"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#f0f2f5";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "#ffffff";
                                                        }}
                                                    >
                                                        Delete for me
                                                    </button>

                                                    {own && (
                                                        <button
                                                            className="cs-message-menu-item cs-message-menu-danger"
                                                            onClick={() =>
                                                                deleteForEveryone(
                                                                    msg
                                                                )
                                                            }
                                                            style={{
                                                                display: "block",
                                                                width:
                                                                    "100%",
                                                                padding:
                                                                    "11px 16px",
                                                                border:
                                                                    "none",
                                                                background:
                                                                    "#ffffff",
                                                                cursor:
                                                                    "pointer",
                                                                textAlign:
                                                                    "left",
                                                                color:
                                                                    "#d32f2f",
                                                                fontSize: "14px",
                                                                fontWeight: "500"
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = "#f0f2f5";
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = "#ffffff";
                                                            }}
                                                        >
                                                            Delete for everyone
                                                        </button>
                                                    )}
                                                </div>,
                                                document.body
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                        )
                    )}

                    <div
                        ref={
                            messageEndRef
                        }
                    />
                </div>

                {(selectedUser ||
                    selectedGroup) && (
                    <div
                        className="cs-composer"
                        style={{
                            position:
                                "relative",
                            padding:
                                "10px 14px",
                            background:
                                "#f0f2f5",
                            borderTop:
                                "1px solid #d1d7db"
                        }}
                    >
                        {replyingTo && (
                            <div
                                className="cs-composer-reply-preview"
                                style={{
                                    padding: "8px 12px",
                                    borderLeft: "4px solid var(--cs-brand)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "10px",
                                    marginBottom: "10px"
                                }}
                            >
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0
                                    }}
                                >
                                    <div
                                        className="cs-composer-reply-sender"
                                        style={{
                                            fontWeight: "bold",
                                            fontSize: "13px",
                                            marginBottom: "3px"
                                        }}
                                    >
                                        Replying to {replyingTo.senderName || "User"}
                                    </div>

                                    <div
                                        className="cs-composer-reply-text"
                                        style={{
                                            fontSize: "14px",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis"
                                        }}
                                    >
                                        {replyingTo.messageType === "image"
                                            ? "📷 Photo"
                                            : replyingTo.messageType === "file"
                                                ? `📄 ${replyingTo.fileName || "File"}`
                                                : replyingTo.message}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    aria-label="Cancel reply"
                                    className="cs-composer-reply-dismiss"
                                    onClick={() => setReplyingTo(null)}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        fontSize: "22px",
                                        cursor: "pointer",
                                        padding: "2px 6px",
                                        flex: "0 0 auto"
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        {showAttachment && (
                            <div
                                className="cs-attachment-menu"
                                style={{
                                    position:
                                        "absolute",
                                    bottom:
                                        "65px",
                                    left:
                                        "55px",
                                    background:
                                        "#ffffff",
                                    borderRadius:
                                        "12px",
                                    padding:
                                        "10px",
                                    boxShadow:
                                        "0 4px 20px rgba(0,0,0,0.2)",
                                    zIndex:
                                        120,
                                    minWidth:
                                        "190px"
                                }}
                            >
                                <label
                                    className="cs-attachment-option"
                                    style={{
                                        display:
                                            "block",
                                        padding:
                                            "10px",
                                        cursor:
                                            "pointer"
                                    }}
                                >
                                    🖼️ Photos & videos
                                    <input
                                        id="attachment-photo-video"
                                        name="photoVideoAttachment"
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={
                                            handleAttachment
                                        }
                                        style={{
                                            display:
                                                "none"
                                        }}
                                    />
                                </label>

                                <label
                                    className="cs-attachment-option"
                                    style={{
                                        display:
                                            "block",
                                        padding:
                                            "10px",
                                        cursor:
                                            "pointer"
                                    }}
                                >
                                    📄 Document
                                    <input
                                        id="attachment-document"
                                        name="documentAttachment"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt,.xlsx,.ppt,.pptx"
                                        onChange={
                                            handleAttachment
                                        }
                                        style={{
                                            display:
                                                "none"
                                        }}
                                    />
                                </label>

                                <label
                                    className="cs-attachment-option"
                                    style={{
                                        display:
                                            "block",
                                        padding:
                                            "10px",
                                        cursor:
                                            "pointer"
                                    }}
                                >
                                    📎 Any file
                                    <input
                                        id="attachment-file"
                                        name="fileAttachment"
                                        type="file"
                                        onChange={
                                            handleAttachment
                                        }
                                        style={{
                                            display:
                                                "none"
                                        }}
                                    />
                                </label>
                            </div>
                        )}

                        {isRecording && (
                            <div className="cs-recording-indicator" role="status" aria-label="Recording voice message">
                                <div className="cs-recording-time"><span className="cs-recording-dot" /> <span>Recording</span> <time>{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</time></div>
                                <div className="cs-recording-waveform" aria-hidden="true">
                                    {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--wave-index": index }} />)}
                                </div>
                                <div className="cs-recording-actions">
                                    <button type="button" className="cs-recording-cancel" onClick={cancelRecording} aria-label="Discard recording"><X size={16} /> Discard</button>
                                    <button type="button" className="cs-recording-stop" onClick={stopRecording} aria-label="Finish recording"><Square size={13} fill="currentColor" /> Finish</button>
                                </div>
                            </div>
                        )}
                        {voicePreview && (
                            <div className="cs-voice-preview" aria-label={`Voice recording for ${voicePreview.target.label}`}>
                                <audio controls preload="metadata" src={voicePreview.url} />
                                <span className="cs-voice-duration">{Math.floor(voicePreview.duration / 60)}:{String(voicePreview.duration % 60).padStart(2, "0")}</span>
                                <span className="cs-voice-target">For {voicePreview.target.label}</span>
                                <button type="button" className="cs-voice-discard" aria-label="Discard recording" onClick={discardVoicePreview} disabled={voiceSending}><X size={17} /></button>
                                <button type="button" className="cs-voice-send" onClick={sendVoicePreview} disabled={voiceSending}>{voiceSending ? "Sending…" : "Send recording"}</button>
                                {voicePreview.error && <span className="cs-voice-error" role="alert">{voicePreview.error}</span>}
                            </div>
                        )}

                        {messageSendError && <div className="cs-voice-error" role="alert">{messageSendError}</div>}

                        <div
                            style={{
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                gap:
                                    "8px"
                            }}
                        >
                            <button
                                type="button"
                                className="cs-attach-button"
                                aria-label="Attach files"
                                aria-expanded={showAttachment}
                                onClick={() => {
                                    setShowAttachment(
                                        !showAttachment
                                    );
                                }}
                                style={{
                                    border:
                                        "none",
                                    background:
                                        "transparent",
                                    cursor:
                                        "pointer",
                                    fontSize:
                                        "23px",
                                    padding:
                                        "5px"
                                }}
                            >
                                📎
                            </button>

                            <input
                                id="message-composer"
                                name="message"
                                type="text"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="Type a message"
                                value={message}
                                onChange={
                                    handleTyping
                                }
                                onKeyDown={
                                    handleKeyDown
                                }
                                onFocus={() => {
                                    setOpenMenu(
                                        null
                                    );
                                }}
                                style={{
                                    flex:
                                        1,
                                    border:
                                        "none",
                                    outline:
                                        "none",
                                    background:
                                        "#ffffff",
                                    borderRadius:
                                        "22px",
                                    padding:
                                        "12px 16px",
                                    fontSize:
                                        "15px",
                                    color:
                                        "#111111"
                                }}
                            />

                            <button
                                type="button"
                                aria-label={
                                    isRecording
                                        ? "Stop recording"
                                        : voicePreview
                                            ? "Send or discard the current recording first"
                                            : "Record voice message"
                                }
                                title={
                                    isRecording
                                        ? "Stop recording"
                                        : voicePreview
                                            ? "Send or discard the current recording first"
                                            : "Record voice message"
                                }
                                onClick={
                                    isRecording
                                        ? stopRecording
                                        : startRecording
                                }
                                disabled={Boolean(voicePreview) && !isRecording}
                                style={{
                                    border: "none",
                                    background: isRecording
                                        ? "#ff4d4f"
                                        : "transparent",
                                    color: isRecording
                                        ? "#ffffff"
                                        : "#54656f",
                                    fontSize: "21px",
                                    cursor: "pointer",
                                    borderRadius: "50%",
                                    width: "40px",
                                    height: "40px",
                                    flex: "0 0 40px"
                                }}
                            >
                                
                                 <Mic size={22} />
                            </button>

                            <button
                                type="button"
                                className="cs-send-button"
                                aria-label="Send message"
                                onClick={
                                    handleSendMessage
                                }
                                style={{
                                    width:
                                        "44px",
                                    height:
                                        "44px",
                                    borderRadius:
                                        "50%",
                                    border:
                                        "none",
                                    background:
                                        "var(--cs-brand)",
                                    color:
                                        "#ffffff",
                                    cursor:
                                        "pointer",
                                    fontSize:
                                        "18px"
                                }}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <aside
    className="cs-info-panel"
    aria-label="Chat information"
>
    {/* Chat Info Header */}
    <div className="cs-info-heading">
        <div>
            <strong>Chat Info</strong>

            <small>
    {selectedGroup
        ? "Group conversation"
        : selectedUser
            ? "Chat details"
            : "Conversation details"}
</small>
        </div>

        <button
            type="button"
            className="cs-icon-button"
            aria-label="Close chat information"
            title="Close"
            onClick={() => {
                console.log("Closing Chat Info");
                setShowInfoPanel(false);
            }}
        >
            <X size={17} />
        </button>
    </div>

   {/* Profile / Group Information */}
{selectedGroup ? (
    <>
        <div className="cs-info-profile">
            <div className="cs-info-avatar is-group">
                <UsersRound size={28} />
            </div>

            <strong>{selectedGroup.name}</strong>

            <span>
                {selectedGroup.members.length} members
            </span>
        </div>

        <section className="cs-info-section">
            <h3>Group members</h3>

            {selectedGroup.members.map((member) => (
                <div
                    className="cs-info-member"
                    key={member._id}
                >
                    {member.profilePhoto ? (
                        <ProtectedImage className="cs-mini-avatar" path={`/media/profiles/${member._id}`} refreshKey={member.profilePhoto} alt={`${member.username} profile photo`} fallback="👤" onClick={(event) => { event.stopPropagation(); openProfilePhotoViewer(member); }} />
                    ) : (
                        <span className="cs-mini-avatar">👤</span>
                    )}

                    <span>{member.username}</span>

                    <span className="cs-group-member-status" data-online={Boolean(member.isOnline)}><i aria-hidden="true" />{member.isOnline ? "Online" : "Offline"}</span>

                    {member._id?.toString() ===
                        selectedGroup.admin?.toString() && (
                        <span className="cs-admin-badge">
                            Admin
                        </span>
                    )}
                </div>
            ))}
        </section>
        <GroupEvents group={selectedGroup} userId={userId} />
    </>
) : selectedUser ? (
    <>
        <div className="cs-info-profile">

            {selectedUser.profilePhoto ? (
                <ProtectedImage
                    className="cs-info-avatar"
                    path={`/media/profiles/${selectedUser._id}`}
                    refreshKey={selectedUser.profilePhoto}
                    alt={selectedUser.username}
                    fallback="👤"
                    onClick={(event) => { event.stopPropagation(); openProfilePhotoViewer(selectedUser); }}
                />
            ) : (
                <div className="cs-info-avatar">
                    👤
                </div>
            )}

            <strong className="cs-info-username">
                {isSelfChat ? "You" : selectedUser.username}
            </strong>
            {isSelfChat && <span>@{selectedUser.username}</span>}

            <span className="cs-info-status" data-personal={isSelfChat}>
                {isSelfChat
                    ? "Personal notes"
                    : selectedUser.isOnline
                    ? "Online"
                    : "Offline"}
            </span>

            <div className="cs-info-about">
                <span>About</span>

                <p>
                    {selectedUser.about ||
                        "Hey there! I am using chatSpace"}
                </p>
            </div>

        </div>

        {!isSelfChat && <section className="cs-info-section">
            <h3>Security</h3>

            <div className="cs-info-detail">
                <LockKeyhole size={17} />

                <div>
                    <span>Chat security</span>

                    <strong>
                        Messages are protected
                    </strong>
                </div>
            </div>
        </section>}

        {!isSelfChat && <section className="cs-info-section">
            <h3>Privacy controls</h3>
            <p className="cs-info-muted">Blocking affects private messages and calls. Shared groups remain available.</p>
            {!selectedUser.isDeleted && (
                <button
                    type="button"
                    className="cs-private-chat-action"
                    onClick={() => setSelectedUserBlocked(!isSelectedUserBlocked)}
                    style={{ width: "100%", padding: "10px", cursor: "pointer", marginBottom: "8px" }}
                >
                    {isSelectedUserBlocked ? "Unblock user" : "Block user"}
                </button>
            )}
            <button
                type="button"
                className="cs-private-chat-action"
                onClick={removeSelectedConversation}
                style={{ width: "100%", padding: "10px", cursor: "pointer" }}
            >
                Remove conversation
            </button>
        </section>}
    </>
) : (
    <div className="cs-info-empty">
        <MessageCircle size={24} />

        <span>
            Select a conversation to view details.
        </span>
    </div>
)}

       
    {/* Media */}
    <section className="cs-info-section">
        <h3>Media</h3>

        <div className="cs-info-media-grid">
            {messages
                .filter(
                    (msg) =>
                        msg.messageType === "image" &&
                        msg.fileUrl
                )
                .slice(-6)
                .map((msg) => (
                    <button
                        key={msg._id}
                        type="button"
                        className="cs-info-media-photo"
                        aria-label={msg.fileName || "Open shared image"}
                        onClick={() => openPhotoViewer(msg._id)}
                    >
                        <ProtectedImage
                            path={`/media/messages/${msg._id}`}
                            alt={
                                msg.fileName ||
                                "Shared image"
                            }
                        />
                    </button>
                ))}
        </div>

        {messages.every(
            (msg) => msg.messageType !== "image"
        ) && (
            <p className="cs-info-muted">
                No shared media yet.
            </p>
        )}
    </section>

    {/* Files */}
    <section className="cs-info-section">
        <h3>Files</h3>

        {messages
            .filter(
                (msg) =>
                    (msg.messageType === "file" ||
                        msg.messageType === "audio") &&
                    msg.fileUrl
            )
            .slice(-5)
            .map((msg) => (
                <ProtectedDownload
                    className="cs-info-file"
                    key={msg._id}
                    path={`/media/messages/${msg._id}`}
                    fileName={msg.fileName || "Voice message"}
                >
                    <FileText size={16} />

                    <span>
                        {msg.fileName ||
                            "Voice message"}
                    </span>

                    <ChevronRight size={15} />
                </ProtectedDownload>
            ))}

        {messages.every(
            (msg) =>
                msg.messageType !== "file" &&
                msg.messageType !== "audio"
        ) && (
            <p className="cs-info-muted">
                No shared files yet.
            </p>
        )}
    </section>

    {/* Links */}
    <section className="cs-info-section">
        <h3>Links</h3>

        {messages
            .filter((msg) =>
                /https?:\/\//i.test(
                    msg.message || ""
                )
            )
            .slice(-5)
            .map((msg) => {
                const link =
                    msg.message.match(
                        /https?:\/\/\S+/i
                    )?.[0];

                return (
                    <a
                        className="cs-info-file"
                        key={msg._id}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <MessageCircle size={15} />

                        <span>{link}</span>
                    </a>
                );
            })}

        {messages.every(
            (msg) =>
                !/https?:\/\//i.test(
                    msg.message || ""
                )
        ) && (
            <p className="cs-info-muted">
                No shared links yet.
            </p>
        )}
    </section>
</aside>

            {showAddMembers &&
                selectedGroup && (
                    <div
                        className="cs-add-members-backdrop"
                        role="presentation"
                        onClick={() => {
                            setShowAddMembers(
                                false
                            );
                            setSelectedMembers(
                                []
                            );
                            setMemberSearch(
                                ""
                            );
                            setAddMembersError("");
                            setAddMembersNotice("");
                        }}
                        style={{
                            position:
                                "fixed",
                            inset: 0,
                            background:
                                "rgba(16,24,32,0.48)",
                            display:
                                "flex",
                            alignItems:
                                "center",
                            justifyContent:
                                "center",
                            zIndex:
                                1000,
                            padding:
                                "16px"
                        }}
                    >
                        <div
                            className="cs-add-members-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="add-members-title"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                            style={{
                                width:
                                    "100%",
                                maxWidth:
                                    "450px",
                                maxHeight:
                                    "80vh",
                                background:
                                    "#ffffff",
                                borderRadius:
                                    "12px",
                                overflow:
                                    "hidden",
                                display:
                                    "flex",
                                flexDirection:
                                    "column",
                                boxShadow:
                                    "0 20px 50px rgba(0,0,0,0.25)"
                            }}
                        >
                                <div
                                    className="cs-add-members-header"
                                style={{
                                    padding:
                                        "18px",
                                    display:
                                        "flex",
                                    justifyContent:
                                        "space-between",
                                    alignItems:
                                        "center",
                                    borderBottom:
                                        "1px solid #eee"
                                }}
                            >
                                <div>
                                    <h2
                                        id="add-members-title"
                                        style={{
                                            margin:
                                                0
                                        }}
                                    >
                                        Add members
                                    </h2>

                                    <small
                                        className="cs-add-members-subtitle"
                                        style={{
                                            color:
                                                "#667781"
                                        }}
                                    >
                                        Add people to{" "}
                                        {
                                            selectedGroup.name
                                        }
                                    </small>
                                </div>

                                <button
                                    type="button"
                                    className="cs-add-members-close"
                                    aria-label="Close Add Members"
                                    onClick={() => {
                                        setShowAddMembers(
                                            false
                                        );
                                        setSelectedMembers(
                                            []
                                        );
                                    }}
                                    style={{
                                        border:
                                            "none",
                                        background:
                                            "#f0f2f5",
                                        borderRadius:
                                            "50%",
                                        width:
                                            "36px",
                                        height:
                                            "36px",
                                        cursor:
                                            "pointer"
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            <div
                                className="cs-add-members-search"
                                style={{
                                    padding:
                                        "14px"
                                }}
                            >
                                <input
                                    id="group-member-search"
                                    name="groupMemberSearch"
                                    type="search"
                                    placeholder="Search people..."
                                    value={
                                        memberSearch
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setMemberSearch(
                                            e.target.value
                                        )
                                    }
                                    style={{
                                        width:
                                            "100%",
                                        boxSizing:
                                            "border-box",
                                        padding:
                                            "12px 15px",
                                        border:
                                            "1px solid #ddd",
                                        borderRadius:
                                            "22px",
                                        outline:
                                            "none"
                                    }}
                                />
                            </div>

                            <div
                                className="cs-add-members-list"
                                style={{
                                    flex:
                                        1,
                                    overflowY:
                                        "auto",
                                    padding:
                                        "0 14px"
                                }}
                            >
                                {memberDirectoryLoading ? (
                                    <p className="cs-add-members-empty" role="status">Loading people…</p>
                                ) : memberDirectoryError ? (
                                    <div className="cs-add-members-empty" role="alert">
                                        <p>{memberDirectoryError}</p>
                                        <button type="button" onClick={async () => {
                                            setMemberDirectoryLoading(true);
                                            try {
                                                const response = await axios.get(apiUrl("/users"));
                                                setUsers(response.data.users);
                                                setMemberDirectoryError("");
                                            } catch (error) {
                                                setMemberDirectoryError(error.response?.data?.message || "People could not be loaded.");
                                            } finally {
                                                setMemberDirectoryLoading(false);
                                            }
                                        }}>Try again</button>
                                    </div>
                                ) : availableMembers.length === 0 ? (
                                    <p
                                        className="cs-add-members-empty"
                                        style={{
                                            color:
                                                "#667781"
                                        }}
                                    >
                                        {memberSearchValue ? "No people match this search." : "No people available to add."}
                                    </p>
                                ) : (
                                    availableMembers.map(
                                        (
                                            user
                                        ) => (
                                            <label
                                                className="cs-add-member-option"
                                                data-selected={selectedMembers.includes(user._id)}
                                                key={
                                                    user._id
                                                }
                                                style={{
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    padding:
                                                        "12px",
                                                    borderRadius:
                                                        "10px",
                                                    cursor:
                                                        "pointer",
                                                    background:
                                                        selectedMembers.includes(
                                                            user._id
                                                        )
                                                            ? "#e7fce9"
                                                            : "#ffffff"
                                                }}
                                            >
                                                <input
                                                    id={`member-${user._id}`}
                                                    name="groupMember"
                                                    type="checkbox"
                                                    checked={selectedMembers.includes(
                                                        user._id
                                                    )}
                                                    onChange={() =>
                                                        toggleMemberSelection(
                                                            user._id
                                                        )
                                                    }
                                                    style={{
                                                        marginRight:
                                                            "12px"
                                                    }}
                                                />

                                                <div
                                                    style={{
                                                        width:
                                                            "40px",
                                                        height:
                                                            "40px",
                                                        borderRadius:
                                                            "50%",
                                                        background:
                                                            "#dfe5e7",
                                                        display:
                                                            "flex",
                                                        alignItems:
                                                            "center",
                                                        justifyContent:
                                                            "center",
                                                        marginRight:
                                                            "12px"
                                                    }}
                                                >
                                                    👤
                                                </div>

                                                <strong className="cs-add-member-name">
                                                    {
                                                        user.username
                                                    }
                                                </strong>
                                            </label>
                                        )
                                    )
                                )}
                            </div>

                            <div
                                className="cs-add-members-footer"
                                style={{
                                    padding:
                                        "15px",
                                    borderTop:
                                        "1px solid #eee",
                                    display:
                                        "flex",
                                    justifyContent:
                                        "space-between",
                                    alignItems:
                                        "center"
                                }}
                            >
                                <span
                                    className="cs-add-members-count"
                                    style={{
                                        color:
                                            "#667781"
                                    }}
                                >
                                    {
                                        selectedMembers.length
                                    }{" "}
                                    selected
                                </span>

                                <button
                                    type="button"
                                    className="cs-add-members-cancel"
                                    onClick={() => {
                                        setShowAddMembers(false);
                                        setSelectedMembers([]);
                                        setMemberSearch("");
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="cs-add-members-submit"
                                    onClick={
                                        addMembersToGroup
                                    }
                                    disabled={
                                        selectedMembers.length ===
                                        0 || addingMembers
                                    }
                                    style={{
                                        border:
                                            "none",
                                        background:
                                            selectedMembers.length ===
                                            0
                                                ? "#cbd5e1"
                                                : "var(--cs-brand)",
                                        color:
                                            "#ffffff",
                                        padding:
                                            "11px 20px",
                                        borderRadius:
                                            "22px",
                                        cursor:
                                            selectedMembers.length ===
                                            0
                                                ? "not-allowed"
                                                : "pointer",
                                        fontWeight:
                                            "bold"
                                    }}
                                >
                                    {addingMembers ? "Adding…" : "Add selected"}
                                </button>
                            </div>
                            {(addMembersError || addMembersNotice) && (
                                <p className={addMembersError ? "cs-add-members-error" : "cs-add-members-success"} role={addMembersError ? "alert" : "status"}>
                                    {addMembersError || addMembersNotice}
                                </p>
                            )}
                        </div>
                    </div>
                )}

            {showCreateGroup && (
                <div
                    role="presentation"
                    onClick={() => {
                        setShowCreateGroup(false);
                        setNewGroupName("");
                        setNewGroupMembers([]);
                    }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(16,24,32,0.48)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                        padding: "16px",
                        boxSizing: "border-box"
                    }}
                >
                    <div
                        role="dialog"
                        className="cs-create-group-dialog"
                        aria-modal="true"
                        aria-labelledby="create-group-title"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: "100%",
                            maxWidth: "450px",
                            maxHeight: "min(88vh, 700px)",
                            background: "var(--cs-surface)",
                            color: "var(--cs-text)",
                            borderRadius: "8px",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
                        }}
                    >
                        <div
                            style={{
                                padding: "18px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderBottom: "1px solid var(--cs-border)",
                                gap: "12px"
                            }}
                        >
                            <div>
                                <h2
                                    id="create-group-title"
                                    style={{ margin: 0 }}
                                >
                                    Create Group
                                </h2>
                                <small style={{ color: "var(--cs-readable-muted, var(--cs-muted))" }}>
                                    Add people to your new group
                                </small>
                            </div>

                            <button
                                type="button"
                                aria-label="Close create group dialog"
                                onClick={() => {
                                    setShowCreateGroup(false);
                                    setNewGroupName("");
                                    setNewGroupMembers([]);
                                }}
                                style={{
                                    border: "none",
                                    color: "var(--cs-text)",
                                    background: "var(--cs-surface-raised)",
                                    borderRadius: "50%",
                                    width: "36px",
                                    height: "36px",
                                    flex: "0 0 36px",
                                    cursor: "pointer",
                                    fontSize: "16px"
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: "16px" }}>
                            <input
                                className="cs-create-group-name"
                                id="new-group-name"
                                name="groupName"
                                type="text"
                                aria-label="Group name"
                                placeholder="Enter group name"
                                value={newGroupName}
                                onChange={(event) =>
                                    setNewGroupName(event.target.value)
                                }
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "12px 15px",
                                    border: "1px solid var(--cs-border)",
                                    borderRadius: "8px",
                                    outline: "none",
                                    fontSize: "15px",
                                    color: "var(--cs-text)",
                                    background: "var(--cs-surface)"
                                }}
                            />
                        </div>

                        <div
                            style={{
                                padding: "0 16px 10px",
                                color: "var(--cs-readable-muted, var(--cs-muted))",
                                fontWeight: "600"
                            }}
                        >
                            Select members
                        </div>

                        <div
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                padding: "0 16px"
                            }}
                        >
                            {users.length === 0 ? (
                                <p style={{ color: "var(--cs-readable-muted, var(--cs-muted))" }}>
                                    No users available.
                                </p>
                            ) : (
                                users
                                    .filter(
                                        (user) =>
                                            user._id?.toString() !==
                                            userId?.toString()
                                    )
                                    .map((user) => {
                                        const selected =
                                            newGroupMembers.includes(user._id);

                                        return (
                                            <label
                                                key={user._id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "12px",
                                                    padding: "11px",
                                                    borderRadius: "8px",
                                                    cursor: "pointer",
                                                    background: selected
                                                        ? "var(--cs-primary-soft)"
                                                        : "var(--cs-surface)",
                                                    color: "var(--cs-text)"
                                                }}
                                            >
                                                <input
                                                    id={`new-group-member-${user._id}`}
                                                    name="newGroupMember"
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() =>
                                                        toggleNewGroupMember(
                                                            user._id
                                                        )
                                                    }
                                                    style={{
                                                        width: "18px",
                                                        height: "18px",
                                                        accentColor: "var(--cs-brand)"
                                                    }}
                                                />

                                                <div
                                                    style={{
                                                        width: "42px",
                                                        height: "42px",
                                                        flex: "0 0 42px",
                                                        borderRadius: "50%",
                                                        color: "var(--cs-text)",
                                                        background: "var(--cs-surface-raised)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "20px"
                                                    }}
                                                >
                                                    👤
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <strong>{user.username}</strong>
                                                </div>

                                            </label>
                                        );
                                    })
                            )}
                        </div>

                        <div
                            style={{
                                padding: "15px 16px",
                                                        borderTop: "1px solid var(--cs-border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px"
                            }}
                        >
                            <span style={{ color: "var(--cs-readable-muted, var(--cs-muted))" }}>
                                {newGroupMembers.length} selected
                            </span>

                            <button
                                type="button"
                                onClick={createGroup}
                                disabled={
                                    !newGroupName.trim() ||
                                    newGroupMembers.length === 0
                                }
                                style={{
                                    background:
                                        !newGroupName.trim() ||
                                        newGroupMembers.length === 0
                                            ? "var(--cs-surface-raised)"
                                            : "var(--cs-brand)",
                                    color: !newGroupName.trim() || newGroupMembers.length === 0
                                        ? "var(--cs-readable-muted, var(--cs-muted))"
                                        : "#ffffff",
                                    border: !newGroupName.trim() || newGroupMembers.length === 0
                                        ? "1px solid var(--cs-border)"
                                        : "1px solid var(--cs-brand)",
                                    padding: "11px 22px",
                                    borderRadius: "22px",
                                    cursor:
                                        !newGroupName.trim() ||
                                        newGroupMembers.length === 0
                                            ? "not-allowed"
                                            : "pointer",
                                    fontWeight: "bold"
                                }}
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        {showChatSummary && (
            <ChatSummaryDialog
                conversationType={selectedGroup ? "group" : selectedUser && !isSelfChat ? "private" : null}
                conversationId={selectedGroup?._id || (isSelfChat ? null : selectedUser?._id)}
                onClose={() => setShowChatSummary(false)}
            />
        )}
        {showWallpaperDialog && selectedUser && !isSelfChat && (
            <ConversationWallpaperDialog
                peer={selectedUser}
                onClose={() => setShowWallpaperDialog(false)}
                onUpdated={handleConversationWallpaperUpdated}
            />
        )}
        {reportDraft && (
            <div className="cs-report-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget && !reportStatus[reportDraft._id]?.loading) setReportDraft(null);
            }}>
                <section className="cs-report-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-report-title">
                    <button type="button" className="cs-report-close" aria-label="Close report dialog" disabled={Boolean(reportStatus[reportDraft._id]?.loading)} onClick={() => setReportDraft(null)}><X size={18} /></button>
                    <h2 id="cs-report-title">Report message</h2>
                    {reportStatus[reportDraft._id]?.success ? (
                        <>
                            <div className="cs-report-success" role="status">Report submitted. Thank you for helping keep ChatSpace safe.</div>
                            <div className="cs-report-dialog-actions"><button type="button" onClick={() => setReportDraft(null)}>Close</button></div>
                        </>
                    ) : (
                        <>
                            <p>Choose a reason and review it before submitting. Your report is private and will not be shown to the sender.</p>
                            <label htmlFor="cs-report-reason">Reason</label>
                            <select id="cs-report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                                <option value="suspected_scam">Suspected scam or fraud</option>
                                <option value="suspicious_link">Suspicious link</option>
                                <option value="impersonation">Impersonation</option>
                                <option value="sensitive_information">Request for sensitive information</option>
                                <option value="other">Other</option>
                            </select>
                            <label htmlFor="cs-report-details">Optional details</label>
                            <textarea id="cs-report-details" maxLength={500} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Add context (up to 500 characters)" />
                            <div className="cs-report-dialog-actions">
                                <button type="button" disabled={Boolean(reportStatus[reportDraft._id]?.loading)} onClick={() => setReportDraft(null)}>Cancel</button>
                                <button type="button" disabled={Boolean(reportStatus[reportDraft._id]?.loading)} onClick={submitMessageReport}>
                                    {reportStatus[reportDraft._id]?.loading ? "Submitting…" : "Confirm and submit report"}
                                </button>
                            </div>
                            {reportStatus[reportDraft._id]?.message && <div className="cs-report-error" role="alert">{reportStatus[reportDraft._id].message}</div>}
                        </>
                    )}
                </section>
            </div>
        )}
        </>
    );
}

export default App;




