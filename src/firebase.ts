import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

try {
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
        console.log("[Firebase Connection Status]:", snap.val());
    });
} catch (e) {
    console.error("Failed to setup connected listener", e);
}

let serverTimeOffset = 0;
try {
    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snapshot) => {
        serverTimeOffset = snapshot.val() || 0;
    });
} catch (e) {
    console.error("Failed to setup serverTimeOffset listener", e);
}

export function getSyncedTime(): number {
    return Date.now() + serverTimeOffset;
}

export const isFirebaseConfigured =
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.includes("placeholder-rtdb-url");