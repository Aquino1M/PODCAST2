import { createServer } from "node:http";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

try { process.loadEnvFile?.(); } catch {}

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.APP_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
const dataDir = join(root, "data");
const stateFile = join(dataDir, "podcast-data.json");
const tokenFile = join(dataDir, "social-tokens.json");
const authFile = join(dataDir, "auth.json");
const envFile = join(root, ".env");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseSecret);
let supabaseAvailable = useSupabase;
const useRemote = () => useSupabase && supabaseAvailable;
const localSessionSecret = randomBytes(32).toString("hex");
const remoteDocuments = new Map([[stateFile,"state"],[tokenFile,"social_tokens"],[authFile,"auth"]]);
let runtimeSettings = {};
let settingsLoaded = false;
let metricsCache = { expires:0, value:{} };
const loginAttempts = new Map();
const scrypt = promisify(scryptCallback);
const sessionCookie = "onda_session";
const uid = () => randomBytes(12).toString("hex");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".txt":"text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".otf":"font/otf", ".json": "application/json; charset=utf-8" };
const setting = key => process.env[key] || runtimeSettings[key];

const providers = {
  youtube: {
    clientId: () => setting("YOUTUBE_CLIENT_ID"),
    clientSecret: () => setting("YOUTUBE_CLIENT_SECRET"),
  },
  instagram: {
    clientId: () => setting("INSTAGRAM_CLIENT_ID"),
    clientSecret: () => setting("INSTAGRAM_CLIENT_SECRET"),
  },
  tiktok: {
    clientId: () => setting("TIKTOK_CLIENT_KEY"),
    clientSecret: () => setting("TIKTOK_CLIENT_SECRET"),
  },
};

const requestOrigin = request => {
  if (!process.env.VERCEL) return baseUrl;
  const host=String(request.headers["x-forwarded-host"]||request.headers.host||"").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) return baseUrl;
  const protocol=String(request.headers["x-forwarded-proto"]||"https").split(",")[0]==="http"?"http":"https";
  return `${protocol}://${host}`;
};
const callbackUrl = (provider, origin) => `${origin}/api/oauth/${provider}/callback`;

