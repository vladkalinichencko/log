export function connectWebSocket(onMessage: (message: { type: string }) => void): WebSocket {
  const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  socket.onmessage = (event) => onMessage(JSON.parse(event.data));
  return socket;
}
