(() => {
  const STYLE_ID = 'onda-vitrine-layout-fix';

  const css = `
    /* Ajuste solicitado: cards de vídeo todos do mesmo tamanho, centralizados e rolando. */
    .clips-container-main {
      width: 100% !important;
      max-width: none !important;
      align-items: stretch !important;
    }
    .clips-row-wrap {
      width: 100% !important;
      max-width: none !important;
      overflow-x: hidden !important;
      overflow-y: visible !important;
      justify-content: flex-start !important;
      padding: 12px 0 18px !important;
      margin: 0 !important;
    }
    .clips-row {
      width: max-content !important;
      max-width: none !important;
      min-width: max-content !important;
      justify-content: flex-start !important;
      align-items: center !important;
      gap: 24px !important;
      margin: 0 !important;
      padding: 0 12px !important;
    }
    .row-clip-card,
    .row-clip-card.featured {
      width: 112px !important;
      height: 118px !important;
      flex: 0 0 112px !important;
      margin: 0 !important;
      padding: 22px 10px 14px !important;
      border-radius: 20px !important;
      border: 1px solid rgba(255,255,255,.7) !important;
      box-shadow: 0 12px 28px rgba(15,23,42,.14), 0 3px 10px rgba(15,23,42,.06) !important;
      transform: none !important;
    }
    .row-clip-card.featured .row-clip-initial {
      width: auto !important;
      height: auto !important;
      border-radius: 0 !important;
      display: block !important;
      font-size: 30px !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .row-clip-card.featured .row-clip-name {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      text-shadow: 0 3px 10px rgba(0,0,0,.5) !important;
    }

    /* PC: ocupa a largura toda até o final. */
    @media (min-width: 1181px) {
      body { width: 100% !important; }
      .dashboard { width: 100% !important; max-width: none !important; }
      .bottom-showcase,
      .clips-container-main,
      .clips-row-wrap { width: 100% !important; max-width: none !important; }
      .clips-row { min-width: 100% !important; }
    }

    /* Tablet: as quatro redes ficam em uma única linha, não 2x2. */
    @media (min-width: 701px) and (max-width: 1024px) {
      .analytics-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 12px !important;
        width: 100% !important;
      }
      .platform-card {
        min-width: 0 !important;
        width: 100% !important;
        padding: 14px !important;
        gap: 14px !important;
      }
      .platform-title { font-size: 11px !important; gap: 7px !important; }
      .icon-wrapper,
      .brand-logo-img,
      .tiktok-logo-img { width: 30px !important; height: 30px !important; }
      .main-metric { font-size: 18px !important; }
      .growth-pill { font-size: 9px !important; padding: 3px 5px !important; }
      .line-chart-container { height: 112px !important; }
      .bar-chart-container { gap: 5px !important; }
      .bar-label { font-size: 8px !important; }
      .gauge-wrapper { width: 92px !important; height: 92px !important; }
      .gauge-percentage { font-size: 22px !important; }
    }

    /* Celular: continua uma única fileira horizontal; nada de 2x2. */
    @media (max-width: 700px) {
      .analytics-grid {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 12px !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
        width: 100% !important;
        padding: 2px 2px 14px !important;
        margin: 0 !important;
        scroll-snap-type: x mandatory !important;
        scrollbar-width: none !important;
        -webkit-overflow-scrolling: touch !important;
      }
      .analytics-grid::-webkit-scrollbar { display: none !important; }
      .platform-card {
        flex: 0 0 min(82vw, 320px) !important;
        width: min(82vw, 320px) !important;
        min-width: min(82vw, 320px) !important;
        scroll-snap-align: center !important;
      }
      .clips-row-wrap {
        overflow-x: hidden !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 12px 0 18px !important;
      }
      .clips-row { gap: 14px !important; padding: 0 8px !important; }
      .row-clip-card,
      .row-clip-card.featured {
        width: 96px !important;
        height: 104px !important;
        flex-basis: 96px !important;
        border-radius: 18px !important;
        padding: 18px 8px 12px !important;
      }
    }
  `;

  function startClipLoop(doc) {
    const viewport = doc.querySelector('.clips-row-wrap');
    const row = doc.querySelector('.clips-row');
    if (!viewport || !row || viewport.dataset.ondaAutoScroll === '1') return;

    viewport.dataset.ondaAutoScroll = '1';
    const original = Array.from(row.children);
    if (original.length > 1) {
      original.forEach(card => row.appendChild(card.cloneNode(true)));
    }

    let paused = false;
    let last = performance.now();
    const half = () => row.scrollWidth / 2;

    const tick = now => {
      if (!doc.defaultView || !doc.body.isConnected) return;
      if (!paused && !doc.hidden && row.scrollWidth > viewport.clientWidth) {
        viewport.scrollLeft += Math.min(1.2, (now - last) * 0.035);
        const limit = half();
        if (limit > 0 && viewport.scrollLeft >= limit) viewport.scrollLeft -= limit;
      }
      last = now;
      doc.defaultView.requestAnimationFrame(tick);
    };

    viewport.addEventListener('mouseenter', () => { paused = true; });
    viewport.addEventListener('mouseleave', () => { paused = false; });
    viewport.addEventListener('touchstart', () => { paused = true; }, { passive: true });
    viewport.addEventListener('touchend', () => { setTimeout(() => { paused = false; }, 1200); }, { passive: true });
    doc.defaultView.requestAnimationFrame(tick);
  }

  function applyToFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc?.head) return;
      if (!doc.getElementById(STYLE_ID)) {
        const style = doc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = css;
        doc.head.appendChild(style);
      }
      startClipLoop(doc);
    } catch (_) {}
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaLayoutFix === '1') return;
    frame.dataset.ondaLayoutFix = '1';
    frame.addEventListener('load', () => applyToFrame(frame));
    applyToFrame(frame);
  }

  const scan = () => document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(watchFrame);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
