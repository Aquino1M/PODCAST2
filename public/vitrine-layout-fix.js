(() => {
  const STYLE_ID = 'onda-vitrine-layout-fix';

  const css = `
    .clips-container-main {
      width:100% !important;
      max-width:none !important;
      align-items:stretch !important;
    }
    .clips-row-wrap {
      width:100% !important;
      max-width:none !important;
      overflow-x:hidden !important;
      overflow-y:visible !important;
      justify-content:flex-start !important;
      padding:18px 0 20px !important;
      margin:0 !important;
      scrollbar-width:none !important;
      -webkit-overflow-scrolling:touch !important;
    }
    .clips-row-wrap::-webkit-scrollbar { display:none !important; }
    .clips-row {
      width:max-content !important;
      max-width:none !important;
      min-width:max-content !important;
      display:flex !important;
      flex-wrap:nowrap !important;
      justify-content:flex-start !important;
      align-items:center !important;
      gap:18px !important;
      margin:0 !important;
      padding:0 12px !important;
    }
    .clips-row.onda-clips-fit {
      width:100% !important;
      min-width:100% !important;
      justify-content:center !important;
    }
    .row-clip-card,
    .row-clip-card.featured {
      position:relative !important;
      width:112px !important;
      height:118px !important;
      flex:0 0 112px !important;
      margin:0 !important;
      border-radius:20px !important;
      transform:none !important;
      overflow:hidden !important;
      display:flex !important;
      align-items:center !important;
      justify-content:center !important;
      background:#0d172b !important;
      border:1px solid rgba(15,23,42,.18) !important;
      box-shadow:0 12px 26px rgba(15,23,42,.12) !important;
      isolation:isolate !important;
    }
    .row-clip-card.onda-youtube-card {
      background:#05070c !important;
      cursor:pointer !important;
    }
    .onda-short-poster {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      object-fit:cover !important;
      object-position:center !important;
      transform:scale(1.02) !important;
      z-index:1 !important;
      background:#0b1220 !important;
    }
    .onda-short-shade {
      position:absolute !important;
      inset:0 !important;
      z-index:2 !important;
      background:linear-gradient(180deg,rgba(2,6,23,.02) 35%,rgba(2,6,23,.72) 100%) !important;
      pointer-events:none !important;
    }
    .onda-short-frame {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      border:0 !important;
      background:transparent !important;
      z-index:3 !important;
      opacity:0 !important;
      pointer-events:none !important;
      transition:opacity .22s ease !important;
    }
    .onda-short-frame.is-visible { opacity:1 !important; }
    .onda-short-number {
      position:absolute !important;
      left:8px !important;
      bottom:8px !important;
      z-index:5 !important;
      padding:4px 7px !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.64) !important;
      border:1px solid rgba(255,255,255,.16) !important;
      color:#fff !important;
      font:800 8px/1 Arial,sans-serif !important;
      letter-spacing:.05em !important;
      backdrop-filter:blur(7px) !important;
      pointer-events:none !important;
    }
    .onda-short-muted {
      position:absolute !important;
      left:8px !important;
      top:8px !important;
      z-index:6 !important;
      width:24px !important;
      height:24px !important;
      display:grid !important;
      place-items:center !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.62) !important;
      border:1px solid rgba(255,255,255,.16) !important;
      color:#fff !important;
      font-size:11px !important;
      pointer-events:none !important;
      backdrop-filter:blur(7px) !important;
    }
    .onda-short-open {
      position:absolute !important;
      right:7px !important;
      top:7px !important;
      z-index:8 !important;
      width:26px !important;
      height:26px !important;
      display:grid !important;
      place-items:center !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.74) !important;
      border:1px solid rgba(255,255,255,.28) !important;
      color:#fff !important;
      text-decoration:none !important;
      font:800 11px/1 Arial,sans-serif !important;
      backdrop-filter:blur(8px) !important;
      transition:transform .18s ease,background .18s ease !important;
    }
    .onda-short-open:hover {
      background:rgba(3,7,18,.94) !important;
      transform:scale(1.08) !important;
    }
    .onda-short-loading {
      position:absolute !important;
      inset:0 !important;
      z-index:4 !important;
      display:grid !important;
      place-items:center !important;
      color:#fff !important;
      font:800 9px/1 Arial,sans-serif !important;
      letter-spacing:.05em !important;
      background:linear-gradient(145deg,#0c172b,#111827) !important;
    }

    @media (min-width:1181px) {
      body { width:100% !important; }
      .dashboard { width:100% !important; max-width:none !important; }
      .bottom-showcase,
      .clips-container-main,
      .clips-row-wrap { width:100% !important; max-width:none !important; }
    }

    @media (min-width:701px) and (max-width:1024px) {
      .analytics-grid {
        display:grid !important;
        grid-template-columns:repeat(4,minmax(0,1fr)) !important;
        gap:12px !important;
        width:100% !important;
      }
      .platform-card {
        min-width:0 !important;
        width:100% !important;
        padding:14px !important;
        gap:14px !important;
      }
      .platform-title { font-size:11px !important; gap:7px !important; }
      .icon-wrapper,.brand-logo-img,.tiktok-logo-img { width:30px !important; height:30px !important; }
      .main-metric { font-size:18px !important; }
      .growth-pill { font-size:9px !important; padding:3px 5px !important; }
      .line-chart-container { height:112px !important; }
      .bar-chart-container { gap:5px !important; }
      .bar-label { font-size:8px !important; }
      .gauge-wrapper { width:92px !important; height:92px !important; }
      .gauge-percentage { font-size:22px !important; }
    }

    @media (max-width:700px) {
      .analytics-grid {
        display:flex !important;
        flex-wrap:nowrap !important;
        gap:12px !important;
        overflow-x:auto !important;
        overflow-y:visible !important;
        width:100% !important;
        padding:2px max(9vw,18px) 14px !important;
        margin:0 !important;
        scroll-snap-type:x mandatory !important;
        scroll-behavior:smooth !important;
        scrollbar-width:none !important;
        -webkit-overflow-scrolling:touch !important;
        overscroll-behavior-inline:contain !important;
      }
      .analytics-grid::-webkit-scrollbar { display:none !important; }
      .platform-card {
        flex:0 0 min(82vw,320px) !important;
        width:min(82vw,320px) !important;
        min-width:min(82vw,320px) !important;
        scroll-snap-align:center !important;
        scroll-snap-stop:always !important;
      }
      .clips-row-wrap { width:100% !important; margin:0 !important; padding:16px 0 !important; }
      .clips-row { gap:14px !important; padding:0 8px !important; }
      .row-clip-card,.row-clip-card.featured {
        width:96px !important;
        height:104px !important;
        flex:0 0 96px !important;
        border-radius:18px !important;
      }
      .onda-short-open { width:23px !important; height:23px !important; right:5px !important; top:5px !important; }
      .onda-short-muted { width:22px !important; height:22px !important; left:5px !important; top:5px !important; }
      .onda-short-number { left:6px !important; bottom:6px !important; }
    }
  `;

  const buildEmbedUrl = (short, doc) => {
    const id = encodeURIComponent(short.id);
    const origin = encodeURIComponent(doc.defaultView.location.origin);
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&origin=${origin}`;
  };

  function startPreview(card, short, doc) {
    if (!card || !short?.id) return;
    let frame = card.querySelector('.onda-short-frame');
    if (!frame) {
      frame = doc.createElement('iframe');
      frame.className = 'onda-short-frame';
      frame.src = buildEmbedUrl(short, doc);
      frame.title = `Preview mudo do Short ${short.position || ''}`.trim();
      frame.loading = 'eager';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      card.insertBefore(frame, card.querySelector('.onda-short-open'));
      setTimeout(() => frame?.classList.add('is-visible'), 550);
    } else {
      frame.classList.add('is-visible');
    }
    card.dataset.previewing = '1';
  }

  function stopPreview(card) {
    if (!card) return;
    const frame = card.querySelector('.onda-short-frame');
    if (frame) {
      frame.classList.remove('is-visible');
      setTimeout(() => {
        if (card.dataset.previewing !== '1') frame.remove();
      }, 260);
    }
    delete card.dataset.previewing;
  }

  function makeShortCard(short, index, doc, pauseCarousel, resumeCarousel) {
    const card = doc.createElement('article');
    card.className = 'row-clip-card onda-youtube-card';
    card.dataset.ondaShortId = short.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `Short ${index + 1} do Podcast do Bebezão. Passe o mouse ou toque para ver o preview sem áudio.`);

    const poster = doc.createElement('img');
    poster.className = 'onda-short-poster';
    poster.src = `https://i.ytimg.com/vi/${encodeURIComponent(short.id)}/hqdefault.jpg`;
    poster.alt = `Preview do Short ${index + 1}`;
    poster.loading = index < 2 ? 'eager' : 'lazy';
    poster.decoding = 'async';

    const shade = doc.createElement('span');
    shade.className = 'onda-short-shade';

    const muted = doc.createElement('span');
    muted.className = 'onda-short-muted';
    muted.textContent = '🔇';
    muted.title = 'Preview sem áudio';

    const number = doc.createElement('span');
    number.className = 'onda-short-number';
    number.textContent = `SHORT ${index + 1}`;

    const open = doc.createElement('a');
    open.className = 'onda-short-open';
    open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.title = 'Abrir no YouTube';
    open.setAttribute('aria-label', `Abrir Short ${index + 1} no YouTube`);
    open.textContent = '↗';

    card.append(poster, shade, muted, number, open);

    const begin = () => {
      pauseCarousel?.();
      startPreview(card, short, doc);
    };
    const end = () => {
      stopPreview(card);
      resumeCarousel?.();
    };

    card.addEventListener('mouseenter', begin);
    card.addEventListener('mouseleave', end);
    card.addEventListener('focusin', begin);
    card.addEventListener('focusout', event => {
      if (!card.contains(event.relatedTarget)) end();
    });
    card.addEventListener('touchstart', event => {
      if (event.target.closest('.onda-short-open')) return;
      begin();
    }, { passive:true });
    card.addEventListener('touchend', () => {
      setTimeout(() => {
        stopPreview(card);
        resumeCarousel?.();
      }, 3500);
    }, { passive:true });

    return card;
  }

  function setupClipCarousel(doc) {
    const viewport = doc.querySelector('.clips-row-wrap');
    const row = doc.querySelector('.clips-row');
    if (!viewport || !row) return null;
    if (viewport.dataset.ondaClipV2 === '1') return viewport._ondaClipController || null;
    viewport.dataset.ondaClipV2 = '1';

    let paused = false;
    let resumeTimer = null;
    let last = performance.now();

    const syncFit = () => {
      row.classList.remove('onda-clips-fit');
      const fits = row.scrollWidth <= viewport.clientWidth + 2;
      row.classList.toggle('onda-clips-fit', fits);
      if (fits) viewport.scrollLeft = 0;
    };

    const pause = () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };

    const resume = (delay = 450) => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { paused = false; }, delay);
    };

    const tick = now => {
      if (!doc.defaultView || !doc.body.isConnected) return;
      const cards = Array.from(row.querySelectorAll('.row-clip-card'));
      const fits = row.classList.contains('onda-clips-fit');
      if (!paused && !doc.hidden && !fits && cards.length > 1) {
        const delta = Math.min(1.05, Math.max(.25, (now - last) * .028));
        viewport.scrollLeft += delta;
        const first = cards[0];
        const gap = parseFloat(doc.defaultView.getComputedStyle(row).gap || '0') || 0;
        if (first && viewport.scrollLeft >= first.offsetWidth + gap) {
          row.appendChild(first);
          viewport.scrollLeft -= first.offsetWidth + gap;
        }
      }
      last = now;
      doc.defaultView.requestAnimationFrame(tick);
    };

    viewport.addEventListener('mouseenter', pause);
    viewport.addEventListener('mouseleave', () => resume());
    viewport.addEventListener('touchstart', pause, { passive:true });
    viewport.addEventListener('touchend', () => resume(1400), { passive:true });
    viewport.addEventListener('touchcancel', () => resume(700), { passive:true });
    doc.defaultView.addEventListener('resize', () => setTimeout(syncFit, 80));

    const controller = { pause, resume, syncFit };
    viewport._ondaClipController = controller;
    setTimeout(syncFit, 60);
    doc.defaultView.requestAnimationFrame(tick);
    return controller;
  }

  async function hydrateYouTubeShorts(doc) {
    const row = doc.querySelector('.clips-row');
    if (!row || row.dataset.ondaShortsLoading === '1') return;
    row.dataset.ondaShortsLoading = '1';

    const controller = setupClipCarousel(doc);
    row.innerHTML = '';
    for (let index = 0; index < 5; index += 1) {
      const loading = doc.createElement('article');
      loading.className = 'row-clip-card';
      loading.innerHTML = '<span class="onda-short-loading">CARREGANDO</span>';
      row.appendChild(loading);
    }
    controller?.syncFit();

    try {
      const response = await doc.defaultView.fetch('/api/youtube-shorts', { headers:{ Accept:'application/json' }, cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const shorts = Array.isArray(data?.shorts) ? data.shorts.filter(item => item?.id).slice(0, 5) : [];
      if (!shorts.length) throw new Error('Nenhum Short disponível');

      row.innerHTML = '';
      shorts.forEach((short, index) => {
        row.appendChild(makeShortCard(short, index, doc, controller?.pause, controller?.resume));
      });
      controller?.syncFit();
      row.dataset.ondaShortsLoaded = '1';
    } catch (error) {
      row.innerHTML = '';
      for (let index = 0; index < 5; index += 1) {
        const card = doc.createElement('article');
        card.className = 'row-clip-card';
        card.innerHTML = `<span class="onda-short-loading">SHORT ${index + 1}</span>`;
        row.appendChild(card);
      }
      controller?.syncFit();
      console.warn('Não foi possível carregar os Shorts', error);
    } finally {
      delete row.dataset.ondaShortsLoading;
    }
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
      grid.scrollTo({ left:centeredLeft(list[index]), behavior:smooth ? 'smooth' : 'auto' });
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
        if (list.length > 1) goTo(index + 1, true);
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
          let distance = Infinity;
          list.forEach((card, i) => {
            const value = Math.abs((card.offsetLeft + card.clientWidth / 2) - center);
            if (value < distance) { distance = value; nearest = i; }
          });
          index = nearest;
        }
        start();
      }, 1300);
    };

    grid.addEventListener('touchstart', pauseForUser, { passive:true });
    grid.addEventListener('touchend', resumeAfterUser, { passive:true });
    grid.addEventListener('touchcancel', resumeAfterUser, { passive:true });
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
      hydrateYouTubeShorts(doc);
      startSocialCarousel(doc);
    } catch (_) {}
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaLayoutFix === '2') return;
    frame.dataset.ondaLayoutFix = '2';
    frame.addEventListener('load', () => applyToFrame(frame));
    applyToFrame(frame);
  }

  const scan = () => document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(watchFrame);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
})();
