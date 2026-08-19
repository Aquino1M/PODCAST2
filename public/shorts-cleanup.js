(() => {
  const STYLE_ID = 'onda-shorts-cleanup';

  const css = `
    .onda-safe-short .onda-short-index,
    .onda-youtube-card .onda-short-number {
      display:none !important;
    }
  `;

  function clean(doc) {
    if (!doc?.head || !doc.body) return;

    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css;
      doc.head.appendChild(style);
    }

    doc.querySelectorAll('.onda-short-index,.onda-short-number').forEach(node => node.remove());

    doc.querySelectorAll('.onda-safe-short,.onda-youtube-card').forEach(card => {
      if (card.dataset.ondaClickLocal === '1') return;
      card.dataset.ondaClickLocal = '1';
      card.addEventListener('click', event => {
        if (event.target.closest('.onda-short-open')) return;
        event.preventDefault();
        event.stopPropagation();
        try { card.focus({ preventScroll:true }); } catch { card.focus(); }
      }, true);
    });
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaShortCleanupWatch === '1') return;
    frame.dataset.ondaShortCleanupWatch = '1';

    let observer = null;
    const apply = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.documentElement) return;
        clean(doc);
        if (!observer) {
          observer = new MutationObserver(() => clean(doc));
          observer.observe(doc.documentElement, { childList:true, subtree:true });
        }
      } catch {}
    };

    frame.addEventListener('load', () => {
      observer?.disconnect();
      observer = null;
      apply();
      setTimeout(apply, 500);
      setTimeout(apply, 1200);
    });

    apply();
    setTimeout(apply, 700);
  }

  const scan = () => document
    .querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]')
    .forEach(watchFrame);

  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
})();
