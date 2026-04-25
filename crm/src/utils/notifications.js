import { onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  db,
  getMessagingInstance,
  requestMessagingToken,
  VAPID_KEY,
} from "../firebaseConfig.js";
const isBrowser = typeof window !== "undefined";
const runtimeEnv =
  (typeof process !== "undefined" && process.env && process.env.NODE_ENV) ||
  import.meta.env?.MODE ||
  "";
const isDev = runtimeEnv !== "production";
let hasLoggedMissingVapidWarning = false;

async function ensureServiceWorkerRegistration() {
  if (!isBrowser || !('serviceWorker' in navigator)) {
    throw new Error('Service workers não são suportados neste ambiente.');
  }

  try {
    const readyRegistration = await navigator.serviceWorker.ready;
    const readyScriptUrl = readyRegistration.active?.scriptURL;
    if (readyScriptUrl && readyScriptUrl.includes('firebase-messaging-sw.js')) {
      return readyRegistration;
    }
  } catch (error) {
    console.warn('[notifications] Não foi possível obter serviceWorker.ready:', error);
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  const existing = registrations.find((registration) => {
    const scriptURL =
      registration.active?.scriptURL ||
      registration.installing?.scriptURL ||
      registration.waiting?.scriptURL;
    return scriptURL?.includes("firebase-messaging-sw.js");
  });

  if (existing) {
    return existing;
  }

  return navigator.serviceWorker.register("/firebase-messaging-sw.js");
}

export async function registerDeviceForPush(uid) {
  if (!isBrowser) return null;

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  if (!("Notification" in window)) {
    console.warn("API de notificações não suportada neste navegador.");
    return null;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    console.warn("Permissão para notificações não concedida.");
    return null;
  }

  if (!VAPID_KEY) {
    if (isDev && !hasLoggedMissingVapidWarning) {
      hasLoggedMissingVapidWarning = true;
      console.warn(
        "A variável de ambiente da chave VAPID não está configurada; notificações push permanecerão desativadas."
      );
    }
    return null;
  }

  try {
    const registration = await ensureServiceWorkerRegistration();
    const token = await requestMessagingToken(messaging, registration);

    if (!token) {
      if (isDev) {
        console.info("Push token indisponível neste ambiente; seguindo sem notificações.");
      }
      return null;
    }

    await setDoc(
      doc(db, "notificationTokens", token),
      {
        uid: uid || null,
        platform: navigator.platform || "web",
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch (error) {
    console.error("Falha ao registrar notificações push:", error);
    throw error;
  }
}

export async function listenForForegroundMessages(callback) {
  if (!isBrowser) return () => {};

  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, callback);
}

export function subscribeToServiceWorkerMessages(callback) {
  if (!isBrowser || !("serviceWorker" in navigator)) {
    return () => {};
  }

  const handler = (event) => {
    callback(event);
  };

  navigator.serviceWorker.addEventListener("message", handler);

  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
  };
}
