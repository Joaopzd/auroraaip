// Tiny event bus to open the Aurora chat from anywhere (e.g. mobile tab bar).
export const CHAT_OPEN_EVENT = "aurora:open-chat";

export function openAuroraChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT));
}
