import { getVercelOidcToken } from '@vercel/oidc';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const SUPABASE_URL = 'https://kyrcukwbodzcuqkpihuf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NuE7UwPOwkEPo0-QqdNaNg_Vwvtwk6e';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/onda-vercel-proxy`;
const REGISTRY_KEY = 'workspaces';
const DEFAULT_WORKSPACE_ID = 'fala-62';
const OWNER_ID = 'owner';
const STATE_IDS = { agenda:9, guests:10, sponsors:12, programs:10, finance:6, tasks:7, members:10 };
const STATE_COLLECTIONS = Object.keys(STATE_IDS);
const DEFAULT_APPEARANCE = {
  PODCAST_NAME:'FALA 62',
  APPEARANCE_FONT:'scholar',
  APPEARANCE_LETTER_SPACING:'0.025',
  APPEARANCE_WORD_SPACING:'0.16',
  APPEARANCE_GLOW:'10',
  APPEARANCE_GLOW_OPACITY:'0.15',
  APPEARANCE_ACCENT_COLOR:'#6366F1',
  APPEARANCE_CARD_RADIUS:'16',
  APPEARANCE_INTERFACE_THEME:'light',
};

const cleanWorkspaceId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const cleanName = value => String(value || '').replace(/[<>\r\n]/g, '').trim().slice(0, 60);
const uid = () => randomBytes(8).toString('hex');

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
      if (size > 512_000) reject(new Error('payload too large'));
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
  const oidcToken = await runtimeOidcToken();
  if (!oidcToken) throw new Error('Vercel OIDC indisponível');
  const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
  const response = await fetch(PROXY_URL, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${oidcToken}`,
      apikey:SUPABASE_PUBLISHABLE_KEY,
    },
    body:JSON.stringify({
      path,
      method:String(options.method || 'GET').toUpperCase(),
      headers,
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

async function writeDocuments(rows) {
  if (!rows.length) return;
  const response = await proxy('/rest/v1/onda_documents?on_conflict=key', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
    body:JSON.stringify(rows.map(([key, value]) => ({ key, value, updated_at:new Date().toISOString() }))),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
}

async function listDocuments(prefix) {
  const response = await proxy(`/rest/v1/onda_documents?key=like.${encodeURIComponent(prefix + '%')}&select=key,value&order=key.asc`);
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.json();
}

async function deleteDocument(key) {
  const response = await proxy(`/rest/v1/onda_documents?key=eq.${encodeURIComponent(key)}`, { method:'DELETE' });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
}

async function deletePrefix(prefix) {
  const rows = await listDocuments(prefix);
  for (const item of rows) await deleteDocument(item.key);
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

async function currentUser(req) {
  const rawCookie = String(req.headers?.cookie || '');
  const token = rawCookie.split(';').map(item => item.trim()).find(item => item.startsWith('onda_session='))?.slice('onda_session='.length);
  const [payload, supplied] = String(token || '').split('.');
  if (!payload || !supplied || !validSessionSignature(payload, supplied)) return null;
  let session;
  try { session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!session?.id || Number(session.expires) <= Date.now()) return null;
  const auth = await readDocument('auth');
  const users = Array.isArray(auth?.users) ? auth.users : [];
  const user = users.find(item => String(item.id) === String(session.id) && item.status !== 'Inativo');
  return user ? { id:user.id, name:user.name, email:user.email, role:user.role, status:user.status || 'Ativo' } : null;
}

function normalizeRegistry(value, authUsers = []) {
  const raw = Array.isArray(value?.workspaces) ? value.workspaces : [];
  const workspaces = raw.map(item => ({
    id:cleanWorkspaceId(item?.id),
    name:cleanName(item?.name) || 'Podcast',
    ownerId:String(item?.ownerId || OWNER_ID),
    memberIds:Array.isArray(item?.memberIds) ? [...new Set(item.memberIds.map(String))] : [],
    status:item?.status === 'Arquivado' ? 'Arquivado' : 'Ativo',
    createdAt:item?.createdAt || new Date().toISOString(),
    updatedAt:item?.updatedAt || null,
  })).filter(item => item.id);

  if (!workspaces.length) {
    const activeUsers = authUsers.filter(user => user?.status !== 'Inativo').map(user => String(user.id));
    workspaces.push({
      id:DEFAULT_WORKSPACE_ID,
      name:'FALA 62',
      ownerId:OWNER_ID,
      memberIds:[...new Set([OWNER_ID, ...activeUsers])],
      status:'Ativo',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    });
  }
  return {
    version:1,
    defaultWorkspaceId:cleanWorkspaceId(value?.defaultWorkspaceId) || workspaces[0].id,
    workspaces,
  };
}

async function loadRegistry({ persist = true } = {}) {
  const [saved, auth] = await Promise.all([readDocument(REGISTRY_KEY).catch(() => ({})), readDocument('auth').catch(() => ({users:[]}))]);
  const registry = normalizeRegistry(saved, Array.isArray(auth?.users) ? auth.users : []);
  if (persist && (!Array.isArray(saved?.workspaces) || !saved.workspaces.length)) await writeDocument(REGISTRY_KEY, registry);
  return registry;
}

function workspaceFromRequest(req, url, registry, user = null) {
  const requested = cleanWorkspaceId(req.headers?.['x-onda-workspace'] || url.searchParams.get('workspace'));
  const allowed = user?.id === OWNER_ID
    ? registry.workspaces
    : registry.workspaces.filter(item => item.memberIds.includes(String(user?.id || '')));
  const activeAllowed = allowed.filter(item => item.status !== 'Arquivado');
  if (requested) {
    const exact = activeAllowed.find(item => item.id === requested);
    if (exact) return exact;
  }
  return activeAllowed.find(item => item.id === registry.defaultWorkspaceId) || activeAllowed[0] || null;
}

const workspaceKey = (workspaceId, suffix) => `workspace:${workspaceId}:${suffix}`;

async function ensureWorkspaceInitialized(workspace) {
  const markerKey = workspaceKey(workspace.id, 'initialized');
  const marker = await readDocument(markerKey).catch(() => ({}));
  if (marker?.ready) return;

  const rows = [];
  if (workspace.id === DEFAULT_WORKSPACE_ID) {
    const legacyState = await listDocuments('state:').catch(() => []);
    for (const item of legacyState) rows.push([workspaceKey(workspace.id, item.key), item.value]);

    const [settings, footer, social] = await Promise.all([
      readDocument('settings').catch(() => ({})),
      readDocument('appearance_footer_text').catch(() => ({})),
      readDocument('social_live_config').catch(() => ({})),
    ]);
    rows.push([workspaceKey(workspace.id, 'settings'), Object.keys(settings || {}).length ? settings : { ...DEFAULT_APPEARANCE, PODCAST_NAME:workspace.name }]);
    if (Object.keys(footer || {}).length) rows.push([workspaceKey(workspace.id, 'appearance_footer_text'), footer]);
    if (Object.keys(social || {}).length) rows.push([workspaceKey(workspace.id, 'social_live_config'), social]);
  } else {
    rows.push([workspaceKey(workspace.id, 'settings'), { ...DEFAULT_APPEARANCE, PODCAST_NAME:workspace.name }]);
    rows.push([workspaceKey(workspace.id, 'appearance_footer_text'), { text:`WWW.${workspace.name.replace(/\s+/g, '').toUpperCase()}.COM` }]);
  }
  rows.push([markerKey, { ready:true, initializedAt:new Date().toISOString() }]);
  await writeDocuments(rows);
}

function emptyState() {
  return Object.fromEntries(STATE_COLLECTIONS.map(key => [key, []]));
}

async function readState(workspace) {
  await ensureWorkspaceInitialized(workspace);
  const prefix = workspaceKey(workspace.id, 'state:');
  const rows = await listDocuments(prefix);
  const result = emptyState();
  for (const item of rows) {
    const parts = item.key.slice(prefix.length).split(':');
    const collection = parts[0];
    if (result[collection] && Array.isArray(item.value)) result[collection].push(item.value);
  }
  return result;
}

function validState(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && STATE_COLLECTIONS.every(key => !value[key] || Array.isArray(value[key]));
}

async function replaceState(workspace, value) {
  await ensureWorkspaceInitialized(workspace);
  const prefix = workspaceKey(workspace.id, 'state:');
  await deletePrefix(prefix);
  const rows = [];
  for (const collection of STATE_COLLECTIONS) {
    for (const record of Array.isArray(value[collection]) ? value[collection] : []) {
      let id = record?.[STATE_IDS[collection]];
      if (!id) {
        id = `${Date.now().toString(36)}-${uid().slice(0, 6)}`;
        record[STATE_IDS[collection]] = id;
      }
      rows.push([`${prefix}${collection}:${id}`, record]);
    }
  }
  await writeDocuments(rows);
}

async function applyStateChanges(workspace, changes) {
  await ensureWorkspaceInitialized(workspace);
  const writes = [];
  for (const change of changes) {
    const key = workspaceKey(workspace.id, `state:${change.collection}:${change.id}`);
    if (change.deleted) await deleteDocument(key);
    else writes.push([key, change.record]);
  }
  await writeDocuments(writes);
}

function appearanceFromSettings(settings = {}, workspaceName = 'ONDA') {
  const number = (key, fallback, min, max) => {
    const value = Number(settings[key]);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  };
  const font = ['scholar','inter','georgia'].includes(settings.APPEARANCE_FONT) ? settings.APPEARANCE_FONT : 'scholar';
  const theme = ['light','dark','system'].includes(settings.APPEARANCE_INTERFACE_THEME) ? settings.APPEARANCE_INTERFACE_THEME : 'light';
  const accent = /^#[0-9a-f]{6}$/i.test(String(settings.APPEARANCE_ACCENT_COLOR || '')) ? String(settings.APPEARANCE_ACCENT_COLOR) : '#6366F1';
  return {
    podcastName:cleanName(settings.PODCAST_NAME) || workspaceName,
    font,
    letterSpacing:number('APPEARANCE_LETTER_SPACING', .025, 0, .12),
    wordSpacing:number('APPEARANCE_WORD_SPACING', .16, 0, .4),
    glow:number('APPEARANCE_GLOW', 10, 0, 30),
    glowOpacity:number('APPEARANCE_GLOW_OPACITY', .15, 0, .5),
    accentColor:accent,
    cardRadius:number('APPEARANCE_CARD_RADIUS', 16, 8, 28),
    interfaceTheme:theme,
  };
}

async function readAppearance(workspace) {
  await ensureWorkspaceInitialized(workspace);
  const settings = await readDocument(workspaceKey(workspace.id, 'settings')).catch(() => ({}));
  return appearanceFromSettings(settings, workspace.name);
}

async function writeAppearance(workspace, body) {
  const current = await readDocument(workspaceKey(workspace.id, 'settings')).catch(() => ({}));
  const podcastName = cleanName(body.podcastName);
  const font = String(body.font || '');
  const letterSpacing = Number(body.letterSpacing);
  const wordSpacing = Number(body.wordSpacing);
  const glow = Number(body.glow);
  const glowOpacity = Number(body.glowOpacity);
  const accentColor = String(body.accentColor || '');
  const cardRadius = Number(body.cardRadius);
  const interfaceTheme = String(body.interfaceTheme || '');
  if (podcastName.length < 2 || !['scholar','inter','georgia'].includes(font) || ![letterSpacing,wordSpacing,glow,glowOpacity,cardRadius].every(Number.isFinite) || letterSpacing < 0 || letterSpacing > .12 || wordSpacing < 0 || wordSpacing > .4 || glow < 0 || glow > 30 || glowOpacity < 0 || glowOpacity > .5 || cardRadius < 8 || cardRadius > 28 || !/^#[0-9a-f]{6}$/i.test(accentColor) || !['light','dark','system'].includes(interfaceTheme)) {
    throw new Error('Configuração de aparência inválida');
  }
  const next = {
    ...current,
    PODCAST_NAME:podcastName,
    APPEARANCE_FONT:font,
    APPEARANCE_LETTER_SPACING:String(letterSpacing),
    APPEARANCE_WORD_SPACING:String(wordSpacing),
    APPEARANCE_GLOW:String(glow),
    APPEARANCE_GLOW_OPACITY:String(glowOpacity),
    APPEARANCE_ACCENT_COLOR:accentColor,
    APPEARANCE_CARD_RADIUS:String(cardRadius),
    APPEARANCE_INTERFACE_THEME:interfaceTheme,
  };
  await writeDocument(workspaceKey(workspace.id, 'settings'), next);
  return appearanceFromSettings(next, workspace.name);
}

async function showcase(workspace) {
  const state = await readState(workspace);
  const guests = state.guests || [];
  const sponsors = state.sponsors || [];
  const agenda = state.agenda || [];
  const guestNames = new Set(guests.map(item => String(item[0] || '').toLowerCase()));
  const episodes = agenda.filter(item => guestNames.has(String(item[2] || '').toLowerCase()) && item[7] !== 'Cancelado' && (item[10] === 'Sim' || (item[10] === undefined && !String(item[5] || '').toLowerCase().includes('reunião')))).length;
  const delivered = sponsors.reduce((sum, item) => sum + Number(item[7] || 0), 0);
  const planned = sponsors.reduce((sum, item) => sum + Number(item[8] || 0), 0);
  return {
    workspace:{ id:workspace.id, name:workspace.name },
    episodes,
    guestCount:guests.length,
    deliveryRate:planned ? Math.round(delivered / planned * 100) : 0,
    metrics:{},
    guests:guests.slice(0, 8).map(item => ({ name:item[0], initials:item[1], category:item[2], next:item[7], photo:item[13] })),
    sponsors:sponsors.filter(item => item[4] !== 'Encerrado').slice(0, 8).map(item => ({ name:item[0], initials:item[1], logo:item[15] })),
  };
}

async function usersPublic() {
  const auth = await readDocument('auth').catch(() => ({users:[]}));
  return (Array.isArray(auth?.users) ? auth.users : []).map(user => ({ id:user.id, name:user.name, email:user.email, role:user.role, status:user.status || 'Ativo' }));
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const action = String(url.searchParams.get('action') || 'list').toLowerCase();

  try {
    const registry = await loadRegistry();

    if (req.method === 'GET' && action === 'showcase') {
      const requested = cleanWorkspaceId(req.headers?.['x-onda-workspace'] || url.searchParams.get('workspace'));
      const workspace = registry.workspaces.find(item => item.id === requested && item.status !== 'Arquivado') || registry.workspaces.find(item => item.id === registry.defaultWorkspaceId) || registry.workspaces[0];
      if (!workspace) return send(res, 404, { error:'Espaço não encontrado' });
      return send(res, 200, await showcase(workspace), 'public, max-age=30, stale-while-revalidate=90');
    }

    if (req.method === 'GET' && action === 'appearance') {
      const requested = cleanWorkspaceId(req.headers?.['x-onda-workspace'] || url.searchParams.get('workspace'));
      const workspace = registry.workspaces.find(item => item.id === requested && item.status !== 'Arquivado') || registry.workspaces.find(item => item.id === registry.defaultWorkspaceId) || registry.workspaces[0];
      if (!workspace) return send(res, 404, { error:'Espaço não encontrado' });
      return send(res, 200, await readAppearance(workspace), 'public, max-age=30, stale-while-revalidate=90');
    }

    if (req.method === 'GET' && action === 'footer-text') {
      const requested = cleanWorkspaceId(req.headers?.['x-onda-workspace'] || url.searchParams.get('workspace'));
      const workspace = registry.workspaces.find(item => item.id === requested && item.status !== 'Arquivado') || registry.workspaces.find(item => item.id === registry.defaultWorkspaceId) || registry.workspaces[0];
      if (!workspace) return send(res, 404, { error:'Espaço não encontrado' });
      await ensureWorkspaceInitialized(workspace);
      const value = await readDocument(workspaceKey(workspace.id, 'appearance_footer_text')).catch(() => ({}));
      return send(res, 200, { text:String(value?.text || 'WWW.AQUINOCAST.COM').slice(0, 80) }, 'public, max-age=30, stale-while-revalidate=90');
    }

    const user = await currentUser(req);
    if (!user) return send(res, 401, { error:'Faça login para continuar' });
    const workspace = workspaceFromRequest(req, url, registry, user);

    if (action === 'list' && req.method === 'GET') {
      const visible = user.id === OWNER_ID ? registry.workspaces : registry.workspaces.filter(item => item.memberIds.includes(String(user.id)));
      return send(res, 200, {
        owner:user.id === OWNER_ID,
        current:workspace?.id || null,
        workspaces:visible.map(item => ({ id:item.id, name:item.name, status:item.status, owner:item.ownerId === user.id, memberCount:item.memberIds.length })),
      });
    }

    if (!workspace) return send(res, 403, { error:'Você não possui acesso a este espaço' });

    if (action === 'state' && req.method === 'GET') return send(res, 200, await readState(workspace));
    if (action === 'state' && req.method === 'PUT') {
      if (user.role === 'Leitura') return send(res, 403, { error:'Seu acesso permite apenas visualizar os dados' });
      const body = await readBody(req);
      if (!validState(body)) return send(res, 400, { error:'Estrutura de dados inválida' });
      await replaceState(workspace, body);
      return send(res, 200, { ok:true, workspace:workspace.id, savedAt:new Date().toISOString() });
    }

    if (action === 'state-changes' && req.method === 'POST') {
      if (user.role === 'Leitura') return send(res, 403, { error:'Seu acesso permite apenas visualizar os dados' });
      const { changes = [] } = await readBody(req);
      const invalid = !Array.isArray(changes) || changes.length < 1 || changes.length > 30 || changes.some(change => !STATE_COLLECTIONS.includes(change?.collection) || !String(change?.id || '') || (!change.deleted && (!Array.isArray(change.record) || String(change.record[STATE_IDS[change.collection]]) !== String(change.id))));
      if (invalid) return send(res, 400, { error:'Alterações inválidas' });
      await applyStateChanges(workspace, changes);
      return send(res, 200, { ok:true, workspace:workspace.id, savedAt:new Date().toISOString() });
    }

    if (action === 'appearance' && req.method === 'POST') {
      if (user.role !== 'Administrador') return send(res, 403, { error:'Apenas o administrador configura a aparência' });
      const body = await readBody(req);
      try { return send(res, 200, await writeAppearance(workspace, body)); }
      catch (error) { return send(res, 400, { error:error.message }); }
    }

    if (action === 'footer-text' && req.method === 'POST') {
      if (user.role !== 'Administrador') return send(res, 403, { error:'Apenas o administrador configura a aparência' });
      const body = await readBody(req);
      const text = String(body?.text || '').replace(/[<>\r\n]/g, '').trim().slice(0, 80);
      if (!text) return send(res, 400, { error:'Informe o texto do rodapé' });
      await writeDocument(workspaceKey(workspace.id, 'appearance_footer_text'), { text });
      return send(res, 200, { text });
    }

    if (action === 'create' && req.method === 'POST') {
      if (user.id !== OWNER_ID) return send(res, 403, { error:'Somente Aquino pode criar espaços no momento' });
      const body = await readBody(req);
      const name = cleanName(body.name);
      if (name.length < 2) return send(res, 400, { error:'Informe o nome do podcast' });
      let id = cleanWorkspaceId(body.id || name) || `podcast-${uid().slice(0, 6)}`;
      if (registry.workspaces.some(item => item.id === id)) id = `${id}-${uid().slice(0, 4)}`;
      const item = { id, name, ownerId:OWNER_ID, memberIds:[OWNER_ID], status:'Ativo', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
      registry.workspaces.push(item);
      await writeDocument(REGISTRY_KEY, registry);
      await ensureWorkspaceInitialized(item);
      return send(res, 201, { workspace:{ id:item.id, name:item.name, status:item.status, memberCount:1 } });
    }

    if (action === 'rename' && req.method === 'POST') {
      if (user.id !== OWNER_ID) return send(res, 403, { error:'Somente Aquino pode gerenciar espaços no momento' });
      const body = await readBody(req);
      const id = cleanWorkspaceId(body.id);
      const item = registry.workspaces.find(row => row.id === id);
      const name = cleanName(body.name);
      if (!item || name.length < 2) return send(res, 400, { error:'Espaço ou nome inválido' });
      item.name = name;
      item.updatedAt = new Date().toISOString();
      await writeDocument(REGISTRY_KEY, registry);
      return send(res, 200, { ok:true, workspace:{ id:item.id, name:item.name, status:item.status, memberCount:item.memberIds.length } });
    }

    if (action === 'members' && req.method === 'GET') {
      if (user.id !== OWNER_ID) return send(res, 403, { error:'Somente Aquino pode gerenciar a equipe do painel no momento' });
      return send(res, 200, { workspace:{ id:workspace.id, name:workspace.name, memberIds:workspace.memberIds }, users:await usersPublic() });
    }

    if (action === 'members' && req.method === 'POST') {
      if (user.id !== OWNER_ID) return send(res, 403, { error:'Somente Aquino pode gerenciar a equipe do painel no momento' });
      const body = await readBody(req);
      const users = await usersPublic();
      const validIds = new Set(users.map(item => String(item.id)));
      const requested = Array.isArray(body.memberIds) ? body.memberIds.map(String).filter(id => validIds.has(id)) : [];
      workspace.memberIds = [...new Set([OWNER_ID, ...requested])];
      workspace.updatedAt = new Date().toISOString();
      await writeDocument(REGISTRY_KEY, registry);
      return send(res, 200, { ok:true, workspace:{ id:workspace.id, name:workspace.name, memberIds:workspace.memberIds } });
    }

    if (action === 'archive' && req.method === 'POST') {
      if (user.id !== OWNER_ID) return send(res, 403, { error:'Somente Aquino pode gerenciar espaços no momento' });
      const body = await readBody(req);
      const item = registry.workspaces.find(row => row.id === cleanWorkspaceId(body.id));
      if (!item) return send(res, 404, { error:'Espaço não encontrado' });
      if (item.id === registry.defaultWorkspaceId) return send(res, 400, { error:'O espaço principal não pode ser arquivado' });
      item.status = body.archived === false ? 'Ativo' : 'Arquivado';
      item.updatedAt = new Date().toISOString();
      await writeDocument(REGISTRY_KEY, registry);
      return send(res, 200, { ok:true, workspace:{ id:item.id, name:item.name, status:item.status } });
    }

    return send(res, 405, { error:'Método ou ação não permitida' });
  } catch (error) {
    return send(res, 500, { error:String(error?.message || error || 'Erro interno') });
  }
}
