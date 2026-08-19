import { getVercelOidcToken } from "@vercel/oidc";
import { createHmac, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = "https://kyrcukwbodzcuqkpihuf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e";
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const originalFetch = globalThis.fetch.bind(globalThis);
const configuredKey = String(process.env.SUPABASE_SECRET_KEY || "");
const FOOTER_DOC_KEY = "appearance_footer_text";
const DEFAULT_FOOTER_TEXT = "WWW.AQUINOCAST.COM";

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

function jsonResponse(response, status, body, cache = "public, max-age=300, stale-while-revalidate=600") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cache);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > 64_000) reject(new Error("payload too large"));
      else chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("invalid json")); }
    });
    request.on("error", reject);
  });
}

function sessionSecret() {
  return String(process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || configuredKey || "__vercel_oidc_proxy__");
}

function validSessionSignature(payload, supplied) {
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(String(supplied || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function currentAdmin(request) {
  const rawCookie = String(request.headers?.cookie || "");
  const token = rawCookie.split(";").map(item => item.trim()).find(item => item.startsWith("onda_session="))?.slice("onda_session=".length);
  const [payload, supplied] = String(token || "").split(".");
  if (!payload || !supplied || !validSessionSignature(payload, supplied)) return null;

  let session;
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return null; }
  if (!session?.id || Number(session.expires) <= Date.now()) return null;

  try {
    const authResponse = await fetch(`${SUPABASE_URL}/rest/v1/onda_documents?key=eq.auth&select=value&limit=1`);
    if (!authResponse.ok) return null;
    const authValue = (await authResponse.json())[0]?.value || {};
    const users = Array.isArray(authValue?.users)
      ? authValue.users
      : authValue?.passwordHash
        ? [{ id:authValue.id || "owner", role:"Administrador", status:"Ativo" }]
        : [];
    const user = users.find(item => String(item.id) === String(session.id) && item.status !== "Inativo");
    return user?.role === "Administrador" ? user : null;
  } catch {
    return null;
  }
}

async function footerTextEndpoint(request, response) {
  if (request.method === "GET") {
    try {
      const upstream = await fetch(`${SUPABASE_URL}/rest/v1/onda_documents?key=eq.${encodeURIComponent(FOOTER_DOC_KEY)}&select=value&limit=1`);
      const value = upstream.ok ? (await upstream.json())[0]?.value : null;
      const text = typeof value?.text === "string" ? value.text : DEFAULT_FOOTER_TEXT;
      return jsonResponse(response, 200, { text }, "no-store");
    } catch {
      return jsonResponse(response, 200, { text: DEFAULT_FOOTER_TEXT }, "no-store");
    }
  }

  if (request.method !== "POST") return jsonResponse(response, 405, { error:"Método não permitido" }, "no-store");
  if (!await currentAdmin(request)) return jsonResponse(response, 403, { error:"Apenas o administrador pode alterar esse texto" }, "no-store");

  let body;
  try { body = await readJsonBody(request); }
  catch { return jsonResponse(response, 400, { error:"Dados inválidos" }, "no-store"); }

  const text = String(body?.text ?? "").trim();
  if (text.length > 80 || /[<>\r\n]/.test(text)) return jsonResponse(response, 400, { error:"Use até 80 caracteres, sem quebra de linha" }, "no-store");

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/onda_documents?on_conflict=key`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" },
      body:JSON.stringify([{ key:FOOTER_DOC_KEY, value:{ text }, updated_at:new Date().toISOString() }]),
    });
    if (!upstream.ok) throw new Error(`Supabase ${upstream.status}`);
    return jsonResponse(response, 200, { text, saved:true }, "no-store");
  } catch (error) {
    return jsonResponse(response, 502, { error:"Não foi possível salvar no Supabase", detail:String(error?.message || error) }, "no-store");
  }
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
  const path = requestedApiPath(request);
  if (path === "youtube-shorts") return youtubeShorts(response);
  if (path === "footer-text") return footerTextEndpoint(request, response);
  return appHandler(request, response);
}
