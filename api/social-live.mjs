import { getVercelOidcToken } from "@vercel/oidc";
import { createHmac, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = "https://kyrcukwbodzcuqkpihuf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e";
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const DOC_KEY = "social_live_config";
const TIKHUB_BASE = "https://api.tikhub.io";
const CACHE_MS = 5 * 60_000;
const DEFAULT_CONFIG = {
  mode: "demo",
  tikhubApiKey: "",
  accounts: {
    tiktok: { id: "", enabled: true },
    instagram: { id: "", enabled: true },
    youtube: { id: "", enabled: true },
  },
  updatedAt: null,
};

let metricsCache = { key: "", expires: 0, value: {} };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanId = value => String(value || "").trim().replace(/^@/, "").slice(0, 120);
const num = value => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const text = value.replace(/,/g, "").trim();
    const match = text.match(/^([\d.]+)\s*([KMB])?$/i);
    if (match) {
      const base = Number(match[1]);
      const factor = { K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || "").toUpperCase()] || 1;
      if (Number.isFinite(base)) return Math.round(base * factor);
    }
    const parsed = Number(text.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

function json(response, status, body, cache = "no-store") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cache);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > 96_000) reject(new Error("payload too large"));
      else chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("invalid json")); }
    });
    request.on("error", reject);
  });
}

async function runtimeOidcToken() {
  try {
    const token = await getVercelOidcToken();
    if (token) return token;
  } catch {}
  return process.env.VERCEL_OIDC_TOKEN || "";
}

async function proxy(path, options = {}) {
  const oidcToken = await runtimeOidcToken();
  if (!oidcToken) throw new Error("Vercel OIDC indisponível");
  const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
  const payload = JSON.stringify({
    path,
    method: String(options.method || "GET").toUpperCase(),
    headers,
    body: options.body ?? null,
    bodyEncoding: null,
  });
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    last = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${oidcToken}`,
        "apikey": SUPABASE_PUBLISHABLE_KEY,
      },
      body: payload,
      signal: AbortSignal.timeout(15_000),
    });
    if (last.ok || ![408, 425, 429, 500, 502, 503, 504].includes(last.status)) return last;
    await sleep(180 * (attempt + 1));
  }
  return last;
}

async function readDocument(key) {
  const response = await proxy(`/rest/v1/onda_documents?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return (await response.json())[0]?.value || {};
}

async function writeDocument(key, value) {
  const response = await proxy("/rest/v1/onda_documents?on_conflict=key", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
}

function normalizeAccount(input, previous = { id: "", enabled: true }) {
  if (typeof input === "string") return { id: cleanId(input), enabled: true };
  if (!input || typeof input !== "object") return previous;
  return {
    id: input.id === undefined ? cleanId(previous.id) : cleanId(input.id),
    enabled: input.enabled === undefined ? previous.enabled !== false : Boolean(input.enabled),
  };
}

function normalizeConfig(value = {}) {
  const accounts = value.accounts && typeof value.accounts === "object" ? value.accounts : {};
  return {
    mode: value.mode === "real" ? "real" : "demo",
    tikhubApiKey: String(value.tikhubApiKey || ""),
    accounts: {
      tiktok: normalizeAccount(accounts.tiktok, DEFAULT_CONFIG.accounts.tiktok),
      instagram: normalizeAccount(accounts.instagram, DEFAULT_CONFIG.accounts.instagram),
      youtube: normalizeAccount(accounts.youtube, DEFAULT_CONFIG.accounts.youtube),
    },
    updatedAt: value.updatedAt || null,
  };
}

function safeConfig(config) {
  return {
    mode: config.mode,
    tikhubConfigured: Boolean(config.tikhubApiKey),
    accounts: config.accounts,
    updatedAt: config.updatedAt,
  };
}

function sessionSecret() {
  return String(process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || "__vercel_oidc_proxy__");
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
    const auth = await readDocument("auth");
    const users = Array.isArray(auth?.users)
      ? auth.users
      : auth?.passwordHash
        ? [{ id: auth.id || "owner", role: "Administrador", status: "Ativo" }]
        : [];
    const user = users.find(item => String(item.id) === String(session.id) && item.status !== "Inativo");
    return user?.role === "Administrador" ? user : null;
  } catch {
    return null;
  }
}

