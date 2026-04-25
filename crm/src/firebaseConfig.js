// Firebase configuration and initialization for the CRM side of the project.
// This file centralises the Firebase SDK setup so other modules can import
// the configured services without duplicating boilerplate.

import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';
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

const GOOGLE_API_KEY = 'AIzaSyD_otNB81Of8fcsOPpCf_PvawQeVNF2Hkw';

const firebaseConfig = {
  apiKey: envVar('REACT_APP_FIREBASE_API_KEY') || GOOGLE_API_KEY,
  authDomain: envVar('REACT_APP_FIREBASE_AUTH_DOMAIN') ||
    'ana-guimaraes.firebaseapp.com',
  projectId: envVar('REACT_APP_FIREBASE_PROJECT_ID') || 'ana-guimaraes',
  // Use the bucket ID configured in Firebase Console. For this project the
  // canonical bucket is `*.firebasestorage.app`; forcing `*.appspot.com`
  // causes upload preflight failures (reported in production as CORS errors).
  storageBucket:
    envVar('REACT_APP_FIREBASE_STORAGE_BUCKET') || 'ana-guimaraes.firebasestorage.app',
  messagingSenderId:
    envVar('REACT_APP_FIREBASE_MESSAGING_SENDER_ID') || '847824537421',
  appId:
    envVar('REACT_APP_FIREBASE_APP_ID') ||
    '1:847824537421:web:75861057fd6f998ee49904',
  measurementId: envVar('REACT_APP_FIREBASE_MEASUREMENT_ID') || 'G-F8BVTNLEW7',
};

export const firebasePublicConfig = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKeySuffix: firebaseConfig.apiKey ? firebaseConfig.apiKey.slice(-6) : 'N/A',
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

if (
  isDev &&
  (!firebaseConfig.appId || firebaseConfig.appId.includes('REPLACE_WITH_YOUR_WEB_APP_ID'))
) {
  console.warn('[firebaseConfig] appId inválido detectado; confira variáveis REACT_APP_FIREBASE_*.');
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
let analytics = null;

const initializeAnalytics = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const supported = await analyticsIsSupported();
    if (!supported) return null;
    return getAnalytics(app);
  } catch (error) {
    console.warn('[firebaseConfig] Analytics indisponível no contexto atual:', error);
    return null;
  }
};

const analyticsPromise = initializeAnalytics().then((instance) => {
  analytics = instance;
  return instance;
});

// --- Exported Firebase services ---
// Firestore for data storage, Auth for authentication, Storage for
// file uploads.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Expose the underlying app and analytics for advanced use cases.
export { app, analytics, analyticsPromise };

// --- FCM / Notifications ---
// Messaging inicializa somente sob demanda para evitar dependências
// no carregamento público da Home.
let messagingInitPromise = null;

export const getMessagingInstance = async () => {
  if (messagingInitPromise) return messagingInitPromise;

  messagingInitPromise = (async () => {
    if (typeof window === 'undefined') return null;
    try {
      const supported = await messagingIsSupported();
      if (!supported) return null;
      return getMessaging(app);
    } catch (err) {
      console.error('Failed to initialise Firebase Messaging:', err);
      return null;
    }
  })();

  return messagingInitPromise;
};

export const requestMessagingToken = async (messaging, serviceWorkerRegistration) => {
  if (!messaging || !VAPID_KEY) return null;

  try {
    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration,
    });
  } catch (error) {
    const normalizedMessage = String(error?.message || '').toLowerCase();
    const isInstallationsPermissionError =
      error?.code === 'installations/request-failed' ||
      normalizedMessage.includes('firebaseinstallations.googleapis.com') ||
      normalizedMessage.includes('permission_denied');

    if (isInstallationsPermissionError) {
      console.warn(
        '[firebaseConfig] Push desativado neste ambiente (sem permissão para Firebase Installations).'
      );
      return null;
    }

    throw error;
  }
};
