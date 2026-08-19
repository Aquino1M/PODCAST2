(() => {
  const STYLE_ID = 'onda-shorts-cleanup';

  const css = `
    .onda-safe-short .onda-short-index,
    .onda-youtube-card .onda-short-number {
      display:none !important;
    }

    .onda-safe-short,
    .onda-youtube-card {
      cursor:pointer !important;
    }

    .onda-click-player {
      position:absolute !important;
      inset:0 !important;
      width:100% !important;
      height:100% !important;
      border:0 !important;
      background:#000 !important;
      z-index:6 !important;
      opacity:0 !important;
      pointer-events:auto !important;
      transition:opacity .18s ease !important;
    }

    .onda-click-player.is-ready {
      opacity:1 !important;
    }

    .onda-safe-short.onda-click-ready .onda-short-poster,
    .onda-youtube-card.onda-click-ready .onda-short-poster {
      opacity:0 !important;
    }

    .onda-safe-short.onda-click-playing,
    .onda-youtube-card.onda-click-playing {
      aspect-ratio:9 / 16 !important;
      height:241.7778px !important;
      border-radius:22px !important;
      box-shadow:0 18px 38px rgba(15,23,42,.22) !important;
    }

    .onda-safe-short.onda-click-playing .onda-preview-hint,
    .onda-youtube-card.onda-click-playing .onda-preview-hint {
      display:none !important;
    }

    .onda-safe-short .onda-short-open,
    .onda-youtube-card .onda-short-open {
      z-index:10 !important;
    }

    .onda-safe-short .onda-muted-badge,
    .onda-youtube-card .onda-short-muted {
      z-index:9 !important;
    }

    @media (max-width:700px) {
      .onda-safe-short.onda-click-playing,
      .onda-youtube-card.onda-click-playing {
        height:209.7778px !important;
        border-radius:19px !important;
      }
    }
  `;

  const playerUrl = (id, doc) => {
    const safe = encodeURIComponent(id);
    const origin = encodeURIComponent(doc.defaultView.location.origin);
    return `https://www.youtube-nocookie.com/embed/${safe}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0&loop=1&playlist=${safe}&enablejsapi=1&origin=${origin}`;
  };

  function send(frame, payload) {
    try {
      frame?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    } catch {}
  }

  function stopPlayer(card) {
    if (!card) return;
    card.classList.remove('onda-click-playing', 'onda-click-ready');
    const frame = card.querySelector('.onda-click-player');
    if (frame) {
      try { frame.remove(); } catch {}
    }
  }

  function stopOtherPlayers(doc, current) {
    doc.querySelectorAll('.onda-safe-short.onda-click-playing,.onda-youtube-card.onda-click-playing').forEach(card => {
      if (card !== current) stopPlayer(card);
    });
  }

  function startPlayer(card, doc) {
    const id = String(card?.dataset?.ondaShortId || '').trim();
    if (!id) return;

    stopOtherPlayers(doc, card);
    card.classList.add('onda-click-playing');

    try { card.focus({ preventScroll:true }); } catch { try { card.focus(); } catch {} }

    let frame = card.querySelector('.onda-click-player');
    if (frame) {
      frame.classList.add('is-ready');
      card.classList.add('onda-click-ready');
      send(frame, { event:'command', func:'mute', args:[] });
      send(frame, { event:'command', func:'playVideo', args:[] });
      return;
    }

    // Remove apenas previews temporários de hover. O novo player nasce do clique do usuário,
    // o que é mais confiável no Chrome e no Brave para iniciar a reprodução.
    card.querySelectorAll('iframe.onda-short-player,iframe.onda-short-frame').forEach(node => {
      try { node.remove(); } catch {}
    });
    card.classList.remove('onda-player-ready');

    frame = doc.createElement('iframe');
    frame.className = 'onda-click-player';
    frame.src = playerUrl(id, doc);
    frame.title = 'Reproduzir Short sem áudio';
    frame.loading = 'eager';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.setAttribute('allowfullscreen', '');

    const open = card.querySelector('.onda-short-open');
    if (open) card.insertBefore(frame, open);
    else card.appendChild(frame);

    const kick = () => {
      send(frame, { event:'listening', id:`onda-click-${id}` });
      send(frame, { event:'command', func:'mute', args:[] });
      send(frame, { event:'command', func:'playVideo', args:[] });
    };

    frame.addEventListener('load', () => {
      // Mantém a thumbnail até o iframe realmente terminar de carregar.
      // Depois, o player fica visível e interativo dentro do próprio card.
      setTimeout(() => {
        if (!frame.isConnected) return;
        frame.classList.add('is-ready');
        card.classList.add('onda-click-ready');
        kick();
        setTimeout(kick, 180);
        setTimeout(kick, 520);
        setTimeout(kick, 1000);
      }, 120);
    }, { once:true });
  }

  function clean(doc) {
    if (!doc?.head || !doc.body) return;

    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    style.textContent = css;

    doc.querySelectorAll('.onda-short-index,.onda-short-number').forEach(node => node.remove());

    doc.querySelectorAll('.onda-safe-short,.onda-youtube-card').forEach(card => {
      if (card.dataset.ondaClickLocal === '2') return;
      card.dataset.ondaClickLocal = '2';

      card.addEventListener('click', event => {
        if (event.target.closest('.onda-short-open')) return;
        event.preventDefault();
        event.stopPropagation();
        startPlayer(card, doc);
      }, true);

      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('.onda-short-open')) return;
        event.preventDefault();
        startPlayer(card, doc);
      });
    });
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaShortCleanupWatch === '2') return;
    frame.dataset.ondaShortCleanupWatch = '2';

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