async function tikhub(path, params, apiKey) {
  const url = new URL(path, TIKHUB_BASE);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  let data;
  try { data = await response.json(); }
  catch { data = null; }
  if (!response.ok || (data && Number(data.code) >= 400)) {
    const message = data?.message || data?.detail || data?.error || `TikHub ${response.status}`;
    throw new Error(String(message));
  }
  return data || {};
}

async function validateTikHubKey(apiKey) {
  const result = await tikhub("/api/v1/tikhub/user/get_user_info", {}, apiKey);
  if (result?.user_data?.account_disabled || result?.user_data?.is_active === false) throw new Error("A conta TikHub está desativada");
  return true;
}

function deepObjects(root, limit = 3000) {
  const result = [];
  const queue = [root];
  const seen = new Set();
  while (queue.length && result.length < limit) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (Array.isArray(value)) value.forEach(item => queue.push(item));
    else Object.values(value).forEach(item => queue.push(item));
  }
  return result;
}

function firstValue(root, keys) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));
  for (const object of deepObjects(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
}

function firstArray(root, preferredKeys = []) {
  const wanted = new Set(preferredKeys.map(key => String(key).toLowerCase()));
  for (const object of deepObjects(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && Array.isArray(value) && value.length) return value;
    }
  }
  for (const object of deepObjects(root)) if (Array.isArray(object) && object.length && object.some(item => item && typeof item === "object")) return object;
  return [];
}

function recent30(items) {
  const cutoff = Date.now() / 1000 - 30 * 86400;
  const withTime = items.map(item => ({ item, time: num(firstValue(item, ["createTime", "create_time", "taken_at", "taken_at_timestamp", "publishedAt", "publish_time", "timestamp"])) })).filter(row => row.time > 0);
  if (!withTime.length) return items;
  return withTime.filter(row => row.time > 1e12 ? row.time / 1000 >= cutoff : row.time >= cutoff).map(row => row.item);
}

function contentFromItem(item, provider) {
  const id = String(firstValue(item, ["id", "aweme_id", "videoId", "video_id", "code"]) || "");
  const title = String(firstValue(item, ["title", "desc", "description", "video_description", "caption", "text", "headline"]) || "Conteúdo publicado").slice(0, 120);
  const image = firstValue(item, ["cover_image_url", "cover", "display_url", "thumbnail", "thumbnailUrl", "thumbnail_url", "coverUrl"]);
  const views = num(firstValue(item, ["playCount", "play_count", "viewCount", "view_count", "video_view_count", "video_play_count", "views"]));
  let url = firstValue(item, ["share_url", "shareUrl", "webVideoUrl", "web_url", "permalink", "url"]);
  if (!url && provider === "TikTok" && id) url = `https://www.tiktok.com/@x/video/${id}`;
  if (!url && provider === "YouTube" && id) url = `https://www.youtube.com/watch?v=${id}`;
  return { title, provider, views, image: typeof image === "string" ? image : undefined, url: typeof url === "string" ? url : undefined };
}

async function tiktokMetrics(account, apiKey) {
  const uniqueId = cleanId(account.id);
  const profileRaw = await tikhub("/api/v1/tiktok/web/fetch_user_profile", { uniqueId }, apiKey);
  const profile = profileRaw?.data?.userInfo || profileRaw?.data?.user_info || profileRaw?.data || profileRaw;
  const user = profile?.user || profile?.author || profile;
  const stats = profile?.stats || profile?.statistics || profile?.statsV2 || profile;
  const secUid = String(user?.secUid || user?.sec_uid || firstValue(profileRaw, ["secUid", "sec_uid"]) || "");
  let items = [];
  if (secUid) {
    try {
      const postsRaw = await tikhub("/api/v1/tiktok/web/fetch_user_post", { secUid, cursor: 0, count: 15, coverFormat: 2 }, apiKey);
      items = firstArray(postsRaw?.data || postsRaw, ["itemList", "item_list", "aweme_list", "items", "videos"]);
    } catch {}
  }
  const periodItems = recent30(items);
  const views = periodItems.reduce((sum, item) => sum + num(firstValue(item, ["playCount", "play_count", "view_count", "views"])), 0);
  const interactions = periodItems.reduce((sum, item) => sum
    + num(firstValue(item, ["diggCount", "digg_count", "like_count", "likes"]))
    + num(firstValue(item, ["commentCount", "comment_count", "comments"]))
    + num(firstValue(item, ["shareCount", "share_count", "shares"])), 0);
  return {
    name: "TikTok",
    handle: `@${String(user?.uniqueId || user?.unique_id || uniqueId).replace(/^@/, "")}`,
    followers: num(stats?.followerCount ?? stats?.follower_count ?? firstValue(profileRaw, ["followerCount", "follower_count"])),
    views,
    reach: num(stats?.heartCount ?? stats?.heart_count ?? stats?.likesCount ?? stats?.likes_count ?? firstValue(profileRaw, ["heartCount", "likes_count"])),
    extra: {
      interactions,
      videoCount: num(stats?.videoCount ?? stats?.video_count),
      contents: periodItems.slice(0, 10).map(item => contentFromItem(item, "TikTok")),
      source: "public",
    },
    updatedAt: new Date().toISOString(),
    source: "tikhub",
  };
}

