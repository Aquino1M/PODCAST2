(() => {
  const STYLE_ID = 'onda-guest-photo-fix-style';
  const FRAME_STYLE_ID = 'onda-public-guest-photo-style';
  let showcase = null;
  let showcaseAt = 0;
  let scheduled = false;

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const initials = name => String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase();

  function photoUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      const marker = '/storage/v1/object/public/podcast-media/';
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        const name = decodeURIComponent(url.pathname.slice(index + marker.length));
        if (/^[a-zA-Z0-9._-]{1,180}\.(?:png|jpe?g|webp)$/i.test(name)) {
          return `/guest-photo/${encodeURIComponent(name)}`;
        }
      }
      return url.href;
    } catch {
      return raw;
    }
  }

  async function loadShowcase(force = false) {
    if (!force && showcase && Date.now() - showcaseAt < 30_000) return showcase;
    const response = await fetch('/api/public/showcase', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Showcase ${response.status}`);
    showcase = await response.json();
    showcaseAt = Date.now();
    return showcase;
  }

  function guestMap(data) {
    return new Map((Array.isArray(data?.guests) ? data.guests : [])
      .filter(item => item?.name)
      .map(item => [normalize(item.name), item]));
  }

  function makeImage(guest, className = '') {
    const image = document.createElement('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = `Foto de ${guest.name || 'convidado'}`;
    if (className) image.className = className;
    const proxy = photoUrl(guest.photo);
    image.dataset.ondaOriginalPhoto = String(guest.photo || '');
    image.src = proxy || String(guest.photo || '');
    image.addEventListener('error', () => {
      const original = image.dataset.ondaOriginalPhoto || '';
      if (original && image.src !== original && image.dataset.ondaOriginalTried !== '1') {
        image.dataset.ondaOriginalTried = '1';
        image.src = original;
        return;
      }
      image.closest('.guest-media')?.setAttribute('data-photo-failed', '1');
      image.remove();
    });
    return image;
  }

  function patchInternal(data) {
    const map = guestMap(data);
    if (!map.size) return;

    document.querySelectorAll('.dashboard-guest[data-collection="guests"], .person-card[data-collection="guests"]').forEach(card => {
      const name = card.querySelector('strong, h3')?.textContent || '';
      const guest = map.get(normalize(name));
      if (!guest?.photo) return;
      const media = card.querySelector('.guest-media');
      if (!media) return;
      const desired = photoUrl(guest.photo);
      const current = media.querySelector('img');
      if (current && (current.getAttribute('src') === desired || current.dataset.ondaOriginalPhoto === String(guest.photo))) return;
      media.dataset.photoFailed = '';
      media.replaceChildren(makeImage(guest));
      media.dataset.ondaGuestPhoto = '1';
    });
  }

  function injectInternalStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dashboard-guest .guest-media[data-onda-guest-photo="1"] img,
      .person-card .guest-media[data-onda-guest-photo="1"] img {
        width:100%!important;height:100%!important;display:block!important;
        object-fit:cover!important;object-position:center!important;
      }
      .dashboard-guest .dashboard-guest-photo[data-onda-guest-photo="1"] {
        width:100%!important;height:176px!important;
      }
      @media(max-width:560px){
        .dashboard-guest .dashboard-guest-photo[data-onda-guest-photo="1"]{height:155px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function disableLegacyCarousel(doc) {
    if (doc.documentElement.dataset.ondaGuestLegacyDisabled === '1') return;
    doc.documentElement.dataset.ondaGuestLegacyDisabled = '1';
    const script = doc.createElement('script');
    script.textContent = `
      try { clearInterval(carouselInterval); carouselInterval = null; } catch (_) {}
      try { updateCarousel = function(){}; } catch (_) {}
      try { startCarouselAutoRotation = function(){}; } catch (_) {}
      try { resetCarouselTimer = function(){}; } catch (_) {}
    `;
    doc.documentElement.appendChild(script);
    script.remove();
  }

  function ensureFrameStyle(doc) {
    if (doc.getElementById(FRAME_STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = FRAME_STYLE_ID;
    style.textContent = `
      .carousel-section .guest-card[data-onda-real-photo="1"] {
        background-position:center!important;
        background-size:cover!important;
        background-repeat:no-repeat!important;
      }
      .carousel-section .guest-card[data-onda-real-photo="1"]::after {
        background:linear-gradient(to top,rgba(4,10,18,.76) 0%,rgba(4,10,18,.24) 38%,rgba(4,10,18,.04) 72%)!important;
      }
      .carousel-section .guest-card[data-onda-real-photo="1"] .guest-initials {
        opacity:0!important;
        visibility:hidden!important;
      }
      .carousel-section .guest-card[data-onda-real-photo="1"] .guest-name {
        color:#fff!important;
        opacity:1!important;
        position:relative!important;
        z-index:3!important;
        text-shadow:0 2px 12px rgba(0,0,0,.85)!important;
      }
    `;
    doc.head.appendChild(style);
  }

  function createFrameController(frame, data) {
    const doc = frame.contentDocument;
    if (!doc?.documentElement) return null;
    ensureFrameStyle(doc);
    disableLegacyCarousel(doc);

    const cards = Array.from(doc.querySelectorAll('.carousel-section .guest-card'));
    if (!cards.length) return null;
    const guests = (Array.isArray(data?.guests) ? data.guests : []).filter(item => item?.name);
    if (!guests.length) return null;

    const previous = frame.__ondaGuestPhotoController;
    if (previous?.destroy) previous.destroy();

    let center = Math.min(2, guests.length - 1);
    let paused = false;
    let timer = 0;
    let enforceTimer = 0;
    const offsets = [-2, -1, 0, 1, 2];

    const guestAt = index => {
      const total = guests.length;
      return guests[((index % total) + total) % total];
    };

    const renderCard = (card, guest) => {
      if (!card || !guest) return;
      const name = card.querySelector('.guest-name');
      const initial = card.querySelector('.guest-initials');
      const key = `${guest.name}|${guest.photo || ''}`;
      if (card.dataset.ondaGuestKey !== key) card.dataset.ondaGuestKey = key;
      if (name && name.textContent !== String(guest.name || '')) name.textContent = guest.name || '';
      if (initial) {
        const text = guest.initials || initials(guest.name);
        if (initial.textContent !== text) initial.textContent = text;
      }

      if (guest.photo) {
        const src = photoUrl(guest.photo);
        const background = `linear-gradient(to top,rgba(4,10,18,.28),rgba(4,10,18,.02) 62%), url("${src.replace(/"/g, '%22')}")`;
        card.dataset.ondaRealPhoto = '1';
        card.style.setProperty('background-image', background, 'important');
        card.style.setProperty('background-position', 'center', 'important');
        card.style.setProperty('background-size', 'cover', 'important');
        card.style.setProperty('background-repeat', 'no-repeat', 'important');
      } else {
        card.dataset.ondaRealPhoto = '0';
        card.style.removeProperty('background-image');
      }
      card.style.opacity = '1';
      card.style.transform = '';
    };

    const render = () => cards.forEach((card, slot) => renderCard(card, guestAt(center + (offsets[slot] ?? slot - 2))));
    const schedule = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (paused || doc.hidden) return;
        center = (center + 1) % guests.length;
        render();
      }, 4000);
    };

    const onClick = event => {
      const button = event.target.closest('.carousel-section .nav-btn');
      if (!button) return;
      const nav = Array.from(doc.querySelectorAll('.carousel-section .nav-btn'));
      const direction = button === nav[0] ? -1 : 1;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      center = (center + direction + guests.length) % guests.length;
      render();
      schedule();
    };
    doc.addEventListener('click', onClick, true);

    const section = doc.querySelector('.carousel-section');
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    const onTouchStart = () => { paused = true; };
    const onTouchEnd = () => setTimeout(() => { paused = false; }, 900);
    section?.addEventListener('mouseenter', onEnter);
    section?.addEventListener('mouseleave', onLeave);
    section?.addEventListener('touchstart', onTouchStart, { passive:true });
    section?.addEventListener('touchend', onTouchEnd, { passive:true });

    render();
    schedule();
    enforceTimer = setInterval(render, 700);

    const controller = {
      destroy() {
        clearInterval(timer);
        clearInterval(enforceTimer);
        doc.removeEventListener('click', onClick, true);
        section?.removeEventListener('mouseenter', onEnter);
        section?.removeEventListener('mouseleave', onLeave);
        section?.removeEventListener('touchstart', onTouchStart);
        section?.removeEventListener('touchend', onTouchEnd);
      },
      refresh(nextData) {
        if (Array.isArray(nextData?.guests) && nextData.guests.length) {
          controller.destroy();
          frame.__ondaGuestPhotoController = createFrameController(frame, nextData);
        }
      }
    };
    frame.__ondaGuestPhotoController = controller;
    return controller;
  }

  async function patchFrame(frame, force = false) {
    try {
      const data = await loadShowcase(force);
      if (!frame.contentDocument?.head) return;
      createFrameController(frame, data);
    } catch (_) {}
  }

  function watchFrames(force = false) {
    document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(frame => {
      if (frame.dataset.ondaGuestPhotoWatch !== '1') {
        frame.dataset.ondaGuestPhotoWatch = '1';
        frame.addEventListener('load', () => setTimeout(() => patchFrame(frame, true), 80));
      }
      if (frame.contentDocument?.readyState === 'complete') patchFrame(frame, force);
    });
  }

  async function patchAll(force = false) {
    injectInternalStyle();
    try {
      const data = await loadShowcase(force);
      patchInternal(data);
    } catch (_) {}
    watchFrames(force);
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchAll(false);
    });
  }

  injectInternalStyle();
  patchAll(true);
  new MutationObserver(schedulePatch).observe(document.documentElement, { childList:true, subtree:true });
  setInterval(() => patchAll(false), 5000);
})();
