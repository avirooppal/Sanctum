export async function requestHostApprovalToken(toolName: string): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const wv = (window as any).chrome?.webview;
  if (!wv?.postMessage || !wv?.addEventListener) return undefined;
  return new Promise((resolve) => {
    const requestId = `tok-${crypto.randomUUID()}`;
    const timer = setTimeout(() => {
      wv.removeEventListener("message", onMsg);
      resolve(undefined);
    }, 2000);
    const onMsg = (event: { data: unknown }) => {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : (event.data as any);
        if (msg?.type === "approvalTokenIssued" && msg.requestId === requestId) {
          clearTimeout(timer);
          wv.removeEventListener("message", onMsg);
          resolve(typeof msg.token === "string" ? msg.token : undefined);
        }
      } catch {}
    };
    wv.addEventListener("message", onMsg);
    wv.postMessage(JSON.stringify({ type: "requestApprovalToken", requestId, toolName }));
  });
}

export async function fetchWithApproval(
  url: string,
  init: RequestInit,
  toolName: string
): Promise<Response> {
  const token = await requestHostApprovalToken(toolName);
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("X-Sanctum-Approval", token);
  }
  return fetch(url, { ...init, headers });
}
