/*
 * Study Sphere Ai — Firebase authentication and user-data foundation.
 * Browser ES module. Serve this project over HTTPS (or localhost), not file://.
 * Firebase web configuration identifies the public app; Firestore rules and
 * trusted server code are still required to protect private/privileged data.
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  reload,
  updateProfile,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Firebase web config is public app identification, not a service-account secret.
const firebaseConfig = {
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
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(async error => {
  console.warn("Persistent browser storage is unavailable; trying session persistence.", error);
  try { await setPersistence(auth, browserSessionPersistence); }
  catch (fallbackError) { console.warn("Browser persistence is unavailable in this environment.", fallbackError); }
});
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const PROFILE_COLLECTION = "users";
const ALLOWED_USER_DATA_COLLECTIONS = new Set(["notes", "projects", "conversations"]);
const PENDING_REFERRAL_KEY = "studySphereAi.pendingReferral";

function requireSignedInUser() {
  if (!auth.currentUser) throw new Error("Please sign in before saving your work.");
  return auth.currentUser;
}

function safeStorageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {
    console.warn("Local Study Sphere Ai cache could not be saved.", error);
  }
}

function randomReferralCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

export function captureReferralCode() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    if (fromUrl && /^[A-Z0-9]{4,20}$/i.test(fromUrl)) {
      localStorage.setItem(PENDING_REFERRAL_KEY, fromUrl.toUpperCase());
    }
    return (localStorage.getItem(PENDING_REFERRAL_KEY) || "").toUpperCase();
  } catch {
    return "";
  }
}

function clearPendingReferralCode() {
  try { localStorage.removeItem(PENDING_REFERRAL_KEY); } catch { /* storage may be disabled */ }
}

async function resolveReferrer(code, newUid) {
  if (!code) return null;
  try {
    const referralSnapshot = await getDoc(doc(db, "referralCodes", code));
    if (!referralSnapshot.exists()) return null;
    const referralUid = referralSnapshot.data()?.uid;
    return referralUid && referralUid !== newUid ? referralUid : null;
  } catch (error) {
    console.warn("Referral attribution could not be checked; account creation will continue.", error);
    return null;
  }
}