const securityHeaders = type => ({
  "Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"SAMEORIGIN",
  "Referrer-Policy":"same-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":`default-src 'self'; connect-src 'self'; img-src 'self' data: blob: https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'${type.startsWith("text/html")?" 'unsafe-inline'":""}; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'`,
});
const send = (response, status, body, type = "application/json; charset=utf-8") => {
  response.writeHead(status, securityHeaders(type));
  response.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
};
const supabaseFetch = async (path, options = {}) => {
  try {
    const response = await fetch(`${supabaseUrl}${path}`, { ...options, signal:options.signal||AbortSignal.timeout(5_000), headers: { apikey:supabaseSecret, "User-Agent":"ONDA-Server/1.0", ...options.headers } });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    return response;
  } catch (error) {
    supabaseAvailable = false;
    throw error;
  }
};
const externalFetch = (url, options = {}) => fetch(url, { ...options, signal:options.signal||AbortSignal.timeout(10_000) });
const readDocument = async key => {
  const response = await supabaseFetch(`/rest/v1/onda_documents?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
  return (await response.json())[0]?.value || {};
};
// ponytail: um documento compartilhado atende a operação atual; separar por módulo se edições simultâneas começarem a sobrescrever dados.
const writeDocument = async (key, value) => supabaseFetch("/rest/v1/onda_documents?on_conflict=key", { method:"POST", headers:{ "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" }, body:JSON.stringify([{key,value,updated_at:new Date().toISOString()}]) });
const stateIds={agenda:9,guests:10,sponsors:12,programs:10,finance:6,tasks:7,members:10};
const stateCollections=Object.keys(stateIds);
const writeDocuments = rows => supabaseFetch("/rest/v1/onda_documents?on_conflict=key",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows.map(([key,value])=>({key,value,updated_at:new Date().toISOString()})))});
const ensureStateRecords = async () => {
  if(!useRemote()||(await readDocument("state_records_ready")).ready)return;
  const legacy=await readDocument("state"),rows=[];
  for(const collection of stateCollections)for(const record of Array.isArray(legacy[collection])?legacy[collection]:[]){if(!record[stateIds[collection]])record[stateIds[collection]]=uid();rows.push([`state:${collection}:${record[stateIds[collection]]}`,record])}
  rows.push(["state_records_ready",{ready:true,migratedAt:new Date().toISOString()}]);
  await writeDocuments(rows);
};
const readState = async () => {
  if(!useRemote())return readJson(stateFile);
  await ensureStateRecords();
  const response=await supabaseFetch("/rest/v1/onda_documents?key=like.state%3A%25&select=key,value"),result=Object.fromEntries(stateCollections.map(key=>[key,[]]));
  for(const item of await response.json()){const collection=item.key.split(":")[1];if(result[collection]&&Array.isArray(item.value))result[collection].push(item.value)}
  return result;
};
const replaceState = async value => {
  if(!useRemote())return writeJson(stateFile,value);
  const existing=await supabaseFetch("/rest/v1/onda_documents?key=like.state%3A%25&select=key"),keys=(await existing.json()).map(item=>item.key);
  for(const key of keys)await supabaseFetch(`/rest/v1/onda_documents?key=eq.${encodeURIComponent(key)}`,{method:"DELETE"});
  const rows=[];for(const collection of stateCollections)for(const record of value[collection]||[])rows.push([`state:${collection}:${record[stateIds[collection]]}`,record]);
  if(rows.length)await writeDocuments(rows);
};
const applyStateChanges = async changes => {
  if(useRemote()){const writes=[];for(const change of changes){const key=`state:${change.collection}:${change.id}`;if(change.deleted)await supabaseFetch(`/rest/v1/onda_documents?key=eq.${encodeURIComponent(key)}`,{method:"DELETE"});else writes.push([key,change.record])}if(writes.length)await writeDocuments(writes);return}
  const saved=await readJson(stateFile);for(const change of changes){const rows=Array.isArray(saved[change.collection])?saved[change.collection]:(saved[change.collection]=[]),index=rows.findIndex(row=>String(row[stateIds[change.collection]])===String(change.id));if(change.deleted){if(index>=0)rows.splice(index,1)}else if(index>=0)rows[index]=change.record;else rows.push(change.record)}await writeJson(stateFile,saved);
};
const loadRuntimeSettings = async () => {
  if (useRemote() && !settingsLoaded) { try { runtimeSettings = await readDocument("settings"); } catch { runtimeSettings = {}; } settingsLoaded = true; }
};
const readJson = async file => {
  if (useRemote() && remoteDocuments.has(file)) { try { return await readDocument(remoteDocuments.get(file)); } catch {} }
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return {}; }
};
const writeJson = async (file, value) => {
  if (useRemote() && remoteDocuments.has(file)) { try { return await writeDocument(remoteDocuments.get(file), value); } catch {} }
  await mkdir(dataDir, { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, file);
};
const saveEnv = async values => {
  if (useRemote()) {
    runtimeSettings = { ...runtimeSettings, ...Object.fromEntries(Object.entries(values).map(([key,value])=>[key,String(value)])) };
    settingsLoaded = true;
    await writeDocument("settings", runtimeSettings);
    return;
  }
  let lines = [];
  try { lines = (await readFile(envFile, "utf8")).split(/\r?\n/).filter(Boolean); } catch {}
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(String(value))}`;
    const index = lines.findIndex(item => item.startsWith(`${key}=`));
    if (index < 0) lines.push(line); else lines[index] = line;
    process.env[key] = String(value);
  }
  const temp = `${envFile}.tmp`;
  await writeFile(temp, `${lines.join("\n")}\n`, "utf8");
  await rename(temp, envFile);
};
const readBody = request => new Promise((resolveBody, reject) => {
  const chunks = [];
  let size = 0;
  request.on("data", chunk => { size += chunk.length; if (size > 2_000_000) reject(new Error("payload too large")); else chunks.push(chunk); });
  request.on("end", () => { try { resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new Error("invalid json")); } });
  request.on("error", reject);
});
const isValidState = value => value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(Array.isArray);
const signature = value => createHmac("sha256", process.env.SESSION_SECRET || supabaseSecret || localSessionSecret).update(value).digest("base64url");
const validSignature = (payload, supplied) => { const expected=signature(payload),a=Buffer.from(String(supplied||"")),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b) };
const sessionFrom = async request => {
  const token = request.headers.cookie?.split(";").map(item => item.trim().split("=")).find(([name]) => name === sessionCookie)?.[1];
  const [payload, supplied] = token?.split(".") || [];
  if (!payload || !supplied) return null;
  if(!validSignature(payload,supplied))return null;
  let saved;try{saved=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"))}catch{return null}
  if(saved.expires<Date.now())return null;
  const account=authData(await readJson(authFile)).users.find(user=>user.id===saved.id&&user.status!=="Inativo");
  return account?{user:publicUser(account)}:null;
};
const setSession = (response, user) => {
  const maxAge = 12 * 60 * 60;
  const payload=Buffer.from(JSON.stringify({id:user.id,expires:Date.now()+maxAge*1000})).toString("base64url"),token=`${payload}.${signature(payload)}`;
  response.setHeader("Set-Cookie", `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.VERCEL||baseUrl.startsWith("https://") ? "; Secure" : ""}`);
};
const clearSession = (request, response) => {
  response.setHeader("Set-Cookie", `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
};
const makeOauthState = (provider, origin) => { const payload=Buffer.from(JSON.stringify({provider,origin,expires:Date.now()+10*60_000,nonce:randomBytes(16).toString("hex")})).toString("base64url");return `${payload}.${signature(payload)}` };
const validOauthState = (token,provider,origin) => { const [payload,supplied]=String(token||"").split(".");if(!payload||!validSignature(payload,supplied))return false;try{const state=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));return state.provider===provider&&state.origin===origin&&state.expires>Date.now()}catch{return false} };
const passwordHash = async (password, salt) => Buffer.from(await scrypt(password, salt, 64)).toString("hex");
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const loginKey = (request,email) => `${String(request.headers["x-forwarded-for"]||request.socket?.remoteAddress||"").split(",")[0]}:${String(email).trim().toLowerCase()}`;
const loginBlocked = key => {const attempt=loginAttempts.get(key);if(!attempt||attempt.until<Date.now()){loginAttempts.delete(key);return false}return attempt.count>=5};
const failedLogin = key => {const previous=loginAttempts.get(key),fresh=!previous||previous.until<Date.now();loginAttempts.set(key,{count:fresh?1:previous.count+1,until:Date.now()+15*60_000})};
const roles = ["Administrador", "Gestor", "Colaborador", "Leitura"];
const appearanceFonts=["scholar","inter","georgia"],limitedSetting=(key,fallback,min,max)=>{const value=Number(setting(key));return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback};
const appearanceSettings=()=>({podcastName:String(setting("PODCAST_NAME")||"ONDA").trim().slice(0,40)||"ONDA",font:appearanceFonts.includes(setting("APPEARANCE_FONT"))?setting("APPEARANCE_FONT"):"scholar",letterSpacing:limitedSetting("APPEARANCE_LETTER_SPACING",.025,0,.12),wordSpacing:limitedSetting("APPEARANCE_WORD_SPACING",.16,0,.4),glow:limitedSetting("APPEARANCE_GLOW",10,0,30),glowOpacity:limitedSetting("APPEARANCE_GLOW_OPACITY",.15,0,.5),accentColor:/^#[0-9a-f]{6}$/i.test(String(setting("APPEARANCE_ACCENT_COLOR")||""))?String(setting("APPEARANCE_ACCENT_COLOR")):"#6366F1",cardRadius:limitedSetting("APPEARANCE_CARD_RADIUS",16,8,28),interfaceTheme:["light","dark","system"].includes(String(setting("APPEARANCE_INTERFACE_THEME")||""))?String(setting("APPEARANCE_INTERFACE_THEME")):"light"});
const authData = value => Array.isArray(value?.users) ? value : value?.passwordHash ? { users: [{ id: value.id || "owner", name: value.name, email: value.email, role: "Administrador", status: "Ativo", salt: value.salt, passwordHash: value.passwordHash, createdAt: value.createdAt }] } : { users: [] };
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status || "Ativo", createdAt: user.createdAt });
const htmlResult = (title, message, origin, ok = true) => `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:16px system-ui;background:#090b12;color:#f5f6fa;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:520px;padding:32px;border:1px solid #2a3040;border-radius:16px;background:#121620}h1{color:${ok ? "#63e6c5" : "#ff7288"}}a{color:#8290ff}</style><main data-origin="${origin}" data-success="${ok}"><h1>${title}</h1><p>${message}</p><a href="/">Voltar ao ONDA Studio OS</a></main><script src="/public/oauth-result.js"></script>`;

async function saveToken(provider, token) {
  const tokens = await readJson(tokenFile);
  tokens[provider] = { ...token, saved_at: Date.now() };
  await writeJson(tokenFile, tokens);
}

function authorizationUrl(provider, state, origin) {
  const config = providers[provider];
  if (!config?.clientId() || !config.clientSecret()) return null;
  const redirectUri=callbackUrl(provider,origin);
  if (provider === "youtube") {
    const params = new URLSearchParams({ client_id: config.clientId(), redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", state, scope: "https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly" });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  if (provider === "instagram") {
    const params = new URLSearchParams({ client_id: config.clientId(), redirect_uri: redirectUri, response_type: "code", state, scope: "instagram_business_basic,instagram_business_manage_insights" });
    return `https://www.instagram.com/oauth/authorize?${params}`;
  }
  const params = new URLSearchParams({ client_key: config.clientId(), redirect_uri: redirectUri, response_type: "code", state, scope: "user.info.basic,user.info.profile,user.info.stats,video.list" });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

async function exchangeCode(provider, code, origin) {
  const config = providers[provider];
  const redirectUri=callbackUrl(provider,origin);
  let url;
  let body;
  if (provider === "youtube") {
    url = "https://oauth2.googleapis.com/token";
    body = { client_id: config.clientId(), client_secret: config.clientSecret(), code, grant_type: "authorization_code", redirect_uri: redirectUri };
  } else if (provider === "instagram") {
    url = "https://api.instagram.com/oauth/access_token";
    body = { client_id: config.clientId(), client_secret: config.clientSecret(), code, grant_type: "authorization_code", redirect_uri: redirectUri };
  } else {
    url = "https://open.tiktokapis.com/v2/oauth/token/";
    body = { client_key: config.clientId(), client_secret: config.clientSecret(), code, grant_type: "authorization_code", redirect_uri: redirectUri };
  }
  const result = await externalFetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const token = await result.json();
  if (!result.ok || !token.access_token) throw new Error(token.error_description || token.message || token.error || "Falha ao obter token");
  if (provider === "instagram") {
    const longUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(config.clientSecret())}&access_token=${encodeURIComponent(token.access_token)}`;
    const longResponse = await externalFetch(longUrl);
    const longToken = await longResponse.json();
    if (longResponse.ok && longToken.access_token) Object.assign(token, longToken);
  }
  token.expires_at = Date.now() + Number(token.expires_in || 3600) * 1000;
  await saveToken(provider, token);
}

async function currentToken(provider, token) {
  if (!token?.access_token || !token.expires_at || token.expires_at > Date.now() + 60_000) return token;
  const config = providers[provider];
  let response;
  if (provider === "youtube" && token.refresh_token) {
    response = await externalFetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({ client_id:config.clientId(), client_secret:config.clientSecret(), refresh_token:token.refresh_token, grant_type:"refresh_token" }) });
  } else if (provider === "tiktok" && token.refresh_token) {
    response = await externalFetch("https://open.tiktokapis.com/v2/oauth/token/", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({ client_key:config.clientId(), client_secret:config.clientSecret(), refresh_token:token.refresh_token, grant_type:"refresh_token" }) });
  } else if (provider === "instagram") {
    response = await externalFetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token.access_token)}`);
  }
  if (!response) throw new Error("A autorização expirou. Conecte a conta novamente.");
  const fresh = await response.json();
  if (!response.ok || !fresh.access_token) throw new Error(fresh.error_description || fresh.error?.message || "Não foi possível renovar a autorização");
  const merged = { ...token, ...fresh, refresh_token:fresh.refresh_token || token.refresh_token, expires_at:Date.now()+Number(fresh.expires_in||3600)*1000 };
  await saveToken(provider, merged);
  return merged;
}

async function youtubeMetrics(token) {
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const channelResponse = await externalFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true", { headers });
  const channel = (await channelResponse.json()).items?.[0];
  if (!channel) throw new Error("Canal do YouTube não encontrado ou API Data v3 não ativada");
  const end = new Date();
  const start = new Date(end); start.setDate(start.getDate() - 30);
  const params = new URLSearchParams({ ids: "channel==MINE", startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), metrics: "views,likes,comments,estimatedMinutesWatched" });
  const analyticsResponse = await externalFetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, { headers });
  const analytics = await analyticsResponse.json();
  const row = analytics.rows?.[0] || [0, 0, 0, 0];
  let traffic={};try{const trafficParams=new URLSearchParams({ids:"channel==MINE",startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),metrics:"views",dimensions:"insightTrafficSourceType"}),trafficRows=(await (await externalFetch(`https://youtubeanalytics.googleapis.com/v2/reports?${trafficParams}`,{headers})).json()).rows||[],groups={direct:["NO_LINK_OTHER","NOTIFICATION","SUBSCRIBER"],suggested:["RELATED_VIDEO","YT_OTHER_PAGE","BROWSE_FEATURES"],search:["YT_SEARCH"],external:["EXT_URL","EXT_EMBEDDED_PLAYER"]},total=trafficRows.reduce((sum,item)=>sum+Number(item[1]||0),0);traffic=Object.fromEntries(Object.entries(groups).map(([key,types])=>[key,total?Math.round(trafficRows.filter(item=>types.includes(item[0])).reduce((sum,item)=>sum+Number(item[1]||0),0)/total*100):0]))}catch{}
  let contents=[];try{const uploads=channel.contentDetails?.relatedPlaylists?.uploads,playlist=uploads?await (await externalFetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=20`,{headers})).json():{},ids=(playlist.items||[]).map(item=>item.contentDetails?.videoId).filter(Boolean),videos=ids.length?await (await externalFetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(ids.join(","))}`,{headers})).json():{};contents=(videos.items||[]).map(item=>({title:item.snippet?.title||"Vídeo",provider:"YouTube",views:Number(item.statistics?.viewCount||0),image:item.snippet?.thumbnails?.medium?.url||item.snippet?.thumbnails?.default?.url,url:`https://www.youtube.com/watch?v=${item.id}`}))}catch{}
  return { name: "YouTube", handle: channel.snippet.title, followers: Number(channel.statistics.subscriberCount || 0), views: Number(row[0] || 0), reach: Number(row[3] || 0), extra: { likes: row[1], comments: row[2], videoCount: channel.statistics.videoCount, traffic, contents }, updatedAt: new Date().toISOString() };
}

