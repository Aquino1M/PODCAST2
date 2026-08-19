const SUPABASE_URL = "https://kyrcukwbodzcuqkpihuf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e";
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const originalFetch = globalThis.fetch.bind(globalThis);
const realSecret = process.env.SUPABASE_SECRET_KEY;
const oidcToken = process.env.VERCEL_OIDC_TOKEN;

if (!realSecret && oidcToken) {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SECRET_KEY = "__vercel_oidc_proxy__";

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (url && url.startsWith(SUPABASE_URL)) {
      const path = url.slice(SUPABASE_URL.length);
      if (path.startsWith("/rest/v1/onda_documents") || path.startsWith("/storage/v1/object/podcast-media/")) {
        const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
        let body = init.body ?? null;
        let bodyEncoding = null;

        if (body && typeof body !== "string") {
          if (body instanceof ArrayBuffer) body = Buffer.from(body).toString("base64");
          else if (ArrayBuffer.isView(body)) body = Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString("base64");
          else if (Buffer.isBuffer(body)) body = body.toString("base64");
          if (typeof body === "string") bodyEncoding = "base64";
        }

        return originalFetch(PROXY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${oidcToken}`,
            "apikey": SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            path,
            method: String(init.method || "GET").toUpperCase(),
            headers,
            body,
            bodyEncoding,
          }),
          signal: init.signal,
        });
      }
    }
    return originalFetch(input, init);
  };
}

const { handler } = await import("../server.mjs");
export default handler;
