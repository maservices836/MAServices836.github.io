/**
 * firebase-init.js
 * Reuses the v12.14.0 Firebase instance from firebase-config.js, attaches App Check
 * for Firebase AI Logic, and resolves existing or anonymous user sessions.
 */

import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app-check.js";
import { auth, db } from "./firebase-config.js";

if (!getApps().length) {
  throw new Error("firebase-config.js must initialize Firebase before firebase-init.js loads.");
}

export const app = getApp();
export { auth, db };

// Enable App Check debug token on localhost or when ?debug=true is passed in URL
const isLocalOrDebug =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  new URLSearchParams(location.search).has("debug");

if (isLocalOrDebug) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

let appCheckInstance = null;

/**
 * Initializes App Check required by Firebase AI Logic.
 * Pass your reCAPTCHA Enterprise site key or set window.MA_RECAPTCHA_SITE_KEY in HTML.
 */
export function initHybridAppCheck(siteKey = window.MA_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI") {
  if (appCheckInstance) return appCheckInstance;
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (err) {
    console.warn("[HybridAI] App Check initialization notice:", err.message);
  }
  return appCheckInstance;
}

// Boot App Check immediately on module load
initHybridAppCheck();

/**
 * Preserves an already logged-in MA Services user (student/contractor/admin),
 * or creates an anonymous session so public visitors and judges can run triage immediately.
 */
export function ensureHybridUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
          return;
        }
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (err) {
          reject(err);
        }
      },
      (err) => {
        unsubscribe();
        reject(err);
      }
    );
  });
}