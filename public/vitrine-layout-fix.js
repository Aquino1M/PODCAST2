(() => {
  const STYLE_ID = 'onda-vitrine-layout-fix';

  const css = `
    /* Cards de vídeos em destaque: mantêm os quadrados e rolam lateralmente. */
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
      padding: 18px 0 20px !important;
      margin: 0 !important;
    }
    .clips-row {
      width: max-content !important;
      max-width: none !important;
      min-width: max-content !important;
      display: flex !important;
      flex-wrap: nowrap !important;
      justify-content: flex-start !important;
      align-items: center !important;
      gap: 18px !important;
      margin: 0 !important;
      padding: 0 12px !important;
    }
    .row-clip-card,
    .row-clip-card.featured {
      position: relative !important;
      width: 112px !important;
      height: 118px !important;
      flex: 0 0 112px !important;
      margin: 0 !important;
      border-radius: 20px !important;
      transform: none !important;
      overflow: hidden !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background:#0d172b !important;
    }
    .row-clip-card.onda-coming-card .row-clip-initial,
    .row-clip-card.onda-coming-card .row-clip-name,
    .row-clip-card.onda-coming-card .row-clip-play,
    .row-clip-card.onda-coming-card .premium-play {
      display: none !important;
    }
    .clip-soon-label {
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 10px !important;
      color: #fff !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      letter-spacing: .02em !important;
      text-align: center !important;
      text-shadow: 0 2px 8px rgba(0,0,0,.45) !important;
      z-index: 4 !important;
      pointer-events: none !important;
    }
    .row-clip-card.onda-youtube-card {
      background:#05070c !important;
      border:1px solid rgba(255,255,255,.12) !important;
      box-shadow:0 12px 26px rgba(15,23,42,.18) !important;
    }
    .row-clip-card.onda-youtube-card .clip-soon-label { display:none !important; }
    .onda-short-frame {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      border:0 !important;
      background:#000 !important;
      z-index:3 !important;
    }
    .onda-short-open {
      position:absolute !important;
      right:6px !important;
      top:6px !important;
      z-index:7 !important;
      width:24px !important;
      height:24px !important;
      display:grid !important;
      place-items:center !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.72) !important;
      border:1px solid rgba(255,255,255,.28) !important;
      color:#fff !important;
      text-decoration:none !important;
      font:800 11px/1 Arial,sans-serif !important;
      backdrop-filter:blur(8px) !important;
    }
    .onda-short-open:hover { background:rgba(3,7,18,.92) !important; }

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
        padding: 16px 0 16px !important;
      }
      .clips-row {
        gap: 14px !important;
        padding: 0 8px !important;
      }
      .row-clip-card,
      .row-clip-card.featured {
        width: 96px !important;
        height: 104px !important;
        flex: 0 0 96px !important;
        border-radius: 18px !important;
      }
      .clip-soon-label { font-size: 12px !important; }
      .onda-short-open { width:22px !important;height:22px !important;right:5px !important;top:5px !important; }
    }
  `;

  function markVideoCards(doc) {
    const row = doc.querySelector('.clips-row');
    if (!row) return [];
    const cards = Array.from(row.querySelectorAll('.row-clip-card'));
    cards.forEach(card => {
      card.classList.add('onda-coming-card');
      if (!card.querySelector('.clip-soon-label')) {
        const label = doc.createElement('span');
        label.className = 'clip-soon-label';
        label.textContent = 'Em breve';
        card.appendChild(label);
      }
    });
    return cards;
  }

  function mountShort(card, short, doc) {
    if (!card || !short?.id || card.dataset.ondaShortId === short.id) return;
    card.dataset.ondaShortId = short.id;
    card.classList.remove('onda-coming-card');
    card.classList.add('onda-youtube-card');
    card.innerHTML = '';

    const frame = doc.createElement('iframe');
    frame.className = 'onda-short-frame';
    frame.src = short.embedUrl || `https://www.youtube.com/embed/${encodeURIComponent(short.id)}?rel=0&playsinline=1`;
    frame.title = `Short ${short.position || ''} do Podcast do Bebezão`.trim();
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;

    const open = doc.createElement('a');
    open.className = 'onda-short-open';
    open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.title = 'Abrir este Short no YouTube';
    open.setAttribute('aria-label', 'Abrir este Short no YouTube');
    open.textContent = '↗';

    card.append(frame, open);
  }

  async function hydrateYouTubeShorts(doc) {
    const row = doc.querySelector('.clips-row');
    if (!row || row.dataset.ondaShortsLoaded === '1' || row.dataset.ondaShortsLoading === '1') return;
    row.dataset.ondaShortsLoading = '1';
    try {
      const response = await doc.defaultView.fetch('/api/youtube-shorts', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const shorts = Array.isArray(data?.shorts) ? data.shorts.slice(0, 5) : [];
      if (!shorts.length) return;

      const cards = Array.from(row.querySelectorAll('.row-clip-card'));
      const originalCount = Number(row.dataset.ondaOriginalCount || cards.length || 0);
      if (!originalCount) return;
      cards.forEach((card, index) => {
        const originalIndex = index % originalCount;
        if (originalIndex < shorts.length) mountShort(card, shorts[originalIndex], doc);
      });
      row.dataset.ondaShortsLoaded = '1';
    } catch (_) {
      // Se o YouTube estiver temporariamente indisponível, os cards continuam como "Em breve".
    } finally {
      delete row.dataset.ondaShortsLoading;
    }
  }

  function startClipLoop(doc) {
    const viewport = doc.querySelector('.clips-row-wrap');
    const row = doc.querySelector('.clips-row');
    if (!viewport || !row || viewport.dataset.ondaAutoScroll === '1') return;

    const original = markVideoCards(doc);
    if (!original.length) return;
    viewport.dataset.ondaAutoScroll = '1';
    row.dataset.ondaOriginalCount = String(original.length);

    if (original.length > 1) {
      original.forEach(card => row.appendChild(card.cloneNode(true)));
    }

    let paused = false;
    let last = performance.now();
    const half = () => row.scrollWidth / 2;

    const tick = now => {
      if (!doc.defaultView || !doc.body.isConnected) return;
      if (!paused && !doc.hidden && row.scrollWidth > viewport.clientWidth) {
        viewport.scrollLeft += Math.min(1.15, Math.max(.35, (now - last) * 0.032));
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
    viewport.addEventListener('touchcancel', () => { setTimeout(() => { paused = false; }, 500); }, { passive: true });
    doc.defaultView.addEventListener('blur', () => { paused = true; });
    doc.defaultView.addEventListener('focus', () => { paused = false; });
    doc.defaultView.requestAnimationFrame(tick);
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

    const centeredLeft = card => Math.max(0, card.offsetLeft - (grid.clientWidth - card.clientWidth) / 2);

    const goTo = (nextIndex, smooth = true) => {
      const list = cards();
      if (!list.length || !isMobile()) return;
      index = ((nextIndex % list.length) + list.length) % list.length;
      grid.scrollTo({ left: centeredLeft(list[index]), behavior: smooth ? 'smooth' : 'auto' });
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
      startClipLoop(doc);
      hydrateYouTubeShorts(doc);
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
