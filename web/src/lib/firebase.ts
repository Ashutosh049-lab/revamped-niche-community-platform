import { initializeApp, type FirebaseApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

// Read config from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDiFLGdPiP9n1UrN7y2k8Q-JfQHAk8HQD0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "storedata-cdac6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "storedata-cdac6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "storedata-cdac6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "115311579403",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:115311579403:web:78dae1c1f5d1167b90520e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-RMTXTV460L"
};

// Initialize Firebase app (non-null exports for DX)
let app: FirebaseApp;
(function init() {
  const existing = getApps();
  if (existing.length) {
    app = existing[0]!;
    return;
  }
  // Basic sanity check; config has safe defaults above
  const required = ["apiKey", "authDomain", "projectId", "appId"] as const;
  const missing = required.filter((k) => !firebaseConfig[k]);
  if (missing.length) {
    throw new Error(`Missing Firebase config: ${missing.join(", ")}`);
  }
  app = initializeApp(firebaseConfig);
})();

export { app };

// Strongly-typed, non-null service singletons
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Configure Google Auth Provider
export const provider: GoogleAuthProvider = (() => {
  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope("email");
  googleProvider.addScope("profile");
  googleProvider.setCustomParameters({ prompt: "select_account" });
  return googleProvider;
})();

// Connect to local emulators in development (opt-in)
if (false && import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  } catch {}
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8081);
  } catch {}
  try {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  } catch {}
}
