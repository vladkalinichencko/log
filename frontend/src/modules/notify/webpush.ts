import { deletePushSubscription, fetchPushKey, savePushSubscription } from "../../api/client";
import type { SystemNotifications } from "./index";

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const worker = () => navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);

const key_bytes = (key: string) => Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

export async function system_notifications_state(): Promise<SystemNotifications> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return (await (await worker()).pushManager.getSubscription()) ? "on" : "off";
}

export async function enable_system_notifications() {
  const key = await fetchPushKey();
  const subscription = await (await worker()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key_bytes(key) });
  await savePushSubscription(subscription.toJSON());
}

export async function disable_system_notifications() {
  const subscription = await (await worker()).pushManager.getSubscription();
  if (!subscription) return;
  await deletePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
