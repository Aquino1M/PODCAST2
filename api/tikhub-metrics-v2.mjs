import { getVercelOidcToken } from "@vercel/oidc";

const SUPABASE_URL = "https://kyrcukwbodzcuqkpihuf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e";
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const TIKHUB_BASE = "https://api.tikhub.io";
const DOC_KEY = "social_live_config";
const CACHE_MS = 120_000;

let cache = { key: "", until: 0, value: null };

const cleanId = value => String(value || "").trim().replace(/^@/, "").slice(0, 120);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

async function runtimeOidcToken() {
  try {
    const token = await getVercelOidcToken();
    if (token) return token;
  } catch {}
  return process.env.VERCEL_OIDC_TOKEN || "";
}

async function readConfig() {
  const token = await runtimeOidcToken();
  if (!token) throw new Error("Vercel OIDC indisponível");
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      path: `/rest/v1/onda_documents?key=eq.${encodeURIComponent(DOC_KEY)}&select=value&limit=1`,
      method: "GET",
      headers: { Accept: "application/json" },
      body: null,
      bodyEncoding: null,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  const rows = await response.json();
  const value = rows?.[0]?.value || {};
  return {
    mode: value.mode === "real" ? "real" : "demo",
    apiKey: String(value.tikhubApiKey || ""),
    accounts: {
      tiktok: { id: cleanId(value.accounts?.tiktok?.id), enabled: value.accounts?.tiktok?.enabled !== false },
      instagram: { id: cleanId(value.accounts?.instagram?.id), enabled: value.accounts?.instagram?.enabled !== false },
      youtube: { id: String(value.accounts?.youtube?.id || "").trim(), enabled: value.accounts?.youtube?.enabled !== false },
    },
    updatedAt: value.updatedAt || null,
  };
}

function readableError(value, fallback = "Falha na TikHub") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const nested = value.message || value.msg || value.detail || value.error || value.description;
    if (nested && nested !== value) return readableError(nested, fallback);
    try { return JSON.stringify(value); } catch {}
  }
  return fallback;
}

async function tikhub(path, params, apiKey) {
  const url = new URL(path, TIKHUB_BASE);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  let data = null;
  try { data = await response.json(); } catch {}
  const code = Number(data?.code);
  if (!response.ok || (Number.isFinite(code) && code >= 400)) {
    throw new Error(readableError(data?.message || data?.detail || data?.error, `TikHub ${response.status}`));
  }
  return data || {};
}

function objects(root, max = 4000) {
  const result = [];
  const queue = [root];
  const seen = new Set();
  while (queue.length && result.length < max) {
    const item = queue.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (Array.isArray(item)) item.forEach(value => queue.push(value));
    else Object.values(item).forEach(value => queue.push(value));
  }
  return result;
}

function firstValue(root, keys) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));
  for (const object of objects(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
}

function firstArray(root, keys = []) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));
  for (const object of objects(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && Array.isArray(value) && value.length) return value;
    }
  }
  for (const object of objects(root)) {
    if (Array.isArray(object) && object.length && object.some(item => item && typeof item === "object")) return object;
  }
  return [];
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["count", "value", "total", "number", "amount"]) {
      if (value[key] !== undefined) {
        const parsed = numberValue(value[key]);
        if (parsed) return parsed;
      }
    }
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const match = normalized.match(/(-?[\d.]+)\s*([KMB])?/i);
    if (match) {
      const base = Number(match[1]);
      const factor = { K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || "").toUpperCase()] || 1;
      if (Number.isFinite(base)) return Math.round(base * factor);
    }
  }
  return 0;
}

function metric(root, keys) {
  return numberValue(firstValue(root, keys));
}

function recent30(items) {
  const cutoff = Date.now() / 1000 - 30 * 86400;
  const rows = items.map(item => ({
    item,
    time: metric(item, ["create_time", "createTime", "taken_at", "taken_at_timestamp", "timestamp", "publish_time", "publishedAt"]),
  }));
  const withTime = rows.filter(row => row.time > 0);
  if (!withTime.length) return items;
  return withTime.filter(row => (row.time > 1e12 ? row.time / 1000 : row.time) >= cutoff).map(row => row.item);
}

