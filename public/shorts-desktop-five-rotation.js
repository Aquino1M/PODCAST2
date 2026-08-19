(() => {
  const STYLE_ID = 'onda-desktop-five-rotation-style';
  const DESKTOP_MIN = 1025;
  const SLOT_COUNT = 5;
  const ROTATE_MS = 2300;

  const css = `
    @media (min-width:1025px) {
      .clips-row-wrap.onda-desktop-five-rotation {
        overflow:hidden !important;
      }
      .clips-row.onda-desktop-five-rotation-row {
        display:flex !important;
        flex-wrap:nowrap !important;
        justify-content:center !important;
        align-items:center !important;
      }
      .onda-desktop-five-rotation-row > .onda-safe-short {
        transition:transform .28s cubic-bezier(.22,.61,.36,1), opacity .28s ease, box-shadow .28s ease !important;
        will-change:transform,opacity !important;
      }
      .onda-desktop-five-rotation-row > .onda-safe-short.onda-five-out {
        transform:translateX(-22px) scale(.985) !important;
        opacity:.28 !important;
      }
      .onda-desktop-five-rotation-row > .onda-safe-short.onda-five-in {
        transition:none !important;
        transform:translateX(22px) scale(.985) !important;
        opacity:.28 !important;
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

  function setVideo(card, short, slot) {
    if (!card || !short?.id) return;

    card.querySelectorAll('iframe.onda-click-player,iframe.onda-short-player,iframe.onda-short-frame').forEach(frame => {
      try { frame.remove(); } catch {}
    });
    card.classList.remove('onda-click-playing', 'onda-click-ready', 'onda-player-ready');
    card.dataset.ondaShortId = short.id;
    card.setAttribute('aria-label', `Vídeo ${slot + 1} do Podcast do Bebezão. Clique para assistir sem áudio.`);

    const poster = card.querySelector('.onda-short-poster');
    if (poster) {
      poster.style.removeProperty('display');
      poster.src = `/short-thumb/${encodeURIComponent(short.id)}?v=${encodeURIComponent(short.position || '')}`;
      poster.alt = '';
    }

    const open = card.querySelector('.onda-short-open');
    if (open) {
      open.href = short.url || `https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
      open.setAttribute('aria-label', `Abrir vídeo ${slot + 1} no YouTube`);
    }
  }

  async function mount(doc) {
    const win = doc?.defaultView;
    if (!win || win.innerWidth < DESKTOP_MIN) return false;

    const currentViewport = doc.querySelector('.clips-row-wrap.onda-infinite-shorts');
    const currentRow = currentViewport?.querySelector('.clips-row.onda-infinite-shorts-row');
    if (!currentViewport || !currentRow) return false;
    if (currentViewport.dataset.ondaDesktopFiveRotation === '1') return true;

    let shorts = [];
    try {
      const response = await win.fetch('/shorts-feed', { headers:{ Accept:'application/json' }, cache:'no-store' });
      if (!response.ok) return false;
      const data = await response.json();
      shorts = Array.isArray(data?.shorts) ? data.shorts.filter(item => item?.id).slice(0, 20) : [];
    } catch {
      return false;
    }
    if (shorts.length < SLOT_COUNT + 1) return false;

    ensureStyle(doc);

    // Troca o viewport por um clone para remover os listeners/timers antigos do PC.
    // Assim somente este controlador gira os cinco slots fixos.
    const viewport = currentViewport.cloneNode(false);
    viewport.className = `${currentViewport.className} onda-desktop-five-rotation`;
    viewport.dataset.ondaDesktopFiveRotation = '1';
    viewport.dataset.ondaInfinite20V3 = '1';

    const row = doc.createElement('div');
    row.className = 'clips-row onda-safe-shorts-row onda-infinite-shorts-row onda-desktop-five-slots onda-desktop-five-rotation-row';
    viewport.appendChild(row);

    const oldCards = Array.from(currentRow.querySelectorAll('.onda-safe-short')).slice(0, SLOT_COUNT);
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      const template = oldCards[slot] || oldCards[0];
      if (!template) return false;
      const card = template.cloneNode(true);
      card.removeAttribute('data-onda-click-local');
      card.classList.remove('onda-slot-leave', 'onda-slot-enter', 'onda-five-out', 'onda-five-in', 'onda-click-playing', 'onda-click-ready', 'onda-player-ready');
      setVideo(card, shorts[slot], slot);
      row.appendChild(card);
    }

    currentViewport.replaceWith(viewport);

    let start = 0;
    let paused = false;
    let busy = false;
    let destroyed = false;
    let interval = 0;

    const cards = () => Array.from(row.querySelectorAll(':scope > .onda-safe-short')).slice(0, SLOT_COUNT);

    const pause = () => { paused = true; };
    const resume = () => { paused = false; };

    const rotate = () => {
      if (destroyed || busy || paused || doc.hidden || !row.isConnected) return;
      if (row.querySelector('.onda-click-playing,.onda-player-ready,.onda-click-ready')) return;

      busy = true;
      const visibleCards = cards();
      if (visibleCards.length !== SLOT_COUNT) {
        busy = false;
        return;
      }

      visibleCards.forEach((card, slot) => {
        setTimeout(() => card.classList.add('onda-five-out'), slot * 24);
      });

      setTimeout(() => {
        start = (start + 1) % shorts.length;
        visibleCards.forEach((card, slot) => {
          setVideo(card, shorts[(start + slot) % shorts.length], slot);
          card.classList.remove('onda-five-out');
          card.classList.add('onda-five-in');
        });

        void row.offsetWidth;
        requestAnimationFrame(() => {
          visibleCards.forEach((card, slot) => {
            setTimeout(() => card.classList.remove('onda-five-in'), slot * 24);
          });
          setTimeout(() => { busy = false; }, 420);
        });
      }, 300);
    };

    cards().forEach(card => {
      card.addEventListener('mouseenter', pause);
      card.addEventListener('mouseleave', resume);
      card.addEventListener('focusin', pause);
      card.addEventListener('focusout', event => {
        if (!card.contains(event.relatedTarget)) resume();
      });
    });

    // Primeira troca rápida para deixar evidente que o carrossel está ativo.
    setTimeout(rotate, 1200);
    interval = win.setInterval(rotate, ROTATE_MS);

    win.addEventListener('beforeunload', () => {
      destroyed = true;
      if (interval) win.clearInterval(interval);
    }, { once:true });

    return true;
  }

  function watchFrame(frame) {
    if (!frame || frame.dataset.ondaDesktopFiveRotationWatch === '1') return;
    frame.dataset.ondaDesktopFiveRotationWatch = '1';

    let timer = 0;
    const start = () => {
      if (timer) clearInterval(timer);
      let attempts = 0;
      const attempt = async () => {
        attempts += 1;
        try {
          const doc = frame.contentDocument;
          if (doc?.head) ensureStyle(doc);
          const done = await mount(doc);
          if ((done || attempts >= 36) && timer) {
            clearInterval(timer);
            timer = 0;
          }
        } catch {}
      };
      attempt();
      timer = setInterval(attempt, 500);
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
