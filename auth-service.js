// Shared authentication service used by every Study Sphere Ai auth page.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  updateProfile,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { auth, db, googleProvider } from "./firebase.js";

export { auth, db, signOut, reload, applyActionCode, checkActionCode, verifyPasswordResetCode, confirmPasswordReset };

export const PASSWORD_RULES = [
  { id: "length", label: "6–400 characters", test: value => value.length >= 6 && value.length <= 400 },
  { id: "upper", label: "One uppercase letter", test: value => /[A-Z]/.test(value) },
  { id: "lower", label: "One lowercase letter", test: value => /[a-z]/.test(value) },
  { id: "special", label: "One special character", test: value => /[^A-Za-z0-9]/.test(value) }
];

export function passwordRules(value = "") {
  return PASSWORD_RULES.map(rule => ({ ...rule, met: rule.test(value) }));
}

export function isPasswordValid(value = "") {
  return PASSWORD_RULES.every(rule => rule.test(value));
}

export function safeContinueUrl(fileName, query = "") {
  const suffix = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  return new URL(`${fileName}${suffix}`, window.location.href).href;
}

export async function setRememberMe(remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
}

export async function createEmailAccount({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  if (name.trim()) {
    // The account already exists at this point. A display-name sync failure must not
    // misreport the whole account creation as failed or encourage duplicate signups.
    try {
      await updateProfile(credential.user, { displayName: name.trim() });
    } catch (profileError) {
      console.warn("Firebase account exists, but the Auth display name did not sync yet.", profileError);
    }
  }
  return credential.user;
}

export async function sendVerification(user) {
  // Firebase uses its default email handler unless a custom action URL is configured
  // in Authentication > Templates. See README.md to enable email-action.html.
  const actionCodeSettings = {
    url: safeContinueUrl("email-verification.html", "verified=1"),
    handleCodeInApp: false
  };
  await sendEmailVerification(user, actionCodeSettings);
}

export async function sendPasswordReset(email) {
  const actionCodeSettings = {
    url: safeContinueUrl("login.html", "reset=complete"),
    handleCodeInApp: false
  };
  await sendPasswordResetEmail(auth, email.trim().toLowerCase(), actionCodeSettings);
}

export async function googleSignIn() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    // On browsers that block popups, switch to the supported redirect flow.
    const redirectEligible = [
      "auth/popup-blocked",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported"
    ].includes(error?.code);
    if (redirectEligible) {
      await signInWithRedirect(auth, googleProvider);
      return null; // Navigation to Google will take over.
    }
    throw error;
  }
}

export async function ensureUserProfile(user, options = {}) {
  if (!user?.uid) throw new Error("A signed-in Firebase user is required to create a profile.");
  const profileRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(profileRef);
  const safeAuthFields = {
    uid: user.uid,
    email: user.email || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    updatedAt: serverTimestamp()
  };
  const profileName = options.displayName || user.displayName;
  if (profileName) safeAuthFields.displayName = profileName;

  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      ...safeAuthFields,
      displayName: profileName || "Learner",
      plan: "free",
      premium: false,
      subscriptionStatus: "free",
      preferences: { theme: "dark" },
      createdAt: serverTimestamp()
    });
  } else {
    // Never overwrite a user's plan or premium entitlement from client auth code.
    // If the Auth display name is temporarily missing, preserve the stored profile name.
    await updateDoc(profileRef, safeAuthFields);
  }
  return profileRef;
}

export async function refreshAndCheckEmail(user) {
  if (!user) return false;
  await reload(user);
  return Boolean(auth.currentUser?.emailVerified || user.emailVerified);
}

export function friendlyAuthError(error, context = "general") {
  const code = error?.code || "";
  const common = {
    "auth/invalid-email": "That email address doesn't look valid. Check it and try again.",
    "auth/user-disabled": "This account has been disabled. Contact support for help.",
    "auth/too-many-requests": "There have been too many attempts. Please wait a little and try again.",
    "auth/network-request-failed": "A network error interrupted the request. Check your connection and try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in the Firebase Console yet.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before sign-in finished.",
    "auth/cancelled-popup-request": "Another sign-in window is already open. Finish that one or try again.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow popups and try again.",
    "auth/email-already-in-use": "An account already uses this email. Sign in or reset its password instead.",
    "auth/weak-password": "Choose a stronger password that meets all four requirements.",
    "auth/invalid-credential": "The email or password is incorrect. Check your details and try again.",
    "auth/invalid-action-code": "This email link is invalid or has already been used. Request a new link.",
    "auth/expired-action-code": "This email link has expired. Request a new link and try again.",
    "auth/weak-password": "The password is too weak. Use at least six characters with uppercase, lowercase, and a special character.",
    "auth/missing-password": "Enter your password to continue.",
    "auth/password-does-not-meet-requirements": "The password does not meet the password rules configured in Firebase."
  };
  if (context === "login" && ["auth/user-not-found", "auth/wrong-password"].includes(code)) {
    return "The email or password is incorrect. Check your details or reset your password.";
  }
  if (context === "reset" && code === "auth/user-not-found") {
    return "If an account matches that email, Firebase will send a reset link.";
  }
  return common[code] || "We couldn't complete that request. Please try again. If it continues, check the Firebase setup guide.";
}
