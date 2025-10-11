import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDiFLGdPiP9n1UrN7y2k8Q-JfQHAk8HQD0",
  authDomain: "storedata-cdac6.firebaseapp.com",
  databaseURL: "https://storedata-cdac6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "storedata-cdac6",
  storageBucket: "storedata-cdac6.firebasestorage.app",
  messagingSenderId: "115311579403",
  appId: "1:115311579403:web:78dae1c1f5d1167b90520e",
  measurementId: "G-RMTXTV460L"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
