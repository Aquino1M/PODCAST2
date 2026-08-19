(() => {
  const STORAGE_KEY = 'onda-workspace-id';
  const OWNER_ID = 'owner';
  const STYLE_ID = 'onda-workspace-admin-style-v1';
  const nativeFetch = window.fetch.bind(window);
  const ui = {
    auth:null,
    list:null,
    booting:false,
    adminOpen:false,
    scanQueued:false,
  };

  function currentWorkspaceId() {
    try { return String(localStorage.getItem(STORAGE_KEY) || '').trim(); }
    catch { return ''; }
  }

  function setWorkspaceId(id) {
    try { localStorage.setItem(STORAGE_KEY, String(id || '')); } catch {}
  }

  function workspaceUrl(path, action, original) {
    const next = new URL(path, location.origin);
    if (original) {
      for (const [key, value] of original.searchParams.entries()) {
        if (key !== 'action' && key !== 'workspace') next.searchParams.append(key, value);
      }
    }
    if (action) next.searchParams.set('action', action);
    const workspace = currentWorkspaceId();
    if (workspace) next.searchParams.set('workspace', workspace);
    return next;
  }

  function rewriteUrl(value) {
    let url;
    try { url = new URL(typeof value === 'string' ? value : value.url, location.href); }
    catch { return null; }
    if (url.origin !== location.origin) return null;

    const path = url.pathname;
    if (path === '/api/state') return workspaceUrl('/workspace-api', 'state', url);
    if (path === '/api/state/changes') return workspaceUrl('/workspace-api', 'state-changes', url);
    if (path === '/api/appearance') return workspaceUrl('/workspace-api', 'appearance', url);
    if (path === '/api/footer-text') return workspaceUrl('/workspace-api', 'footer-text', url);
    if (path === '/api/public/showcase') return workspaceUrl('/workspace-api', 'showcase', url);
    if (path === '/social-live-api') return workspaceUrl('/workspace-social-api', url.searchParams.get('action') || 'public', url);
    if (path === '/tikhub-metrics-v2') return workspaceUrl('/workspace-social-api', 'metrics', url);
    return null;
  }

  window.fetch = function ondaWorkspaceFetch(input, init = {}) {
    const rewritten = rewriteUrl(input);
    if (!rewritten) return nativeFetch(input, init);

    const workspace = currentWorkspaceId();
    const sourceHeaders = init.headers || (input instanceof Request ? input.headers : undefined);
    const headers = new Headers(sourceHeaders || {});
    if (workspace) headers.set('X-Onda-Workspace', workspace);

    if (input instanceof Request) {
      const request = new Request(rewritten.toString(), input);
      return nativeFetch(request, { ...init, headers });
    }
    return nativeFetch(rewritten.toString(), { ...init, headers });
  };
  window.__ondaNativeFetch = nativeFetch;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .onda-workspace-switcher{position:relative;margin:2px 12px 16px;z-index:40}
      .onda-workspace-trigger{width:100%;display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid var(--border,#2b3140);border-radius:13px;background:var(--surface,#111620);color:inherit;text-align:left;cursor:pointer;transition:.2s ease}
      .onda-workspace-trigger:hover{border-color:#6366f1;box-shadow:0 8px 24px rgba(99,102,241,.12)}
      .onda-workspace-mark{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;flex:0 0 30px;background:linear-gradient(145deg,#6366f1,#8b5cf6);color:#fff;font:800 10px/1 system-ui;letter-spacing:.04em}
      .onda-workspace-copy{min-width:0;flex:1}
      .onda-workspace-copy small{display:block;font:700 7px/1.2 system-ui;letter-spacing:.16em;opacity:.55;margin-bottom:3px}
      .onda-workspace-copy strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:800 12px/1.2 system-ui}
      .onda-workspace-chevron{font-size:14px;opacity:.55;transition:transform .2s ease}
      .onda-workspace-trigger.open .onda-workspace-chevron{transform:rotate(180deg)}
      .onda-workspace-popover{position:absolute;left:0;right:0;top:calc(100% + 7px);border-radius:14px;border:1px solid rgba(148,163,184,.22);background:#17191d;color:#f8fafc;box-shadow:0 20px 60px rgba(0,0,0,.36);overflow:hidden;z-index:100}
      .onda-workspace-popover[hidden]{display:none!important}
      .onda-workspace-search{display:flex;align-items:center;gap:7px;padding:9px 11px;border-bottom:1px solid rgba(148,163,184,.16)}
      .onda-workspace-search input{width:100%;border:0;outline:0;background:transparent;color:#fff;font:500 11px/1.2 system-ui}
      .onda-workspace-search input::placeholder{color:#8b93a6}
      .onda-workspace-list{max-height:230px;overflow:auto;padding:5px}
      .onda-workspace-item{width:100%;display:flex;align-items:center;gap:9px;padding:9px;border:0;border-radius:10px;background:transparent;color:#f8fafc;text-align:left;cursor:pointer}
      .onda-workspace-item:hover{background:rgba(255,255,255,.06)}
      .onda-workspace-item.active{background:rgba(99,102,241,.14)}
      .onda-workspace-item .onda-space-icon{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:#24272e;color:#d7dcef;font:800 9px/1 system-ui}
      .onda-workspace-item>span:nth-child(2){min-width:0;flex:1}
      .onda-workspace-item strong{display:block;font:700 11px/1.2 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .onda-workspace-item small{display:block;color:#8b93a6;font:500 8px/1.2 system-ui;margin-top:2px}
      .onda-workspace-check{color:#a7f3d0;font-weight:900}
      .onda-workspace-actions{padding:6px;border-top:1px solid rgba(148,163,184,.16)}
      .onda-workspace-actions button{width:100%;display:flex;align-items:center;gap:9px;padding:9px;border:0;border-radius:9px;background:transparent;color:#f8fafc;text-align:left;cursor:pointer;font:650 10px/1.2 system-ui}
      .onda-workspace-actions button:hover{background:rgba(255,255,255,.06)}
      .onda-workspace-actions button span{font-size:16px;width:18px;text-align:center}
      .onda-owner-nav-badge{margin-left:auto!important;font-size:7px!important;letter-spacing:.08em!important;padding:3px 5px!important;border-radius:999px!important;background:rgba(99,102,241,.16)!important;color:#a5b4fc!important}

      .onda-admin-page{display:flex;flex-direction:column;gap:20px}
      .onda-admin-hero{position:relative;overflow:hidden;padding:24px;border:1px solid var(--border,#dde3e8);border-radius:20px;background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.04) 55%,transparent)}
      .onda-admin-hero:after{content:"";position:absolute;width:240px;height:240px;border-radius:50%;right:-90px;top:-140px;background:rgba(99,102,241,.12);filter:blur(2px);pointer-events:none}
      .onda-admin-eyebrow{font:800 9px/1 system-ui;letter-spacing:.18em;color:#6366f1;margin:0 0 8px}
      .onda-admin-hero h1{margin:0;font-size:28px;letter-spacing:-.035em}
      .onda-admin-hero p{max-width:760px;margin:8px 0 0;color:var(--muted,#667085);font-size:12px;line-height:1.6}
      .onda-admin-owner-pill{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:7px 10px;border-radius:999px;background:rgba(18,183,106,.1);color:#07835d;font:800 9px/1 system-ui}
      .onda-admin-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .onda-admin-kpi{padding:16px;border:1px solid var(--border,#e1e6ea);border-radius:16px;background:var(--panel,#fff)}
      .onda-admin-kpi small{display:block;color:var(--muted,#667085);font:700 9px/1.3 system-ui;letter-spacing:.05em;text-transform:uppercase}
      .onda-admin-kpi strong{display:block;margin-top:7px;font-size:20px;letter-spacing:-.03em}
      .onda-admin-kpi span{display:block;margin-top:4px;color:var(--muted,#667085);font-size:9px}
      .onda-admin-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:16px;align-items:start}
      .onda-admin-panel{border:1px solid var(--border,#e1e6ea);border-radius:18px;background:var(--panel,#fff);overflow:hidden}
      .onda-admin-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 18px 14px;border-bottom:1px solid var(--border,#edf0f2)}
      .onda-admin-panel-head h2{margin:0;font-size:16px}
      .onda-admin-panel-head p{margin:4px 0 0;color:var(--muted,#667085);font-size:9px;line-height:1.5}
      .onda-admin-panel-body{padding:16px 18px 18px}
      .onda-admin-primary,.onda-admin-secondary,.onda-admin-danger{appearance:none;border-radius:10px;padding:9px 11px;font:800 9px/1 system-ui;cursor:pointer}
      .onda-admin-primary{border:1px solid #6366f1;background:#6366f1;color:#fff}
      .onda-admin-secondary{border:1px solid var(--border,#dfe5e2);background:transparent;color:inherit}
      .onda-admin-danger{border:1px solid rgba(217,45,32,.2);background:rgba(217,45,32,.06);color:#d92d20}
      .onda-space-admin-list{display:grid;gap:8px}
      .onda-space-admin-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px;border:1px solid var(--border,#edf0f2);border-radius:12px}
      .onda-space-admin-row.current{border-color:rgba(99,102,241,.35);background:rgba(99,102,241,.045)}
      .onda-space-admin-row .mark{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#6366f1,#8b5cf6);color:#fff;font:900 10px/1 system-ui}
      .onda-space-admin-row strong{display:block;font-size:11px}
      .onda-space-admin-row small{display:block;margin-top:3px;color:var(--muted,#667085);font-size:8px}
      .onda-space-row-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .onda-appearance-form{display:grid;grid-template-columns:1fr 1fr;gap:11px}
      .onda-admin-field{display:flex;flex-direction:column;gap:6px}
      .onda-admin-field.wide{grid-column:1/-1}
      .onda-admin-field span{font:800 8px/1 system-ui;letter-spacing:.06em;color:var(--muted,#667085)}
      .onda-admin-field input,.onda-admin-field select{width:100%;box-sizing:border-box;border:1px solid var(--border,#dfe5e2);border-radius:10px;padding:9px 10px;background:var(--panel,#fff);color:inherit;outline:none;font:600 10px/1.2 system-ui}
      .onda-admin-field input:focus,.onda-admin-field select:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
      .onda-admin-form-actions{display:flex;justify-content:flex-end;gap:8px;grid-column:1/-1;margin-top:3px}
      .onda-team-table{display:grid;gap:7px}
      .onda-team-row{display:grid;grid-template-columns:24px minmax(150px,1fr) minmax(120px,.55fr) minmax(100px,.45fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid var(--border,#edf0f2);border-radius:11px}
      .onda-team-row.owner{background:rgba(99,102,241,.04)}
      .onda-team-row input[type=checkbox]{width:15px;height:15px;accent-color:#6366f1}
      .onda-team-person strong{display:block;font-size:10px}
      .onda-team-person small{display:block;margin-top:2px;color:var(--muted,#667085);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .onda-team-row select{width:100%;border:1px solid var(--border,#dfe5e2);border-radius:8px;padding:7px;background:var(--panel,#fff);color:inherit;font:600 9px/1 system-ui}
      .onda-team-row button{padding:7px 9px}
      .onda-create-login{display:grid;grid-template-columns:1fr 1fr 1fr 150px auto;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#edf0f2)}
      .onda-create-login input,.onda-create-login select{min-width:0;border:1px solid var(--border,#dfe5e2);border-radius:9px;padding:8px 9px;background:var(--panel,#fff);color:inherit;font:600 9px/1 system-ui}
      .onda-admin-note{padding:11px 12px;border-radius:11px;background:rgba(99,102,241,.055);color:var(--muted,#667085);font:600 9px/1.5 system-ui}
      .onda-admin-toast{position:fixed;right:20px;bottom:20px;z-index:15000;max-width:340px;padding:11px 14px;border-radius:12px;background:#101828;color:#fff;box-shadow:0 16px 44px rgba(0,0,0,.25);font:700 10px/1.4 system-ui;animation:ondaToastIn .2s ease}
      .onda-admin-toast.error{background:#b42318}
      @keyframes ondaToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .onda-admin-modal-backdrop{position:fixed;inset:0;z-index:14000;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.58);backdrop-filter:blur(6px)}
      .onda-admin-modal{width:min(460px,96vw);border-radius:18px;border:1px solid rgba(148,163,184,.22);background:var(--panel,#fff);color:inherit;box-shadow:0 28px 90px rgba(0,0,0,.28);overflow:hidden}
      .onda-admin-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid var(--border,#edf0f2)}
      .onda-admin-modal h3{margin:0;font-size:17px}.onda-admin-modal header p{margin:5px 0 0;color:var(--muted,#667085);font-size:9px}
      .onda-admin-modal .body{padding:16px 18px}.onda-admin-modal .actions{display:flex;justify-content:flex-end;gap:8px;padding:0 18px 18px}
      @media(max-width:1050px){.onda-admin-kpis{grid-template-columns:repeat(2,1fr)}.onda-admin-grid{grid-template-columns:1fr}.onda-team-row{grid-template-columns:24px minmax(130px,1fr) 120px 100px auto}.onda-create-login{grid-template-columns:1fr 1fr}}
      @media(max-width:700px){.onda-workspace-switcher{margin:4px 10px 12px}.onda-admin-kpis{grid-template-columns:1fr 1fr}.onda-admin-hero{padding:18px}.onda-admin-hero h1{font-size:23px}.onda-appearance-form{grid-template-columns:1fr}.onda-team-row{grid-template-columns:24px 1fr}.onda-team-row select,.onda-team-row button{grid-column:2}.onda-create-login{grid-template-columns:1fr}.onda-admin-grid{gap:12px}}
      html[data-theme="dark"] .onda-admin-panel,html[data-theme="dark"] .onda-admin-kpi,html[data-theme="dark"] .onda-admin-modal{background:#111620;border-color:#293244}
      html[data-theme="dark"] .onda-space-admin-row,html[data-theme="dark"] .onda-team-row{border-color:#293244}
      html[data-theme="dark"] .onda-admin-field input,html[data-theme="dark"] .onda-admin-field select,html[data-theme="dark"] .onda-team-row select,html[data-theme="dark"] .onda-create-login input,html[data-theme="dark"] .onda-create-login select{background:#0b1220;border-color:#293244;color:#f8fafc}
    `;
    document.head.appendChild(style);
  }

  async function api(path, options = {}) {
    const response = await nativeFetch(path, options);
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  function initials(name) {
    return String(name || 'P').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'P';
  }

  function toast(message, error = false) {
    document.querySelector('.onda-admin-toast')?.remove();
    const node = document.createElement('div');
    node.className = `onda-admin-toast${error ? ' error' : ''}`;
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2800);
  }

  async function loadWorkspaceList(force = false) {
    if (!force && ui.list) return ui.list;
    const result = await api('/workspace-api?action=list', { cache:'no-store' });
    ui.list = result;
    const saved = currentWorkspaceId();
    const available = result.workspaces || [];
    if (!saved || !available.some(item => item.id === saved && item.status !== 'Arquivado')) {
      if (result.current) setWorkspaceId(result.current);
    }
    return result;
  }

  async function loadAuth(force = false) {
    if (!force && ui.auth?.authenticated) return ui.auth;
    const response = await nativeFetch('/api/auth/status', { cache:'no-store' });
    const auth = await response.json().catch(() => ({}));
    ui.auth = auth;
    return auth;
  }

  function closeWorkspacePopover() {
    const pop = document.querySelector('.onda-workspace-popover');
    const trigger = document.querySelector('.onda-workspace-trigger');
    if (pop) pop.hidden = true;
    trigger?.classList.remove('open');
  }

  function workspaceItemHtml(item, current) {
    return `<button class="onda-workspace-item ${item.id === current ? 'active' : ''}" type="button" data-onda-workspace-select="${esc(item.id)}" data-name="${esc(item.name.toLowerCase())}">
      <span class="onda-space-icon">${esc(initials(item.name))}</span>
      <span><strong>${esc(item.name)}</strong><small>${item.status === 'Arquivado' ? 'Arquivado' : `${Number(item.memberCount || 0)} acesso(s)`}</small></span>
      ${item.id === current ? '<span class="onda-workspace-check">✓</span>' : ''}
    </button>`;
  }

  async function mountSwitcher(sidebar) {
    if (!sidebar || sidebar.querySelector('.onda-workspace-switcher')) return;
    const list = await loadWorkspaceList().catch(() => null);
    if (!list || ui.auth?.user?.id !== OWNER_ID) return;
    const current = currentWorkspaceId() || list.current;
    const active = (list.workspaces || []).find(item => item.id === current) || list.workspaces?.[0];
    if (!active) return;

    const wrap = document.createElement('div');
    wrap.className = 'onda-workspace-switcher';
    wrap.innerHTML = `<button class="onda-workspace-trigger" type="button" aria-expanded="false">
      <span class="onda-workspace-mark">${esc(initials(active.name))}</span>
      <span class="onda-workspace-copy"><small>ESPAÇO DE TRABALHO</small><strong>${esc(active.name)}</strong></span>
      <span class="onda-workspace-chevron">⌄</span>
    </button>
    <div class="onda-workspace-popover" hidden>
      <label class="onda-workspace-search"><span>⌕</span><input type="search" placeholder="Buscar espaço..." aria-label="Buscar espaço"></label>
      <div class="onda-workspace-list">${(list.workspaces || []).map(item => workspaceItemHtml(item, current)).join('')}</div>
      <div class="onda-workspace-actions">
        <button type="button" data-onda-create-space><span>＋</span>Criar espaço</button>
        <button type="button" data-onda-manage-spaces><span>⚙</span>Gerenciar espaços</button>
      </div>
    </div>`;
    sidebar.querySelector('.brand-lockup')?.insertAdjacentElement('afterend', wrap);

    const trigger = wrap.querySelector('.onda-workspace-trigger');
    const pop = wrap.querySelector('.onda-workspace-popover');
    trigger.onclick = event => {
      event.stopPropagation();
      pop.hidden = !pop.hidden;
      trigger.classList.toggle('open', !pop.hidden);
      trigger.setAttribute('aria-expanded', String(!pop.hidden));
    };
    wrap.querySelector('.onda-workspace-search input').oninput = event => {
      const q = String(event.target.value || '').trim().toLowerCase();
      wrap.querySelectorAll('[data-onda-workspace-select]').forEach(button => {
        button.hidden = Boolean(q && !String(button.dataset.name || '').includes(q));
      });
    };
    wrap.querySelectorAll('[data-onda-workspace-select]').forEach(button => button.onclick = () => switchWorkspace(button.dataset.ondaWorkspaceSelect));
    wrap.querySelector('[data-onda-create-space]').onclick = () => openCreateWorkspace();
    wrap.querySelector('[data-onda-manage-spaces]').onclick = () => { closeWorkspacePopover(); openAdminPage(); };
  }

  function mountOwnerNav(sidebar) {
    if (!sidebar || ui.auth?.user?.id !== OWNER_ID) return;
    const nav = sidebar.querySelector('nav');
    if (!nav || nav.querySelector('[data-onda-admin-page]')) return;
    const operation = [...nav.querySelectorAll('.nav-group')].find(group => String(group.querySelector('p')?.textContent || '').trim().toUpperCase() === 'OPERAÇÃO') || nav.querySelector('.nav-group:last-child');
    if (!operation) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.ondaAdminPage = '1';
    button.innerHTML = '<span>⚙</span>Administração<b class="onda-owner-nav-badge">DONO</b>';
    operation.appendChild(button);
    button.onclick = () => openAdminPage();
  }

  function enforceOwnerOnly() {
    if (!ui.auth?.authenticated) return;
    const owner = ui.auth.user?.id === OWNER_ID;
    if (!owner) document.querySelector('[data-page="appearance"]')?.remove();
  }

  function markAdminNavActive(active) {
    document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', false));
    document.querySelector('[data-onda-admin-page]')?.classList.toggle('active', Boolean(active));
  }

  function switchWorkspace(id) {
    if (!id || id === currentWorkspaceId()) return closeWorkspacePopover();
    setWorkspaceId(id);
    location.reload();
  }

  function modal({ title, description, body, confirmText = 'Salvar', onConfirm }) {
    document.querySelector('.onda-admin-modal-backdrop')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'onda-admin-modal-backdrop';
    overlay.innerHTML = `<section class="onda-admin-modal" role="dialog" aria-modal="true">
      <header><div><h3>${esc(title)}</h3><p>${esc(description || '')}</p></div><button class="onda-admin-secondary" type="button" data-close>×</button></header>
      <div class="body">${body}</div>
      <div class="actions"><button class="onda-admin-secondary" type="button" data-close>Cancelar</button><button class="onda-admin-primary" type="button" data-confirm>${esc(confirmText)}</button></div>
    </section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('[data-confirm]').onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try { await onConfirm?.(overlay); close(); }
      catch (error) { toast(error.message, true); }
      finally { button.disabled = false; }
    };
    return overlay;
  }

  function openCreateWorkspace() {
    closeWorkspacePopover();
    modal({
      title:'Criar espaço de podcast',
      description:'Cada espaço terá dados, aparência e contas TikHub isolados.',
      body:`<label class="onda-admin-field"><span>NOME DO PODCAST</span><input name="workspaceName" maxlength="60" placeholder="Ex.: AquinoCast" autofocus></label>`,
      confirmText:'Criar espaço',
      onConfirm:async overlay => {
        const name = overlay.querySelector('[name="workspaceName"]').value.trim();
        if (name.length < 2) throw new Error('Informe o nome do podcast');
        const result = await api('/workspace-api?action=create', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) });
        ui.list = null;
        setWorkspaceId(result.workspace.id);
        toast('Espaço criado. Abrindo o novo podcast...');
        setTimeout(() => location.reload(), 350);
      },
    });
  }

  async function renameWorkspace(item) {
    modal({
      title:'Renomear espaço',
      description:'O identificador interno permanece o mesmo; somente o nome exibido muda.',
      body:`<label class="onda-admin-field"><span>NOME DO PODCAST</span><input name="workspaceName" maxlength="60" value="${esc(item.name)}"></label>`,
      onConfirm:async overlay => {
        const name = overlay.querySelector('[name="workspaceName"]').value.trim();
        await api(`/workspace-api?action=rename&workspace=${encodeURIComponent(item.id)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:item.id, name }) });
        ui.list = null;
        toast('Nome do espaço atualizado');
        await openAdminPage(true);
      },
    });
  }

  function appearanceFormHtml(appearance) {
    return `<form class="onda-appearance-form" data-onda-admin-appearance>
      <label class="onda-admin-field wide"><span>NOME DO PODCAST</span><input name="podcastName" minlength="2" maxlength="40" value="${esc(appearance.podcastName || '')}" required></label>
      <label class="onda-admin-field"><span>TEMA</span><select name="interfaceTheme"><option value="light" ${appearance.interfaceTheme === 'light' ? 'selected' : ''}>Branco</option><option value="dark" ${appearance.interfaceTheme === 'dark' ? 'selected' : ''}>Preto</option><option value="system" ${appearance.interfaceTheme === 'system' ? 'selected' : ''}>Sistema</option></select></label>
      <label class="onda-admin-field"><span>FONTE</span><select name="font"><option value="scholar" ${appearance.font === 'scholar' ? 'selected' : ''}>Scholar</option><option value="inter" ${appearance.font === 'inter' ? 'selected' : ''}>Inter</option><option value="georgia" ${appearance.font === 'georgia' ? 'selected' : ''}>Georgia</option></select></label>
      <label class="onda-admin-field"><span>COR DE DESTAQUE</span><input name="accentColor" type="color" value="${esc(appearance.accentColor || '#6366F1')}"></label>
      <label class="onda-admin-field"><span>RAIO DOS CARDS</span><input name="cardRadius" type="number" min="8" max="28" value="${Number(appearance.cardRadius || 16)}"></label>
      <input type="hidden" name="letterSpacing" value="${Number(appearance.letterSpacing ?? .025)}"><input type="hidden" name="wordSpacing" value="${Number(appearance.wordSpacing ?? .16)}"><input type="hidden" name="glow" value="${Number(appearance.glow ?? 10)}"><input type="hidden" name="glowOpacity" value="${Number(appearance.glowOpacity ?? .15)}">
      <div class="onda-admin-form-actions"><button class="onda-admin-primary" type="submit">Salvar aparência deste podcast</button></div>
    </form>`;
  }

  function teamRowsHtml(users, memberIds) {
    const members = new Set((memberIds || []).map(String));
    return users.map(user => {
      const owner = String(user.id) === OWNER_ID;
      return `<div class="onda-team-row ${owner ? 'owner' : ''}" data-user-id="${esc(user.id)}">
        <input type="checkbox" data-member ${members.has(String(user.id)) || owner ? 'checked' : ''} ${owner ? 'disabled' : ''} aria-label="Acesso ao podcast">
        <div class="onda-team-person"><strong>${esc(user.name || 'Usuário')}${owner ? ' · Aquino' : ''}</strong><small>${esc(user.email || '')}</small></div>
        <select data-role ${owner ? 'disabled' : ''}>${['Administrador','Gestor','Colaborador','Leitura'].map(role => `<option ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select>
        <select data-status ${owner ? 'disabled' : ''}><option ${user.status !== 'Inativo' ? 'selected' : ''}>Ativo</option><option ${user.status === 'Inativo' ? 'selected' : ''}>Inativo</option></select>
        <button class="onda-admin-secondary" type="button" data-save-user ${owner ? 'disabled' : ''}>Salvar</button>
      </div>`;
    }).join('');
  }

  async function renderAdminPage() {
    if (ui.auth?.user?.id !== OWNER_ID) return;
    const content = document.querySelector('#content');
    if (!content) return;
    ui.adminOpen = true;
    markAdminNavActive(true);
    const crumb = document.querySelector('#crumb');
    if (crumb) crumb.textContent = 'Administração';
    content.innerHTML = '<div class="onda-admin-page"><div class="onda-admin-hero"><p class="onda-admin-eyebrow">ADMINISTRAÇÃO DO SISTEMA</p><h1>Carregando gestão do painel...</h1></div></div>';

    try {
      const list = await loadWorkspaceList(true);
      const current = currentWorkspaceId() || list.current;
      const [membership, appearance, users] = await Promise.all([
        api(`/workspace-api?action=members&workspace=${encodeURIComponent(current)}`, { cache:'no-store' }),
        api(`/workspace-api?action=appearance&workspace=${encodeURIComponent(current)}`, { cache:'no-store' }),
        api('/api/users', { cache:'no-store' }),
      ]);
      const workspaces = list.workspaces || [];
      const currentItem = workspaces.find(item => item.id === current) || workspaces[0];
      const activeSpaces = workspaces.filter(item => item.status !== 'Arquivado');
      const memberIds = membership.workspace?.memberIds || [];

      content.innerHTML = `<div class="onda-admin-page">
        <section class="onda-admin-hero">
          <p class="onda-admin-eyebrow">ADMINISTRAÇÃO DO SISTEMA</p>
          <h1>Controle dos podcasts e do painel</h1>
          <p>Crie espaços separados para cada podcast, troque de operação sem misturar dados e controle aparência, logins e quem pode acessar cada painel.</p>
          <span class="onda-admin-owner-pill">● Visível somente para Aquino</span>
        </section>

        <section class="onda-admin-kpis">
          <article class="onda-admin-kpi"><small>Podcasts ativos</small><strong>${activeSpaces.length}</strong><span>Bancos lógicos isolados</span></article>
          <article class="onda-admin-kpi"><small>Logins do sistema</small><strong>${users.length}</strong><span>Contas globais cadastradas</span></article>
          <article class="onda-admin-kpi"><small>Espaço atual</small><strong>${esc(currentItem?.name || 'Podcast')}</strong><span>${esc(current || '')}</span></article>
          <article class="onda-admin-kpi"><small>Isolamento</small><strong>Ativo</strong><span>Estado · aparência · TikHub</span></article>
        </section>

        <div class="onda-admin-grid">
          <section class="onda-admin-panel">
            <div class="onda-admin-panel-head"><div><h2>Espaços de podcast</h2><p>Cada espaço trabalha com seus próprios registros, visual e contas sociais.</p></div><button class="onda-admin-primary" type="button" data-admin-create-space>＋ Criar espaço</button></div>
            <div class="onda-admin-panel-body"><div class="onda-space-admin-list">${workspaces.map(item => `<article class="onda-space-admin-row ${item.id === current ? 'current' : ''}" data-space-id="${esc(item.id)}"><span class="mark">${esc(initials(item.name))}</span><div><strong>${esc(item.name)}</strong><small>${item.status} · ${Number(item.memberCount || 0)} acesso(s) · ${esc(item.id)}</small></div><div class="onda-space-row-actions">${item.id !== current && item.status !== 'Arquivado' ? '<button class="onda-admin-secondary" type="button" data-space-switch>Abrir</button>' : ''}<button class="onda-admin-secondary" type="button" data-space-rename>Renomear</button>${item.id !== list.current ? `<button class="onda-admin-danger" type="button" data-space-archive>${item.status === 'Arquivado' ? 'Reativar' : 'Arquivar'}</button>` : ''}</div></article>`).join('')}</div></div>
          </section>

          <section class="onda-admin-panel">
            <div class="onda-admin-panel-head"><div><h2>Aparência</h2><p>Configuração exclusiva do podcast selecionado.</p></div></div>
            <div class="onda-admin-panel-body">${appearanceFormHtml(appearance)}</div>
          </section>
        </div>

        <section class="onda-admin-panel">
          <div class="onda-admin-panel-head"><div><h2>Gestão da equipe e logins</h2><p>Controle quem entra no painel, o nível de acesso e em quais podcasts cada pessoa pode trabalhar.</p></div><button class="onda-admin-primary" type="button" data-save-members>Salvar acessos ao podcast</button></div>
          <div class="onda-admin-panel-body">
            <div class="onda-admin-note">O login é global, mas o acesso aos dados é por espaço. Marcar uma pessoa aqui libera somente o podcast <strong>${esc(currentItem?.name || '')}</strong>. O acesso do Aquino permanece sempre ativo.</div>
            <div class="onda-team-table" style="margin-top:12px">${teamRowsHtml(users, memberIds)}</div>
            <form class="onda-create-login" data-create-login>
              <input name="name" placeholder="Nome completo" required minlength="3">
              <input name="email" type="email" placeholder="E-mail" required>
              <input name="password" type="password" placeholder="Senha inicial (8+)" required minlength="8">
              <select name="role"><option>Administrador</option><option selected>Gestor</option><option>Colaborador</option><option>Leitura</option></select>
              <button class="onda-admin-primary" type="submit">Criar login</button>
            </form>
          </div>
        </section>
      </div>`;

      content.querySelector('[data-admin-create-space]').onclick = openCreateWorkspace;
      content.querySelectorAll('[data-space-switch]').forEach(button => button.onclick = () => switchWorkspace(button.closest('[data-space-id]').dataset.spaceId));
      content.querySelectorAll('[data-space-rename]').forEach(button => {
        button.onclick = () => {
          const id = button.closest('[data-space-id]').dataset.spaceId;
          const item = workspaces.find(row => row.id === id);
          if (item) renameWorkspace(item);
        };
      });
      content.querySelectorAll('[data-space-archive]').forEach(button => button.onclick = async () => {
        const row = button.closest('[data-space-id]');
        const item = workspaces.find(value => value.id === row.dataset.spaceId);
        if (!item) return;
        button.disabled = true;
        try {
          await api(`/workspace-api?action=archive&workspace=${encodeURIComponent(current)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:item.id, archived:item.status !== 'Arquivado' }) });
          ui.list = null;
          toast(item.status === 'Arquivado' ? 'Espaço reativado' : 'Espaço arquivado');
          await renderAdminPage();
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
      });

      const appearanceForm = content.querySelector('[data-onda-admin-appearance]');
      appearanceForm.onsubmit = async event => {
        event.preventDefault();
        const button = appearanceForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          const form = new FormData(appearanceForm);
          const payload = Object.fromEntries(form.entries());
          payload.letterSpacing = Number(payload.letterSpacing); payload.wordSpacing = Number(payload.wordSpacing); payload.glow = Number(payload.glow); payload.glowOpacity = Number(payload.glowOpacity); payload.cardRadius = Number(payload.cardRadius);
          await api(`/workspace-api?action=appearance&workspace=${encodeURIComponent(current)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
          toast('Aparência salva somente neste podcast');
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
      };

      content.querySelectorAll('[data-save-user]').forEach(button => button.onclick = async () => {
        const row = button.closest('[data-user-id]');
        const id = row.dataset.userId;
        const user = users.find(item => String(item.id) === String(id));
        if (!user) return;
        button.disabled = true;
        try {
          await api(`/api/users/${encodeURIComponent(id)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:user.name, email:user.email, role:row.querySelector('[data-role]').value, status:row.querySelector('[data-status]').value }) });
          toast(`Acesso de ${user.name} atualizado`);
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
      });

      content.querySelector('[data-save-members]').onclick = async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const ids = [...content.querySelectorAll('[data-user-id]')].filter(row => row.querySelector('[data-member]')?.checked).map(row => row.dataset.userId);
          await api(`/workspace-api?action=members&workspace=${encodeURIComponent(current)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ memberIds:ids }) });
          ui.list = null;
          toast('Equipe autorizada para este podcast');
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
      };

      content.querySelector('[data-create-login]').onsubmit = async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          const data = Object.fromEntries(new FormData(form).entries());
          await api('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
          toast('Login criado. Agora escolha em quais podcasts ele terá acesso.');
          await renderAdminPage();
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
      };
    } catch (error) {
      content.innerHTML = `<div class="onda-admin-page"><section class="onda-admin-hero"><p class="onda-admin-eyebrow">ADMINISTRAÇÃO</p><h1>Não foi possível carregar</h1><p>${esc(error.message)}</p></section></div>`;
      toast(error.message, true);
    }
  }

  async function openAdminPage(force = false) {
    if (force) ui.list = null;
    await loadAuth(true).catch(() => null);
    if (ui.auth?.user?.id !== OWNER_ID) return;
    closeWorkspacePopover();
    await renderAdminPage();
  }

  async function scan() {
    ensureStyle();
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    if (!ui.auth?.authenticated) {
      if (ui.booting) return;
      ui.booting = true;
      try {
        const auth = await loadAuth(true);
        if (auth?.authenticated) await loadWorkspaceList(true).catch(() => null);
      } catch {}
      finally { ui.booting = false; }
    }
    if (!ui.auth?.authenticated) return;
    enforceOwnerOnly();
    if (ui.auth.user?.id === OWNER_ID) {
      await mountSwitcher(document.querySelector('.sidebar'));
      mountOwnerNav(document.querySelector('.sidebar'));
    }
  }

  function scheduleScan() {
    if (ui.scanQueued) return;
    ui.scanQueued = true;
    queueMicrotask(async () => {
      ui.scanQueued = false;
      await scan();
    });
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.onda-workspace-switcher')) closeWorkspacePopover();
    if (event.target.closest('[data-page]')) {
      ui.adminOpen = false;
      document.querySelector('[data-onda-admin-page]')?.classList.remove('active');
    }
  }, true);

  ensureStyle();
  scheduleScan();
  new MutationObserver(scheduleScan).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('focus', () => scheduleScan());
})();
