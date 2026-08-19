import { getVercelOidcToken } from '@vercel/oidc';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = 'https://kyrcukwbodzcuqkpihuf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const TIKHUB_BASE = 'https://api.tikhub.io';
const DEFAULT_WORKSPACE_ID = 'fala-62';
const OWNER_ID = 'owner';
const CACHE_MS = 180_000;
const caches = new Map();

const cleanWorkspaceId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const cleanId = value => String(value || '').trim().replace(/^@/, '').slice(0, 120);
const number = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of ['count','value','total','number','amount']) {
      if (value[key] !== undefined) {
        const nested = number(value[key]);
        if (Number.isFinite(nested)) return nested;
      }
    }
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    const match = normalized.match(/(-?[\d.]+)\s*([KMB])?/i);
    if (match) {
      const base = Number(match[1]);
      const factor = { K:1e3, M:1e6, B:1e9 }[String(match[2] || '').toUpperCase()] || 1;
      if (Number.isFinite(base)) return Math.round(base * factor);
    }
  }
  return 0;
};

function send(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 128_000) reject(new Error('payload too large'));
      else chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

async function runtimeOidcToken() {
  try {
    const token = await getVercelOidcToken();
    if (token) return token;
  } catch {}
  return process.env.VERCEL_OIDC_TOKEN || '';
}

async function proxy(path, options = {}) {
  const token = await runtimeOidcToken();
  if (!token) throw new Error('Vercel OIDC indisponível');
  const response = await fetch(PROXY_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}`, apikey:SUPABASE_PUBLISHABLE_KEY },
    body:JSON.stringify({
      path,
      method:String(options.method || 'GET').toUpperCase(),
      headers:Object.fromEntries(new Headers(options.headers || {}).entries()),
      body:options.body ?? null,
      bodyEncoding:null,
    }),
    signal:AbortSignal.timeout(15_000),
  });
  return response;
}

async function readDocument(key) {
  const response = await proxy(`/rest/v1/onda_documents?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return (await response.json())[0]?.value || {};
}

