(() => {
  const STYLE_ID='onda-shorts-layout-v3';
  const css=`
    .bottom-showcase,
    .clips-container-main{
      width:100% !important;
      max-width:none !important;
    }

    .clips-container-main{
      align-items:center !important;
    }

    .clips-row-wrap.onda-infinite-shorts{
      width:min(1080px,calc(100vw - 40px)) !important;
      max-width:none !important;
      margin:0 auto !important;
      padding:18px 0 22px !important;
      overflow-x:auto !important;
      overflow-y:visible !important;
      scrollbar-width:none !important;
      -webkit-overflow-scrolling:touch !important;
    }
    .clips-row-wrap.onda-infinite-shorts::-webkit-scrollbar{display:none !important}

    .clips-row.onda-infinite-shorts-row{
      gap:24px !important;
      padding:0 14px !important;
      margin:0 !important;
      align-items:center !important;
      justify-content:flex-start !important;
    }

    .clips-row.onda-infinite-shorts-row .onda-safe-short{
      flex:0 0 clamp(156px,12vw,186px) !important;
      width:clamp(156px,12vw,186px) !important;
      height:258px !important;
      border-radius:22px !important;
    }

    .clips-row.onda-infinite-shorts-row .onda-safe-short.onda-click-playing,
    .clips-row.onda-infinite-shorts-row .onda-safe-short.onda-player-ready{
      aspect-ratio:9 / 16 !important;
      height:auto !important;
      min-height:0 !important;
    }

    /* PC: a seção de vídeos sai do limite interno do dashboard e usa o centro
       real da janela. Assim os cinco cards não ficam presos na metade esquerda. */
    @media (min-width:1025px){
      .bottom-showcase{
        position:relative !important;
        left:50% !important;
        width:100vw !important;
        max-width:100vw !important;
        margin-left:-50vw !important;
        margin-right:-50vw !important;
        padding-left:0 !important;
        padding-right:0 !important;
        justify-content:center !important;
      }
      .clips-container-main{
        width:100% !important;
        max-width:none !important;
        align-items:center !important;
      }
      .clips-row-wrap.onda-infinite-shorts{
        margin-left:auto !important;
        margin-right:auto !important;
        flex:0 0 auto !important;
      }
    }

    @media (min-width:701px) and (max-width:1100px){
      .clips-row-wrap.onda-infinite-shorts{
        width:calc(100vw - 28px) !important;
      }
      .clips-row.onda-infinite-shorts-row{
        gap:18px !important;
        padding:0 10px !important;
      }
      .clips-row.onda-infinite-shorts-row .onda-safe-short{
        flex-basis:clamp(142px,17vw,168px) !important;
        width:clamp(142px,17vw,168px) !important;
        height:236px !important;
      }
    }

    @media (max-width:700px){
      .bottom-showcase,
      .clips-container-main{
        width:100% !important;
        max-width:100% !important;
      }
      .bottom-showcase{
        left:auto !important;
        margin-left:0 !important;
        margin-right:0 !important;
      }
      .clips-row-wrap.onda-infinite-shorts{
        width:100% !important;
        max-width:100% !important;
        margin:0 !important;
        padding:14px 0 18px !important;
        overscroll-behavior-inline:contain !important;
      }
      .clips-row.onda-infinite-shorts-row{
        gap:14px !important;
        padding:0 12px !important;
      }
      .clips-row.onda-infinite-shorts-row .onda-safe-short{
        flex:0 0 min(40vw,146px) !important;
        width:min(40vw,146px) !important;
        height:210px !important;
        border-radius:19px !important;
      }
      .clips-row.onda-infinite-shorts-row .onda-safe-short.onda-click-playing,
      .clips-row.onda-infinite-shorts-row .onda-safe-short.onda-player-ready{
        aspect-ratio:9 / 16 !important;
        height:auto !important;
      }
    }
  `;

  function ensureStyle(doc){
    if(!doc?.head) return;
    let style=doc.getElementById(STYLE_ID);
    if(!style){style=doc.createElement('style');style.id=STYLE_ID;doc.head.appendChild(style)}
    if(style.textContent!==css) style.textContent=css;
  }

  function sizeDesktop(doc){
    try{
      const win=doc.defaultView;
      const viewport=doc.querySelector('.clips-row-wrap.onda-infinite-shorts');
      const row=doc.querySelector('.clips-row.onda-infinite-shorts-row');
      const card=row?.querySelector('.onda-safe-short');
      if(!viewport||!row||!card) return false;

      if(win.innerWidth<1025){
        viewport.style.removeProperty('width');
        viewport.style.removeProperty('max-width');
        return true;
      }

      const rowStyle=win.getComputedStyle(row);
      const gap=parseFloat(rowStyle.gap||'0')||0;
      const padLeft=parseFloat(rowStyle.paddingLeft||'0')||0;
      const padRight=parseFloat(rowStyle.paddingRight||'0')||0;
      const cardWidth=card.getBoundingClientRect().width;
      const desired=Math.ceil(cardWidth*5+gap*4+padLeft+padRight+2);
      const available=Math.max(720,win.innerWidth-40);
      const width=Math.min(desired,available);

      viewport.style.setProperty('width',`${width}px`,'important');
      viewport.style.setProperty('max-width',`${available}px`,'important');
      return true;
    }catch{return false}
  }

  function apply(frame){
    try{
      const doc=frame.contentDocument;
      if(!doc?.head) return false;
      ensureStyle(doc);
      sizeDesktop(doc);
      return true;
    }catch{return false}
  }

  function watch(frame){
    if(!frame||frame.dataset.ondaShortLayoutV3==='2') return;
    frame.dataset.ondaShortLayoutV3='2';
    let timer=null;

    const start=()=>{
      if(timer) clearInterval(timer);
      let attempts=0;
      const run=()=>{
        apply(frame);
        attempts+=1;
        if(attempts>=30&&timer){clearInterval(timer);timer=null}
      };
      run();
      timer=setInterval(run,500);
      try{
        const win=frame.contentWindow;
        if(win&&!win.__ondaShortDesktopResize){
          win.__ondaShortDesktopResize=true;
          win.addEventListener('resize',()=>setTimeout(()=>apply(frame),80));
        }
      }catch{}
    };

    frame.addEventListener('load',start);
    start();
  }

  const scan=()=>document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(watch);
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();