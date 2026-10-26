import { LiveEvent } from "../../types/domain";

export type Request = <T>(url: string, init?: RequestInit) => Promise<T>;

export type ConnectLive = (onEvent: (event: LiveEvent) => void) => WebSocket;

export { request, connectLive } from "./json";
