// Firebase configuration and initialization for the CRM side of the project.
// This file centralises the Firebase SDK setup so other modules can import
// the configured services without duplicating boilerplate.

import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  getMessaging,
  getToken,
  isSupported as messagingIsSupported,
} from 'firebase/messaging';

// --- Firebase project configuration ---
// Prefer environment variables so production deployments can use a
// dedicated API key and auth domain. Hard-coded fallbacks keep local
// development working out of the box.
const envVar = (key) => process.env[key] || import.meta.env?.[key] || '';

const GOOGLE_API_KEY = 'AIzaSyAIdbF2EgdbZSPqBaQhi1pnNb4t5xauwEc';

const firebaseConfig = {
  apiKey: envVar('REACT_APP_FIREBASE_API_KEY') || GOOGLE_API_KEY,
  authDomain: envVar('REACT_APP_FIREBASE_AUTH_DOMAIN') ||
    'apfood-e9627.firebaseapp.com',
  projectId: envVar('REACT_APP_FIREBASE_PROJECT_ID') || 'ana-guimaraes',
  // Use the default Firebase storage host (appspot.com). The previous value
  // pointed to firebasestorage.app, which is only for direct download links
  // and breaks SDK requests.
  storageBucket:
    envVar('REACT_APP_FIREBASE_STORAGE_BUCKET') || 'ana-guimaraes.appspot.com',
  messagingSenderId:
    envVar('REACT_APP_FIREBASE_MESSAGING_SENDER_ID') || '847824537421',
  appId:
    envVar('REACT_APP_FIREBASE_APP_ID') ||
    '1:847824537421:web:75861057fd6f998ee49904',
  measurementId: envVar('REACT_APP_FIREBASE_MEASUREMENT_ID') || 'G-F8BVTNLEW7',
};

const runtimeEnv =
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) ||
  import.meta.env?.MODE ||
  '';
const isDev = runtimeEnv !== 'production';

const missingEnvKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnvKeys.length && isDev) {
  console.warn(
    '[firebaseConfig] Variáveis de ambiente ausentes, usando valores de fallback:',
    missingEnvKeys.join(', ')
  );
}

// Single source for the VAPID key so all modules read the same value and
// we can fail gracefully when it is absent.
export const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY ||
  process.env.REACT_APP_VAPID_KEY ||
  import.meta.env?.VITE_VAPID_KEY ||
  '';

// Initialise the Firebase app.  Use getApps() to avoid creating
// duplicate instances if this module is imported multiple times.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Optionally enable Google Analytics (only works in browsers).  When
// running in Node or during SSR the analytics import will be unused.
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// --- Exported Firebase services ---
// Firestore for data storage, Auth for authentication, Storage for
// file uploads.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Expose the underlying app and analytics for advanced use cases.
export { app, analytics };

// --- FCM / Notifications ---
// messagingPromise lazily initialises the Messaging service only if
// the browser supports it and the user grants permission for
// notifications.  Code that requires messaging should await this
// promise.
export const messagingPromise = (async () => {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await messagingIsSupported();
    if (!supported) return null;
    const messaging = getMessaging(app);
    if (!VAPID_KEY) {
      return messaging;
    }
    // Request permission to send notifications.  This must be
    // triggered from a user gesture in most browsers; failure to
    // request here will cause the promise to reject.
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('🔔 Notification permission not granted');
      return messaging;
    }

    await getToken(messaging, { vapidKey: VAPID_KEY });
    return messaging;
  } catch (err) {
    console.error('Failed to initialise Firebase Messaging:', err);
    return null;
  }
})();
