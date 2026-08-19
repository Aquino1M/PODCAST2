(() => {
  const STYLE_ID = 'onda-guest-photo-stable-style';
  const FRAME_STYLE_ID = 'onda-vitrine-guest-photo-stable-style';
  const CACHE_MS = 60_000;
  let cache = null;
  let cacheAt = 0;
  let loading = null;
  let refreshTimer = 0;

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
        const file = decodeURIComponent(url.pathname.slice(index + marker.length));
        if (/^[a-zA-Z0-9._-]{1,180}\.(?:png|jpe?g|webp)$/i.test(file)) {
          return `/guest-photo/${encodeURIComponent(file)}`;
        }
      }
      return url.href;
    } catch {
      return raw;
    }
  }

  async function load(force = false) {
    if (!force && cache && Date.now() - cacheAt < CACHE_MS) return cache;
    if (loading) return loading;
    loading = fetch('/api/public/showcase', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(`Showcase ${response.status}`);
        const data = await response.json();
        cache = data;
        cacheAt = Date.now();
        return data;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  function guestList(data) {
    return (Array.isArray(data?.guests) ? data.guests : [])
      .filter(guest => guest?.name);
  }

  function uniqueGuestList(list) {
    const seen = new Set();
    const unique = [];
    for (const guest of Array.isArray(list) ? list : []) {
      const key = normalize(guest?.name);
      if (!key || seen.has(key) || !guest?.photo) continue;
      seen.add(key);
      unique.push(guest);
    }
    return unique;
  }

  function guestMap(data) {
    const map = new Map();
    for (const guest of guestList(data)) {
      const key = normalize(guest.name);
      if (key && !map.has(key)) map.set(key, guest);
    }
    return map;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .show-visual[data-onda-guest-photo="1"]{position:relative!important;overflow:hidden!important;background-image:none!important}
      .show-visual[data-onda-guest-photo="1"]>.onda-show-guest-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important;z-index:0!important}
      .show-visual[data-onda-guest-photo="1"]::after{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;pointer-events:none!important;background:linear-gradient(180deg,rgba(8,12,24,.12),rgba(8,12,24,.08) 48%,rgba(8,12,24,.46))!important}
      .show-visual[data-onda-guest-photo="1"]>small,.show-visual[data-onda-guest-photo="1"]>.dots,.show-visual[data-onda-guest-photo="1"]>.status{position:relative!important;z-index:2!important}
      .show-visual[data-onda-guest-photo="1"]>.show-monogram{opacity:0!important;visibility:hidden!important}
      .dashboard-guest .dashboard-guest-photo[data-onda-guest-photo="1"],.person-card .guest-media[data-onda-guest-photo="1"]{position:relative!important;overflow:hidden!important}
      .dashboard-guest .dashboard-guest-photo[data-onda-guest-photo="1"]>.onda-dashboard-guest-photo,.person-card .guest-media[data-onda-guest-photo="1"]>.onda-dashboard-guest-photo{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important}
    `;
    document.head.appendChild(style);
  }

  function makeImage(doc, className, guest, onFail) {
    const image = doc.createElement('img');
    image.className = className;
    image.alt = `Foto de ${guest.name || 'convidado'}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    const proxy = photoUrl(guest.photo);
    const original = String(guest.photo || '').trim();
    image.src = proxy || original;
    image.dataset.original = original;
    image.addEventListener('error', () => {
      if (original && image.dataset.originalTried !== '1' && image.src !== original) {
        image.dataset.originalTried = '1';
        image.src = original;
        return;
      }
      onFail?.(image);
    });
    return image;
  }

  function patchUpcomingShows(map) {
    document.querySelectorAll('.show-card').forEach(card => {
      const name = card.querySelector('.show-meta h3, h3')?.textContent || '';
      const guest = map.get(normalize(name));
      const visual = card.querySelector('.show-visual');
      if (!visual || !guest?.photo) return;
      const key = `${guest.name}|${guest.photo}`;
      if (visual.dataset.ondaGuestPhotoKey === key && visual.querySelector('.onda-show-guest-photo')) return;
      visual.querySelector('.onda-show-guest-photo')?.remove();
      const image = makeImage(document, 'onda-show-guest-photo', guest, failed => {
        failed.remove();
        delete visual.dataset.ondaGuestPhoto;
        delete visual.dataset.ondaGuestPhotoKey;
      });
      visual.prepend(image);
      visual.dataset.ondaGuestPhoto = '1';
      visual.dataset.ondaGuestPhotoKey = key;
    });
  }

  function patchDashboardGuests(map) {
    document.querySelectorAll('.dashboard-guest[data-collection="guests"], .person-card[data-collection="guests"]').forEach(card => {
      const name = card.querySelector('strong, h3')?.textContent || '';
      const guest = map.get(normalize(name));
      if (!guest?.photo) return;
      const media = card.querySelector('.dashboard-guest-photo, .guest-media');
      if (!media) return;
      const key = `${guest.name}|${guest.photo}`;
      if (media.dataset.ondaGuestPhotoKey === key && media.querySelector('.onda-dashboard-guest-photo')) return;
      const image = makeImage(document, 'onda-dashboard-guest-photo', guest, failed => {
        failed.remove();
        delete media.dataset.ondaGuestPhoto;
        delete media.dataset.ondaGuestPhotoKey;
      });
      media.replaceChildren(image);
      media.dataset.ondaGuestPhoto = '1';
      media.dataset.ondaGuestPhotoKey = key;
    });
  }

  function ensureFrameStyle(doc) {
    if (!doc?.head || doc.getElementById(FRAME_STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = FRAME_STYLE_ID;
    style.textContent = `
      .carousel-section .guest-card{position:relative!important;overflow:hidden!important}
      .carousel-section .guest-card>.onda-vitrine-guest-photo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important;z-index:0!important;pointer-events:none!important}
      .carousel-section .guest-card[data-onda-real-photo="1"]::after{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;pointer-events:none!important;background:linear-gradient(to top,rgba(4,10,18,.72) 0%,rgba(4,10,18,.16) 44%,rgba(4,10,18,.02) 76%)!important}
      .carousel-section .guest-card[data-onda-real-photo="1"] .guest-initials{opacity:0!important;visibility:hidden!important}
      .carousel-section .guest-card .guest-initials{position:relative!important;z-index:2!important}
      .carousel-section .guest-card .guest-name{position:relative!important;z-index:3!important}
      .carousel-section .guest-card[data-onda-real-photo="1"] .guest-name{color:#fff!important;opacity:1!important;text-shadow:0 2px 12px rgba(0,0,0,.85)!important}
      html body .bottom-showcase{width:100%!important;justify-content:center!important}
      html body .bottom-showcase .clips-container-main{width:100%!important;align-items:center!important;justify-content:center!important}
      html body .bottom-showcase .clips-row-wrap.onda-carousel-final{margin-left:auto!important;margin-right:auto!important;left:auto!important;right:auto!important}
      @media(min-width:1025px){html body .bottom-showcase .clips-row-wrap.onda-carousel-final.onda-carousel-desktop{width:min(1000px,calc(100vw - 48px))!important;max-width:min(1000px,calc(100vw - 48px))!important}}
    `;
    doc.head.appendChild(style);
  }

  function expectedNames(list, offset, count) {
    if (!list.length) return [];
    return Array.from({ length:count }, (_, index) => list[(offset + index) % list.length]?.name || '');
  }

  function patchFrameCards(frame, map, list) {
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc?.head) return;
    ensureFrameStyle(doc);

    const liveGuests = uniqueGuestList(list);
    const cards = [...doc.querySelectorAll('.carousel-section .guest-card')];
    const section = doc.querySelector('.carousel-section');
    if (!liveGuests.length || !cards.length || !section) return;

    const rawOffset = Number(section.__ondaGuestOffset || 0);
    const offset = ((rawOffset % liveGuests.length) + liveGuests.length) % liveGuests.length;
    const namesForThisFrame = expectedNames(liveGuests, offset, cards.length);

    cards.forEach((card, index) => {
      const guest = liveGuests[(offset + index) % liveGuests.length];
      if (!guest) return;

      const name = card.querySelector('.guest-name');
      const label = card.querySelector('.guest-initials');
      const guestInitials = guest.initials || initials(guest.name);

      if (name && name.textContent !== guest.name) name.textContent = guest.name;
      if (label && label.textContent !== guestInitials) label.textContent = guestInitials;

      const key = `${guest.name}|${guest.photo}`;
      const currentImage = card.querySelector('.onda-vitrine-guest-photo');
      if (card.dataset.ondaGuestPhotoKey === key && currentImage) return;

      currentImage?.remove();
      const image = makeImage(doc, 'onda-vitrine-guest-photo', guest, failed => {
        failed.remove();
        delete card.dataset.ondaRealPhoto;
        delete card.dataset.ondaGuestPhotoKey;
        if (label) {
          label.textContent = guestInitials;
          label.style.removeProperty('opacity');
          label.style.removeProperty('visibility');
        }
      });
      image.addEventListener('load', () => {
        card.dataset.ondaRealPhoto = '1';
      }, { once:true });
      card.prepend(image);
      card.dataset.ondaGuestPhotoKey = key;
      card.dataset.ondaRealPhoto = '1';
    });

    section.__ondaExpectedGuestNames = namesForThisFrame;
    section.__ondaGuestPhotoData = { map, list:liveGuests };

    const viewport = doc.querySelector('.clips-row-wrap.onda-carousel-final');
    const container = doc.querySelector('.clips-container-main');
    if (container) {
      container.style.setProperty('width', '100%', 'important');
      container.style.setProperty('align-items', 'center', 'important');
    }
    if (viewport) {
      viewport.style.setProperty('margin-left', 'auto', 'important');
      viewport.style.setProperty('margin-right', 'auto', 'important');
    }

    if (!section.__ondaPhotoObserver) {
      let timer = 0;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const latest = section.__ondaGuestPhotoData;
          if (!latest) return;
          const unique = uniqueGuestList(latest.list);
          if (!unique.length) return;

          const expected = Array.isArray(section.__ondaExpectedGuestNames) ? section.__ondaExpectedGuestNames : [];
          const current = [...section.querySelectorAll('.guest-card .guest-name')]
            .map(node => String(node.textContent || ''));
          const changedByNativeCarousel = expected.length === current.length && current.some((name, index) => normalize(name) !== normalize(expected[index]));

          if (changedByNativeCarousel && unique.length > 1) {
            section.__ondaGuestOffset = (Number(section.__ondaGuestOffset || 0) + 1) % unique.length;
          }
          patchFrameCards(frame, latest.map, unique);
        }, 110);
      });
      observer.observe(section, { childList:true, subtree:true });
      section.__ondaPhotoObserver = observer;
    }
  }

  function patchFrames(map, list) {
    const unique = uniqueGuestList(list);
    document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(frame => {
      frame.__ondaGuestPhotoData = { map, list:unique };
      if (frame.dataset.ondaGuestStableWatch !== '1') {
        frame.dataset.ondaGuestStableWatch = '1';
        frame.addEventListener('load', () => {
          setTimeout(() => {
            const latest = frame.__ondaGuestPhotoData;
            if (latest) patchFrameCards(frame, latest.map, latest.list);
          }, 150);
        });
      }
      patchFrameCards(frame, map, unique);
    });
  }

  async function patch(force = false) {
    ensureStyle();
    try {
      const data = await load(force);
      const list = guestList(data);
      const map = guestMap(data);
      if (!list.length) return;
      patchUpcomingShows(map);
      patchDashboardGuests(map);
      patchFrames(map, list);
    } catch {}
  }

  function schedulePatch(delay = 100) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => patch(false), delay);
  }

  ensureStyle();
  patch(true);
  document.addEventListener('click', () => schedulePatch(140), true);
  window.addEventListener('popstate', () => schedulePatch(80));
  window.addEventListener('hashchange', () => schedulePatch(80));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedulePatch(80); });
  setInterval(() => { if (!document.hidden) patch(false); }, 30_000);
})();
