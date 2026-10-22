import { io } from "socket.io-client";
import { getFreshIdToken } from "./firebase";
import { API_ORIGIN } from "./config";

const socket = io(API_ORIGIN, {
    autoConnect: false,
    auth: async (callback) => {
        try {
            callback({ token: await getFreshIdToken() });
        } catch {
            callback({ token: null });
        }
    }
});

export default socket;
