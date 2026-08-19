(() => {
  const STYLE_ID = 'onda-shorts-916-hover-fix';
  const css = `
    .clips-row.onda-safe-shorts-row .onda-safe-short {
      transition: height .24s cubic-bezier(.2,.8,.2,1), box-shadow .24s ease, border-radius .24s ease !important;
      transform-origin: center center !important;
    }

    .clips-row.onda-safe-shorts-row .onda-safe-short:hover,
    .clips-row.onda-safe-shorts-row .onda-safe-short:focus-within,
    .clips-row.onda-safe-shorts-row .onda-safe-short.onda-player-ready {
      height: 241.7778px !important;
      aspect-ratio: 9 / 16 !important;
      border-radius: 22px !important;
      box-shadow: 0 18px 38px rgba(15,23,42,.22) !important;
    }

    .clips-row.onda-safe-shorts-row .onda-safe-short:hover .onda-short-player,
    .clips-row.onda-safe-shorts-row .onda-safe-short:focus-within .onda-short-player,
    .clips-row.onda-safe-shorts-row .onda-safe-short.onda-player-ready .onda-short-player {
      width: 100% !important;
      height: 100% !important;
      inset: 0 !important;
      object-fit: cover !important;
    }

    @media (max-width:700px) {
      .clips-row.onda-safe-shorts-row .onda-safe-short:focus-within,
      .clips-row.onda-safe-shorts-row .onda-safe-short.onda-player-ready {
        height: 209.7778px !important;
        aspect-ratio: 9 / 16 !important;
        border-radius: 19px !important;
      }
    }
  `;

  function apply(frame) {
    try {
      const doc = frame?.contentDocument;
      if (!doc?.head) return;
      let style = doc.getElementById(STYLE_ID);
      if (!style) {
        style = doc.createElement('style');
        style.id = STYLE_ID;
        doc.head.appendChild(style);
      }
      style.textContent = css;
    } catch {}
  }

  function watch(frame) {
    if (!frame || frame.dataset.onda916Watch === '1') return;
    frame.dataset.onda916Watch = '1';
    frame.addEventListener('load', () => {
      apply(frame);
      setTimeout(() => apply(frame), 500);
      setTimeout(() => apply(frame), 1200);
    });
    apply(frame);
    setTimeout(() => apply(frame), 700);
  }

  const scan = () => {
    document
      .querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]')
      .forEach(watch);
  };

  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
