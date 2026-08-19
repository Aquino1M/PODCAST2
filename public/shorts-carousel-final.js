(() => {
  const STYLE_ID = 'onda-shorts-carousel-final-style';
  const DESKTOP_MIN = 1025;
  const DESKTOP_VISIBLE = 5;
  const DESKTOP_BUFFER = 1;
  const SLIDE_MS = 720;
  const ROTATE_DELAY = 2600;

  const css = `
    .clips-row-wrap.onda-carousel-final {
      position:relative !important;
      margin-left:auto !important;
      margin-right:auto !important;
      scrollbar-width:none !important;
      -ms-overflow-style:none !important;
      -webkit-overflow-scrolling:touch !important;
    }
    .clips-row-wrap.onda-carousel-final::-webkit-scrollbar{display:none!important}

    .clips-row.onda-carousel-final-row{
      display:flex !important;
      flex-wrap:nowrap !important;
      align-items:center !important;
      justify-content:flex-start !important;
      max-width:none !important;
      min-width:max-content !important;
      width:max-content !important;
      margin:0 !important;
      will-change:transform !important;
    }

    @media (min-width:1025px){
      .clips-row-wrap.onda-carousel-final.onda-carousel-desktop{
        overflow:hidden !important;
        width:min(980px,calc(100vw - 56px)) !important;
        max-width:min(980px,calc(100vw - 56px)) !important;
        padding:18px 0 22px !important;
      }
      .clips-row.onda-carousel-final-row.onda-carousel-desktop-row{
        gap:24px !important;
        padding:0 !important;
        transition:none;
      }
      .onda-carousel-desktop-row > .onda-safe-short{
        flex:0 0 176px !important;
        width:176px !important;
        height:258px !important;
        border-radius:22px !important;
      }
      .onda-carousel-desktop-row > .onda-safe-short.onda-click-playing,
      .onda-carousel-desktop-row > .onda-safe-short.onda-player-ready{
        aspect-ratio:9/16 !important;
        height:auto !important;
      }
    }

    @media (min-width:701px) and (max-width:1024px){
      .clips-row-wrap.onda-carousel-final.onda-carousel-mobile{
        overflow-x:auto !important;
        overflow-y:visible !important;
        width:calc(100vw - 28px) !important;
        max-width:calc(100vw - 28px) !important;
        padding:16px 0 20px !important;
      }
      .clips-row.onda-carousel-final-row.onda-carousel-mobile-row{
        gap:18px !important;
        padding:0 12px !important;
      }
      .onda-carousel-mobile-row > .onda-safe-short{
        flex:0 0 clamp(142px,17vw,168px) !important;
        width:clamp(142px,17vw,168px) !important;
        height:236px !important;
      }
    }

    @media (max-width:700px){
      .clips-row-wrap.onda-carousel-final.onda-carousel-mobile{
        overflow-x:auto !important;
        overflow-y:visible !important;
        width:100% !important;
        max-width:100% !important;
        margin:0 !important;
        padding:14px 0 18px !important;
        overscroll-behavior-inline:contain !important;
      }
      .clips-row.onda-carousel-final-row.onda-carousel-mobile-row{
        gap:14px !important;
        padding:0 12px !important;
      }
      .onda-carousel-mobile-row > .onda-safe-short{
        flex:0 0 min(40vw,146px) !important;
        width:min(40vw,146px) !important;
        height:210px !important;
        border-radius:19px !important;
      }
      .onda-carousel-mobile-row > .onda-safe-short.onda-click-playing,
      .onda-carousel-mobile-row > .onda-safe-short.onda-player-ready{
        aspect-ratio:9/16 !important;
        height:auto !important;
      }
    }
  `;

  function ensureStyle(doc){
    if(!doc?.head) return;
    let style=doc.getElementById(STYLE_ID);
    if(!style){
      style=doc.createElement('style');
      style.id=STYLE_ID;
      doc.head.appendChild(style);
    }
    if(style.textContent!==css) style.textContent=css;
  }

  function makeCard(short,index,doc,eager=false){
    const card=doc.createElement('article');
    card.className='onda-safe-short';
    card.dataset.ondaShortId=short.id;
    card.tabIndex=0;
    card.setAttribute('aria-label',`Vídeo ${index+1} do Podcast do Bebezão. Clique para assistir sem áudio.`);

    const fallback=doc.createElement('span');
    fallback.className='onda-short-fallback';

    const poster=doc.createElement('img');
    poster.className='onda-short-poster';
    poster.src=`/short-thumb/${encodeURIComponent(short.id)}`;
    poster.alt='';
    poster.loading=eager?'eager':'lazy';
    poster.decoding='async';
    poster.addEventListener('error',()=>{poster.style.display='none'});

    const shade=doc.createElement('span');
    shade.className='onda-short-shade';

    const muted=doc.createElement('span');
    muted.className='onda-muted-badge';
    muted.textContent='🔇';
    muted.title='Preview sem áudio';

    const hint=doc.createElement('span');
    hint.className='onda-preview-hint';
    hint.textContent='Clique para assistir';

    const open=doc.createElement('a');
    open.className='onda-short-open';
    open.href=short.url||`https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
    open.target='_blank';
    open.rel='noopener noreferrer';
    open.textContent='↗';
    open.title='Abrir no YouTube';
    open.setAttribute('aria-label',`Abrir vídeo ${index+1} no YouTube`);

    card.append(fallback,poster,shade,muted,hint,open);
    return card;
  }

  function updateCard(card,short,index){
    if(!card||!short?.id) return;
    card.querySelectorAll('iframe.onda-click-player,iframe.onda-short-player,iframe.onda-short-frame').forEach(frame=>{
      try{frame.remove()}catch{}
    });
    card.classList.remove('onda-click-playing','onda-click-ready','onda-player-ready');
    card.dataset.ondaShortId=short.id;
    card.setAttribute('aria-label',`Vídeo ${index+1} do Podcast do Bebezão. Clique para assistir sem áudio.`);
    const poster=card.querySelector('.onda-short-poster');
    if(poster){
      poster.style.removeProperty('display');
      poster.src=`/short-thumb/${encodeURIComponent(short.id)}`;
    }
    const open=card.querySelector('.onda-short-open');
    if(open){
      open.href=short.url||`https://www.youtube.com/shorts/${encodeURIComponent(short.id)}`;
      open.setAttribute('aria-label',`Abrir vídeo ${index+1} no YouTube`);
    }
  }

  function bindPauseToCards(row,state){
    row.querySelectorAll('.onda-safe-short').forEach(card=>{
      if(card.dataset.ondaFinalPause==='1') return;
      card.dataset.ondaFinalPause='1';
      card.addEventListener('mouseenter',()=>{state.paused=true});
      card.addEventListener('mouseleave',()=>{state.paused=false});
      card.addEventListener('focusin',()=>{state.paused=true});
      card.addEventListener('focusout',event=>{
        if(!card.contains(event.relatedTarget)) state.paused=false;
      });
    });
  }

  function desktopCarousel(viewport,row,shorts,doc){
    viewport.classList.add('onda-carousel-desktop');
    row.classList.add('onda-carousel-desktop-row');
    row.replaceChildren();

    const rendered=DESKTOP_VISIBLE+DESKTOP_BUFFER;
    for(let i=0;i<rendered;i+=1){
      row.appendChild(makeCard(shorts[i%shorts.length],i,doc,true));
    }

    const state={paused:false,busy:false,destroyed:false};
    let nextIndex=rendered%shorts.length;
    let timer=0;

    bindPauseToCards(row,state);

    const schedule=(delay=ROTATE_DELAY)=>{
      if(state.destroyed) return;
      if(timer) doc.defaultView.clearTimeout(timer);
      timer=doc.defaultView.setTimeout(step,delay);
    };

    const step=()=>{
      timer=0;
      if(state.destroyed||state.busy||!row.isConnected||!viewport.isConnected) return;
      if(state.paused||doc.hidden||row.querySelector('.onda-click-playing,.onda-player-ready,.onda-click-ready')){
        schedule(450);
        return;
      }

      const first=row.firstElementChild;
      if(!first){schedule();return}
      const style=doc.defaultView.getComputedStyle(row);
      const gap=parseFloat(style.gap||'0')||0;
      const distance=first.getBoundingClientRect().width+gap;

      state.busy=true;
      row.style.transition=`transform ${SLIDE_MS}ms cubic-bezier(.22,.61,.36,1)`;
      row.style.transform=`translate3d(-${distance}px,0,0)`;

      doc.defaultView.setTimeout(()=>{
        if(!row.isConnected){state.busy=false;return}
        row.style.transition='none';
        row.style.transform='translate3d(0,0,0)';

        const recycled=row.firstElementChild;
        if(recycled){
          row.appendChild(recycled);
          updateCard(recycled,shorts[nextIndex],nextIndex);
          nextIndex=(nextIndex+1)%shorts.length;
        }
        void row.offsetWidth;
        bindPauseToCards(row,state);
        state.busy=false;
        schedule(ROTATE_DELAY);
      },SLIDE_MS+35);
    };

    // primeira passagem logo após carregar para ficar visível que está animado
    schedule(1100);

    doc.defaultView.addEventListener('beforeunload',()=>{
      state.destroyed=true;
      if(timer) doc.defaultView.clearTimeout(timer);
    },{once:true});

    viewport._ondaInfiniteController={
      pause:()=>{state.paused=true},
      resume:()=>{state.paused=false;schedule(500)}
    };
  }

  function mobileCarousel(viewport,row,shorts,doc){
    viewport.classList.add('onda-carousel-mobile');
    row.classList.add('onda-carousel-mobile-row');
    row.replaceChildren();

    const COPIES=3;
    for(let copy=0;copy<COPIES;copy+=1){
      shorts.forEach((short,index)=>{
        row.appendChild(makeCard(short,index,doc,copy===1&&index<6));
      });
    }

    const state={paused:false,destroyed:false,normalizing:false,cycleWidth:0,last:performance.now(),raf:0};
    bindPauseToCards(row,state);

    const measure=()=>{
      const first=row.children[0];
      const second=row.children[shorts.length];
      if(!first||!second) return 0;
      state.cycleWidth=second.offsetLeft-first.offsetLeft;
      return state.cycleWidth;
    };

    const normalize=()=>{
      if(state.normalizing) return;
      if(!state.cycleWidth&&!measure()) return;
      const cycle=state.cycleWidth;
      let next=viewport.scrollLeft;
      if(next<cycle*.45) next+=cycle;
      else if(next>cycle*1.55) next-=cycle;
      if(Math.abs(next-viewport.scrollLeft)>1){
        state.normalizing=true;
        viewport.scrollLeft=next;
        doc.defaultView.requestAnimationFrame(()=>{state.normalizing=false});
      }
    };

    const tick=now=>{
      if(state.destroyed||!row.isConnected||!viewport.isConnected) return;
      normalize();
      const playing=!!row.querySelector('.onda-click-playing,.onda-player-ready,.onda-click-ready');
      if(!state.paused&&!playing&&!doc.hidden){
        const elapsed=Math.min(40,Math.max(0,now-state.last));
        viewport.scrollLeft+=Math.max(.35,elapsed*.032);
        normalize();
      }
      state.last=now;
      state.raf=doc.defaultView.requestAnimationFrame(tick);
    };

    let resumeTimer=0;
    const pause=()=>{
      state.paused=true;
      if(resumeTimer) doc.defaultView.clearTimeout(resumeTimer);
    };
    const resume=(delay=1000)=>{
      if(resumeTimer) doc.defaultView.clearTimeout(resumeTimer);
      resumeTimer=doc.defaultView.setTimeout(()=>{state.paused=false},delay);
    };

    viewport.addEventListener('touchstart',pause,{passive:true});
    viewport.addEventListener('touchend',()=>resume(1200),{passive:true});
    viewport.addEventListener('touchcancel',()=>resume(700),{passive:true});
    viewport.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')pause()},{passive:true});
    viewport.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')resume(1100)},{passive:true});
    viewport.addEventListener('scroll',normalize,{passive:true});

    const placeMiddle=()=>{
      if(!measure()) return;
      viewport.scrollLeft=state.cycleWidth;
    };
    doc.defaultView.requestAnimationFrame(placeMiddle);
    doc.defaultView.setTimeout(placeMiddle,80);
    doc.defaultView.setTimeout(placeMiddle,350);

    state.raf=doc.defaultView.requestAnimationFrame(tick);
    doc.defaultView.addEventListener('beforeunload',()=>{
      state.destroyed=true;
      if(state.raf) doc.defaultView.cancelAnimationFrame(state.raf);
    },{once:true});

    viewport._ondaInfiniteController={pause,resume,normalize};
  }

  async function mount(doc){
    const win=doc?.defaultView;
    const current=doc?.querySelector('.clips-row-wrap');
    if(!win||!current||current.dataset.ondaCarouselFinal==='1') return false;

    ensureStyle(doc);

    let shorts=[];
    try{
      const response=await win.fetch('/shorts-feed',{headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok) return false;
      const data=await response.json();
      shorts=Array.isArray(data?.shorts)?data.shorts.filter(item=>item?.id).slice(0,20):[];
    }catch{return false}
    if(shorts.length<6) return false;

    // clone elimina listeners/timers dos controladores antigos para não haver disputa.
    const viewport=current.cloneNode(false);
    viewport.className='clips-row-wrap onda-infinite-shorts onda-carousel-final';
    viewport.dataset.ondaCarouselFinal='1';
    viewport.dataset.ondaInfinite20V3='1';
    viewport.dataset.ondaDesktopFiveRotation='1';

    const row=doc.createElement('div');
    row.className='clips-row onda-safe-shorts-row onda-infinite-shorts-row onda-carousel-final-row';
    viewport.appendChild(row);
    current.replaceWith(viewport);

    if(win.innerWidth>=DESKTOP_MIN) desktopCarousel(viewport,row,shorts,doc);
    else mobileCarousel(viewport,row,shorts,doc);

    return true;
  }

  function watchFrame(frame){
    if(!frame||frame.dataset.ondaCarouselFinalWatch==='1') return;
    frame.dataset.ondaCarouselFinalWatch='1';

    let timer=0;
    const start=()=>{
      if(timer) clearInterval(timer);
      let tries=0;
      const attempt=async()=>{
        tries+=1;
        try{
          const doc=frame.contentDocument;
          if(doc?.head) ensureStyle(doc);
          const done=await mount(doc);
          if((done||tries>=40)&&timer){clearInterval(timer);timer=0}
        }catch{}
      };
      attempt();
      timer=setInterval(attempt,450);
    };

    frame.addEventListener('load',start);
    start();
  }

  const scan=()=>document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(watchFrame);
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
