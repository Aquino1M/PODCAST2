(() => {
  const STYLE_ID = 'onda-social-live-manager-style';
  const PANEL_CLASS = 'onda-social-source-panel';
  let publicState = null;
  let publicStateAt = 0;
  let observerScheduled = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const css = `
    .${PANEL_CLASS}{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:18px;align-items:center;padding:18px 20px;margin:0 0 20px;border:1px solid var(--line,#d9dedb);border-radius:18px;background:var(--panel,#fff);box-shadow:0 12px 34px rgba(15,23,42,.06)}
    .${PANEL_CLASS} small{display:block;font-size:9px;font-weight:800;letter-spacing:.18em;color:#65708a;margin-bottom:5px}
    .${PANEL_CLASS} h3{font-size:16px;margin:0 0 5px;color:var(--ink,#0f172a)}
    .${PANEL_CLASS} p{font-size:11px;line-height:1.5;margin:0;color:var(--muted,#667085)}
    .onda-social-source-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .onda-source-toggle{display:flex;padding:4px;border:1px solid var(--line,#d9dedb);border-radius:12px;background:rgba(99,102,241,.04)}
    .onda-source-toggle button{appearance:none;border:0;background:transparent;color:var(--muted,#667085);font:800 10px/1 system-ui;padding:9px 12px;border-radius:9px;cursor:pointer;transition:.18s ease}
    .onda-source-toggle button.active{background:var(--accent-color,#6366f1);color:#fff;box-shadow:0 6px 16px rgba(99,102,241,.22)}
    .onda-social-manage{appearance:none;border:1px solid var(--line,#d9dedb);background:var(--panel,#fff);color:var(--ink,#0f172a);font:800 10px/1 system-ui;padding:12px 14px;border-radius:12px;cursor:pointer}
    .onda-social-live-state{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding-top:12px;border-top:1px solid var(--line,#e6e9e7);font:700 9px/1.4 system-ui;color:var(--muted,#667085)}
    .onda-social-live-state i{width:7px;height:7px;border-radius:99px;background:#98a2b3}
    .onda-social-live-state.real i{background:#12b76a;box-shadow:0 0 0 4px rgba(18,183,106,.12)}
    .onda-social-live-state.demo i{background:#f79009;box-shadow:0 0 0 4px rgba(247,144,9,.12)}
    .onda-social-manager-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(6,10,20,.58);backdrop-filter:blur(8px)}
    .onda-social-manager{width:min(820px,96vw);max-height:min(820px,92vh);overflow:auto;background:var(--panel,#fff);color:var(--ink,#0f172a);border:1px solid var(--line,#d9dedb);border-radius:22px;box-shadow:0 32px 90px rgba(2,6,23,.32)}
    .onda-social-manager-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 24px;border-bottom:1px solid var(--line,#e6e9e7)}
    .onda-social-manager-head small{display:block;font:800 9px/1 system-ui;letter-spacing:.18em;color:#6366f1;margin-bottom:7px}
    .onda-social-manager-head h2{margin:0;font-size:24px;font-family:var(--display-font,Georgia,serif)}
    .onda-social-manager-head p{margin:7px 0 0;color:var(--muted,#667085);font-size:11px;line-height:1.5}
    .onda-social-manager-close{appearance:none;border:0;background:#111827;color:#fff;width:34px;height:34px;border-radius:10px;font-size:18px;cursor:pointer}
    .onda-social-manager-body{padding:22px 24px}
    .onda-social-section{padding:18px;border:1px solid var(--line,#e1e5e2);border-radius:16px;margin-bottom:16px;background:rgba(99,102,241,.025)}
    .onda-social-section>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}
    .onda-social-section>header h3{margin:0;font-size:14px}
    .onda-social-section>header span{font:800 9px/1 system-ui;padding:6px 8px;border-radius:999px;background:rgba(99,102,241,.1);color:#6366f1}
    .onda-social-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .onda-social-field{display:flex;flex-direction:column;gap:6px}
    .onda-social-field.wide{grid-column:1/-1}
    .onda-social-field>span{font:800 9px/1 system-ui;letter-spacing:.08em;color:var(--muted,#667085)}
    .onda-social-field input{width:100%;box-sizing:border-box;border:1px solid var(--line,#d9dedb);border-radius:11px;padding:11px 12px;background:var(--panel,#fff);color:var(--ink,#111827);outline:none;font:500 12px/1.2 system-ui}
    .onda-social-field input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
    .onda-account-field{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:end}
    .onda-account-icon{height:39px;display:grid;place-items:center;border-radius:10px;background:#111827;color:#fff;font:900 10px/1 system-ui}
    .onda-enable{height:39px;display:flex;align-items:center;gap:6px;font:700 9px/1 system-ui;color:var(--muted,#667085)}
    .onda-oauth-status{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}
    .onda-oauth-status div{padding:10px;border-radius:11px;border:1px solid var(--line,#e1e5e2);background:var(--panel,#fff)}
    .onda-oauth-status strong{display:block;font-size:10px;margin-bottom:4px}
    .onda-oauth-status small{font-size:8px;color:var(--muted,#667085)}
    .onda-oauth-status .connected small{color:#12b76a;font-weight:800}
    .onda-social-tech-list{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
    .onda-social-tech-list article{padding:12px;border:1px solid var(--line,#e1e5e2);border-radius:12px;background:var(--panel,#fff)}
    .onda-social-tech-list b{display:block;font-size:10px;margin-bottom:6px}
    .onda-social-tech-list span{display:block;font-size:9px;line-height:1.45;color:var(--muted,#667085)}
    .onda-social-tech-list em{display:inline-block;margin-top:8px;font:800 8px/1 system-ui;font-style:normal;color:#6366f1}
    .onda-social-manager-error{min-height:18px;margin:0 0 8px;color:#d92d20;font:700 10px/1.4 system-ui}
    .onda-social-manager-actions{display:flex;justify-content:flex-end;gap:9px;padding:0 24px 24px}
    .onda-social-manager-actions button{appearance:none;border-radius:11px;padding:11px 15px;font:800 10px/1 system-ui;cursor:pointer}
    .onda-social-manager-actions .cancel{border:1px solid var(--line,#d9dedb);background:var(--panel,#fff);color:var(--ink,#111827)}
    .onda-social-manager-actions .save{border:1px solid #6366f1;background:#6366f1;color:#fff;box-shadow:0 8px 20px rgba(99,102,241,.22)}
    .onda-social-manager-actions button:disabled{opacity:.55;cursor:wait}
    .onda-live-toast{position:fixed;right:20px;bottom:20px;z-index:11000;padding:11px 14px;border-radius:11px;background:#101828;color:#fff;font:700 10px/1.3 system-ui;box-shadow:0 12px 36px rgba(2,6,23,.28)}
    html[data-theme="dark"] .${PANEL_CLASS},html[data-theme="dark"] .onda-social-manager,html[data-theme="dark"] .onda-social-section,html[data-theme="dark"] .onda-oauth-status div,html[data-theme="dark"] .onda-social-tech-list article,html[data-theme="dark"] .onda-social-field input,html[data-theme="dark"] .onda-social-manage{--panel:#111827;--ink:#f8fafc;--muted:#a8b1c3;--line:#293244}
    @media(max-width:760px){.${PANEL_CLASS}{grid-template-columns:1fr}.onda-social-source-actions{justify-content:flex-start}.onda-social-form-grid{grid-template-columns:1fr}.onda-social-field.wide{grid-column:auto}.onda-oauth-status,.onda-social-tech-list{grid-template-columns:1fr}.onda-social-manager-body,.onda-social-manager-head{padding:18px}.onda-social-manager-actions{padding:0 18px 18px}.onda-account-field{grid-template-columns:32px 1fr}.onda-enable{grid-column:2}}
  `;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function toast(message) {
    document.querySelector('.onda-live-toast')?.remove();
    const node = document.createElement('div');
    node.className = 'onda-live-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2800);
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  async function getPublicState(force = false) {
    if (!force && publicState && Date.now() - publicStateAt < 30_000) return publicState;
    publicState = await fetchJson('/social-live-api?action=public', { cache:'no-store' });
    publicStateAt = Date.now();
    return publicState;
  }

  function providerName(key) {
    return { youtube:'YouTube', instagram:'Instagram', tiktok:'TikTok', spotify:'Spotify' }[key] || key;
  }

  function compact(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', { notation:'compact', maximumFractionDigits:1 }).format(number);
  }

  function applyLiveMetrics(metrics = {}) {
    Object.entries(metrics).forEach(([provider, data]) => {
      if (!data || data.error) return;
      const card = document.querySelector(`.network-card[data-provider="${provider}"]`);
      if (!card) return;
      const currentBadge = card.querySelector('.network-head b')?.textContent || '';
      if (/OFICIAL/i.test(currentBadge) && !/TIKHUB/i.test(currentBadge)) return;
      const handle = card.querySelector('.network-head p');
      const badge = card.querySelector('.network-head b');
      const stats = card.querySelectorAll('.network-stats strong');
      const footer = card.querySelector('.network-footer span');
      if (handle && data.handle) handle.textContent = data.handle;
      if (badge) badge.textContent = '● TIKHUB';
      if (stats[0]) stats[0].textContent = compact(data.followers);
      if (stats[1]) stats[1].textContent = compact(data.views);
      if (footer) footer.textContent = `Alcance ${compact(data.reach)} · dados públicos reais`;
      card.dataset.ondaLiveSource = 'tikhub';
    });
  }

  function updatePanel(panel, state) {
    if (!panel || !state) return;
    panel.querySelectorAll('[data-source-mode]').forEach(button => button.classList.toggle('active', button.dataset.sourceMode === state.mode));
    const status = panel.querySelector('.onda-social-live-state');
    const configuredAccounts = Object.entries(state.accounts || {}).filter(([, account]) => account?.enabled && account?.id).map(([key, account]) => `${providerName(key)}: @${String(account.id).replace(/^@/, '')}`);
    status.className = `onda-social-live-state ${state.mode}`;
    status.innerHTML = `<i></i><span>${state.mode === 'real' ? 'Vitrine usando dados verdadeiros' : 'Vitrine usando dados demonstrativos'}${state.tikhubConfigured ? ' · TikHub configurada' : ''}${configuredAccounts.length ? ` · ${esc(configuredAccounts.join(' · '))}` : ''}</span>`;
    if (state.mode === 'real') applyLiveMetrics(state.metrics || {});
  }

  async function saveMode(mode, panel) {
    const buttons = panel.querySelectorAll('[data-source-mode]');
    buttons.forEach(button => button.disabled = true);
    try {
      await fetchJson('/social-live-api?action=config', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ mode }),
      });
      const state = await getPublicState(true);
      updatePanel(panel, state);
      await syncAllPublicFrames(true);
      toast(mode === 'real' ? 'Vitrine alterada para dados verdadeiros' : 'Vitrine alterada para demonstração');
    } catch (error) {
      toast(error.message);
    } finally {
      buttons.forEach(button => button.disabled = false);
    }
  }

  async function openManager(panel) {
    let config;
    let oauth = {};
    try {
      [config, oauth] = await Promise.all([
        fetchJson('/social-live-api?action=config', { cache:'no-store' }),
        fetch('/api/social/status', { cache:'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      ]);
    } catch (error) {
      toast(error.message);
      return;
    }

    document.querySelector('.onda-social-manager-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'onda-social-manager-overlay';
    const account = key => config.accounts?.[key] || { id:'', enabled:true };
    const oauthBox = key => {
      const item = oauth[key] || {};
      const label = item.connected ? 'OAuth oficial conectado' : item.configured ? 'OAuth pronto para conectar' : 'OAuth ainda não configurado';
      return `<div class="${item.connected ? 'connected' : ''}"><strong>${providerName(key)}</strong><small>${esc(label)}</small></div>`;
    };

    overlay.innerHTML = `<section class="onda-social-manager" role="dialog" aria-modal="true" aria-label="Gerenciar contas sociais">
      <div class="onda-social-manager-head"><div><small>INTEGRAÇÕES SOCIAIS</small><h2>Contas reais da vitrine</h2><p>Adicione suas contas públicas via TikHub ou continue usando o OAuth oficial já existente. A API Key fica somente no servidor.</p></div><button class="onda-social-manager-close" type="button" aria-label="Fechar">×</button></div>
      <form data-onda-social-form>
        <div class="onda-social-manager-body">
          <section class="onda-social-section"><header><h3>TikHub API</h3><span>${config.tikhubConfigured ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}</span></header>
            <div class="onda-social-form-grid"><label class="onda-social-field wide"><span>API Key TikHub</span><input name="apiKey" type="password" autocomplete="new-password" placeholder="${config.tikhubConfigured ? 'Deixe em branco para manter a chave atual' : 'Cole sua API Key da tikhub.io'}"></label></div>
          </section>
          <section class="onda-social-section"><header><h3>Contas que podem alimentar a vitrine</h3><span>DADOS PÚBLICOS</span></header>
            <div class="onda-social-form-grid">
              <div class="onda-account-field"><span class="onda-account-icon">TT</span><label class="onda-social-field"><span>TikTok · usuário</span><input name="tiktok" value="${esc(account('tiktok').id)}" placeholder="ex.: bebezaopodcast"></label><label class="onda-enable"><input name="tiktokEnabled" type="checkbox" ${account('tiktok').enabled !== false ? 'checked' : ''}> Ativo</label></div>
              <div class="onda-account-field"><span class="onda-account-icon">IG</span><label class="onda-social-field"><span>Instagram · usuário</span><input name="instagram" value="${esc(account('instagram').id)}" placeholder="ex.: aquinocast"></label><label class="onda-enable"><input name="instagramEnabled" type="checkbox" ${account('instagram').enabled !== false ? 'checked' : ''}> Ativo</label></div>
              <div class="onda-account-field"><span class="onda-account-icon">YT</span><label class="onda-social-field"><span>YouTube · Channel ID ou @handle</span><input name="youtube" value="${esc(account('youtube').id)}" placeholder="UC... ou @canal"></label><label class="onda-enable"><input name="youtubeEnabled" type="checkbox" ${account('youtube').enabled !== false ? 'checked' : ''}> Ativo</label></div>
            </div>
            <div class="onda-oauth-status">${oauthBox('youtube')}${oauthBox('instagram')}${oauthBox('tiktok')}</div>
            <p style="margin:12px 0 0;font:600 9px/1.55 system-ui;color:var(--muted,#667085)">O botão “Conectar canal” da tela continua sendo o caminho do OAuth oficial. Quando houver OAuth oficial e TikHub para a mesma rede, a vitrine prioriza o dado oficial autenticado.</p>
          </section>
          <section class="onda-social-section"><header><h3>Estrutura TikTok</h3><span>STATUS</span></header>
            <div class="onda-social-tech-list"><article><b>Login Social · OAuth 2.0</b><span>Fluxo oficial já existente no painel para conectar a conta autorizada.</span><em>DISPONÍVEL</em></article><article><b>Pixel + Events API</b><span>Área preparada para a próxima etapa de conversões server-side.</span><em>EXIGE CREDENCIAIS DO TIKTOK ADS</em></article><article><b>Lead Gen · Webhooks</b><span>Integração de leads em tempo real será ativada com o app/credenciais de anúncios.</span><em>EXIGE CREDENCIAIS DO TIKTOK ADS</em></article></div>
          </section>
          <p class="onda-social-manager-error" data-social-error></p>
        </div>
        <div class="onda-social-manager-actions"><button class="cancel" type="button" data-social-cancel>Cancelar</button><button class="save" type="submit">Salvar contas</button></div>
      </form>
    </section>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.onda-social-manager-close').onclick = close;
    overlay.querySelector('[data-social-cancel]').onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    const form = overlay.querySelector('[data-onda-social-form]');
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      const error = form.querySelector('[data-social-error]');
      const data = new FormData(form);
      button.disabled = true;
      error.textContent = '';
      try {
        const result = await fetchJson('/social-live-api?action=config', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            apiKey:String(data.get('apiKey') || '').trim(),
            accounts:{
              tiktok:{ id:String(data.get('tiktok') || '').trim(), enabled:data.has('tiktokEnabled') },
              instagram:{ id:String(data.get('instagram') || '').trim(), enabled:data.has('instagramEnabled') },
              youtube:{ id:String(data.get('youtube') || '').trim(), enabled:data.has('youtubeEnabled') },
            },
          }),
        });
        publicState = null;
        const state = await getPublicState(true);
        updatePanel(panel, state);
        close();
        await syncAllPublicFrames(true);
        toast(result.tikhubConfigured ? 'Contas sociais salvas no Supabase' : 'Contas salvas; adicione a API Key TikHub para ativar os dados públicos');
      } catch (saveError) {
        error.textContent = saveError.message;
      } finally {
        button.disabled = false;
      }
    };
  }

  async function mountMetricsPanel() {
    ensureStyle();
    const grid = document.querySelector('.metrics-network-grid');
    if (!grid || document.querySelector(`.${PANEL_CLASS}`)) return;
    const panel = document.createElement('section');
    panel.className = PANEL_CLASS;
    panel.innerHTML = `<div><small>FONTE DA VITRINE</small><h3>Demonstrativo ou dados verdadeiros</h3><p>Escolha o que o público verá nos cards de redes sociais. Contas autenticadas por OAuth têm prioridade; TikHub complementa contas públicas.</p></div><div class="onda-social-source-actions"><div class="onda-source-toggle"><button type="button" data-source-mode="demo">Demonstrativo</button><button type="button" data-source-mode="real">Verdadeiro</button></div><button type="button" class="onda-social-manage" data-social-manage>Gerenciar contas</button></div><div class="onda-social-live-state demo"><i></i><span>Carregando fonte da vitrine...</span></div>`;
    grid.parentNode.insertBefore(panel, grid);
    panel.querySelectorAll('[data-source-mode]').forEach(button => button.onclick = () => saveMode(button.dataset.sourceMode, panel));
    panel.querySelector('[data-social-manage]').onclick = () => openManager(panel);
    try {
      const state = await getPublicState(true);
      updatePanel(panel, state);
    } catch (error) {
      panel.querySelector('.onda-social-live-state span').textContent = `Não foi possível consultar a fonte: ${error.message}`;
    }
  }

  async function resolvedShowcase() {
    const [showcase, social] = await Promise.all([
      fetchJson('/api/public/showcase', { cache:'no-store' }).catch(() => ({})),
      getPublicState(false).catch(() => ({ mode:'demo', metrics:{} })),
    ]);
    const oauthMetrics = showcase?.metrics && typeof showcase.metrics === 'object' ? showcase.metrics : {};
    const tikhubMetrics = social?.metrics && typeof social.metrics === 'object' ? social.metrics : {};
    const metrics = social.mode === 'real' ? { ...tikhubMetrics, ...oauthMetrics } : {};
    return { ...showcase, metrics, socialDisplayMode:social.mode };
  }

  async function syncPublicFrame(frame, force = false) {
    if (!frame) return;
    if (!force && frame.dataset.ondaSocialModeSynced === '1') return;
    frame.dataset.ondaSocialModeSynced = '1';
    try {
      if (force) publicState = null;
      const data = await resolvedShowcase();
      const payload = { type:'onda-showcase-data', data };
      const send = () => {
        try { frame.contentWindow?.postMessage(payload, location.origin); } catch {}
      };
      send();
      setTimeout(send, 350);
      setTimeout(send, 1100);
      setTimeout(send, 2400);
    } catch {}
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaSocialLiveWatch === '1') return;
    frame.dataset.ondaSocialLiveWatch = '1';
    frame.addEventListener('load', () => {
      frame.dataset.ondaSocialModeSynced = '0';
      setTimeout(() => syncPublicFrame(frame, true), 120);
    });
    setTimeout(() => syncPublicFrame(frame), 200);
  }

  async function syncAllPublicFrames(force = false) {
    const frames = Array.from(document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]'));
    await Promise.all(frames.map(frame => syncPublicFrame(frame, force)));
  }

  function scan() {
    document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(watchFrame);
    mountMetricsPanel();
  }

  function scheduleScan() {
    if (observerScheduled) return;
    observerScheduled = true;
    queueMicrotask(() => {
      observerScheduled = false;
      scan();
    });
  }

  ensureStyle();
  scan();
  new MutationObserver(scheduleScan).observe(document.documentElement, { childList:true, subtree:true });
})();
