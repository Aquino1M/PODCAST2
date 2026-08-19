(() => {
  const STYLE_ID = 'onda-shorts-20-feed-style';

  const css = `
    @media (min-width:701px) {
      .clips-row-wrap.onda-safe-shorts {
        width:100% !important;
        max-width:776px !important;
        margin-left:auto !important;
        margin-right:auto !important;
        overflow-x:hidden !important;
      }
      .clips-row.onda-safe-shorts-row {
        width:max-content !important;
        min-width:max-content !important;
        justify-content:flex-start !important;
      }
    }
  `;

  function ensureStyle(doc) {
    if (!doc?.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    doc.head.appendChild(style);
  }

  function makeCard(short, index, doc) {
    const card = doc.createElement('article');
    card.className = 'onda-safe-short';
    card.dataset.ondaShortId = short.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `Vídeo ${index + 1} do Podcast do Bebezão. Clique para assistir sem áudio.`);

    const fallback = doc.createElement('span');
    fallback.className = 'onda-short-fallback';
    fallback.textContent = '';

    const poster = doc.createElement('img');
    poster.className = 'onda-short-poster';
    poster.src = `/short-thumb/${encodeURIComponent(short.id)}`;
    poster.alt = '';
    poster.loading = 'lazy';
    poster.decoding = 'async';
    poster.addEventListener('error', () => { poster.style.display = 'none'; }, { once:true });

    const shade = doc.createElement('span');
    shade.className = 'onda-short-shade';

    const muted = doc.createElement('span');
    muted.className = 'onda-muted-badge';
    muted.textContent = '🔇';
    muted.title = 'Preview sem áudio';

    const hint = doc.createElement('span');
    hint.className = 'onda-preview-hint';
    hint.textContent = 'Clique para assistir';

    const open = doc.createElement('a');
    open.className = 'onda-short-open';
    open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = '↗';
    open.title = 'Abrir no YouTube';
    open.setAttribute('aria-label', `Abrir vídeo ${index + 1} no YouTube`);

    card.append(fallback, poster, shade, muted, hint, open);
    return card;
  }

  async function extendFeed(doc) {
    const row = doc.querySelector('.clips-row.onda-safe-shorts-row');
    if (!row || row.dataset.onda20Feed === '1') return false;

    row.dataset.onda20Feed = 'loading';
    try {
      const response = await doc.defaultView.fetch('/shorts-feed', {
        headers:{ Accept:'application/json' },
        cache:'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const shorts = Array.isArray(data?.shorts)
        ? data.shorts.filter(item => item?.id).slice(0,20)
        : [];
      if (shorts.length < 6) throw new Error('Feed de Shorts incompleto');

      const existingIds = new Set(
        Array.from(row.querySelectorAll('[data-onda-short-id]'))
          .map(card => String(card.dataset.ondaShortId || ''))
          .filter(Boolean)
      );

      shorts.forEach((short, index) => {
        if (existingIds.has(short.id)) return;
        row.appendChild(makeCard(short, index, doc));
        existingIds.add(short.id);
      });

      // Mantém no máximo os 20 vídeos mais recentes girando no mesmo carrossel.
      const cards = Array.from(row.querySelectorAll('.onda-safe-short'));
      if (cards.length > 20) cards.slice(20).forEach(card => card.remove());

      row.dataset.onda20Feed = '1';
      row.querySelectorAll('.onda-preview-hint').forEach(hint => {
        hint.textContent = 'Clique para assistir';
      });
      return true;
    } catch (error) {
      row.dataset.onda20Feed = 'error';
      setTimeout(() => { if (row.isConnected) delete row.dataset.onda20Feed; }, 5000);
      return false;
    }
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.onda20FeedWatch === '1') return;
    frame.dataset.onda20FeedWatch = '1';

    let timer = null;
    const tryMount = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body) return;
        ensureStyle(doc);
        extendFeed(doc);
      } catch {}
    };

    const start = () => {
      if (timer) clearInterval(timer);
      tryMount();
      timer = setInterval(() => {
        tryMount();
        try {
          const doc = frame.contentDocument;
          if (doc?.querySelector('.clips-row.onda-safe-shorts-row[data-onda20-feed="1"]')) {
            clearInterval(timer);
            timer = null;
          }
        } catch {}
      }, 500);
      setTimeout(() => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 15000);
    };

    frame.addEventListener('load', start);
    start();
  }

  const scan = () => document
    .querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]')
    .forEach(watchFrame);

  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
})();
