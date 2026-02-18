// Firebase configuration and setup for the public/cardápio pages.
// This file initialises a named Firebase app instance to avoid
// interfering with the main CRM session.  It also ensures that
// anonymous authentication is persisted between reloads so each
// visitor retains a consistent session.

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  setDoc,
  arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// --- Firebase project configuration ---
// These credentials correspond to the Ana Guimarães project hosted on
// Firebase.  Replace them only if you migrate the project to a new
// Firebase account.
const GOOGLE_API_KEY = 'AIzaSyAIdbF2EgdbZSPqBaQhi1pnNb4t5xauwEc';

const firebaseConfig = {
  apiKey: GOOGLE_API_KEY,
  authDomain: 'apfood-e9627.firebaseapp.com',
  projectId: 'ana-guimaraes',
  storageBucket: 'ana-guimaraes.firebasestorage.app',
  messagingSenderId: '847824537421',
  appId: '1:847824537421:web:75861057fd6f998ee49904',
  measurementId: 'G-F8BVTNLEW7',
};

// Create or retrieve a named app instance.  Using a distinct name
// prevents interference with other Firebase initialisations on the page.
const appName = 'cardapioPublic';
const app = getApps().find((a) => a.name === appName) || initializeApp(firebaseConfig, appName);

// Firestore service for data operations.
const db = getFirestore(app);

// Authentication service.
const auth = getAuth(app);

// Some Firebase projects restrict anonymous authentication at the admin
// level.  Anonymous auth is now enabled by default (so freshly enabled
// Firebase settings work out of the box), but you can disable it by
// setting `window.DISABLE_ANON_AUTH = true` before loading this script
// if the project explicitly blocks anonymous sessions.
const ANONYMOUS_AUTH_ENABLED = window.DISABLE_ANON_AUTH !== true;

if (!ANONYMOUS_AUTH_ENABLED) {
  window.firebaseAnonAuthUnavailable = true;
  console.info('Autenticação anônima desativada para o cardápio público.');
} else {
  const handleAnonAuthError = (error) => {
    console.warn('Autenticação anônima indisponível; prosseguindo sem login.', error);
    window.firebaseAnonAuthUnavailable = true;
  };

  // Persist anonymous login so that returning visitors keep the same
  // anonymous user ID.  This prevents duplication of carts or orders
  // across reloads.
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      onAuthStateChanged(auth, (user) => {
        // If no user is signed in yet, sign in anonymously.  This should
        // only happen once per browser session.
        if (!user && !window.firebaseAnonAuthUnavailable) {
          signInAnonymously(auth).catch(handleAnonAuthError);
        } else if (!user) {
          handleAnonAuthError(new Error('anonymous auth skipped'));
        } else {
          console.log('Sessão anônima ativa:', user.uid);
        }
      });
    })
    .catch((error) => {
      console.error('Erro ao definir persistência de autenticação:', error);
      handleAnonAuthError(error);
    });
}

// --- Exports ---
// Export both the app instance and the Firestore helpers used by the
// cardápio pages.  Consumers can import exactly what they need
// without including unused modules in the bundle.
export {
  app,
  db,
  auth,
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  setDoc,
  arrayUnion,
};