function content(item, provider) {
  const id = String(firstValue(item, ["aweme_id", "id", "video_id", "videoId", "code", "shortcode"]) || "");
  const title = String(firstValue(item, ["desc", "title", "caption", "description", "text"]) || "Conteúdo publicado").slice(0, 140);
  const views = metric(item, ["play_count", "playCount", "view_count", "viewCount", "video_view_count", "video_play_count", "views"]);
  let url = firstValue(item, ["share_url", "shareUrl", "web_url", "webVideoUrl", "permalink", "url"]);
  if (!url && provider === "TikTok" && id) url = `https://www.tiktok.com/@x/video/${id}`;
  return { title, provider, views, url: typeof url === "string" ? url : undefined };
}

async function tiktokMetrics(account, apiKey) {
  const username = cleanId(account.id);
  let profileRaw;
  try {
    profileRaw = await tikhub("/api/v1/tiktok/app/v3/handler_user_profile", { unique_id: username }, apiKey);
  } catch {
    profileRaw = await tikhub("/api/v1/tiktok/web/fetch_user_profile", { uniqueId: username }, apiKey);
  }

  const secUserId = String(firstValue(profileRaw, ["sec_uid", "secUid", "sec_user_id", "secUserId"]) || "");
  let postsRaw = {};
  try {
    postsRaw = await tikhub("/api/v1/tiktok/app/v3/fetch_user_post_videos_v3", {
      sec_user_id: secUserId || undefined,
      unique_id: secUserId ? undefined : username,
      max_cursor: 0,
      count: 20,
      sort_type: 0,
    }, apiKey);
  } catch {}

  const items = firstArray(postsRaw?.data || postsRaw, ["aweme_list", "awemeList", "item_list", "itemList", "items", "videos"]);
  const period = recent30(items);
  const views = period.reduce((sum, item) => sum + metric(item, ["play_count", "playCount", "view_count", "viewCount", "views"]), 0);
  const interactions = period.reduce((sum, item) => sum
    + metric(item, ["digg_count", "diggCount", "like_count", "likes"])
    + metric(item, ["comment_count", "commentCount", "comments"])
    + metric(item, ["share_count", "shareCount", "shares"]), 0);

  return {
    name: "TikTok",
    handle: `@${String(firstValue(profileRaw, ["unique_id", "uniqueId", "username"]) || username).replace(/^@/, "")}`,
    followers: metric(profileRaw, ["follower_count", "followerCount", "fans_count", "fans", "followers_count", "followers"]),
    views,
    reach: metric(profileRaw, ["total_favorited", "heart_count", "heartCount", "likes_count", "likesCount", "digg_count"]),
    extra: {
      interactions,
      videoCount: metric(profileRaw, ["aweme_count", "video_count", "videoCount"]),
      contents: period.slice(0, 10).map(item => content(item, "TikTok")),
      source: "public",
    },
    source: "tikhub",
    updatedAt: new Date().toISOString(),
  };
}

async function instagramMetrics(account, apiKey) {
  const username = cleanId(account.id);
  let profileRaw;
  const attempts = [
    ["/api/v1/instagram/v1/fetch_user_info_by_username", { username }],
    ["/api/v1/instagram/v1/fetch_user_info_by_username_v3", { username }],
    ["/api/v1/instagram/v2/fetch_user_info", { username }],
  ];
  let lastError;
  for (const [path, params] of attempts) {
    try { profileRaw = await tikhub(path, params, apiKey); break; }
    catch (error) { lastError = error; }
  }
  if (!profileRaw) throw lastError || new Error("Não foi possível consultar o Instagram");

  const userId = String(firstValue(profileRaw, ["pk", "id", "user_id", "userId"]) || "");
  let postsRaw = {};
  try {
    postsRaw = await tikhub("/api/v1/instagram/v2/fetch_user_posts", { username }, apiKey);
  } catch {
    if (userId) {
      try { postsRaw = await tikhub("/api/v1/instagram/v1/fetch_user_posts", { user_id: userId, count: 20 }, apiKey); }
      catch {}
    }
  }

  let items = firstArray(postsRaw?.data || postsRaw, ["items", "posts", "edges", "media"]);
  items = items.map(item => item?.node || item).filter(Boolean);
  const period = recent30(items);
  const views = period.reduce((sum, item) => sum + metric(item, ["video_view_count", "video_play_count", "play_count", "view_count", "views"]), 0);
  const interactions = period.reduce((sum, item) => sum
    + metric(item, ["like_count", "likes", "edge_liked_by"])
    + metric(item, ["comment_count", "comments", "edge_media_to_comment"]), 0);

  return {
    name: "Instagram",
    handle: `@${String(firstValue(profileRaw, ["username"]) || username).replace(/^@/, "")}`,
    followers: metric(profileRaw, ["follower_count", "followers_count", "edge_followed_by", "followers"]),
    views,
    reach: interactions,
    extra: {
      interactions,
      media: metric(profileRaw, ["media_count", "edge_owner_to_timeline_media"]),
      contents: period.slice(0, 10).map(item => content(item, "Instagram")),
      source: "public",
    },
    source: "tikhub",
    updatedAt: new Date().toISOString(),
  };
}

