import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Settings } from "../components/Settings";

const requests: { url: string; method: string; body: unknown }[] = [];

function stubBrowser(permission: NotificationPermission) {
  let subscription: { endpoint: string; toJSON: () => object; unsubscribe: () => Promise<boolean> } | null = null;
  const pushManager = {
    getSubscription: async () => subscription,
    subscribe: async () => {
      subscription = {
        endpoint: "https://push.example/browser",
        toJSON: () => ({ endpoint: "https://push.example/browser", keys: { p256dh: "p", auth: "a" } }),
        unsubscribe: async () => true,
      };
      return subscription;
    },
  };
  vi.stubGlobal("Notification", { permission });
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: async () => ({}), ready: Promise.resolve({ pushManager }) },
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET", body: init?.body && JSON.parse(String(init.body)) });
    const body = url === "/api/push/key" ? { key: "BAAA" } : url.includes("/settings") ? { hero: null, alerts: {} } : { subscribed: true };
    return new Response(JSON.stringify(body), { status: 200 });
  }));
}

const box = () => screen.getByLabelText(/alerts as system notifications/) as HTMLInputElement;

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
});

describe("system notifications", () => {
  it("ticking the box subscribes this browser and hands the subscription to the server", async () => {
    stubBrowser("default");
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => expect(box().disabled).toBe(false));
    expect(box().checked).toBe(false);
    fireEvent.click(box());
    await waitFor(() => expect(box().closest("label")!.dataset.state).toBe("on"));
    expect(box().checked).toBe(true);
    expect(requests.find((request) => request.url === "/api/push/subscriptions")).toEqual({
      url: "/api/push/subscriptions",
      method: "PUT",
      body: { endpoint: "https://push.example/browser", keys: { p256dh: "p", auth: "a" } },
    });
  });

  it("a browser that blocked notifications says so and cannot be ticked", async () => {
    stubBrowser("denied");
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => expect(box().closest("label")!.dataset.state).toBe("blocked"));
    expect(box().disabled).toBe(true);
    expect(box().closest("label")!.textContent).toContain("blocked in this browser's site settings");
  });
});
