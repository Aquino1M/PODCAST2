(() => {
  const ENDPOINT = '/tikhub-metrics-v2';
  const REFRESH_MS = 60_000;
  let state = null;
  let stateAt = 0;
  let loading = null;
  let showcaseCache = null;
  let showcaseAt = 0;
  let applying = false;

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const compact = value => new Intl.NumberFormat('pt-BR', { notation:'compact', maximumFractionDigits:1 }).format(number(value));
  const usable = metric => Boolean(metric && !metric.error && [metric.followers, metric.views, metric.reach, metric.likes, metric.posts].some(value => number(value) > 0));

  async function json(url, options) {
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  async function load(force = false) {
    if (!force && state && Date.now() - stateAt < REFRESH_MS) return state;
    if (loading) return loading;
    loading = json(ENDPOINT, { cache:'no-store' })
      .then(value => {
        state = value;
        stateAt = Date.now();
        return value;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  async function showcase(force = false) {
    if (!force && showcaseCache && Date.now() - showcaseAt < REFRESH_MS) return showcaseCache;
    showcaseCache = await json('/api/public/showcase', { cache:'no-store' }).catch(() => ({}));
    showcaseAt = Date.now();
    return showcaseCache;
  }

  function errorLabel(metric) {
    const text = String(metric?.error || '');
    if (/balance|credit|saldo|paid balance|free credits/i.test(text)) return 'TikHub: saldo necessário';
    return 'TikHub: dados indisponíveis';
  }

  function patchMetricCards(data) {
    if (!data || data.mode !== 'real') return;
    for (const provider of ['tiktok','instagram','youtube']) {
      const metric = data.metrics?.[provider];
      const card = document.querySelector(`.network-card[data-provider="${provider}"]`);
      if (!card || !metric) continue;

      const badge = card.querySelector('.network-head b');
      const handle = card.querySelector('.network-head p');
      const values = card.querySelectorAll('.network-stats strong');
      const footer = card.querySelector('.network-footer span');

      if (badge) {
        badge.textContent = '● TIKHUB';
        badge.title = metric.error || 'Dados públicos reais via TikHub';
      }
      if (handle && metric.handle) handle.textContent = metric.handle;

      if (!usable(metric)) {
        values.forEach(value => { value.textContent = '—'; });
        if (footer) footer.textContent = metric.error ? errorLabel(metric) : 'TikHub: aguardando dados válidos';
        card.dataset.ondaTikHubError = '1';
        continue;
      }

      card.dataset.ondaTikHubError = '0';
      card.dataset.ondaLiveSource = 'tikhub';
      if (values[0]) values[0].textContent = compact(metric.followers);
      if (values[1]) values[1].textContent = compact(metric.views);
      if (footer) footer.textContent = `Alcance ${compact(metric.reach)} · dados públicos reais`;
    }
  }

  function patchDashboard(data) {
    if (!data || data.mode !== 'real') return;
    for (const provider of ['tiktok','instagram','youtube']) {
      const metric = data.metrics?.[provider];
      if (!metric) continue;
      const panel = document.querySelector(`[data-channel-panel="${provider}"]`);
      if (!panel) continue;
      const badge = panel.querySelector('header small');
      const total = panel.querySelector('.auth-channel-total b');
      if (badge) badge.textContent = 'TIKHUB';
      if (total) total.textContent = usable(metric) ? compact(metric.views || metric.reach || metric.followers) : '—';
    }
  }

  function patchFrameUnavailable(frame, data) {
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc) return;
    for (const provider of ['tiktok','instagram','youtube']) {
      const metric = data.metrics?.[provider];
      if (!metric || usable(metric)) continue;
      const card = doc.getElementById(`card-${provider}`);
      if (!card) continue;
      const main = card.querySelector('.main-metric');
      if (main) main.textContent = '—';
      card.title = metric.error ? errorLabel(metric) : 'Aguardando dados válidos da TikHub';
    }
  }

  function patchTikHubOnlyModal() {
    const list = document.querySelector('.modal-overlay .connection-list');
    if (!list) return;
    const tikhub = list.querySelector(':scope > .onda-tikhub-row');
    if (!tikhub) return;

    [...list.children].forEach(child => {
      if (child !== tikhub) child.remove();
    });

    const overlay = list.closest('.modal-overlay');
    const eyebrow = overlay?.querySelector('.modal-head .eyebrow');
    const title = overlay?.querySelector('.modal-head h2');
    if (eyebrow) eyebrow.textContent = 'TIKHUB API';
    if (title) title.textContent = 'Conectar contas pela TikHub';

    list.parentElement?.querySelector('.setup-note')?.remove();
    const sourceText = list.parentElement?.querySelector('.onda-vitrine-source-box small');
    if (sourceText) sourceText.textContent = 'Use dados demonstrativos ou os dados verdadeiros consultados somente pela TikHub.';
  }

  function makeExtraLine(doc, base, stroke, transform, name) {
    const ns = 'http://www.w3.org/2000/svg';
    const line = doc.createElementNS(ns, 'path');
    line.setAttribute('d', base.getAttribute('d') || '');
    line.setAttribute('class', `chart-line onda-chart-extra onda-chart-${name}`);
    line.setAttribute('stroke', stroke);
    line.setAttribute('fill', 'none');
    line.setAttribute('transform', transform);
    line.setAttribute('pointer-events', 'none');
    line.style.opacity = '.9';
    return line;
  }

  function patchFourLineCharts(doc) {
    if (!doc) return;
    doc.querySelectorAll('.platform-card .chart-svg').forEach(svg => {
      const existing = svg.querySelectorAll('.onda-chart-extra');
      if (existing.length >= 2) return;
      existing.forEach(item => item.remove());

      const base = [...svg.querySelectorAll('path.chart-line:not(.onda-chart-extra)')];
      if (base.length < 2) return;

      const orange = makeExtraLine(doc, base[1], '#F59E0B', 'translate(0 7)', 'orange');
      const red = makeExtraLine(doc, base[0], '#EF4444', 'translate(0 -7)', 'red');
      const anchor = svg.querySelector('.chart-hover-line');
      if (anchor) {
        svg.insertBefore(orange, anchor);
        svg.insertBefore(red, anchor);
      } else {
        svg.appendChild(orange);
        svg.appendChild(red);
      }
    });
  }

  function bindFrameChartRefresh(frame) {
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc?.documentElement) return;
    patchFourLineCharts(doc);
    if (doc.documentElement.dataset.ondaFourLineBound === '1') return;
    doc.documentElement.dataset.ondaFourLineBound = '1';
    doc.addEventListener('click', () => {
      setTimeout(() => patchFourLineCharts(doc), 90);
      setTimeout(() => patchFourLineCharts(doc), 260);
    }, true);
  }

  function patchFrameCharts() {
    document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(frame => {
      bindFrameChartRefresh(frame);
    });
  }

  async function syncFrames(data, force = false) {
    if (!data || data.mode !== 'real') return;
    const publicData = await showcase(force);
    const realTikHub = {};
    for (const [provider, metric] of Object.entries(data.metrics || {})) {
      if (usable(metric)) realTikHub[provider] = metric;
    }

    // A vitrine usa somente a TikHub. OAuth oficial não é mais mesclado aqui.
    const payload = { type:'onda-showcase-data', data:{ ...publicData, metrics:realTikHub, socialDisplayMode:'real' } };
    document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(frame => {
      try { frame.contentWindow?.postMessage(payload, location.origin); } catch {}
      setTimeout(() => patchFrameUnavailable(frame, data), 60);
      setTimeout(() => bindFrameChartRefresh(frame), 120);
    });
  }

  async function apply(force = false) {
    if (applying) return;
    applying = true;
    try {
      const data = await load(force);
      patchMetricCards(data);
      patchDashboard(data);
      await syncFrames(data, force);
      patchFrameCharts();
      patchTikHubOnlyModal();
    } catch (error) {
      console.warn('[TikHub] atualização adiada:', error?.message || error);
    } finally {
      applying = false;
    }
  }

  const formValue = (form, name) => {
    const field = form.elements?.namedItem(name);
    return field && 'value' in field ? String(field.value || '').trim() : '';
  };
  const checked = (form, name) => {
    const field = form.elements?.namedItem(name);
    return Boolean(field && 'checked' in field && field.checked);
  };

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
          apiKey:formValue(form, 'apiKey'),
          accounts:{
            tiktok:{ id:formValue(form, 'tiktok'), enabled:checked(form, 'tiktokEnabled') },
            instagram:{ id:formValue(form, 'instagram'), enabled:checked(form, 'instagramEnabled') },
            youtube:{ id:formValue(form, 'youtube'), enabled:checked(form, 'youtubeEnabled') },
          },
        }),
      });
      state = null;
      stateAt = 0;
      showcaseCache = null;
      form.closest('.onda-tikhub-overlay')?.remove();
      document.dispatchEvent(new CustomEvent('onda:tikhub-saved', { detail:result }));
      setTimeout(() => apply(true), 180);
    } catch (saveError) {
      if (error) error.textContent = saveError.message;
    } finally {
      if (button) button.disabled = false;
    }
  }, true);

  document.addEventListener('onda:tikhub-saved', () => {
    state = null;
    stateAt = 0;
    showcaseCache = null;
    setTimeout(() => apply(true), 120);
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (target?.closest?.('[data-page="metrics"], [data-open-social], [data-action="connect-social"]')) {
      setTimeout(() => apply(false), 180);
    }
    if (target?.closest?.('[data-primary-action]')) {
      setTimeout(patchTikHubOnlyModal, 220);
      setTimeout(patchTikHubOnlyModal, 650);
      setTimeout(patchTikHubOnlyModal, 1400);
    }
  }, true);

  function watchFrames() {
    document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(frame => {
      if (frame.dataset.ondaTikHubStableWatch === '1') {
        bindFrameChartRefresh(frame);
        return;
      }
      frame.dataset.ondaTikHubStableWatch = '1';
      frame.addEventListener('load', () => {
        setTimeout(() => apply(false), 180);
        setTimeout(() => bindFrameChartRefresh(frame), 300);
        setTimeout(() => bindFrameChartRefresh(frame), 900);
      });
      bindFrameChartRefresh(frame);
    });
  }

  watchFrames();
  setTimeout(() => { watchFrames(); apply(true); patchTikHubOnlyModal(); }, 500);
  setTimeout(() => { apply(false); patchFrameCharts(); patchTikHubOnlyModal(); }, 1800);
  window.addEventListener('focus', () => {
    if (!stateAt || Date.now() - stateAt >= REFRESH_MS) apply(false);
    else patchFrameCharts();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!stateAt || Date.now() - stateAt >= REFRESH_MS) apply(false);
      else patchFrameCharts();
    }
  });
  setInterval(() => {
    if (!document.hidden && document.querySelector('.metrics-network-grid,[data-channel-panel],iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]')) {
      watchFrames();
      apply(false);
    }
  }, REFRESH_MS);
})();
