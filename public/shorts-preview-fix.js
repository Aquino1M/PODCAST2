(() => {
  const STYLE_ID = 'onda-shorts-safe-preview-v3';

  const css = `
    .clips-row-wrap.onda-safe-shorts {
      width:100% !important;
      max-width:none !important;
      overflow-x:auto !important;
      overflow-y:visible !important;
      scrollbar-width:none !important;
      -webkit-overflow-scrolling:touch !important;
      scroll-behavior:smooth !important;
      padding:18px 0 20px !important;
      margin:0 !important;
    }
    .clips-row-wrap.onda-safe-shorts::-webkit-scrollbar { display:none !important; }
    .clips-row.onda-safe-shorts-row {
      display:flex !important;
      flex-wrap:nowrap !important;
      align-items:center !important;
      justify-content:center !important;
      gap:18px !important;
      width:max-content !important;
      min-width:100% !important;
      padding:0 12px !important;
      margin:0 !important;
    }
    .onda-safe-short {
      position:relative !important;
      flex:0 0 136px !important;
      width:136px !important;
      height:188px !important;
      border-radius:22px !important;
      overflow:hidden !important;
      background:#07101f !important;
      border:1px solid rgba(15,23,42,.22) !important;
      box-shadow:0 12px 28px rgba(15,23,42,.16) !important;
      isolation:isolate !important;
      transform:none !important;
      cursor:pointer !important;
    }
    .onda-safe-short .onda-short-fallback {
      position:absolute !important;
      inset:0 !important;
      z-index:1 !important;
      display:grid !important;
      place-items:center !important;
      background:linear-gradient(145deg,#111b31,#08101f) !important;
      color:#fff !important;
      font:800 11px/1.2 Arial,sans-serif !important;
      letter-spacing:.04em !important;
      text-align:center !important;
      padding:18px !important;
    }
    .onda-safe-short .onda-short-poster {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      object-fit:cover !important;
      object-position:center !important;
      z-index:3 !important;
      opacity:1 !important;
      transform:scale(1.015) !important;
      transition:opacity .25s ease !important;
      background:#0b1220 !important;
    }
    .onda-safe-short .onda-short-player {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      border:0 !important;
      z-index:2 !important;
      opacity:0 !important;
      pointer-events:none !important;
      background:#000 !important;
      transition:opacity .25s ease !important;
    }
    .onda-safe-short.onda-player-ready .onda-short-player { opacity:1 !important; z-index:4 !important; }
    .onda-safe-short.onda-player-ready .onda-short-poster { opacity:0 !important; }
    .onda-safe-short .onda-short-shade {
      position:absolute !important;
      inset:0 !important;
      z-index:5 !important;
      pointer-events:none !important;
      background:linear-gradient(180deg,rgba(2,6,23,.02) 50%,rgba(2,6,23,.52) 100%) !important;
    }
    .onda-safe-short .onda-muted-badge {
      position:absolute !important;
      top:8px !important;
      left:8px !important;
      z-index:7 !important;
      width:27px !important;
      height:27px !important;
      display:grid !important;
      place-items:center !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.72) !important;
      border:1px solid rgba(255,255,255,.22) !important;
      color:#fff !important;
      font-size:12px !important;
      backdrop-filter:blur(8px) !important;
      pointer-events:none !important;
    }
    .onda-safe-short .onda-short-index {
      position:absolute !important;
      left:8px !important;
      bottom:8px !important;
      z-index:7 !important;
      padding:5px 8px !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.70) !important;
      border:1px solid rgba(255,255,255,.18) !important;
      color:#fff !important;
      font:800 8px/1 Arial,sans-serif !important;
      letter-spacing:.06em !important;
      pointer-events:none !important;
      backdrop-filter:blur(7px) !important;
    }
    .onda-safe-short .onda-short-open {
      position:absolute !important;
      top:8px !important;
      right:8px !important;
      z-index:8 !important;
      width:28px !important;
      height:28px !important;
      display:grid !important;
      place-items:center !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.78) !important;
      border:1px solid rgba(255,255,255,.28) !important;
      color:#fff !important;
      text-decoration:none !important;
      font:800 12px/1 Arial,sans-serif !important;
      backdrop-filter:blur(8px) !important;
    }
    .onda-safe-short .onda-preview-hint {
      position:absolute !important;
      left:50% !important;
      bottom:30px !important;
      transform:translateX(-50%) !important;
      z-index:7 !important;
      max-width:110px !important;
      padding:4px 7px !important;
      border-radius:8px !important;
      background:rgba(3,7,18,.58) !important;
      color:#fff !important;
      font:700 7px/1.2 Arial,sans-serif !important;
      white-space:nowrap !important;
      opacity:0 !important;
      transition:opacity .2s ease !important;
      pointer-events:none !important;
    }
    .onda-safe-short:hover .onda-preview-hint,
    .onda-safe-short:focus-within .onda-preview-hint { opacity:.92 !important; }
    @media (max-width:700px) {
      .clips-row.onda-safe-shorts-row { justify-content:flex-start !important; gap:14px !important; padding:0 10px !important; }
      .onda-safe-short { flex:0 0 118px !important; width:118px !important; height:168px !important; border-radius:19px !important; }
      .onda-safe-short .onda-preview-hint { display:none !important; }
    }
  `;

  function playerUrl(id, doc) {
    const origin = encodeURIComponent(doc.defaultView.location.origin);
    const safe = encodeURIComponent(id);
    return `https://www.youtube-nocookie.com/embed/${safe}?autoplay=1&mute=1&controls=0&loop=1&playlist=${safe}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1&origin=${origin}`;
  }

  function send(frame, payload) {
    try {
      frame?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    } catch {}
  }

  function createPreviewController(doc) {
    const win = doc.defaultView;
    const entries = new Map();

    const onMessage = event => {
      if (!event?.source) return;
      const origin = String(event.origin || '');
      if (!origin.includes('youtube.com') && !origin.includes('youtube-nocookie.com')) return;
      let data = event.data;
      try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
      if (!data || typeof data !== 'object') return;

      for (const [card, entry] of entries) {
        if (entry.frame?.contentWindow !== event.source) continue;
        if (data.event === 'onReady' || data.event === 'infoDelivery') {
          if (!entry.ready) {
            entry.ready = true;
            card.classList.add('onda-player-ready');
            send(entry.frame, { event:'command', func:'mute', args:[] });
            send(entry.frame, { event:'command', func:'playVideo', args:[] });
          }
        }
        break;
      }
    };
    win.addEventListener('message', onMessage);

    const stop = card => {
      const entry = entries.get(card);
      card.classList.remove('onda-player-ready');
      if (!entry) return;
      clearInterval(entry.pingTimer);
      clearTimeout(entry.failTimer);
      try { entry.frame.remove(); } catch {}
      entries.delete(card);
    };

    const start = (card, short) => {
      if (!card || !short?.id || entries.has(card)) return;
      const frame = doc.createElement('iframe');
      frame.className = 'onda-short-player';
      frame.src = playerUrl(short.id, doc);
      frame.title = `Preview mudo do Short ${short.position || ''}`.trim();
      frame.loading = 'eager';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      card.insertBefore(frame, card.querySelector('.onda-short-shade'));

      const entry = { frame, ready:false, pingTimer:null, failTimer:null };
      entries.set(card, entry);

      let pings = 0;
      const ping = () => {
        pings += 1;
        send(frame, { event:'listening', id:`onda-short-${short.id}` });
        send(frame, { event:'command', func:'mute', args:[] });
        send(frame, { event:'command', func:'playVideo', args:[] });
        if (pings >= 12 || entry.ready) clearInterval(entry.pingTimer);
      };
      frame.addEventListener('load', () => {
        ping();
        setTimeout(ping, 180);
        setTimeout(ping, 480);
      });
      entry.pingTimer = setInterval(ping, 250);

      entry.failTimer = setTimeout(() => {
        if (!entry.ready) stop(card);
      }, 3400);
    };

    return { start, stop };
  }

  function makeCarousel(viewport, row, doc) {
    let paused = false;
    let resumeTimer = null;
    let last = performance.now();

    const pause = () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const resume = (delay = 500) => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { paused = false; }, delay);
    };

    const tick = now => {
      if (!row.isConnected || !viewport.isConnected) return;
      if (!paused && !doc.hidden && row.scrollWidth > viewport.clientWidth + 4) {
        viewport.scrollLeft += Math.min(1.05, Math.max(.28, (now - last) * .029));
        const first = row.firstElementChild;
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
    viewport.addEventListener('touchend', () => resume(1500), { passive:true });
    viewport.addEventListener('touchcancel', () => resume(700), { passive:true });
    doc.defaultView.requestAnimationFrame(tick);
    return { pause, resume };
  }

  function createCard(short, index, doc, carousel, preview) {
    const card = doc.createElement('article');
    card.className = 'onda-safe-short';
    card.dataset.ondaShortId = short.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `Short ${index + 1}. Passe o mouse ou toque para visualizar sem áudio.`);

    const fallback = doc.createElement('span');
    fallback.className = 'onda-short-fallback';
    fallback.textContent = `SHORT ${index + 1}`;

    const poster = doc.createElement('img');
    poster.className = 'onda-short-poster';
    poster.src = `/short-thumb/${encodeURIComponent(short.id)}`;
    poster.alt = '';
    poster.loading = index < 2 ? 'eager' : 'lazy';
    poster.decoding = 'async';
    poster.addEventListener('error', () => {
      poster.style.display = 'none';
    }, { once:true });

    const shade = doc.createElement('span');
    shade.className = 'onda-short-shade';

    const muted = doc.createElement('span');
    muted.className = 'onda-muted-badge';
    muted.textContent = '🔇';
    muted.title = 'Preview sem áudio';

    const label = doc.createElement('span');
    label.className = 'onda-short-index';
    label.textContent = `SHORT ${index + 1}`;

    const hint = doc.createElement('span');
    hint.className = 'onda-preview-hint';
    hint.textContent = 'Passe o mouse para assistir';

    const open = doc.createElement('a');
    open.className = 'onda-short-open';
    open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = '↗';
    open.title = 'Abrir no YouTube';
    open.setAttribute('aria-label', `Abrir Short ${index + 1} no YouTube`);

    card.append(fallback, poster, shade, muted, label, hint, open);

    const begin = event => {
      if (event?.target?.closest?.('.onda-short-open')) return;
      carousel.pause();
      preview.start(card, short);
    };
    const end = () => {
      preview.stop(card);
      carousel.resume(500);
    };

    card.addEventListener('mouseenter', begin);
    card.addEventListener('mouseleave', end);
    card.addEventListener('focusin', begin);
    card.addEventListener('focusout', event => {
      if (!card.contains(event.relatedTarget)) end();
    });
    card.addEventListener('touchstart', begin, { passive:true });
    card.addEventListener('touchend', () => {
      setTimeout(() => {
        preview.stop(card);
        carousel.resume(1200);
      }, 5000);
    }, { passive:true });
    card.addEventListener('touchcancel', end, { passive:true });

    return card;
  }

  async function mount(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc?.head || !doc.body) return;
      if (!doc.getElementById(STYLE_ID)) {
        const style = doc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = css;
        doc.head.appendChild(style);
      }

      const oldViewport = doc.querySelector('.clips-row-wrap');
      if (!oldViewport || oldViewport.dataset.ondaSafePreview === '1') return;

      const viewport = oldViewport.cloneNode(false);
      viewport.className = `${oldViewport.className} onda-safe-shorts`;
      viewport.dataset.ondaSafePreview = '1';
      const row = doc.createElement('div');
      row.className = 'clips-row onda-safe-shorts-row';
      viewport.appendChild(row);
      oldViewport.replaceWith(viewport);

      const carousel = makeCarousel(viewport, row, doc);
      const preview = createPreviewController(doc);

      row.innerHTML = '<article class="onda-safe-short"><span class="onda-short-fallback">CARREGANDO</span></article>';
      const response = await doc.defaultView.fetch('/api/youtube-shorts', { headers:{ Accept:'application/json' }, cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const shorts = Array.isArray(data?.shorts) ? data.shorts.filter(item => item?.id).slice(0,5) : [];
      if (!shorts.length) throw new Error('Nenhum Short disponível');

      row.innerHTML = '';
      shorts.forEach((short, index) => row.appendChild(createCard(short, index, doc, carousel, preview)));
    } catch (error) {
      console.error('Falha ao montar Shorts seguros', error);
    }
  }

  function watch(frame) {
    if (!frame || frame.dataset.ondaSafeShortWatch === '1') return;
    frame.dataset.ondaSafeShortWatch = '1';
    frame.addEventListener('load', () => setTimeout(() => mount(frame), 300));
    setTimeout(() => mount(frame), 500);
  }

  const scan = () => document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(watch);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
})();
