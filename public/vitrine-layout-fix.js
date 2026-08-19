(() => {
  const STYLE_ID = 'onda-vitrine-layout-fix';

  const css = `
    /* Área inferior: enquanto os vídeos não forem publicados. */
    .clips-container-main {
      width: 100% !important;
      max-width: none !important;
      align-items: stretch !important;
    }
    .clips-row-wrap {
      width: 100% !important;
      max-width: none !important;
      overflow: hidden !important;
      justify-content: center !important;
      padding: 24px 0 18px !important;
      margin: 0 !important;
    }
    .clips-row {
      width: 100% !important;
      max-width: none !important;
      min-width: 0 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      margin: 0 !important;
      padding: 0 12px !important;
    }
    .clips-coming-soon {
      width: min(100%, 620px);
      min-height: 118px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      border-radius: 24px;
      border: 1px solid var(--border-light, rgba(148,163,184,.18));
      background: var(--bg-card, rgba(255,255,255,.82));
      color: var(--text-primary, #0F172A);
      box-shadow: var(--shadow-soft, 0 12px 28px rgba(15,23,42,.08));
      font-size: clamp(17px, 2.2vw, 24px);
      font-weight: 800;
      letter-spacing: -.02em;
    }
    body.dark-mode .clips-coming-soon {
      background: rgba(15,23,42,.78);
      color: #F8FAFC;
      border-color: rgba(148,163,184,.16);
      box-shadow: 0 14px 32px rgba(0,0,0,.22);
    }

    /* PC: ocupa a largura toda até o final. */
    @media (min-width: 1181px) {
      body { width: 100% !important; }
      .dashboard { width: 100% !important; max-width: none !important; }
      .bottom-showcase,
      .clips-container-main,
      .clips-row-wrap { width: 100% !important; max-width: none !important; }
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

    /* Celular: redes em carrossel horizontal automático, uma passando para o lado da outra. */
    @media (max-width: 700px) {
      .analytics-grid {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 12px !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
        width: 100% !important;
        padding: 2px max(9vw, 18px) 14px !important;
        margin: 0 !important;
        scroll-snap-type: x mandatory !important;
        scroll-behavior: smooth !important;
        scrollbar-width: none !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior-inline: contain !important;
      }
      .analytics-grid::-webkit-scrollbar { display: none !important; }
      .platform-card {
        flex: 0 0 min(82vw, 320px) !important;
        width: min(82vw, 320px) !important;
        min-width: min(82vw, 320px) !important;
        scroll-snap-align: center !important;
        scroll-snap-stop: always !important;
      }
      .clips-row-wrap {
        width: 100% !important;
        margin: 0 !important;
        padding: 18px 0 14px !important;
      }
      .clips-coming-soon {
        width: calc(100% - 20px);
        min-height: 104px;
        border-radius: 20px;
        font-size: 18px;
      }
    }
  `;

  function showComingSoon(doc) {
    const row = doc.querySelector('.clips-row');
    if (!row || row.dataset.ondaComingSoon === '1') return;
    row.dataset.ondaComingSoon = '1';
    row.innerHTML = '<div class="clips-coming-soon" role="status">Em breve vídeos</div>';
  }

  function startSocialCarousel(doc) {
    const grid = doc.querySelector('.analytics-grid');
    if (!grid || grid.dataset.ondaSocialCarousel === '1') return;

    grid.dataset.ondaSocialCarousel = '1';
    let index = 0;
    let timer = null;
    let resumeTimer = null;
    let userInteracting = false;

    const isMobile = () => (doc.defaultView?.innerWidth || 9999) <= 700;
    const cards = () => Array.from(grid.querySelectorAll('.platform-card'));

    const centeredLeft = card => {
      return Math.max(0, card.offsetLeft - (grid.clientWidth - card.clientWidth) / 2);
    };

    const goTo = (nextIndex, smooth = true) => {
      const list = cards();
      if (!list.length || !isMobile()) return;
      index = ((nextIndex % list.length) + list.length) % list.length;
      grid.scrollTo({
        left: centeredLeft(list[index]),
        behavior: smooth ? 'smooth' : 'auto'
      });
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const start = () => {
      stop();
      if (!isMobile()) return;
      timer = setInterval(() => {
        if (userInteracting || doc.hidden) return;
        const list = cards();
        if (list.length < 2) return;
        goTo(index + 1, true);
      }, 3200);
    };

    const pauseForUser = () => {
      userInteracting = true;
      stop();
      if (resumeTimer) clearTimeout(resumeTimer);
    };

    const resumeAfterUser = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        userInteracting = false;
        const list = cards();
        if (list.length) {
          const center = grid.scrollLeft + grid.clientWidth / 2;
          let nearest = 0;
          let nearestDistance = Infinity;
          list.forEach((card, i) => {
            const cardCenter = card.offsetLeft + card.clientWidth / 2;
            const distance = Math.abs(cardCenter - center);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearest = i;
            }
          });
          index = nearest;
        }
        start();
      }, 1300);
    };

    grid.addEventListener('touchstart', pauseForUser, { passive: true });
    grid.addEventListener('touchend', resumeAfterUser, { passive: true });
    grid.addEventListener('touchcancel', resumeAfterUser, { passive: true });
    grid.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse') pauseForUser();
    }, { passive: true });
    grid.addEventListener('pointerup', event => {
      if (event.pointerType !== 'mouse') resumeAfterUser();
    }, { passive: true });

    doc.defaultView?.addEventListener('resize', () => {
      stop();
      if (isMobile()) {
        setTimeout(() => goTo(index, false), 80);
        start();
      }
    });

    setTimeout(() => {
      if (isMobile()) goTo(0, false);
      start();
    }, 350);
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
      showComingSoon(doc);
      startSocialCarousel(doc);
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