/** Create/sync a profile without overwriting server-controlled premium/reward fields. */
export async function ensureUserProfile(user, requestedReferralCode = captureReferralCode()) {
  if (!user?.uid) throw new Error("A valid Firebase user is required.");
  const profileRef = doc(db, PROFILE_COLLECTION, user.uid);
  const existing = await getDoc(profileRef);
  const providerIds = (user.providerData || []).map(item => item.providerId).filter(Boolean);
  const publicFields = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    providerIds,
    lastLoginAt: serverTimestamp()
  };

  if (existing.exists()) {
    await setDoc(profileRef, publicFields, { merge: true });
    return { ...existing.data(), ...publicFields, uid: user.uid };
  }

  const referrerUid = await resolveReferrer((requestedReferralCode || "").toUpperCase(), user.uid);
  // Retry a short-code collision instead of silently overwriting another user's code.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = randomReferralCode();
    const codeRef = doc(db, "referralCodes", code);
    try {
      await runTransaction(db, async transaction => {
        const [profileSnapshot, codeSnapshot] = await Promise.all([
          transaction.get(profileRef), transaction.get(codeRef)
        ]);
        if (profileSnapshot.exists()) {
          transaction.set(profileRef, publicFields, { merge: true });
          return;
        }
        if (codeSnapshot.exists()) throw new Error("REFERRAL_CODE_COLLISION");
        transaction.set(profileRef, {
          ...publicFields,
          createdAt: serverTimestamp(),
          referralCode: code,
          referredByUid: referrerUid || null,
        });
        transaction.set(codeRef, { uid: user.uid, createdAt: serverTimestamp() });
      });
      clearPendingReferralCode();
      return (await getDoc(profileRef)).data();
    } catch (error) {
      if (error?.message === "REFERRAL_CODE_COLLISION" && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("Could not create a referral code. Please try again.");
}

export async function registerWithEmail({ displayName, email, password, referralCode = captureReferralCode() }) {
  await persistenceReady;
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    if (displayName?.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
  } catch (error) {
    console.warn("Profile display name could not be updated.", error);
  }
  // Auth succeeds even if the optional Firestore profile write is temporarily unavailable.
  try { await ensureUserProfile(credential.user, referralCode); }
  catch (error) { console.error("Account created, but cloud profile sync needs attention.", error); }
  await sendVerificationEmail(credential.user);
  return credential.user;
}

export async function signInWithEmail(email, password) {
  await persistenceReady;
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  try { await ensureUserProfile(credential.user); }
  catch (error) { console.error("Signed in, but cloud profile sync failed.", error); }
  return credential.user;
}

export async function signInWithGoogle() {
  await persistenceReady;
  // Redirect is generally more reliable on narrow/mobile browsers; desktop uses a popup.
  const isMobile = window.matchMedia?.("(max-width: 760px), (pointer: coarse)").matches;
  if (isMobile) {
    await signInWithRedirect(auth, googleProvider);
    return null; // The browser is navigating away; auth state is restored on return.
  }
  const credential = await signInWithPopup(auth, googleProvider);
  try { await ensureUserProfile(credential.user); }
  catch (error) { console.error("Google sign-in succeeded, but cloud profile sync failed.", error); }
  return credential.user;
}

export async function processGoogleRedirectResult() {
  await persistenceReady;
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      try { await ensureUserProfile(result.user); }
      catch (error) { console.error("Google profile sync failed after redirect.", error); }
    }
    return result?.user || null;
  } catch (error) {
    // A missing redirect result is normal when a page wasn't opened by redirect sign-in.
    if (error?.code) throw error;
    return null;
  }
}

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) throw new Error("Sign in first to request an email verification link.");
  const continueUrl = new URL("./login.html?verified=1", window.location.href).href;
  await sendEmailVerification(user, { url: continueUrl, handleCodeInApp: false });
}

export async function resendVerificationEmail() {
  const user = requireSignedInUser();
  await sendVerificationEmail(user);
}

export async function sendPasswordReset(email) {
  await persistenceReady;
  const continueUrl = new URL("./login.html?reset=1", window.location.href).href;
  await sendPasswordResetEmail(auth, email.trim(), { url: continueUrl, handleCodeInApp: false });
}

export async function refreshCurrentUser() {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export function watchAuthState(callback, onError = console.error) {
  return onAuthStateChanged(auth, callback, onError);
}

export async function signOutUser() {
  await signOut(auth);
}

export async function getUserProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, PROFILE_COLLECTION, uid));
  return snapshot.exists() ? snapshot.data() : null;
}

/** Display helper only. Premium must be granted by a trusted billing/backend process. */
export async function getPremiumStatus() {
  const profile = await getUserProfile();
  return Boolean(profile?.premium?.active === true || profile?.plan === "premium");
}

function assertAllowedDataCollection(name) {
  if (!ALLOWED_USER_DATA_COLLECTIONS.has(name)) {
    throw new Error("Unsupported user data collection. Use notes, projects, or conversations.");
  }
}

function localDataKey(uid, name) { return `studySphereAi.cache.${uid}.${name}`; }
function pendingQueueKey(uid) { return `studySphereAi.pending.${uid}`; }
function readPendingQueue(uid) { return safeStorageGet(pendingQueueKey(uid), []); }

function queueLocalChange(uid, change) {
  const queue = readPendingQueue(uid);
  const index = queue.findIndex(item => item.collectionName === change.collectionName && item.id === change.id);
  if (index >= 0) queue[index] = change;
  else queue.push(change);
  safeStorageSet(pendingQueueKey(uid), queue);
}

