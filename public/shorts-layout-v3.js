(() => {
  const STYLE_ID='onda-shorts-layout-v3';
  const css=`
    .bottom-showcase,
    .clips-container-main{
      width:100% !important;
      max-width:none !important;
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

  function apply(frame){
    try{
      const doc=frame.contentDocument;
      if(!doc?.head) return;
      let style=doc.getElementById(STYLE_ID);
      if(!style){style=doc.createElement('style');style.id=STYLE_ID;doc.head.appendChild(style)}
      if(style.textContent!==css) style.textContent=css;
    }catch{}
  }

  function watch(frame){
    if(!frame||frame.dataset.ondaShortLayoutV3==='1') return;
    frame.dataset.ondaShortLayoutV3='1';
    frame.addEventListener('load',()=>{apply(frame);setTimeout(()=>apply(frame),500);setTimeout(()=>apply(frame),1500)});
    apply(frame);
    setTimeout(()=>apply(frame),700);
  }

  const scan=()=>document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(watch);
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();