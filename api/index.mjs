import { getVercelOidcToken } from "@vercel/oidc";

const SUPABASE_URL = "https://kyrcukwbodzcuqkpihuf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e";
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const originalFetch = globalThis.fetch.bind(globalThis);
const configuredKey = String(process.env.SUPABASE_SECRET_KEY || "");

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
process.env.SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_URL;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runtimeOidcToken() {
  try {
    const token = await getVercelOidcToken();
    if (token) return token;
  } catch {}
  return process.env.VERCEL_OIDC_TOKEN || "";
}

if (!hasBackendSecret) {
  // Ativa o modo remoto do server.mjs. O valor abaixo nunca é enviado ao banco:
  // toda chamada administrativa é interceptada e autenticada pelo OIDC da Vercel.
  process.env.SUPABASE_SECRET_KEY = "__vercel_oidc_proxy__";

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (url && url.startsWith(SUPABASE_URL)) {
      const path = url.slice(SUPABASE_URL.length);
      if (path.startsWith("/rest/v1/onda_documents") || path.startsWith("/storage/v1/object/podcast-media/")) {
        const oidcToken = await runtimeOidcToken();
        if (!oidcToken) throw new Error("Vercel OIDC indisponível para acessar o Supabase");

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

let shortsCache = { expires: 0, value: null };

function requestedApiPath(request) {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    return String(url.searchParams.get("path") || url.pathname.replace(/^\/api\/?/, "")).replace(/^\/+|\/+$/g, "");
  } catch {
    return "";
  }
}

function jsonResponse(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function youtubeShorts(response) {
  if (shortsCache.value && shortsCache.expires > Date.now()) {
    return jsonResponse(response, 200, shortsCache.value);
  }

  try {
    const channelUrl = "https://www.youtube.com/@Bebezaopodcast/shorts?hl=pt-BR&gl=BR";
    const upstream = await originalFetch(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
        "Cookie": "CONSENT=YES+cb",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) throw new Error(`YouTube respondeu ${upstream.status}`);

    const html = await upstream.text();
    const ids = [];
    const seen = new Set();
    const matcher = /"videoId":"([A-Za-z0-9_-]{11})"/g;
    let match;
    while ((match = matcher.exec(html)) && ids.length < 5) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (ids.length < 5) throw new Error(`Foram encontrados somente ${ids.length} shorts`);

    const value = {
      channel: "@Bebezaopodcast",
      source: "youtube",
      shorts: ids.map((id, index) => ({
        id,
        position: index + 1,
        url: `https://www.youtube.com/shorts/${id}`,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&playsinline=1`,
      })),
      updatedAt: new Date().toISOString(),
    };
    shortsCache = { expires: Date.now() + 10 * 60_000, value };
    return jsonResponse(response, 200, value);
  } catch (error) {
    if (shortsCache.value) return jsonResponse(response, 200, shortsCache.value);
    return jsonResponse(response, 502, { error: "Não foi possível carregar os Shorts do Podcast do Bebezão.", detail: String(error?.message || error) });
  }
}

const { handler: appHandler } = await import("../server.mjs");

export default async function handler(request, response) {
  if (requestedApiPath(request) === "youtube-shorts") return youtubeShorts(response);
  return appHandler(request, response);
}
