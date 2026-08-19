(() => {
  const STYLE_ID = 'onda-shorts-preview-fix';

  const css = `
    .clips-row-wrap.onda-shorts-fixed {
      overflow-x:auto !important;
      overflow-y:visible !important;
      scrollbar-width:none !important;
      -webkit-overflow-scrolling:touch !important;
      scroll-behavior:smooth !important;
    }
    .clips-row-wrap.onda-shorts-fixed::-webkit-scrollbar { display:none !important; }
    .clips-row.onda-shorts-row {
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
    .onda-live-short {
      position:relative !important;
      flex:0 0 136px !important;
      width:136px !important;
      height:188px !important;
      border-radius:22px !important;
      overflow:hidden !important;
      background:#05070c !important;
      border:1px solid rgba(15,23,42,.18) !important;
      box-shadow:0 12px 28px rgba(15,23,42,.16) !important;
      isolation:isolate !important;
      transform:none !important;
    }
    .onda-live-short iframe {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      border:0 !important;
      background:#000 !important;
      z-index:1 !important;
      pointer-events:none !important;
    }
    .onda-live-short::after {
      content:'';
      position:absolute;
      inset:0;
      z-index:2;
      pointer-events:none;
      background:linear-gradient(180deg,rgba(2,6,23,.03) 55%,rgba(2,6,23,.42) 100%);
    }
    .onda-live-short .onda-muted-badge {
      position:absolute !important;
      top:8px !important;
      left:8px !important;
      z-index:4 !important;
      width:26px !important;
      height:26px !important;
      border-radius:999px !important;
      display:grid !important;
      place-items:center !important;
      background:rgba(3,7,18,.72) !important;
      border:1px solid rgba(255,255,255,.24) !important;
      color:#fff !important;
      font-size:12px !important;
      backdrop-filter:blur(7px) !important;
      pointer-events:none !important;
    }
    .onda-live-short .onda-short-index {
      position:absolute !important;
      left:8px !important;
      bottom:8px !important;
      z-index:4 !important;
      padding:5px 8px !important;
      border-radius:999px !important;
      background:rgba(3,7,18,.70) !important;
      border:1px solid rgba(255,255,255,.20) !important;
      color:#fff !important;
      font:800 8px/1 Arial,sans-serif !important;
      letter-spacing:.06em !important;
      pointer-events:none !important;
      backdrop-filter:blur(7px) !important;
    }
    .onda-live-short .onda-short-open {
      position:absolute !important;
      right:8px !important;
      top:8px !important;
      z-index:5 !important;
      width:28px !important;
      height:28px !important;
      border-radius:999px !important;
      display:grid !important;
      place-items:center !important;
      background:rgba(3,7,18,.78) !important;
      border:1px solid rgba(255,255,255,.28) !important;
      color:#fff !important;
      text-decoration:none !important;
      font:800 12px/1 Arial,sans-serif !important;
      backdrop-filter:blur(8px) !important;
    }
    .onda-live-short .onda-short-open:hover { background:rgba(3,7,18,.96) !important; }
    .onda-short-error {
      display:grid !important;
      place-items:center !important;
      color:#fff !important;
      background:linear-gradient(145deg,#0c172b,#111827) !important;
      font:800 10px/1.3 Arial,sans-serif !important;
      text-align:center !important;
      padding:14px !important;
    }
    @media (max-width:700px) {
      .clips-row.onda-shorts-row {
        justify-content:flex-start !important;
        gap:14px !important;
        padding:0 10px !important;
      }
      .onda-live-short {
        flex:0 0 118px !important;
        width:118px !important;
        height:168px !important;
        border-radius:19px !important;
      }
    }
  `;

  function embedUrl(id, doc) {
    const origin = encodeURIComponent(doc.defaultView.location.origin);
    const safe = encodeURIComponent(id);
    return `https://www.youtube.com/embed/${safe}?autoplay=1&mute=1&controls=0&loop=1&playlist=${safe}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1&origin=${origin}`;
  }

  function createCard(short, index, doc, pause, resume) {
    const card = doc.createElement('article');
    card.className = 'onda-live-short';
    card.dataset.ondaShortId = short.id;

    const frame = doc.createElement('iframe');
    frame.src = embedUrl(short.id, doc);
    frame.title = `Preview sem áudio do Short ${index + 1}`;
    frame.loading = 'eager';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.setAttribute('allowfullscreen', '');

    const muted = doc.createElement('span');
    muted.className = 'onda-muted-badge';
    muted.textContent = '🔇';
    muted.title = 'Preview sem áudio';

    const label = doc.createElement('span');
    label.className = 'onda-short-index';
    label.textContent = `SHORT ${index + 1}`;

    const open = doc.createElement('a');
    open.className = 'onda-short-open';
    open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = '↗';
    open.title = 'Abrir no YouTube';
    open.setAttribute('aria-label', `Abrir Short ${index + 1} no YouTube`);

    card.append(frame, muted, label, open);

    card.addEventListener('mouseenter', pause);
    card.addEventListener('mouseleave', () => resume(500));
    card.addEventListener('touchstart', event => {
      if (event.target.closest('.onda-short-open')) return;
      pause();
    }, { passive:true });
    card.addEventListener('touchend', () => resume(1500), { passive:true });
    card.addEventListener('touchcancel', () => resume(700), { passive:true });

    return card;
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
        viewport.scrollLeft += Math.min(1.1, Math.max(.30, (now - last) * .03));
        const cards = Array.from(row.children);
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
    viewport.addEventListener('touchend', () => resume(1500), { passive:true });
    doc.defaultView.requestAnimationFrame(tick);

    return { pause, resume };
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
      if (!oldViewport || oldViewport.dataset.ondaPreviewFixed === '1') return;

      const viewport = oldViewport.cloneNode(false);
      viewport.classList.add('onda-shorts-fixed');
      viewport.dataset.ondaPreviewFixed = '1';

      const row = doc.createElement('div');
      row.className = 'clips-row onda-shorts-row';
      viewport.appendChild(row);
      oldViewport.replaceWith(viewport);

      const carousel = makeCarousel(viewport, row, doc);
      row.innerHTML = '<article class="onda-live-short onda-short-error">Carregando Shorts...</article>';

      const response = await doc.defaultView.fetch('/api/youtube-shorts', { headers:{ Accept:'application/json' }, cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const shorts = Array.isArray(data?.shorts) ? data.shorts.filter(item => item?.id).slice(0,5) : [];
      if (shorts.length !== 5) throw new Error(`Esperados 5 Shorts; recebidos ${shorts.length}`);

      row.innerHTML = '';
      shorts.forEach((short, index) => row.appendChild(createCard(short, index, doc, carousel.pause, carousel.resume)));
    } catch (error) {
      console.error('Falha ao montar previews dos Shorts', error);
      try {
        const doc = frame.contentDocument;
        const row = doc?.querySelector('.clips-row.onda-shorts-row');
        if (row) row.innerHTML = '<article class="onda-live-short onda-short-error">Não foi possível carregar os Shorts</article>';
      } catch (_) {}
    }
  }

  function watch(frame) {
    if (!frame || frame.dataset.ondaShortPreviewWatch === '1') return;
    frame.dataset.ondaShortPreviewWatch = '1';
    frame.addEventListener('load', () => setTimeout(() => mount(frame), 250));
    setTimeout(() => mount(frame), 400);
  }

  const scan = () => document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(watch);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
})();