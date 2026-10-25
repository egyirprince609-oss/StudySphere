# Study Sphere Ai — Authentication starter

**Motto:** Curiosity today. Confidence for tomorrow.  
**Creative line:** Explore. Learn. Create.

This is a fresh, mobile-first Firebase Authentication starter using the provided Firebase web configuration and the provided brand image saved as `logo.png`.

## Included files

- `index.html` — logo splash screen and signed-in routing. A verified account goes to `onboarding.html`; an unverified email/password account is sent to the verification panel; a signed-out visitor goes to `login.html`.
- `authentication.js` — Firebase initialization, local-persistent sessions, email/password and Google methods, verification email, reset email, profile creation, referral links/attribution, and helpers for user-owned notes/projects/conversations.
- `signup.html` — email/password sign-up, live 4-part password meter, confirmation, Google sign-up and verification message.
- `login.html` — email/password login, Google login, verification reminder and resend control.
- `forgot-password.html` — secure Firebase password-reset request.
- `forgot password.html` — a filename-with-spaces copy for compatibility; use the hyphenated filename in links.
- `styles.css` — responsive styling.
- `logo.png` — the app logo used for the brand and PWA icons.
- `manifest.json` and `service-worker.js` — minimal installable web app shell for now.
- `firestore.rules` — starting rules for per-user profiles, notes, projects, conversations, and referral-code lookup.

## Required setup before running

1. Put these files together in the same site root. Keep your real `onboarding.html` beside them. Do not open pages with `file://`; use a local web server or HTTPS hosting.
2. In Firebase Console → Authentication → Sign-in method, enable **Email/Password** and **Google**. Add the actual development/production domains under Authentication → Settings → Authorized domains.
3. Set and verify the email/password password policy in the Firebase Console. This UI checks: **6–400 characters**, at least one uppercase letter, one lowercase letter and one non-alphanumeric, non-whitespace special character. Frontend validation is only the user experience layer; Firebase must enforce the policy too.
4. Under Authentication → Templates, customize the **Email address verification** and **Password reset** templates with your product name and support details. The Firebase SDK requests the messages; browser JavaScript cannot itself send mail through Firebase. The verification URL returns to `login.html?verified=1`. Ensure that URL's domain is authorized.

   Suggested verification email copy (keep Firebase's generated action-link/button in the template):

   > **Subject:** Verify your Study Sphere Ai email address
   >
   > Hello,
   >
   > Welcome to Study Sphere Ai! We are happy to have you join a learning space made for curiosity, creativity and growth. To help keep your account secure, please verify that this email address belongs to you by selecting the verification link in this message. Once your email is verified, return to Study Sphere Ai and continue to onboarding.
   >
   > If you did not create this account, you can ignore this message. For your safety, do not share your verification link with anyone.
   >
   > Thank you,\n   > The Study Sphere Ai Team
5. Create a Cloud Firestore database and publish `firestore.rules` from the Firebase Console → Firestore Database → Rules. Review rules against any existing schema before replacing production rules. Never use open rules such as `allow read, write: if true`.
6. For share-card metadata, replace the relative `og:image` and `twitter:image` values `logo.png` with the absolute HTTPS address of the deployed logo (for example, `https://YOUR-REAL-DOMAIN/logo.png`) in each HTML file. Social preview crawlers generally require an absolute, publicly reachable image URL. Do not leave `YOUR-REAL-DOMAIN` as written.
7. Test in an incognito window and on a phone. HTTPS (or `localhost`) is required for service-worker registration. The service worker caches the app shell only; it does not make Firebase authentication or AI calls work offline.

## Important architecture/security notes

- Firebase local persistence keeps a signed-in session on the same browser/device until the user signs out, storage is cleared, or Firebase invalidates the session. This is not the same as keeping a verification link: verification and password-reset links are one-time action links managed by Firebase and should not be stored in user profile documents.
- For email/password sign-up, the app sends a Firebase verification email. The user stays on the verification panel until the email is verified, then can continue to `onboarding.html`. Google-provider accounts generally arrive with provider-reported email verification; this is checked using Firebase's user state.
- Google sign-in uses Firebase's official Google provider flow (popup on desktop, redirect on narrow/mobile layouts). This starter intentionally does **not** display a fake reCAPTCHA checkbox. Firebase's web `RecaptchaVerifier` is designed for specific flows such as phone verification; it is not a generic visible CAPTCHA gate for `GoogleAuthProvider`. For web app protection, configure Firebase App Check with reCAPTCHA Enterprise (score-based and generally invisible) if it fits the project, then monitor before enabling enforcement. A visible checkbox challenge requires a properly configured site key and server-side validation; this starter does not pretend to validate one.
- The referral system makes a code, creates a share link, and records a referrer's UID when a new account signs up using a valid `?ref=CODE` link. **It does not automatically grant a reward.** Actual awards/counts must be verified by a trusted Cloud Function/backend to prevent self-referrals, forged requests, repeat rewards, and client-side manipulation. The reward amount and trigger have not been specified yet.
- Premium is read-only from the UI side. Do not let a browser grant its own premium access. A payment provider/webhook or trusted backend must update the entitlement, and server-side protected features must verify it.
- Notes/projects/conversations have helper functions in `authentication.js` for per-user Firestore sync plus local-device caching/pending retries. Your future pages must call `saveUserData("notes" | "projects" | "conversations", id, data)` and the matching list/listener functions. This does not automatically save data from other pages unless they use these functions.
- The Firebase project configuration was supplied by the developer. The Firebase web API key is expected to be present in the client config; protect the application with Firebase Authentication, Firestore/Storage Rules, provider restrictions and App Check as appropriate. Never put OpenAI, Gemini, OpenRouter, DeepSeek or ElevenLabs **provider secret keys** in this frontend.
- These are browser-first pages and a PWA shell, not a completed native APK. Google OAuth in a true Android wrapper may need the appropriate native sign-in integration and package/signing configuration.

## Handy cloud-data API

```js
import {
  saveUserData,
  listUserData,
  listenToUserData,
  deleteUserData,
  getUserProfile,
  getPremiumStatus,
  makeReferralLink,
  signOutUser
} from "./authentication.js";

const saved = await saveUserData("notes", null, {
  title: "My first note",
  body: "What I learned today"
});
// saved.id is the ID to keep; saved.synced indicates whether cloud sync succeeded.

const notes = await listUserData("notes");
const unsubscribe = listenToUserData("projects", projects => console.log(projects));
// Call unsubscribe() when the screen/page no longer needs the live listener.

const referral = await makeReferralLink();
// referral.code and referral.link can be shown in a future referral screen.
```

## Password rule reference

The live meter is a quality guide, not a substitute for the Firebase-enforced policy. Passwords are never written to Firestore or local storage by this starter.
