const WS_URL = "ws://localhost:8000/ws";

export function connectWebSocket(onMessage: (data: any) => void): WebSocket {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  ws.onclose = () => {
    console.log("WebSocket closed");
  };

  return ws;
}