function updateLocalCollection(uid, name, id, data, deleted = false) {
  const records = safeStorageGet(localDataKey(uid, name), []);
  const filtered = records.filter(record => record.id !== id);
  if (!deleted) filtered.unshift({ id, ...data });
  safeStorageSet(localDataKey(uid, name), filtered);
}

/** Saves to this device first, then attempts Firestore. Returns whether cloud sync worked. */
export async function saveUserData(collectionName, id, data) {
  assertAllowedDataCollection(collectionName);
  const user = requireSignedInUser();
  const recordId = id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${randomReferralCode(6)}`);
  const payload = { ...data, updatedAt: new Date().toISOString() };
  updateLocalCollection(user.uid, collectionName, recordId, payload);
  const change = { collectionName, id: recordId, data: payload, deleted: false };
  try {
    await setDoc(doc(db, PROFILE_COLLECTION, user.uid, collectionName, recordId), {
      ...data, updatedAt: serverTimestamp()
    }, { merge: true });
    return { id: recordId, synced: true };
  } catch (error) {
    queueLocalChange(user.uid, change);
    return { id: recordId, synced: false, error };
  }
}

export async function listUserData(collectionName) {
  assertAllowedDataCollection(collectionName);
  const user = requireSignedInUser();
  try {
    const snapshot = await getDocs(query(
      collection(db, PROFILE_COLLECTION, user.uid, collectionName), orderBy("updatedAt", "desc")
    ));
    const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    safeStorageSet(localDataKey(user.uid, collectionName), records);
    return records;
  } catch (error) {
    const cached = safeStorageGet(localDataKey(user.uid, collectionName), []);
    if (cached.length) return cached;
    throw error;
  }
}

export async function deleteUserData(collectionName, id) {
  assertAllowedDataCollection(collectionName);
  const user = requireSignedInUser();
  updateLocalCollection(user.uid, collectionName, id, null, true);
  try {
    await deleteDoc(doc(db, PROFILE_COLLECTION, user.uid, collectionName, id));
    return { deleted: true, synced: true };
  } catch (error) {
    queueLocalChange(user.uid, { collectionName, id, data: null, deleted: true });
    return { deleted: true, synced: false, error };
  }
}

/** Best-effort retry for locally queued notes/projects/conversations. */
export async function syncPendingUserData() {
  const user = auth.currentUser;
  if (!user) return { synced: 0, remaining: 0 };
  const queue = readPendingQueue(user.uid);
  let synced = 0;
  const remaining = [];
  for (const change of queue) {
    try {
      const ref = doc(db, PROFILE_COLLECTION, user.uid, change.collectionName, change.id);
      if (change.deleted) await deleteDoc(ref);
      else await setDoc(ref, { ...change.data, updatedAt: serverTimestamp() }, { merge: true });
      synced += 1;
    } catch {
      remaining.push(change);
    }
  }
  safeStorageSet(pendingQueueKey(user.uid), remaining);
  return { synced, remaining: remaining.length };
}

export function listenToUserData(collectionName, callback, onError = console.error) {
  assertAllowedDataCollection(collectionName);
  const user = requireSignedInUser();
  return onSnapshot(
    query(collection(db, PROFILE_COLLECTION, user.uid, collectionName), orderBy("updatedAt", "desc")),
    snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function makeReferralLink() {
  const user = requireSignedInUser();
  let profile = await getUserProfile(user.uid);
  if (!profile?.referralCode) {
    profile = await ensureUserProfile(user);
  }
  if (!profile?.referralCode) throw new Error("Your referral code is not available yet. Check your Firestore setup.");
  const link = new URL("./signup.html", window.location.href);
  link.searchParams.set("ref", profile.referralCode);
  return { code: profile.referralCode, link: link.href };
}

// Retry offline work whenever connectivity returns. Actual reward grants are not client-side.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { syncPendingUserData().catch(() => {}); });
}
