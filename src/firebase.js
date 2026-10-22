import { initializeApp } from "firebase/app";
import { browserSessionPersistence, initializeAuth, onAuthStateChanged } from "firebase/auth";
import axios from "axios";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence
});

export const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(
    auth,
    () => {
      unsubscribe();
      resolve();
    },
    (error) => {
      unsubscribe();
      reject(error);
    }
  );
});

export async function getFreshIdToken() {
  await authReady;
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You are not signed in to Firebase.");
  }
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) {
    throw new Error("The signed-in account changed while authenticating.");
  }
  return token;
}

axios.interceptors.request.use(async (config) => {
  if (config.useProvidedAuthToken) {
    delete config.useProvidedAuthToken;
    return config;
  }
  await authReady;
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== user.uid) {
      throw new Error("The signed-in account changed before the request was sent.");
    }
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
    delete config.headers.authorization;
  }
  return config;
});

export default app;
