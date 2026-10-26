import type { ConnectLive, Request } from "./index";

export const request: Request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = parseJson(text);
  if (body === undefined) throw new Error(`${response.status} ${response.statusText}: ${url} did not answer JSON`);
  if (!response.ok) throw new Error(body.error?.message ?? `${response.status} ${response.statusText}`);
  return body;
};

export const connectLive: ConnectLive = (onEvent) => {
  const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  socket.onmessage = (event) => onEvent(JSON.parse(event.data));
  return socket;
};

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