async function youtubeMetrics(account, apiKey) {
  let channelId = String(account.id || "").trim();
  if (!channelId) throw new Error("Canal do YouTube não informado");
  if (channelId.startsWith("@")) {
    try {
      const idRaw = await tikhub("/api/v1/youtube/web/get_channel_id", { channel_name: channelId.slice(1) }, apiKey);
      channelId = String(firstValue(idRaw, ["channel_id", "channelId", "id"]) || channelId);
    } catch {}
  }
  const profileRaw = await tikhub("/api/v1/youtube/web/get_channel_info", { channel_id: channelId }, apiKey);
  let videosRaw = {};
  try {
    videosRaw = await tikhub("/api/v1/youtube/web/get_channel_videos_v2", { channel_id: channelId, lang: "pt-BR", sortBy: "newest", contentType: "videos" }, apiKey);
  } catch {}
  const items = firstArray(videosRaw?.data || videosRaw, ["videos", "items", "contents", "video_list"]);
  const period = recent30(items);
  const views = period.reduce((sum, item) => sum + metric(item, ["viewCount", "view_count", "views", "viewCountText"]), 0);
  return {
    name: "YouTube",
    handle: String(firstValue(profileRaw, ["title", "channel_name", "name", "handle"]) || account.id || "YouTube"),
    followers: metric(profileRaw, ["subscriberCount", "subscriber_count", "subscribers", "subscriberCountText"]),
    views,
    reach: metric(profileRaw, ["viewCount", "view_count", "total_views"]),
    extra: {
      videoCount: metric(profileRaw, ["videoCount", "video_count"]),
      contents: period.slice(0, 10).map(item => content(item, "YouTube")),
      source: "public",
    },
    source: "tikhub",
    updatedAt: new Date().toISOString(),
  };
}

async function buildMetrics(config) {
  if (config.mode !== "real" || !config.apiKey) return {};
  const loaders = { tiktok: tiktokMetrics, instagram: instagramMetrics, youtube: youtubeMetrics };
  const entries = await Promise.all(Object.entries(loaders).map(async ([provider, loader]) => {
    const account = config.accounts[provider];
    if (!account?.enabled || !account.id) return [provider, null];
    try { return [provider, await loader(account, config.apiKey)]; }
    catch (error) { return [provider, { error: readableError(error?.message || error), source: "tikhub" }]; }
  }));
  return Object.fromEntries(entries.filter(([, value]) => value));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido" });
  try {
    const config = await readConfig();
    const cacheKey = JSON.stringify({ mode: config.mode, accounts: config.accounts, keyTail: config.apiKey.slice(-8), updatedAt: config.updatedAt });
    if (cache.key === cacheKey && cache.until > Date.now() && cache.value) return json(res, 200, cache.value);
    const metrics = await buildMetrics(config);
    const value = {
      mode: config.mode,
      configured: Boolean(config.apiKey),
      accounts: config.accounts,
      metrics,
      updatedAt: new Date().toISOString(),
    };
    cache = { key: cacheKey, until: Date.now() + CACHE_MS, value };
    return json(res, 200, value);
  } catch (error) {
    return json(res, 500, { error: readableError(error?.message || error) });
  }
}