async function tiktokMetrics(token) {
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const profileResponse = await externalFetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,profile_deep_link,follower_count,following_count,likes_count,video_count", { headers });
  const profile = (await profileResponse.json()).data?.user;
  if (!profile) throw new Error("Permissões de perfil/estatísticas do TikTok ainda não foram aprovadas");
  const videosResponse = await externalFetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,share_url,embed_link,create_time,view_count,like_count,comment_count,share_count&max_count=20", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
  const videos = (await videosResponse.json()).data?.videos || [];
  return { name: "TikTok", handle: profile.display_name, followers: Number(profile.follower_count || 0), views: videos.reduce((sum, video) => sum + Number(video.view_count || 0), 0), reach: Number(profile.likes_count || 0), extra: { following: profile.following_count, videoCount: profile.video_count, interactions:videos.reduce((sum,video)=>sum+Number(video.like_count||0)+Number(video.comment_count||0)+Number(video.share_count||0),0),contents:videos.map(video=>({title:video.title||video.video_description||"Vídeo do TikTok",provider:"TikTok",views:Number(video.view_count||0),image:video.cover_image_url,url:video.share_url||video.embed_link})) }, updatedAt: new Date().toISOString() };
}

async function instagramMetrics(token) {
  const fields = "id,username,followers_count,media_count";
  const profileResponse = await externalFetch(`https://graph.instagram.com/me?fields=${fields}&access_token=${encodeURIComponent(token.access_token)}`);
  const profile = await profileResponse.json();
  if (!profile.id) throw new Error(profile.error?.message || "Conta profissional do Instagram não encontrada");
  const insightsUrl = `https://graph.instagram.com/${profile.id}/insights?metric=views,reach,accounts_engaged,total_interactions&period=day&metric_type=total_value&access_token=${encodeURIComponent(token.access_token)}`;
  const insights = await (await externalFetch(insightsUrl)).json();
  const values = Object.fromEntries((insights.data || []).map(item => [item.name, item.total_value?.value || item.values?.at(-1)?.value || 0]));
  let contents=[];try{const media=await (await externalFetch(`https://graph.instagram.com/${profile.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count&limit=20&access_token=${encodeURIComponent(token.access_token)}`)).json();contents=(media.data||[]).map(item=>({title:String(item.caption||"Publicação do Instagram").split("\n")[0].slice(0,100),provider:"Instagram",views:Number(item.like_count||0)+Number(item.comments_count||0),image:item.thumbnail_url||item.media_url,url:item.permalink}))}catch{}
  return { name: "Instagram", handle: `@${profile.username}`, followers: Number(profile.followers_count || 0), views: Number(values.views || 0), reach: Number(values.reach || 0), extra: { interactions: values.total_interactions, engaged: values.accounts_engaged, media: profile.media_count, contents }, updatedAt: new Date().toISOString() };
}

