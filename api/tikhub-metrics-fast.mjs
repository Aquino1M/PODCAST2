import { getVercelOidcToken } from '@vercel/oidc';

const SUPABASE_URL = 'https://kyrcukwbodzcuqkpihuf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const TIKHUB_BASE = 'https://api.tikhub.io';
const DOC_KEY = 'social_live_config';
const CACHE_MS = 180_000;
const REQUEST_TIMEOUT = 12_000;

let cache = { key: '', until: 0, value: null };

const cleanId = value => String(value || '').trim().replace(/^@/, '').slice(0, 120);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

async function oidcToken() {
  try {
    const token = await getVercelOidcToken();
    if (token) return token;
  } catch {}
  return process.env.VERCEL_OIDC_TOKEN || '';
}

async function readConfig() {
  const token = await oidcToken();
  if (!token) throw new Error('Vercel OIDC indisponível');
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      path: `/rest/v1/onda_documents?key=eq.${encodeURIComponent(DOC_KEY)}&select=value&limit=1`,
      method: 'GET',
      headers: { Accept: 'application/json' },
      body: null,
      bodyEncoding: null,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  const rows = await response.json();
  const value = rows?.[0]?.value || {};
  return {
    mode: value.mode === 'real' ? 'real' : 'demo',
    apiKey: String(value.tikhubApiKey || ''),
    accounts: {
      tiktok: { id: cleanId(value.accounts?.tiktok?.id), enabled: value.accounts?.tiktok?.enabled !== false },
      instagram: { id: cleanId(value.accounts?.instagram?.id), enabled: value.accounts?.instagram?.enabled !== false },
      youtube: { id: String(value.accounts?.youtube?.id || '').trim(), enabled: value.accounts?.youtube?.enabled !== false },
    },
  };
}

function readableError(value, fallback = 'Falha na TikHub') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const nested = value.message || value.msg || value.detail || value.error || value.description;
    if (nested && nested !== value) return readableError(nested, fallback);
    try { return JSON.stringify(value); } catch {}
  }
  return fallback;
}

async function tikhub(path, params, apiKey) {
  const url = new URL(path, TIKHUB_BASE);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  let data = null;
  try { data = await response.json(); } catch {}
  const code = Number(data?.code);
  if (!response.ok || (Number.isFinite(code) && code >= 400)) {
    throw new Error(readableError(data?.message || data?.detail || data?.error, `TikHub ${response.status}`));
  }
  return data || {};
}

function walk(root, limit = 3500) {
  const result = [];
  const queue = [root];
  const seen = new Set();
  while (queue.length && result.length < limit) {
    const item = queue.shift();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (Array.isArray(item)) item.forEach(value => queue.push(value));
    else Object.values(item).forEach(value => queue.push(value));
  }
  return result;
}

function firstValue(root, keys) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));
  for (const object of walk(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== '') return value;
    }
  }
  return undefined;
}

function firstArray(root, keys) {
  const wanted = new Set((keys || []).map(key => String(key).toLowerCase()));
  for (const object of walk(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && Array.isArray(value) && value.length) return value;
    }
  }
  return [];
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of ['count','value','total','number','amount']) {
      if (value[key] !== undefined) {
        const parsed = toNumber(value[key]);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    const match = normalized.match(/(-?[\d.]+)\s*([KMB])?/i);
    if (match) {
      const base = Number(match[1]);
      const factor = { K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || '').toUpperCase()] || 1;
      if (Number.isFinite(base)) return Math.round(base * factor);
    }
  }
  return 0;
}

const metric = (root, keys) => toNumber(firstValue(root, keys));

function listViews(items) {
  return items.reduce((sum, item) => sum + metric(item, [
    'playCount','play_count','viewCount','view_count','video_view_count','video_play_count','views'
  ]), 0);
}

function listInteractions(items) {
  return items.reduce((sum, item) => sum
    + metric(item, ['diggCount','digg_count','likeCount','like_count','likes'])
    + metric(item, ['commentCount','comment_count','comments'])
    + metric(item, ['shareCount','share_count','shares']), 0);
}

