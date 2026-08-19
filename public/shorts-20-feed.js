(() => {
  const STYLE_ID = 'onda-shorts-20-feed-style';
  const VISIBLE_DESKTOP = 5;
  const BUFFER_SLOTS = 1;
  const TOTAL_SLOTS = VISIBLE_DESKTOP + BUFFER_SLOTS;

  const css = `
    .clips-row-wrap.onda-infinite-shorts {
      position:relative !important;
      overflow-x:auto !important;
      overflow-y:visible !important;
      scrollbar-width:none !important;
      -ms-overflow-style:none !important;
      scroll-behavior:auto !important;
      overscroll-behavior-inline:contain !important;
      -webkit-overflow-scrolling:touch !important;
      margin-left:auto !important;
      margin-right:auto !important;
    }
    .clips-row-wrap.onda-infinite-shorts::-webkit-scrollbar { display:none !important; }

    .clips-row.onda-infinite-shorts-row {
      display:flex !important;
      flex-wrap:nowrap !important;
      align-items:center !important;
      justify-content:flex-start !important;
      width:max-content !important;
      min-width:max-content !important;
      max-width:none !important;
      gap:18px !important;
      padding:0 12px !important;
      margin:0 !important;
    }

    @media (min-width:701px) {
      body .clips-container-main .clips-row-wrap.onda-infinite-shorts {
        width:776px !important;
        max-width:calc(100vw - 32px) !important;
      }
    }

    @media (max-width:700px) {
      body .clips-container-main .clips-row-wrap.onda-infinite-shorts {
        width:100% !important;
        max-width:100% !important;
        padding-left:0 !important;
        padding-right:0 !important;
      }
      .clips-row.onda-infinite-shorts-row {
        gap:14px !important;
        padding:0 10px !important;
      }
    }
  `;

  function ensureStyle(doc) {
    if (!doc?.head) return;
    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  function clearPlayback(card) {
    if (!card) return;
    card.classList.remove('onda-click-playing', 'onda-click-ready', 'onda-player-ready');
    card.querySelectorAll('iframe.onda-click-player,iframe.onda-short-player,iframe.onda-short-frame').forEach(frame => {
      try { frame.remove(); } catch {}
    });
  }

  function setCardVideo(card, short, logicalIndex) {
    if (!card || !short?.id) return;
    clearPlayback(card);
    card.dataset.ondaShortId = short.id;
    card.setAttribute('aria-label', `Vídeo ${logicalIndex + 1} do Podcast do Bebezão. Clique para assistir sem áudio.`);

    const poster = card.querySelector('.onda-short-poster');
    if (poster) {
      poster.style.display = '';
      poster.src = `/short-thumb/${encodeURIComponent(short.id)}`;
      poster.alt = '';
    }

    const open = card.querySelector('.onda-short-open');
    if (open) {
      open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
      open.setAttribute('aria-label', `Abrir vídeo ${logicalIndex + 1} no YouTube`);
    }
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
    poster.loading = index < VISIBLE_DESKTOP ? 'eager' : 'lazy';
    poster.decoding = 'async';
    poster.addEventListener('error', () => { poster.style.display = 'none'; });

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

  function makeInfiniteCarousel(viewport, row, shorts, doc) {
    let paused = false;
    let resumeTimer = null;
    let last = performance.now();
    let nextVideoIndex = TOTAL_SLOTS % shorts.length;
    let raf = 0;

    const pause = () => {
      paused = true;
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const resume = (delay = 500) => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        paused = false;
        resumeTimer = null;
      }, delay);
    };

    const cardStep = () => {
      const first = row.firstElementChild;
      if (!first) return 0;
      const gap = parseFloat(doc.defaultView.getComputedStyle(row).gap || '0') || 0;
      return first.getBoundingClientRect().width + gap;
    };

    const recyclePassedCards = () => {
      let guard = 0;
      let step = cardStep();
      while (step > 0 && viewport.scrollLeft >= step && guard < 4) {
        const first = row.firstElementChild;
        if (!first) break;

        const short = shorts[nextVideoIndex];
        setCardVideo(first, short, nextVideoIndex);
        nextVideoIndex = (nextVideoIndex + 1) % shorts.length;

        row.appendChild(first);
        viewport.scrollLeft -= step;
        guard += 1;
        step = cardStep();
      }
    };

    const tick = now => {
      if (!row.isConnected || !viewport.isConnected) return;

      recyclePassedCards();

      const hasPlayingVideo = !!row.querySelector('.onda-click-playing,.onda-player-ready');
      if (!paused && !hasPlayingVideo && !doc.hidden) {
        const elapsed = Math.min(40, Math.max(0, now - last));
        viewport.scrollLeft += Math.max(.22, elapsed * .024);
        recyclePassedCards();
      }

      last = now;
      raf = doc.defaultView.requestAnimationFrame(tick);
    };

    viewport.addEventListener('mouseenter', pause);
    viewport.addEventListener('mouseleave', () => resume(450));
    viewport.addEventListener('touchstart', pause, { passive:true });
    viewport.addEventListener('touchend', () => resume(1400), { passive:true });
    viewport.addEventListener('touchcancel', () => resume(700), { passive:true });
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      pause();
    }, { passive:true });
    viewport.addEventListener('pointerup', event => {
      if (event.pointerType === 'mouse') return;
      resume(1200);
    }, { passive:true });
    viewport.addEventListener('focusin', pause);
    viewport.addEventListener('focusout', event => {
      if (!viewport.contains(event.relatedTarget)) resume(500);
    });

    doc.defaultView.addEventListener('beforeunload', () => {
      if (raf) doc.defaultView.cancelAnimationFrame(raf);
    }, { once:true });

    viewport.scrollLeft = 0;
    raf = doc.defaultView.requestAnimationFrame(tick);
    viewport._ondaInfiniteController = { pause, resume };
  }

  async function mountInfinite(doc) {
    const currentViewport = doc.querySelector('.clips-row-wrap');
    if (!currentViewport || currentViewport.dataset.ondaInfinite20 === '1') return false;

    ensureStyle(doc);

    let shorts = [];
    try {
      const response = await doc.defaultView.fetch('/shorts-feed', {
        headers:{ Accept:'application/json' },
        cache:'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      shorts = Array.isArray(data?.shorts)
        ? data.shorts.filter(item => item?.id).slice(0,20)
        : [];
    } catch {
      return false;
    }

    if (shorts.length < TOTAL_SLOTS) return false;

    // Substitui o viewport anterior para desligar os loops antigos e ficar com
    // apenas um controlador de rolagem. Isso evita aceleração ou travamento.
    const viewport = currentViewport.cloneNode(false);
    viewport.className = `${currentViewport.className} onda-infinite-shorts`;
    viewport.dataset.ondaInfinite20 = '1';
    viewport.removeAttribute('data-onda-safe-preview');
    viewport.removeAttribute('data-onda-clip-v2');

    const row = doc.createElement('div');
    row.className = 'clips-row onda-safe-shorts-row onda-infinite-shorts-row';
    viewport.appendChild(row);

    for (let index = 0; index < TOTAL_SLOTS; index += 1) {
      row.appendChild(makeCard(shorts[index], index, doc));
    }

    currentViewport.replaceWith(viewport);
    makeInfiniteCarousel(viewport, row, shorts, doc);
    return true;
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaInfinite20Watch === '1') return;
    frame.dataset.ondaInfinite20Watch = '1';

    let timer = null;
    const attempt = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body) return;
        ensureStyle(doc);
        mountInfinite(doc).then(done => {
          if (done && timer) {
            clearInterval(timer);
            timer = null;
          }
        });
      } catch {}
    };

    const start = () => {
      if (timer) clearInterval(timer);
      attempt();
      timer = setInterval(attempt, 700);
      setTimeout(() => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 18000);
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
