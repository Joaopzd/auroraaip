import { initializeApp, getApps } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

function configured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && appId && vapidKey && firebaseConfig.messagingSenderId);
}

function workerUrl() {
  return `/sw.js?${new URLSearchParams(firebaseConfig).toString()}`;
}

function messagingApp() {
  return getApps().find((app) => app.name === "ditto-push") ?? initializeApp(firebaseConfig, "ditto-push");
}

export async function enablePush(): Promise<PushResult> {
  if (!configured()) return { status: "not-configured" };
  if (!("Notification" in window) || !(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const serviceWorkerRegistration = await navigator.serviceWorker.register(workerUrl());
  try {
    const token = await getToken(getMessaging(messagingApp()), { vapidKey, serviceWorkerRegistration });
    return token ? { status: "registered", token } : { status: "denied" };
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission-blocked")) return { status: "denied" };
    throw error;
  }
}

export async function disablePushLocally() {
  if (!configured() || !(await isSupported())) return null;
  const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
  if (!serviceWorkerRegistration) return null;
  const messaging = getMessaging(messagingApp());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  if (!token) return null;
  await deleteToken(messaging);
  return token;
}