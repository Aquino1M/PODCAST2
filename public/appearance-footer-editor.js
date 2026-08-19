(() => {
  const DEFAULT_TEXT = 'WWW.AQUINOCAST.COM';
  const STYLE_ID = 'onda-footer-text-editor-style';
  let cachedText = null;
  let loadingPromise = null;

  function normalize(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
  }

  async function loadText(force = false) {
    if (!force && cachedText !== null) return cachedText;
    if (!force && loadingPromise) return loadingPromise;
    loadingPromise = fetch('/api/footer-text', { headers:{ Accept:'application/json' }, cache:'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        cachedText = typeof data?.text === 'string' ? data.text : DEFAULT_TEXT;
        return cachedText;
      })
      .catch(() => {
        cachedText = DEFAULT_TEXT;
        return cachedText;
      })
      .finally(() => { loadingPromise = null; });
    return loadingPromise;
  }

  async function saveText(text) {
    const response = await fetch('/api/footer-text', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify({ text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Não foi possível salvar o texto');
    cachedText = typeof data?.text === 'string' ? data.text : text;
    return cachedText;
  }

  function ensureEditorStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .appearance-footer-text { grid-column:1 / -1; }
      .appearance-footer-text input { width:100%; }
      .appearance-footer-helper { display:block; margin-top:6px; font-size:11px; color:var(--muted,#64748b); }
      .appearance-footer-helper.is-ok { color:#0f9f78; }
      .appearance-footer-helper.is-error { color:#c2415b; }
    `;
    document.head.appendChild(style);
  }

  function findPublicFooterTarget(doc) {
    const marked = doc.querySelector('[data-onda-editable-footer-text]');
    if (marked) return marked;

    const candidates = Array.from(doc.querySelectorAll('p,span,small,strong,a,div'))
      .filter(element => {
        const text = normalize(element.textContent);
        return text.includes('WWW.AQUINOCAST.COM') && text.length <= 120;
      })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);

    const target = candidates[0] || null;
    if (target) target.dataset.ondaEditableFooterText = '1';
    return target;
  }

  function applyTextToFrame(frame, text) {
    try {
      const doc = frame?.contentDocument;
      if (!doc?.body) return false;
      const target = findPublicFooterTarget(doc);
      if (!target) return false;
      target.textContent = text;
      target.dataset.ondaEditableFooterText = '1';
      return true;
    } catch {
      return false;
    }
  }

  async function refreshFrames(force = false) {
    const text = await loadText(force);
    document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(frame => {
      if (!applyTextToFrame(frame, text)) {
        setTimeout(() => applyTextToFrame(frame, text), 450);
        setTimeout(() => applyTextToFrame(frame, text), 1200);
      }
    });
  }

  async function mountAppearanceField(form) {
    if (!form || form.dataset.ondaFooterEditor === '1') return;
    form.dataset.ondaFooterEditor = '1';
    ensureEditorStyle();

    const label = document.createElement('label');
    label.className = 'form-field appearance-footer-text';
    label.innerHTML = `
      <span>Texto abaixo dos vídeos</span>
      <input name="footerText" maxlength="80" autocomplete="off" placeholder="WWW.AQUINOCAST.COM">
      <small class="appearance-footer-helper" data-footer-text-status>Esse texto aparece centralizado abaixo dos Shorts na vitrine pública.</small>
    `;

    const grid = form.querySelector('.appearance-grid');
    if (grid) grid.appendChild(label);
    else form.insertBefore(label, form.firstChild);

    const input = label.querySelector('input');
    const status = label.querySelector('[data-footer-text-status]');
    input.value = await loadText();

    form.addEventListener('submit', () => {
      const value = input.value.trim();
      status.classList.remove('is-ok', 'is-error');
      status.textContent = 'Salvando no Supabase...';
      saveText(value)
        .then(saved => {
          input.value = saved;
          status.classList.add('is-ok');
          status.textContent = 'Salvo no Supabase e aplicado na vitrine.';
          refreshFrames(false);
        })
        .catch(error => {
          status.classList.add('is-error');
          status.textContent = error.message;
        });
    }, true);

    const reset = form.querySelector('[data-appearance-reset]');
    if (reset) {
      reset.addEventListener('click', () => {
        input.value = DEFAULT_TEXT;
      }, true);
    }
  }

  function scanAppearance() {
    const form = document.querySelector('[data-appearance-form]');
    if (form) mountAppearanceField(form);
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaFooterTextWatch === '1') return;
    frame.dataset.ondaFooterTextWatch = '1';
    frame.addEventListener('load', () => refreshFrames(true));
  }

  function scanFrames() {
    document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(watchFrame);
    refreshFrames(false);
  }

  scanAppearance();
  scanFrames();
  new MutationObserver(() => {
    scanAppearance();
    scanFrames();
  }).observe(document.documentElement, { childList:true, subtree:true });
})();
