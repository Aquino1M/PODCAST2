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

  function guestMap(data) {
    return new Map((Array.isArray(data?.guests) ? data.guests : [])
      .filter(guest => guest?.name)
      .map(guest => [normalize(guest.name), guest]));
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
    const original = String(guest.photo || '');
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
      .carousel-section .guest-card[data-onda-real-photo="1"]{background-position:center!important;background-size:cover!important;background-repeat:no-repeat!important}
      .carousel-section .guest-card[data-onda-real-photo="1"]::after{background:linear-gradient(to top,rgba(4,10,18,.72) 0%,rgba(4,10,18,.16) 44%,rgba(4,10,18,.02) 76%)!important}
      .carousel-section .guest-card[data-onda-real-photo="1"] .guest-initials{opacity:0!important;visibility:hidden!important}
      .carousel-section .guest-card[data-onda-real-photo="1"] .guest-name{color:#fff!important;opacity:1!important;position:relative!important;z-index:3!important;text-shadow:0 2px 12px rgba(0,0,0,.85)!important}
      html body .bottom-showcase{width:100%!important;justify-content:center!important}
      html body .bottom-showcase .clips-container-main{width:100%!important;align-items:center!important;justify-content:center!important}
      html body .bottom-showcase .clips-row-wrap.onda-carousel-final{margin-left:auto!important;margin-right:auto!important;left:auto!important;right:auto!important}
      @media(min-width:1025px){html body .bottom-showcase .clips-row-wrap.onda-carousel-final.onda-carousel-desktop{width:min(1000px,calc(100vw - 48px))!important;max-width:min(1000px,calc(100vw - 48px))!important}}
    `;
    doc.head.appendChild(style);
  }

  function patchFrameCards(frame, map) {
    let doc;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc?.head) return;
    ensureFrameStyle(doc);

    doc.querySelectorAll('.carousel-section .guest-card').forEach(card => {
      const name = card.querySelector('.guest-name')?.textContent || '';
      const guest = map.get(normalize(name));
      if (!guest?.photo) return;
      const proxy = photoUrl(guest.photo);
      const key = `${guest.name}|${guest.photo}`;
      if (card.dataset.ondaGuestPhotoKey === key) return;
      card.dataset.ondaGuestPhotoKey = key;
      card.dataset.ondaRealPhoto = '1';
      const escaped = String(proxy || guest.photo).replace(/"/g, '%22');
      card.style.setProperty('background-image', `linear-gradient(to top,rgba(4,10,18,.18),rgba(4,10,18,.02) 65%),url("${escaped}")`, 'important');
      card.style.setProperty('background-position', 'center,center', 'important');
      card.style.setProperty('background-size', 'cover,cover', 'important');
      card.style.setProperty('background-repeat', 'no-repeat,no-repeat', 'important');
      const label = card.querySelector('.guest-initials');
      if (label && !label.textContent.trim()) label.textContent = guest.initials || initials(guest.name);
    });

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

    const section = doc.querySelector('.carousel-section');
    if (section && !section.__ondaPhotoObserver) {
      let timer = 0;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => patchFrameCards(frame, map), 80);
      });
      observer.observe(section, { childList: true, subtree: true, characterData: true });
      section.__ondaPhotoObserver = observer;
    }
  }

  function patchFrames(map) {
    document.querySelectorAll('iframe.public-vitrine-frame, iframe[src*="/public/vitrine.html"]').forEach(frame => {
      if (frame.dataset.ondaGuestStableWatch !== '1') {
        frame.dataset.ondaGuestStableWatch = '1';
        frame.addEventListener('load', () => setTimeout(() => patchFrameCards(frame, map), 150));
      }
      patchFrameCards(frame, map);
    });
  }

  async function patch(force = false) {
    ensureStyle();
    try {
      const data = await load(force);
      const map = guestMap(data);
      if (!map.size) return;
      patchUpcomingShows(map);
      patchDashboardGuests(map);
      patchFrames(map);
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