async function tiktokMetrics(account, apiKey) {
  const username = cleanId(account.id);
  const profile = await tikhub('/api/v1/tiktok/web/fetch_user_profile', { uniqueId: username }, apiKey);
  const secUid = String(firstValue(profile, ['secUid','sec_uid','secUserId','sec_user_id']) || '');
  const returnedUsername = cleanId(firstValue(profile, ['uniqueId','unique_id','username']) || username);
  const followers = metric(profile, ['followerCount','follower_count','followersCount','followers_count','fans','fans_count']);
  const likes = metric(profile, ['heartCount','heart_count','heart','totalFavorited','total_favorited','likesCount','likes_count']);
  const videoCount = metric(profile, ['videoCount','video_count','awemeCount','aweme_count']);

  if (!secUid && followers === 0 && likes === 0 && videoCount === 0) {
    throw new Error(`TikHub não retornou dados válidos para @${username}`);
  }

  let posts = [];
  if (secUid) {
    try {
      const rawPosts = await tikhub('/api/v1/tiktok/web/fetch_user_post', {
        secUid,
        cursor: 0,
        count: 20,
        coverFormat: 2,
        post_item_list_request_type: 0,
      }, apiKey);
      posts = firstArray(rawPosts?.data || rawPosts, ['itemList','item_list','awemeList','aweme_list','items','videos']);
    } catch {}
  }

  const views = listViews(posts);
  const interactions = listInteractions(posts);
  return {
    provider: 'tiktok',
    name: 'TikTok',
    handle: `@${returnedUsername || username}`,
    followers,
    views,
    reach: likes || interactions,
    likes,
    posts: videoCount || posts.length,
    source: 'tikhub',
    updatedAt: new Date().toISOString(),
  };
}

async function instagramMetrics(account, apiKey) {
  const username = cleanId(account.id);
  let profile;
  let lastError;
  const attempts = [
    ['/api/v1/instagram/v1/fetch_user_info_by_username_v3', { username }],
    ['/api/v1/instagram/v3/get_user_profile', { username }],
  ];
  for (const [path, params] of attempts) {
    try {
      profile = await tikhub(path, params, apiKey);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!profile) throw lastError || new Error('Não foi possível consultar o Instagram');

  const returnedUsername = cleanId(firstValue(profile, ['username']) || username);
  const followers = metric(profile, ['followerCount','follower_count','followersCount','followers_count','edge_followed_by','followers']);
  const posts = metric(profile, ['mediaCount','media_count','edge_owner_to_timeline_media']);
  if (!firstValue(profile, ['id','pk','user_id','username']) && followers === 0 && posts === 0) {
    throw new Error(`TikHub não retornou dados válidos para @${username}`);
  }

  return {
    provider: 'instagram',
    name: 'Instagram',
    handle: `@${returnedUsername || username}`,
    followers,
    views: 0,
    reach: 0,
    likes: 0,
    posts,
    source: 'tikhub',
    updatedAt: new Date().toISOString(),
  };
}

async function build(config) {
  if (config.mode !== 'real' || !config.apiKey) return {};
  const loaders = { tiktok: tiktokMetrics, instagram: instagramMetrics };
  const entries = await Promise.all(Object.entries(loaders).map(async ([provider, loader]) => {
    const account = config.accounts[provider];
    if (!account?.enabled || !account.id) return [provider, null];
    try {
      return [provider, await loader(account, config.apiKey)];
    } catch (error) {
      return [provider, {
        provider,
        handle: account.id ? `@${cleanId(account.id)}` : '',
        error: readableError(error?.message || error),
        source: 'tikhub',
        updatedAt: new Date().toISOString(),
      }];
    }
  }));
  return Object.fromEntries(entries);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  try {
    const config = await readConfig();
    const cacheKey = JSON.stringify({
      mode: config.mode,
      configured: Boolean(config.apiKey),
      accounts: config.accounts,
    });
    if (cache.value && cache.key === cacheKey && Date.now() < cache.until) {
      return send(res, 200, cache.value);
    }

    const metrics = await build(config);
    const value = {
      mode: config.mode,
      tikhubConfigured: Boolean(config.apiKey),
      metrics,
      accounts: config.accounts,
      cachedForSeconds: CACHE_MS / 1000,
    };
    cache = { key: cacheKey, until: Date.now() + CACHE_MS, value };
    return send(res, 200, value);
  } catch (error) {
    return send(res, 500, { error: readableError(error?.message || error, 'Falha ao consultar métricas') });
  }
}
