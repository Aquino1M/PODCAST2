(() => {
  const STYLE_ID = 'onda-shorts-20-feed-style';
  const COPIES = 5;
  const CENTER_COPY = 2;

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

  function makeCard(short, index, doc, eager = false) {
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
    poster.loading = eager ? 'eager' : 'lazy';
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
    let raf = 0;
    let normalizing = false;
    let cycleWidth = 0;

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

    const measure = () => {
      const first = row.children[0];
      const nextCycle = row.children[shorts.length];
      if (!first || !nextCycle) return 0;
      cycleWidth = nextCycle.offsetLeft - first.offsetLeft;
      return cycleWidth;
    };

    const normalize = () => {
      if (normalizing) return;
      if (!cycleWidth && !measure()) return;

      // Mantém o usuário sempre dentro da cópia central. Como as 5 cópias são
      // idênticas, a troca de posição é visualmente imperceptível, inclusive
      // durante inércia do toque no Chrome/Brave Android.
      const min = cycleWidth * 1.25;
      const max = cycleWidth * 3.75;
      let next = viewport.scrollLeft;

      while (next < min) next += cycleWidth;
      while (next > max) next -= cycleWidth;

      if (Math.abs(next - viewport.scrollLeft) > 1) {
        normalizing = true;
        viewport.scrollLeft = next;
        requestAnimationFrame(() => { normalizing = false; });
      }
    };

    const placeInMiddle = () => {
      if (!measure()) return;
      viewport.scrollLeft = cycleWidth * CENTER_COPY;
      normalize();
    };

    const tick = now => {
      if (!row.isConnected || !viewport.isConnected) return;

      normalize();

      const hasPlayingVideo = !!row.querySelector('.onda-click-playing,.onda-player-ready');
      if (!paused && !hasPlayingVideo && !doc.hidden) {
        const elapsed = Math.min(40, Math.max(0, now - last));
        viewport.scrollLeft += Math.max(.22, elapsed * .024);
        normalize();
      }

      last = now;
      raf = doc.defaultView.requestAnimationFrame(tick);
    };

    viewport.addEventListener('scroll', normalize, { passive:true });
    viewport.addEventListener('mouseenter', pause);
    viewport.addEventListener('mouseleave', () => resume(450));
    viewport.addEventListener('touchstart', pause, { passive:true });
    viewport.addEventListener('touchmove', normalize, { passive:true });
    viewport.addEventListener('touchend', () => {
      normalize();
      resume(1400);
    }, { passive:true });
    viewport.addEventListener('touchcancel', () => {
      normalize();
      resume(700);
    }, { passive:true });
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      pause();
    }, { passive:true });
    viewport.addEventListener('pointerup', event => {
      if (event.pointerType === 'mouse') return;
      normalize();
      resume(1200);
    }, { passive:true });
    viewport.addEventListener('focusin', pause);
    viewport.addEventListener('focusout', event => {
      if (!viewport.contains(event.relatedTarget)) resume(500);
    });

    doc.defaultView.addEventListener('resize', () => {
      const oldCycle = cycleWidth;
      const ratio = oldCycle ? viewport.scrollLeft / oldCycle : CENTER_COPY;
      requestAnimationFrame(() => {
        if (!measure()) return;
        viewport.scrollLeft = cycleWidth * Math.min(3, Math.max(2, ratio));
        normalize();
      });
    });

    doc.defaultView.addEventListener('beforeunload', () => {
      if (raf) doc.defaultView.cancelAnimationFrame(raf);
    }, { once:true });

    requestAnimationFrame(() => {
      placeInMiddle();
      setTimeout(placeInMiddle, 80);
      setTimeout(placeInMiddle, 350);
    });

    raf = doc.defaultView.requestAnimationFrame(tick);
    viewport._ondaInfiniteController = { pause, resume, normalize };
  }

  async function mountInfinite(doc) {
    const currentViewport = doc.querySelector('.clips-row-wrap');
    if (!currentViewport || currentViewport.dataset.ondaInfinite20V2 === '1') return false;

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

    if (shorts.length < 6) return false;

    // Cria 5 cópias completas dos 20 vídeos e começa na cópia central.
    // Assim nunca existe uma borda física próxima durante o swipe com inércia.
    const viewport = currentViewport.cloneNode(false);
    viewport.className = `${currentViewport.className} onda-infinite-shorts`;
    viewport.dataset.ondaInfinite20V2 = '1';
    viewport.removeAttribute('data-onda-safe-preview');
    viewport.removeAttribute('data-onda-clip-v2');
    viewport.removeAttribute('data-onda-infinite20');

    const row = doc.createElement('div');
    row.className = 'clips-row onda-safe-shorts-row onda-infinite-shorts-row';
    viewport.appendChild(row);

    for (let copy = 0; copy < COPIES; copy += 1) {
      shorts.forEach((short, index) => {
        const eager = copy === CENTER_COPY && index < 7;
        row.appendChild(makeCard(short, index, doc, eager));
      });
    }

    currentViewport.replaceWith(viewport);
    makeInfiniteCarousel(viewport, row, shorts, doc);
    return true;
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaInfinite20V2Watch === '1') return;
    frame.dataset.ondaInfinite20V2Watch = '1';

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
