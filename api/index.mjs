const SUPABASE_URL = "https://kyrcukwbodzcuqkpihuf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e";
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const originalFetch = globalThis.fetch.bind(globalThis);
const configuredKey = String(process.env.SUPABASE_SECRET_KEY || "");
const oidcToken = process.env.VERCEL_OIDC_TOKEN;

function isPrivilegedSupabaseKey(key) {
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;
  if (!key.includes(".")) return false;
  try {
    const payload = key.split(".")[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const data = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return data?.role === "service_role";
  } catch {
    return false;
  }
}

const hasBackendSecret = isPrivilegedSupabaseKey(configuredKey);

// O backend precisa sempre conhecer a URL do projeto. Sem isso, o server.mjs
// cai para o armazenamento local e tenta gravar em /var/task, que é read-only no Vercel.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_URL;

if (!hasBackendSecret && oidcToken) {
  // Se a variável tiver recebido uma publishable/anon key por engano, não a usa
  // como chave administrativa. O acesso passa pelo proxy seguro no Supabase.
  process.env.SUPABASE_SECRET_KEY = "__vercel_oidc_proxy__";

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

        const payload = JSON.stringify({
          path,
          method: String(init.method || "GET").toUpperCase(),
          headers,
          body,
          bodyEncoding,
        });

        let lastResponse = null;
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await originalFetch(PROXY_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${oidcToken}`,
                "apikey": SUPABASE_PUBLISHABLE_KEY,
              },
              body: payload,
              // Não reutiliza o timeout curto do server.mjs. Em cold start a
              // Edge Function pode precisar de alguns segundos para validar OIDC.
              signal: AbortSignal.timeout(15_000),
            });
            lastResponse = response;
            if (response.ok) return response;
            if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) return response;
          } catch (error) {
            lastError = error;
          }
          await sleep(180 * (attempt + 1));
        }

        if (lastResponse) return lastResponse;
        throw lastError || new Error("Falha ao acessar o Supabase pelo proxy seguro");
      }
    }
    return originalFetch(input, init);
  };
}

const { handler } = await import("../server.mjs");
export default handler;
