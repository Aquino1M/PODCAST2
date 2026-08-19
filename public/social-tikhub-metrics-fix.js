(() => {
  const ENDPOINT = '/tikhub-metrics-v2';
  let state = null;
  let loading = null;
  let scheduled = false;
  let showcaseCache = null;
  let showcaseAt = 0;

  const compact = value => new Intl.NumberFormat('pt-BR', { notation:'compact', maximumFractionDigits:1 }).format(Number(value || 0));

  async function json(url, options) {
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  async function load(force = false) {
    if (!force && state) return state;
    if (loading) return loading;
    loading = json(`${ENDPOINT}?fresh=${Date.now()}`, { cache:'no-store' })
      .then(value => (state = value))
      .finally(() => { loading = null; });
    return loading;
  }

  async function showcase(force = false) {
    if (!force && showcaseCache && Date.now() - showcaseAt < 30_000) return showcaseCache;
    showcaseCache = await json('/api/public/showcase', { cache:'no-store' }).catch(() => ({}));
    showcaseAt = Date.now();
    return showcaseCache;
  }

  function patchMetricCards(data) {
    if (!data || data.mode !== 'real') return;
    Object.entries(data.metrics || {}).forEach(([provider, metric]) => {
      const card = document.querySelector(`.network-card[data-provider="${provider}"]`);
      if (!card) return;

      const badge = card.querySelector('.network-head b');
      const handle = card.querySelector('.network-head p');
      const values = card.querySelectorAll('.network-stats strong');
      const footer = card.querySelector('.network-footer span');

      if (metric?.error) {
        if (badge) {
          badge.textContent = '● TIKHUB';
          badge.title = metric.error;
        }
        if (footer) {
          footer.textContent = /balance|credit|saldo/i.test(metric.error)
            ? 'TikHub: saldo necessário para consultar esta rede'
            : 'TikHub: não foi possível atualizar esta rede';
          footer.title = metric.error;
        }
        card.dataset.ondaTikHubError = '1';
        return;
      }

      if (!metric) return;
      card.dataset.ondaTikHubError = '0';
      card.dataset.ondaLiveSource = 'tikhub';
      if (handle && metric.handle) handle.textContent = metric.handle;
      if (badge) {
        badge.textContent = '● TIKHUB';
        badge.title = 'Dados públicos reais via TikHub';
      }
      if (values[0]) values[0].textContent = compact(metric.followers);
      if (values[1]) values[1].textContent = compact(metric.views);
      if (footer) footer.textContent = `Alcance ${compact(metric.reach)} · dados públicos reais`;
    });
  }

  function patchDashboard(data) {
    if (!data || data.mode !== 'real') return;
    Object.entries(data.metrics || {}).forEach(([provider, metric]) => {
      if (!metric || metric.error) return;
      const panel = document.querySelector(`[data-channel-panel="${provider}"]`);
      if (!panel) return;
      const badge = panel.querySelector('header small');
      const total = panel.querySelector('.auth-channel-total b');
      if (badge) badge.textContent = 'TIKHUB';
      if (total) total.textContent = compact(metric.views);
    });
  }

  async function syncFrames(data, force = false) {
    if (!data || data.mode !== 'real') return;
    const publicData = await showcase(force);
    const oauth = publicData?.metrics && typeof publicData.metrics === 'object' ? publicData.metrics : {};
    const tikhub = data.metrics && typeof data.metrics === 'object'
      ? Object.fromEntries(Object.entries(data.metrics).filter(([, metric]) => metric && !metric.error))
      : {};
    const merged = { ...tikhub, ...oauth };
    const payload = { type:'onda-showcase-data', data:{ ...publicData, metrics:merged, socialDisplayMode:'real' } };
    document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(frame => {
      try { frame.contentWindow?.postMessage(payload, location.origin); } catch {}
    });
  }

  async function apply(force = false) {
    try {
      const data = await load(force);
      patchMetricCards(data);
      patchDashboard(data);
      await syncFrames(data, force);
    } catch {}
  }

  function directFormValue(form, name) {
    const field = form.elements?.namedItem(name);
    return field && 'value' in field ? String(field.value || '').trim() : '';
  }

  function directChecked(form, name) {
    const field = form.elements?.namedItem(name);
    return Boolean(field && 'checked' in field && field.checked);
  }

  document.addEventListener('submit', async event => {
    const form = event.target?.closest?.('[data-tikhub-form]');
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const button = form.querySelector('.save,[type="submit"]');
    const error = form.querySelector('[data-tikhub-error]');
    if (button) button.disabled = true;
    if (error) error.textContent = '';

    try {
      const result = await json('/social-live-api?action=config', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          apiKey:directFormValue(form, 'apiKey'),
          accounts:{
            tiktok:{ id:directFormValue(form, 'tiktok'), enabled:directChecked(form, 'tiktokEnabled') },
            instagram:{ id:directFormValue(form, 'instagram'), enabled:directChecked(form, 'instagramEnabled') },
            youtube:{ id:directFormValue(form, 'youtube'), enabled:directChecked(form, 'youtubeEnabled') },
          },
        }),
      });

      state = null;
      showcaseCache = null;
      await apply(true);
      form.closest('.onda-tikhub-overlay')?.remove();

      document.dispatchEvent(new CustomEvent('onda:tikhub-saved', { detail:result }));
      const metricsNav = document.querySelector('[data-page="metrics"]');
      if (metricsNav) {
        metricsNav.click();
        setTimeout(() => apply(true), 300);
      }
    } catch (saveError) {
      if (error) error.textContent = saveError.message;
    } finally {
      if (button) button.disabled = false;
    }
  }, true);

  document.addEventListener('onda:tikhub-saved', () => {
    state = null;
    showcaseCache = null;
    setTimeout(() => apply(true), 100);
  });

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (document.querySelector('.metrics-network-grid,[data-channel-panel],iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]')) apply(false);
    });
  }

  new MutationObserver(scheduleApply).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('focus', () => apply(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(true); });
  setTimeout(() => apply(true), 450);
  setTimeout(() => apply(false), 1600);
})();