async function instagramMetrics(account, apiKey) {
  const username = cleanId(account.id);
  const profileRaw = await tikhub("/api/v1/instagram/v3/get_user_profile", { username }, apiKey);
  const user = profileRaw?.data?.user || profileRaw?.data || profileRaw;
  let items = [];
  try {
    const postsRaw = await tikhub("/api/v1/instagram/v3/get_user_posts", { username, first: 20, count: 20 }, apiKey);
    items = firstArray(postsRaw?.data || postsRaw, ["edges", "items", "posts"]);
    items = items.map(item => item?.node || item).filter(Boolean);
  } catch {}
  const periodItems = recent30(items);
  const views = periodItems.reduce((sum, item) => sum + num(firstValue(item, ["video_view_count", "video_play_count", "play_count", "view_count", "views"])), 0);
  const interactions = periodItems.reduce((sum, item) => sum
    + num(firstValue(item, ["like_count", "likes", "edge_liked_by"]))
    + num(firstValue(item, ["comment_count", "comments", "edge_media_to_comment"])), 0);
  return {
    name: "Instagram",
    handle: `@${String(user?.username || username).replace(/^@/, "")}`,
    followers: num(user?.edge_followed_by?.count ?? user?.follower_count ?? user?.followers_count ?? firstValue(profileRaw, ["follower_count", "followers_count"])),
    views,
    reach: 0,
    extra: {
      interactions,
      media: num(user?.edge_owner_to_timeline_media?.count ?? user?.media_count),
      contents: periodItems.slice(0, 10).map(item => contentFromItem(item, "Instagram")),
      publicOnly: true,
    },
    updatedAt: new Date().toISOString(),
    source: "tikhub",
  };
}

async function youtubeMetrics(account, apiKey) {
  let channelId = String(account.id || "").trim();
  if (channelId.startsWith("@")) {
    try {
      const idRaw = await tikhub("/api/v1/youtube/web/get_channel_id", { channel_name: channelId.slice(1) }, apiKey);
      channelId = String(firstValue(idRaw, ["channel_id", "channelId", "id"]) || channelId);
    } catch {}
  }
  const profileRaw = await tikhub("/api/v1/youtube/web/get_channel_info", { channel_id: channelId }, apiKey);
  let items = [];
  try {
    const videosRaw = await tikhub("/api/v1/youtube/web/get_channel_videos_v2", { channel_id: channelId, lang: "pt-BR", sortBy: "newest", contentType: "videos" }, apiKey);
    items = firstArray(videosRaw?.data || videosRaw, ["videos", "items", "contents", "video_list"]);
  } catch {}
  const periodItems = recent30(items);
  const views = periodItems.reduce((sum, item) => sum + num(firstValue(item, ["viewCount", "view_count", "views", "viewCountText"])), 0);
  return {
    name: "YouTube",
    handle: String(firstValue(profileRaw, ["title", "channel_name", "name", "handle"]) || account.id || "YouTube"),
    followers: num(firstValue(profileRaw, ["subscriberCount", "subscriber_count", "subscribers", "subscriberCountText"])),
    views,
    reach: num(firstValue(profileRaw, ["viewCount", "view_count", "total_views"])),
    extra: {
      videoCount: num(firstValue(profileRaw, ["videoCount", "video_count"])),
      contents: periodItems.slice(0, 10).map(item => contentFromItem(item, "YouTube")),
      publicOnly: true,
    },
    updatedAt: new Date().toISOString(),
    source: "tikhub",
  };
}