async function socialMetrics(){
  if(metricsCache.expires>Date.now())return metricsCache.value;
  const tokens=await readJson(tokenFile),result=Object.fromEntries(await Promise.all(Object.entries(tokens).map(async([name,token])=>{try{return [name,await ({youtube:youtubeMetrics,tiktok:tiktokMetrics,instagram:instagramMetrics}[name])(await currentToken(name,token))]}catch(error){return [name,{error:error.message}]}})));
  metricsCache={expires:Date.now()+5*60_000,value:result};return result;
}

export const handler = async (request, response) => {
  try {
    const url = new URL(request.url || "/", baseUrl);
    const origin=requestOrigin(request);
    const routedPath = url.searchParams.get("path");
    const pathname = decodeURIComponent(routedPath ? `/api/${routedPath}` : url.pathname);
    await loadRuntimeSettings();
    if(["POST","PUT","PATCH","DELETE"].includes(request.method)&&request.headers.origin&&request.headers.origin!==origin)return send(response,403,{error:"Origem da solicitação não autorizada"});

    if (pathname === "/api/auth/status" && request.method === "GET") {
      const accounts = authData(await readJson(authFile));
      const session = await sessionFrom(request);
      return send(response, 200, { configured: accounts.users.length > 0, authenticated: Boolean(session), user: session?.user || null });
    }
    if (pathname === "/api/auth/setup" && request.method === "POST") {
      const existing = authData(await readJson(authFile));
      if (existing.users.length) return send(response, 409, { error: "O administrador já foi configurado" });
      const { name = "", email = "", password = "" } = await readBody(request);
      if (name.trim().length < 3) return send(response, 400, { error: "Informe seu nome completo" });
      if (!validEmail(email.trim())) return send(response, 400, { error: "Informe um e-mail válido" });
      if (password.length < 8) return send(response, 400, { error: "A senha precisa ter pelo menos 8 caracteres" });
      const salt = randomBytes(16).toString("hex");
      const account = { id: uid(), name: name.trim(), email: email.trim().toLowerCase(), role: "Administrador", status: "Ativo", salt, passwordHash: await passwordHash(password, salt), createdAt: new Date().toISOString() };
      await writeJson(authFile, { users: [account] });
      const user = publicUser(account);
      setSession(response, user);
      return send(response, 201, { ok: true, user });
    }
    if (pathname === "/api/auth/login" && request.method === "POST") {
      const { email = "", password = "" } = await readBody(request);
      const attemptKey=loginKey(request,email);
      if(loginBlocked(attemptKey))return send(response,429,{error:"Muitas tentativas. Aguarde 15 minutos e tente novamente"});
      const accounts = authData(await readJson(authFile));
      const account = accounts.users.find(user => user.email === email.trim().toLowerCase());
      if (!account?.passwordHash || account.status === "Inativo" || typeof password !== "string") {failedLogin(attemptKey);return send(response, 401, { error: "E-mail ou senha incorretos" })}
      const supplied = Buffer.from(await passwordHash(password, account.salt), "hex");
      const saved = Buffer.from(account.passwordHash, "hex");
      if (supplied.length !== saved.length || !timingSafeEqual(supplied, saved)) {failedLogin(attemptKey);return send(response, 401, { error: "E-mail ou senha incorretos" })}
      loginAttempts.delete(attemptKey);
      const user = publicUser(account);
      setSession(response, user);
      return send(response, 200, { ok: true, user });
    }
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      clearSession(request, response);
      return send(response, 200, { ok: true });
    }
    if(pathname==="/api/public/showcase"&&request.method==="GET"){
      const state=await readState(),guests=state.guests||[],sponsors=state.sponsors||[],agenda=state.agenda||[],guestNames=new Set(guests.map(item=>String(item[0]).toLowerCase())),episodes=agenda.filter(item=>guestNames.has(String(item[2]).toLowerCase())&&item[7]!=="Cancelado"&&(item[10]==="Sim"||(item[10]===undefined&&!String(item[5]).toLowerCase().includes("reunião")))).length,delivered=sponsors.reduce((sum,item)=>sum+Number(item[7]||0),0),planned=sponsors.reduce((sum,item)=>sum+Number(item[8]||0),0),metrics=await socialMetrics();
      return send(response,200,{episodes,guestCount:guests.length,deliveryRate:planned?Math.round(delivered/planned*100):0,metrics:Object.fromEntries(Object.entries(metrics).filter(([,value])=>!value.error).map(([key,value])=>[key,{name:value.name,followers:value.followers,views:value.views,reach:value.reach,extra:value.extra,updatedAt:value.updatedAt}])),guests:guests.slice(0,8).map(item=>({name:item[0],initials:item[1],category:item[2],next:item[7],photo:item[13]})),sponsors:sponsors.filter(item=>item[4]!=="Encerrado").slice(0,8).map(item=>({name:item[0],initials:item[1],logo:item[15]}))});
    }
    if(pathname==="/api/appearance"&&request.method==="GET"){await loadRuntimeSettings();return send(response,200,appearanceSettings())}

    const oauthCallback = /^\/api\/oauth\/(youtube|instagram|tiktok)\/callback$/.test(pathname);
    const session = await sessionFrom(request);
    if (pathname.startsWith("/api/") && !oauthCallback && !session) return send(response, 401, { error: "Faça login para continuar" });

    if (pathname === "/api/users" && request.method === "GET") {
      if (session.user.role !== "Administrador") return send(response, 403, { error: "Apenas o administrador gerencia acessos" });
      return send(response, 200, authData(await readJson(authFile)).users.map(publicUser));
    }
    if(pathname==="/api/appearance"&&request.method==="POST"){
      if(session.user.role!=="Administrador")return send(response,403,{error:"Apenas o administrador configura a aparência"});
      const body=await readBody(request),podcastName=String(body.podcastName||"").trim(),font=String(body.font||""),letterSpacing=Number(body.letterSpacing),wordSpacing=Number(body.wordSpacing),glow=Number(body.glow),glowOpacity=Number(body.glowOpacity),accentColor=String(body.accentColor||""),cardRadius=Number(body.cardRadius),interfaceTheme=String(body.interfaceTheme||"");
      if(podcastName.length<2||podcastName.length>40||/[<>\r\n]/.test(podcastName)||!appearanceFonts.includes(font)||![letterSpacing,wordSpacing,glow,glowOpacity,cardRadius].every(Number.isFinite)||letterSpacing<0||letterSpacing>.12||wordSpacing<0||wordSpacing>.4||glow<0||glow>30||glowOpacity<0||glowOpacity>.5||cardRadius<8||cardRadius>28||!/^#[0-9a-f]{6}$/i.test(accentColor)||!["light","dark","system"].includes(interfaceTheme))return send(response,400,{error:"Configuração de aparência inválida"});
      await saveEnv({PODCAST_NAME:podcastName,APPEARANCE_FONT:font,APPEARANCE_LETTER_SPACING:letterSpacing,APPEARANCE_WORD_SPACING:wordSpacing,APPEARANCE_GLOW:glow,APPEARANCE_GLOW_OPACITY:glowOpacity,APPEARANCE_ACCENT_COLOR:accentColor,APPEARANCE_CARD_RADIUS:cardRadius,APPEARANCE_INTERFACE_THEME:interfaceTheme});return send(response,200,appearanceSettings());
    }
    if (pathname === "/api/users" && request.method === "POST") {
      if (session.user.role !== "Administrador") return send(response, 403, { error: "Apenas o administrador gerencia acessos" });
      const { name = "", email = "", password = "", role = "Colaborador" } = await readBody(request);
      if (name.trim().length < 3 || !validEmail(email.trim()) || password.length < 8 || !roles.includes(role)) return send(response, 400, { error: "Preencha nome, e-mail, cargo de acesso e senha com 8 caracteres" });
      const accounts = authData(await readJson(authFile));
      if (accounts.users.some(user => user.email === email.trim().toLowerCase())) return send(response, 409, { error: "Este e-mail já possui acesso" });
      const salt = randomBytes(16).toString("hex"), user = { id: uid(), name: name.trim(), email: email.trim().toLowerCase(), role, status: "Ativo", salt, passwordHash: await passwordHash(password, salt), createdAt: new Date().toISOString() };
      accounts.users.push(user);await writeJson(authFile, accounts);return send(response, 201, publicUser(user));
    }
    const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && request.method === "PUT") {
      if (session.user.role !== "Administrador") return send(response, 403, { error: "Apenas o administrador gerencia acessos" });
      const accounts = authData(await readJson(authFile)),user=accounts.users.find(item=>item.id===userMatch[1]);if(!user)return send(response,404,{error:"Usuário não encontrado"});
      const body=await readBody(request),email=String(body.email||user.email).trim().toLowerCase(),role=body.role||user.role,status=body.status||user.status;
      if(!validEmail(email)||!roles.includes(role)||accounts.users.some(item=>item.id!==user.id&&item.email===email))return send(response,400,{error:"E-mail ou nível de acesso inválido"});
      if(user.role==="Administrador"&&role!=="Administrador"&&accounts.users.filter(item=>item.role==="Administrador"&&item.status!=="Inativo").length===1)return send(response,400,{error:"O sistema precisa manter pelo menos um administrador"});
      Object.assign(user,{name:String(body.name||user.name).trim(),email,role,status});if(body.password){if(body.password.length<8)return send(response,400,{error:"A nova senha precisa ter 8 caracteres"});user.salt=randomBytes(16).toString("hex");user.passwordHash=await passwordHash(body.password,user.salt)}
      await writeJson(authFile,accounts);return send(response,200,publicUser(user));
    }
    if (userMatch && request.method === "DELETE") {
      if (session.user.role !== "Administrador") return send(response, 403, { error: "Apenas o administrador gerencia acessos" });
      if(userMatch[1]===session.user.id)return send(response,400,{error:"Você não pode apagar seu próprio acesso"});
      const accounts=authData(await readJson(authFile)),index=accounts.users.findIndex(item=>item.id===userMatch[1]);if(index<0)return send(response,404,{error:"Usuário não encontrado"});accounts.users.splice(index,1);await writeJson(authFile,accounts);return send(response,200,{ok:true});
    }

    if (pathname === "/api/state" && request.method === "GET") return send(response, 200, await readState());
    if (pathname === "/api/state" && request.method === "PUT") {
      if (session.user.role === "Leitura") return send(response, 403, { error: "Seu acesso permite apenas visualizar os dados" });
      const state = await readBody(request);
      if (!isValidState(state)) return send(response, 400, { error: "Estrutura de dados inválida" });
      await replaceState(state);
      return send(response, 200, { ok: true, savedAt: new Date().toISOString() });
    }
    if(pathname==="/api/state/changes"&&request.method==="POST"){
      if(session.user.role==="Leitura")return send(response,403,{error:"Seu acesso permite apenas visualizar os dados"});
      const {changes=[]}=await readBody(request);
      if(!Array.isArray(changes)||changes.length<1||changes.length>20||changes.some(change=>!stateCollections.includes(change?.collection)||!String(change.id||"")||(!change.deleted&&(!Array.isArray(change.record)||String(change.record[stateIds[change.collection]])!==String(change.id)))))return send(response,400,{error:"Alterações inválidas"});
      await applyStateChanges(changes);return send(response,200,{ok:true,savedAt:new Date().toISOString()});
    }
    if (pathname === "/api/uploads" && request.method === "POST") {
      if (session.user.role === "Leitura") return send(response, 403, { error: "Seu acesso permite apenas visualizar os dados" });
      const { data = "" } = await readBody(request),match=String(data).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if(!match)return send(response,400,{error:"Envie uma imagem PNG, JPG ou WebP"});
      const file=Buffer.from(match[2],"base64");
      if(file.length>1_800_000)return send(response,400,{error:"A imagem precisa ter menos de 1,8 MB"});
      const name=`${randomBytes(12).toString("hex")}.${match[1]==="jpeg"?"jpg":match[1]}`;
      if(useRemote()){await supabaseFetch(`/storage/v1/object/podcast-media/${name}`,{method:"POST",headers:{"Content-Type":`image/${match[1]}`,"x-upsert":"false"},body:file});return send(response,201,{url:`${supabaseUrl}/storage/v1/object/public/podcast-media/${name}`})}
      const folder=join(root,"public","uploads");await mkdir(folder,{recursive:true});await writeFile(join(folder,name),file);return send(response,201,{url:`/public/uploads/${name}`});
    }
    if (pathname === "/api/social/status" && request.method === "GET") {
      const tokens = await readJson(tokenFile);
      return send(response, 200, Object.fromEntries(Object.entries(providers).map(([name, config]) => [name, { configured: Boolean(config.clientId() && config.clientSecret()), connected: Boolean(tokens[name]?.access_token), requiresHttps: name === "tiktok", callback: callbackUrl(name,origin) }])));
    }
    if (pathname === "/api/social/settings" && request.method === "POST") {
      if (session.user.role !== "Administrador") return send(response, 403, { error: "Apenas o administrador configura integrações" });
      const { provider, clientId = "", clientSecret = "" } = await readBody(request);
      const keys = { youtube:["YOUTUBE_CLIENT_ID","YOUTUBE_CLIENT_SECRET"], instagram:["INSTAGRAM_CLIENT_ID","INSTAGRAM_CLIENT_SECRET"], tiktok:["TIKTOK_CLIENT_KEY","TIKTOK_CLIENT_SECRET"] }[provider];
      const id=String(clientId).trim(),secret=String(clientSecret).trim();
      if (!keys || id.length < 3 || secret.length < 3 || /[\r\n]/.test(id + secret)) return send(response, 400, { error: "Informe o App ID e o App Secret oficiais" });
      if(provider==="youtube"&&!id.endsWith(".apps.googleusercontent.com"))return send(response,400,{error:"Use o ID do cliente OAuth para Aplicativo da Web criado no Google Cloud"});
      if(provider==="tiktok"&&id.includes("googleusercontent.com"))return send(response,400,{error:"Essa é uma chave do Google. Informe a Client Key criada no TikTok for Developers"});
      await saveEnv({ [keys[0]]:id, [keys[1]]:secret });
      metricsCache={expires:0,value:{}};
      return send(response, 200, { ok:true, provider, callback:callbackUrl(provider,origin) });
    }
    if (pathname === "/api/social/metrics" && request.method === "GET") {
      return send(response,200,await socialMetrics());
    }
    const startMatch = pathname.match(/^\/api\/oauth\/(youtube|instagram|tiktok)\/start$/);
    if (startMatch && request.method === "GET") {
      const provider = startMatch[1];
      const state = makeOauthState(provider,origin);
      const destination = authorizationUrl(provider, state,origin);
      if (!destination) return send(response, 503, htmlResult("Configuração necessária", `Preencha as credenciais de ${provider} antes de conectar.`,origin, false), "text/html; charset=utf-8");
      if (provider === "tiktok" && !origin.startsWith("https://")) return send(response, 503, htmlResult("HTTPS necessário", "O TikTok exige uma URL HTTPS cadastrada. Abra o sistema pelo domínio publicado.",origin, false), "text/html; charset=utf-8");
      if(provider==="tiktok"&&providers.tiktok.clientId().includes("googleusercontent.com"))return send(response,400,htmlResult("Client Key incorreta","A credencial salva pertence ao Google. Reconfigure o TikTok usando a Client Key do TikTok for Developers.",origin,false),"text/html; charset=utf-8");
      response.writeHead(302, { Location: destination }); return response.end();
    }
    const callbackMatch = pathname.match(/^\/api\/oauth\/(youtube|instagram|tiktok)\/callback$/);
    if (callbackMatch && request.method === "GET") {
      const provider = callbackMatch[1];
      if (!validOauthState(url.searchParams.get("state"),provider,origin)) return send(response, 400, htmlResult("Conexão recusada", "A sessão de autorização expirou ou é inválida.",origin, false), "text/html; charset=utf-8");
      await exchangeCode(provider, url.searchParams.get("code"),origin);metricsCache={expires:0,value:{}};
      return send(response, 200, htmlResult("Conta conectada", `A conta ${provider} foi autorizada. As métricas serão atualizadas no painel.`,origin), "text/html; charset=utf-8");
    }

    const isPublicFile = pathname === "/" || pathname === "/index.html" || pathname === "/app.js" || pathname === "/app/globals.css" || pathname === "/tiktoklSoKQMn2CNiRPQJWxyukHqLjjwxHYM09.txt" || pathname.startsWith("/public/");
    if (!isPublicFile) throw new Error("not public");
    const file = resolve(join(root, pathname === "/" ? "index.html" : pathname.slice(1)));
    if (file !== root && !file.startsWith(root + sep)) throw new Error("invalid path");
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const type=mime[extname(file)]||"application/octet-stream";response.writeHead(200,securityHeaders(type));
    response.end(await readFile(file));
  } catch (error) {
    if (request.url?.startsWith("/api/")) return send(response, 500, { error: error.message || "Erro interno" });
    send(response, 404, "Não encontrado", "text/plain; charset=utf-8");
  }
};

if (!process.env.VERCEL) createServer(handler).listen(port, "127.0.0.1", () => console.log(`ONDA Studio OS: ${baseUrl}`));