async function writeDocument(key, value) {
  const response = await proxy('/rest/v1/onda_documents?on_conflict=key', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
    body:JSON.stringify([{ key, value, updated_at:new Date().toISOString() }]),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
}

function sessionSecret() {
  return String(process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || '__vercel_oidc_proxy__');
}

function validSessionSignature(payload, supplied) {
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  const a = Buffer.from(String(supplied || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function currentAdmin(req) {
  const token = String(req.headers?.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('onda_session='))?.slice('onda_session='.length);
  const [payload, supplied] = String(token || '').split('.');
  if (!payload || !supplied || !validSessionSignature(payload, supplied)) return null;
  let session;
  try { session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!session?.id || Number(session.expires) <= Date.now()) return null;
  const auth = await readDocument('auth').catch(() => ({users:[]}));
  const user = (Array.isArray(auth?.users) ? auth.users : []).find(item => String(item.id) === String(session.id) && item.status !== 'Inativo');
  return user?.role === 'Administrador' ? user : null;
}

async function workspaceAccess(req, url, admin = null) {
  const registry = await readDocument('workspaces').catch(() => ({}));
  const workspaces = Array.isArray(registry?.workspaces) ? registry.workspaces : [{ id:DEFAULT_WORKSPACE_ID, memberIds:[OWNER_ID], status:'Ativo' }];
  const requested = cleanWorkspaceId(req.headers?.['x-onda-workspace'] || url.searchParams.get('workspace')) || cleanWorkspaceId(registry?.defaultWorkspaceId) || DEFAULT_WORKSPACE_ID;
  const workspace = workspaces.find(item => cleanWorkspaceId(item.id) === requested && item.status !== 'Arquivado') || workspaces.find(item => cleanWorkspaceId(item.id) === cleanWorkspaceId(registry?.defaultWorkspaceId)) || workspaces[0];
  if (!workspace) return null;
  if (!admin) return workspace;
  if (String(admin.id) === OWNER_ID || (Array.isArray(workspace.memberIds) && workspace.memberIds.map(String).includes(String(admin.id)))) return workspace;
  return null;
}

const configKey = workspaceId => `workspace:${workspaceId}:social_live_config`;
const DEFAULT_CONFIG = {
  mode:'demo',
  tikhubApiKey:'',
  accounts:{
    tiktok:{ id:'', enabled:true },
    instagram:{ id:'', enabled:true },
    youtube:{ id:'', enabled:true },
  },
  updatedAt:null,
};

function normalizeAccount(input, previous = { id:'', enabled:true }) {
  if (typeof input === 'string') return { id:cleanId(input), enabled:true };
  if (!input || typeof input !== 'object') return previous;
  return {
    id:input.id === undefined ? cleanId(previous.id) : cleanId(input.id),
    enabled:input.enabled === undefined ? previous.enabled !== false : Boolean(input.enabled),
  };
}

function normalizeConfig(value = {}) {
  return {
    mode:value.mode === 'real' ? 'real' : 'demo',
    tikhubApiKey:String(value.tikhubApiKey || ''),
    accounts:{
      tiktok:normalizeAccount(value.accounts?.tiktok, DEFAULT_CONFIG.accounts.tiktok),
      instagram:normalizeAccount(value.accounts?.instagram, DEFAULT_CONFIG.accounts.instagram),
      youtube:normalizeAccount(value.accounts?.youtube, DEFAULT_CONFIG.accounts.youtube),
    },
    updatedAt:value.updatedAt || null,
  };
}

function safeConfig(config) {
  return { mode:config.mode, tikhubConfigured:Boolean(config.tikhubApiKey), accounts:config.accounts, updatedAt:config.updatedAt };
}

async function loadConfig(workspaceId) {
  let value = await readDocument(configKey(workspaceId)).catch(() => ({}));
  if (!Object.keys(value || {}).length && workspaceId === DEFAULT_WORKSPACE_ID) value = await readDocument('social_live_config').catch(() => ({}));
  return normalizeConfig(value);
}

async function tikhub(path, params, apiKey) {
  const url = new URL(path, TIKHUB_BASE);
  for (const [key, value] of Object.entries(params || {})) if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers:{ Authorization:`Bearer ${apiKey}`, Accept:'application/json' },
    signal:AbortSignal.timeout(12_000),
  });
  let data = null;
  try { data = await response.json(); } catch {}
  const code = Number(data?.code);
  if (!response.ok || (Number.isFinite(code) && code >= 400)) throw new Error(String(data?.message || data?.detail || data?.error || `TikHub ${response.status}`));
  return data || {};
}

async function validateTikHubKey(apiKey) {
  const result = await tikhub('/api/v1/tikhub/user/get_user_info', {}, apiKey);
  if (result?.user_data?.account_disabled || result?.user_data?.is_active === false) throw new Error('A conta TikHub está desativada');
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
    for (const [key, value] of Object.entries(object)) if (wanted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function firstArray(root, keys) {
  const wanted = new Set(keys.map(key => String(key).toLowerCase()));
  for (const object of walk(root)) {
    if (Array.isArray(object)) continue;
    for (const [key, value] of Object.entries(object)) if (wanted.has(key.toLowerCase()) && Array.isArray(value) && value.length) return value;
  }
  return [];
}

const metric = (root, keys) => number(firstValue(root, keys));
const listViews = items => items.reduce((sum, item) => sum + metric(item, ['playCount','play_count','viewCount','view_count','video_view_count','video_play_count','views']), 0);
const listInteractions = items => items.reduce((sum, item) => sum + metric(item, ['diggCount','digg_count','likeCount','like_count','likes']) + metric(item, ['commentCount','comment_count','comments']) + metric(item, ['shareCount','share_count','shares']), 0);

async function tiktokMetrics(account, apiKey) {
  const username = cleanId(account.id);
  const profile = await tikhub('/api/v1/tiktok/web/fetch_user_profile', { uniqueId:username }, apiKey);
  const secUid = String(firstValue(profile, ['secUid','sec_uid','secUserId','sec_user_id']) || '');
  const returnedUsername = cleanId(firstValue(profile, ['uniqueId','unique_id','username']) || username);
  const followers = metric(profile, ['followerCount','follower_count','followersCount','followers_count','fans','fans_count']);
  const likes = metric(profile, ['heartCount','heart_count','heart','totalFavorited','total_favorited','likesCount','likes_count']);
  const videoCount = metric(profile, ['videoCount','video_count','awemeCount','aweme_count']);
  if (!secUid && followers === 0 && likes === 0 && videoCount === 0) throw new Error(`TikHub não retornou dados válidos para @${username}`);
  let posts = [];
  if (secUid) {
    try {
      const raw = await tikhub('/api/v1/tiktok/web/fetch_user_post', { secUid, cursor:0, count:20, coverFormat:2, post_item_list_request_type:0 }, apiKey);
      posts = firstArray(raw?.data || raw, ['itemList','item_list','awemeList','aweme_list','items','videos']);
    } catch {}
  }
  return {
    provider:'tiktok', name:'TikTok', handle:`@${returnedUsername || username}`,
    followers, views:listViews(posts), reach:likes || listInteractions(posts), likes,
    posts:videoCount || posts.length, source:'tikhub', updatedAt:new Date().toISOString(),
    extra:{ interactions:listInteractions(posts), videoCount:videoCount || posts.length, publicOnly:true },
  };
}

async function instagramMetrics(account, apiKey) {
  const username = cleanId(account.id);
  let profile = null;
  let lastError = null;
  for (const [path, params] of [
    ['/api/v1/instagram/v1/fetch_user_info_by_username_v3', { username }],
    ['/api/v1/instagram/v3/get_user_profile', { username }],
  ]) {
    try { profile = await tikhub(path, params, apiKey); break; }
    catch (error) { lastError = error; }
  }
  if (!profile) throw lastError || new Error('Não foi possível consultar o Instagram');
  const returnedUsername = cleanId(firstValue(profile, ['username']) || username);
  const followers = metric(profile, ['followerCount','follower_count','followersCount','followers_count','edge_followed_by','followers']);
  const postsCount = metric(profile, ['mediaCount','media_count','edge_owner_to_timeline_media']);
  let posts = [];
  try {
    const raw = await tikhub('/api/v1/instagram/v3/get_user_posts', { username, first:20, count:20 }, apiKey);
    posts = firstArray(raw?.data || raw, ['edges','items','posts']).map(item => item?.node || item).filter(Boolean);
  } catch {}
  if (!firstValue(profile, ['id','pk','user_id','username']) && followers === 0 && postsCount === 0) throw new Error(`TikHub não retornou dados válidos para @${username}`);
  return {
    provider:'instagram', name:'Instagram', handle:`@${returnedUsername || username}`,
    followers, views:listViews(posts), reach:listInteractions(posts), likes:listInteractions(posts),
    posts:postsCount || posts.length, source:'tikhub', updatedAt:new Date().toISOString(),
    extra:{ interactions:listInteractions(posts), media:postsCount || posts.length, publicOnly:true },
  };
}

async function youtubeMetrics(account, apiKey) {
  let channelId = String(account.id || '').trim();
  if (channelId.startsWith('@')) {
    try {
      const raw = await tikhub('/api/v1/youtube/web/get_channel_id', { channel_name:channelId.slice(1) }, apiKey);
      channelId = String(firstValue(raw, ['channel_id','channelId','id']) || channelId);
    } catch {}
  }
  const profile = await tikhub('/api/v1/youtube/web/get_channel_info', { channel_id:channelId }, apiKey);
  let videos = [];
  try {
    const raw = await tikhub('/api/v1/youtube/web/get_channel_videos_v2', { channel_id:channelId, lang:'pt-BR', sortBy:'newest', contentType:'videos' }, apiKey);
    videos = firstArray(raw?.data || raw, ['videos','items','contents','video_list']);
  } catch {}
  const followers = metric(profile, ['subscriberCount','subscriber_count','subscribers','subscriberCountText']);
  return {
    provider:'youtube', name:'YouTube', handle:String(firstValue(profile, ['title','channel_name','name','handle']) || account.id || 'YouTube'),
    followers, views:listViews(videos), reach:metric(profile, ['viewCount','view_count','total_views']), likes:0,
    posts:metric(profile, ['videoCount','video_count']) || videos.length, source:'tikhub', updatedAt:new Date().toISOString(),
    extra:{ videoCount:metric(profile, ['videoCount','video_count']) || videos.length, publicOnly:true },
  };
}

async function buildMetrics(workspaceId, config) {
  if (config.mode !== 'real' || !config.tikhubApiKey) return {};
  const cacheKey = JSON.stringify({ workspaceId, accounts:config.accounts, keyTail:config.tikhubApiKey.slice(-8) });
  const cached = caches.get(workspaceId);
  if (cached && cached.key === cacheKey && cached.until > Date.now()) return cached.value;
  const loaders = { tiktok:tiktokMetrics, instagram:instagramMetrics, youtube:youtubeMetrics };
  const entries = await Promise.all(Object.entries(loaders).map(async ([provider, loader]) => {
    const account = config.accounts[provider];
    if (!account?.enabled || !account.id) return [provider, null];
    try { return [provider, await loader(account, config.tikhubApiKey)]; }
    catch (error) { return [provider, { provider, handle:account.id ? `@${cleanId(account.id)}` : '', error:String(error?.message || error), source:'tikhub', updatedAt:new Date().toISOString() }]; }
  }));
  const value = Object.fromEntries(entries.filter(([, item]) => item));
  caches.set(workspaceId, { key:cacheKey, until:Date.now() + CACHE_MS, value });
  return value;
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const action = String(url.searchParams.get('action') || 'public').toLowerCase();
  try {
    const publicWorkspace = await workspaceAccess(req, url, null);
    if (!publicWorkspace) return send(res, 404, { error:'Espaço não encontrado' });
    const workspaceId = cleanWorkspaceId(publicWorkspace.id) || DEFAULT_WORKSPACE_ID;

    if (req.method === 'GET' && action === 'public') {
      const config = await loadConfig(workspaceId);
      const metrics = config.mode === 'real' ? await buildMetrics(workspaceId, config) : {};
      return send(res, 200, { workspace:workspaceId, mode:config.mode, metrics, tikhubConfigured:Boolean(config.tikhubApiKey), accounts:config.accounts }, 'public, max-age=30, stale-while-revalidate=90');
    }

    const admin = await currentAdmin(req);
    if (!admin) return send(res, 403, { error:'Apenas o administrador pode gerenciar as contas sociais' });
    const workspace = await workspaceAccess(req, url, admin);
    if (!workspace) return send(res, 403, { error:'Você não possui acesso a este espaço' });
    const scopedId = cleanWorkspaceId(workspace.id) || DEFAULT_WORKSPACE_ID;

    if (req.method === 'GET' && (action === 'config' || action === 'metrics')) {
      const config = await loadConfig(scopedId);
      const metrics = action === 'metrics' ? await buildMetrics(scopedId, config) : undefined;
      return send(res, 200, action === 'metrics' ? { workspace:scopedId, ...safeConfig(config), metrics } : { workspace:scopedId, ...safeConfig(config) });
    }

    if (req.method === 'POST' && action === 'config') {
      const body = await readBody(req).catch(() => null);
      if (!body) return send(res, 400, { error:'Dados inválidos' });
      const current = await loadConfig(scopedId);
      const next = normalizeConfig({
        ...current,
        mode:body.mode === undefined ? current.mode : body.mode,
        accounts:{
          tiktok:normalizeAccount(body.accounts?.tiktok, current.accounts.tiktok),
          instagram:normalizeAccount(body.accounts?.instagram, current.accounts.instagram),
          youtube:normalizeAccount(body.accounts?.youtube, current.accounts.youtube),
        },
        tikhubApiKey:current.tikhubApiKey,
        updatedAt:new Date().toISOString(),
      });
      const suppliedKey = String(body.apiKey || '').trim();
      if (suppliedKey) {
        if (suppliedKey.length < 12 || /[\r\n\s]/.test(suppliedKey)) return send(res, 400, { error:'API Key TikHub inválida' });
        try { await validateTikHubKey(suppliedKey); }
        catch (error) { return send(res, 400, { error:`TikHub recusou a API Key: ${String(error?.message || error)}` }); }
        next.tikhubApiKey = suppliedKey;
      }
      if (next.mode === 'real' && !next.tikhubApiKey && Object.values(next.accounts).some(account => account.enabled && account.id)) return send(res, 400, { error:'Cadastre a API Key da TikHub para usar dados reais' });
      await writeDocument(configKey(scopedId), next);
      caches.delete(scopedId);
      return send(res, 200, { workspace:scopedId, ...safeConfig(next), saved:true });
    }

    return send(res, 405, { error:'Método não permitido' });
  } catch (error) {
    return send(res, 500, { error:String(error?.message || error || 'Falha ao consultar métricas') });
  }
}
