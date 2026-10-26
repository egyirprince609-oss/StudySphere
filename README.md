# Study Sphere Ai — Splash + Authentication Starter

A standalone starter for **Study Sphere Ai**, a Code Academy Solution product. The current build includes the animated splash page, email/password signup, Google sign-in, login, email verification, forgotten-password email, a branded email action handler, and a protected post-login placeholder dashboard. It does not yet include the AI chat engine, premium billing, or the full LMS.

## Files

- `index.html` — animated splash screen; routes an existing verified user to the dashboard, an unverified user to email verification, and a signed-out visitor to signup.
- `signup.html` — email/password account creation, live password checklist, Google sign-in, verification-email request, and starter Firestore profile creation.
- `login.html` — email/password and Google sign-in, remember-me/session persistence, and the unverified-email guard.
- `email-verification.html` — resend and check-verification controls; checks Firebase's current user status instead of trusting a button click.
- `forgot.html` — sends Firebase's password-reset email without revealing whether an address has an account.
- `email-action.html` — custom handler for verification and password-reset action codes. Firebase must be configured to use this URL if you want this branded handler rather than Firebase's default handler.
- `dashboard.html` — protected placeholder so successful login has a working destination while the tutor/LMS are built.
- `firebase.js` and `auth-service.js` — central Firebase initialization and shared authentication/profile helpers.
- `styles.css` — responsive dark navy, cyan, blue, and violet Code Academy-style visual system.
- `assets/logo.png` — cropped 3D Study Sphere Ai emblem. `assets/brand-showcase.png` preserves the full generated artwork as a reference.
- `firestore.rules` — narrowly scoped starter rules for the user's own profile; no client write can grant premium entitlement.

## Before testing or deploying

### 1. Enable Firebase Authentication providers

In the Firebase Console for project **`studyspher`**:

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Enable **Google** and choose the support email shown by Firebase.
4. Open **Authentication → Settings → Authorized domains** and add the exact hosting domain you use (for local testing, add `localhost` if it is not already present).
5. Under the Firebase Authentication password policy, configure the minimum length and uppercase, lowercase, and non-alphanumeric requirements to match the signup and reset pages. This UI accepts 6–400 characters.

### 2. Configure branded email links

Firebase can send verification and password-reset emails, but **the app cannot enable email templates or domain settings from source code**. In **Authentication → Templates**, edit both **Email address verification** and **Password reset** templates and set their custom action URL to:

`https://YOUR_DEPLOYED_DOMAIN/email-action.html`

Replace `YOUR_DEPLOYED_DOMAIN` with your real HTTPS hostname. The action handler is designed to receive the Firebase query parameters `mode` and `oobCode`. If the custom action URL is not configured, Firebase may use its default email-action page instead; the emails can still be delivered, but this app's custom reset form will not be the handler shown from the email link.

The continue URLs created in the code point back to this app. The hosting domain must be authorized in Firebase Authentication.

### 3. Enable Firestore and deploy the starter rules

Create/enable Cloud Firestore in project `studyspher`, then deploy the included rules from this directory:

```bash
npm install -g firebase-tools
firebase login
firebase use studyspher
firebase deploy --only firestore:rules
```

The rules allow an authenticated learner to read their own profile and update basic profile fields. They do **not** grant access to future chats/courses collections or premium entitlements. Add specific rules when those data models are implemented. Later, subscription status must be granted by a trusted backend/payment webhook, not by a browser field.

### 4. Host the files over HTTPS

ES-module imports and Firebase Auth should be tested from a web server, not by opening `index.html` as a `file://` URL. For Firebase Hosting (if Hosting is enabled for this project):

```bash
firebase deploy --only hosting
```

Alternatively, upload the static app to your chosen HTTPS host. Add that exact domain to Firebase Authentication's authorized domains and update the custom email action URLs to match.

### 5. Run a real end-to-end test

1. Open the deployed `/index.html`.
2. Create an account using an email address you can access.
3. Confirm the verification message arrives, then open the link.
4. Return to the app, choose **I've verified my email**, and confirm that it opens the dashboard.
5. Sign out, sign in again, and confirm the verified account passes the gate.
6. Use **Forgot password**, open the newest email, and submit a new password on the custom action page.
7. Test Google sign-in with an actual Google account.

Static source checks cannot prove that Firebase providers, domains, Firestore, email templates, and email delivery are enabled correctly in your project. Those settings must be confirmed during the live test.

## Security notes

- The Firebase web config in `firebase.js` is client configuration. Firebase web API keys are normally public; security must come from Authentication, Firestore/Storage Rules, App Check where appropriate, and trusted backend validation.
- Never put OpenAI, Gemini, OpenRouter, or DeepSeek API secrets in frontend code. Keep those provider keys in Render's backend environment variables.
- The dashboard is only a protected placeholder. Before adding AI requests, the Render backend must verify Firebase ID tokens and enforce user-level plan limits server-side.