async function liveMetrics(config) {
  if (config.mode !== "real" || !config.tikhubApiKey) return {};
  const cacheKey = JSON.stringify({ accounts: config.accounts, keyTail: config.tikhubApiKey.slice(-8) });
  if (metricsCache.key === cacheKey && metricsCache.expires > Date.now()) return metricsCache.value;
  const jobs = {
    tiktok: tiktokMetrics,
    instagram: instagramMetrics,
    youtube: youtubeMetrics,
  };
  const entries = await Promise.all(Object.entries(jobs).map(async ([provider, loader]) => {
    const account = config.accounts[provider];
    if (!account?.enabled || !account.id) return [provider, null];
    try { return [provider, await loader(account, config.tikhubApiKey)]; }
    catch (error) { return [provider, { error: String(error?.message || error), source: "tikhub" }]; }
  }));
  const value = Object.fromEntries(entries.filter(([, item]) => item));
  metricsCache = { key: cacheKey, expires: Date.now() + CACHE_MS, value };
  return value;
}

async function loadConfig() {
  try { return normalizeConfig(await readDocument(DOC_KEY)); }
  catch { return normalizeConfig(DEFAULT_CONFIG); }
}

export default async function handler(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const action = String(url.searchParams.get("action") || "public").toLowerCase();

  if (request.method === "GET" && action === "public") {
    const config = await loadConfig();
    const metrics = config.mode === "real" ? await liveMetrics(config) : {};
    return json(response, 200, { mode: config.mode, metrics, tikhubConfigured: Boolean(config.tikhubApiKey), accounts: config.accounts }, "public, max-age=60, stale-while-revalidate=180");
  }

  const admin = await currentAdmin(request);
  if (!admin) return json(response, 403, { error: "Apenas o administrador pode gerenciar as contas sociais" });

  if (request.method === "GET" && action === "config") {
    const config = await loadConfig();
    return json(response, 200, safeConfig(config));
  }

  if (request.method === "GET" && action === "metrics") {
    const config = await loadConfig();
    return json(response, 200, { mode: config.mode, metrics: await liveMetrics(config), ...safeConfig(config) });
  }

  if (request.method === "POST" && action === "config") {
    let body;
    try { body = await readBody(request); }
    catch { return json(response, 400, { error: "Dados inválidos" }); }

    const current = await loadConfig();
    const next = normalizeConfig({
      ...current,
      mode: body.mode === undefined ? current.mode : body.mode,
      accounts: {
        tiktok: normalizeAccount(body.accounts?.tiktok, current.accounts.tiktok),
        instagram: normalizeAccount(body.accounts?.instagram, current.accounts.instagram),
        youtube: normalizeAccount(body.accounts?.youtube, current.accounts.youtube),
      },
      tikhubApiKey: current.tikhubApiKey,
      updatedAt: new Date().toISOString(),
    });

    const suppliedKey = String(body.apiKey || "").trim();
    if (suppliedKey) {
      if (suppliedKey.length < 12 || /[\r\n\s]/.test(suppliedKey)) return json(response, 400, { error: "API Key TikHub inválida" });
      try { await validateTikHubKey(suppliedKey); }
      catch (error) { return json(response, 400, { error: `TikHub recusou a API Key: ${String(error?.message || error)}` }); }
      next.tikhubApiKey = suppliedKey;
    }

    if (next.mode === "real" && !next.tikhubApiKey) {
      const hasAnyAccount = Object.values(next.accounts).some(account => account.enabled && account.id);
      if (hasAnyAccount) return json(response, 400, { error: "Cadastre a API Key da TikHub para usar essas contas como fonte real" });
    }

    await writeDocument(DOC_KEY, next);
    metricsCache = { key: "", expires: 0, value: {} };
    return json(response, 200, { ...safeConfig(next), saved: true });
  }

  return json(response, 405, { error: "Método não permitido" });
}
