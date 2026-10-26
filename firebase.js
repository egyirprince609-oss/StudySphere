// Study Sphere Ai — Firebase client configuration.
// The web config is public client configuration; protect data with Firebase Rules.
// Never put OpenAI/Gemini/OpenRouter/DeepSeek API keys in this file.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDa46_lsHeEI0UJeYBTXAuJTVKKiKrKil0",
  authDomain: "studyspher.firebaseapp.com",
  projectId: "studyspher",
  storageBucket: "studyspher.firebasestorage.app",
  messagingSenderId: "386526414658",
  appId: "1:386526414658:web:97b668c9b9573ad85f2adb",
  measurementId: "G-F70HTPWRN5"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
