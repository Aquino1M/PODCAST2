(() => {
  const STYLE_ID = 'onda-social-connect-fix-v1';
  let pending = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const css = `
    /* O seletor antigo continua montado para manter a lógica, mas não aparece mais na página. */
    .onda-social-source-panel{display:none !important}

    /* Corrige o modal nativo "Conectar canais oficiais" no tema claro. */
    html[data-theme="light"] .app-modal .connection-list>div,
    html[data-theme="light"] .app-modal .setup-note{
      background:#fff !important;
      color:#101828 !important;
      border:1px solid #dfe5e2 !important;
      box-shadow:none !important;
    }
    html[data-theme="light"] .app-modal .connection-list strong,
    html[data-theme="light"] .app-modal .setup-note strong{color:#101828 !important}
    html[data-theme="light"] .app-modal .connection-list small,
    html[data-theme="light"] .app-modal .setup-note p{color:#667085 !important}
    html[data-theme="light"] .app-modal .provider-icon{
      background:#f8fafc !important;
      color:#101828 !important;
      border:1px solid #dfe5e2 !important;
    }

    .onda-tikhub-row{position:relative}
    .onda-tikhub-brand{
      width:36px;height:36px;display:grid;place-items:center;border-radius:10px;
      background:#111827;color:#fff;font:900 9px/1 system-ui;letter-spacing:.04em;flex:0 0 36px
    }
    .onda-tikhub-row .onda-tikhub-copy{min-width:0;flex:1}
    .onda-tikhub-row .onda-tikhub-copy strong{display:block}
    .onda-tikhub-row .onda-tikhub-copy small{display:block;margin-top:3px}
    .onda-tikhub-configure{
      appearance:none;border:1px solid #6366f1;background:#6366f1;color:#fff;
      border-radius:10px;padding:11px 14px;font:800 10px/1 system-ui;cursor:pointer
    }

    .onda-vitrine-source-box{
      margin-top:14px;padding:14px 16px;border:1px solid #dfe5e2;border-radius:14px;
      background:#fff;color:#101828;display:flex;align-items:center;justify-content:space-between;gap:14px
    }
    .onda-vitrine-source-box>div:first-child strong{display:block;font-size:11px;margin-bottom:4px}
    .onda-vitrine-source-box>div:first-child small{display:block;color:#667085;font-size:9px;line-height:1.45}
    .onda-vitrine-source-toggle{display:flex;gap:4px;padding:4px;border:1px solid #dfe5e2;border-radius:11px;background:#f8fafc;flex:0 0 auto}
    .onda-vitrine-source-toggle button{
      appearance:none;border:0;background:transparent;color:#667085;border-radius:8px;padding:8px 10px;
      font:800 9px/1 system-ui;cursor:pointer
    }
    .onda-vitrine-source-toggle button.active{background:#6366f1;color:#fff;box-shadow:0 5px 14px rgba(99,102,241,.2)}
    .onda-vitrine-source-toggle button:disabled{opacity:.55;cursor:wait}

    html[data-theme="dark"] .onda-vitrine-source-box{background:#111827;color:#f8fafc;border-color:#293244}
    html[data-theme="dark"] .onda-vitrine-source-box>div:first-child small{color:#a8b1c3}
    html[data-theme="dark"] .onda-vitrine-source-toggle{background:#0b1220;border-color:#293244}
    html[data-theme="dark"] .onda-vitrine-source-toggle button{color:#a8b1c3}

    .onda-tikhub-overlay{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:18px;background:rgba(6,10,20,.62);backdrop-filter:blur(8px)}
    .onda-tikhub-modal{width:min(720px,96vw);max-height:92vh;overflow:auto;border-radius:22px;background:#fff;color:#101828;border:1px solid #dfe5e2;box-shadow:0 32px 90px rgba(2,6,23,.34)}
    .onda-tikhub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid #e6e9e7}
    .onda-tikhub-head small{display:block;color:#6366f1;font:800 9px/1 system-ui;letter-spacing:.17em;margin-bottom:7px}
    .onda-tikhub-head h2{margin:0;font-size:24px;font-family:var(--display-font,Georgia,serif)}
    .onda-tikhub-head p{margin:7px 0 0;color:#667085;font:500 10px/1.5 system-ui}
    .onda-tikhub-close{appearance:none;border:0;width:34px;height:34px;border-radius:10px;background:#111827;color:#fff;font-size:18px;cursor:pointer}
    .onda-tikhub-body{padding:22px 24px}
    .onda-tikhub-status{display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:11px 13px;border-radius:12px;background:#f8fafc;border:1px solid #e6e9e7;font:700 9px/1.4 system-ui;color:#667085}
    .onda-tikhub-status i{width:7px;height:7px;border-radius:50%;background:#f79009;box-shadow:0 0 0 4px rgba(247,144,9,.12)}
    .onda-tikhub-status.ready i{background:#12b76a;box-shadow:0 0 0 4px rgba(18,183,106,.12)}
    .onda-tikhub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .onda-tikhub-field{display:flex;flex-direction:column;gap:6px}
    .onda-tikhub-field.wide{grid-column:1/-1}
    .onda-tikhub-field span{font:800 9px/1 system-ui;letter-spacing:.06em;color:#667085}
    .onda-tikhub-field input{width:100%;box-sizing:border-box;border:1px solid #dfe5e2;border-radius:11px;padding:11px 12px;background:#fff;color:#101828;outline:none;font:500 12px/1.2 system-ui}
    .onda-tikhub-field input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
    .onda-tikhub-check{display:flex;align-items:center;gap:7px;margin-top:7px;color:#667085;font:700 9px/1 system-ui}
    .onda-tikhub-note{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e6e9e7;color:#667085;font:600 9px/1.55 system-ui}
    .onda-tikhub-error{min-height:18px;margin:12px 0 0;color:#d92d20;font:700 10px/1.4 system-ui}
    .onda-tikhub-actions{display:flex;justify-content:flex-end;gap:9px;padding:0 24px 24px}
    .onda-tikhub-actions button{appearance:none;border-radius:11px;padding:11px 15px;font:800 10px/1 system-ui;cursor:pointer}
    .onda-tikhub-actions .cancel{border:1px solid #dfe5e2;background:#fff;color:#101828}
    .onda-tikhub-actions .save{border:1px solid #6366f1;background:#6366f1;color:#fff}
    .onda-tikhub-actions button:disabled{opacity:.55;cursor:wait}

    html[data-theme="dark"] .onda-tikhub-modal{background:#111827;color:#f8fafc;border-color:#293244}
    html[data-theme="dark"] .onda-tikhub-head{border-color:#293244}
    html[data-theme="dark"] .onda-tikhub-head p,
    html[data-theme="dark"] .onda-tikhub-field span,
    html[data-theme="dark"] .onda-tikhub-check,
    html[data-theme="dark"] .onda-tikhub-note,
    html[data-theme="dark"] .onda-tikhub-status{color:#a8b1c3}
    html[data-theme="dark"] .onda-tikhub-field input{background:#0b1220;color:#f8fafc;border-color:#293244}
    html[data-theme="dark"] .onda-tikhub-note,
    html[data-theme="dark"] .onda-tikhub-status{background:#0b1220;border-color:#293244}
    html[data-theme="dark"] .onda-tikhub-actions .cancel{background:#111827;color:#f8fafc;border-color:#293244}

    @media(max-width:700px){
      .onda-vitrine-source-box{align-items:stretch;flex-direction:column}
      .onda-vitrine-source-toggle{width:100%;box-sizing:border-box}
      .onda-vitrine-source-toggle button{flex:1}
      .onda-tikhub-grid{grid-template-columns:1fr}
      .onda-tikhub-field.wide{grid-column:auto}
      .onda-tikhub-head,.onda-tikhub-body{padding:18px}
      .onda-tikhub-actions{padding:0 18px 18px}
      .onda-tikhub-row{align-items:center !important}
      .onda-tikhub-configure{padding:10px 11px}
    }
  `;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=css;
    document.head.appendChild(style);
  }

  async function json(url, options){
    const response=await fetch(url, options);
    let body={};
    try{body=await response.json()}catch{}
    if(!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  async function syncVitrine(){
    const [social,showcase]=await Promise.all([
      json('/social-live-api?action=public',{cache:'no-store'}).catch(()=>({mode:'demo',metrics:{}})),
      json('/api/public/showcase',{cache:'no-store'}).catch(()=>({})),
    ]);
    const oauth=showcase?.metrics && typeof showcase.metrics==='object' ? showcase.metrics : {};
    const publicMetrics=social?.metrics && typeof social.metrics==='object' ? social.metrics : {};
    const metrics=social.mode==='real' ? {...publicMetrics,...oauth} : {};
    const data={...showcase,metrics,socialDisplayMode:social.mode};
    document.querySelectorAll('iframe.public-vitrine-frame,iframe[src*="/public/vitrine.html"]').forEach(frame=>{
      try{frame.contentWindow?.postMessage({type:'onda-showcase-data',data},location.origin)}catch{}
    });
    return social;
  }

  async function setMode(mode, root){
    const buttons=root.querySelectorAll('[data-onda-source]');
    buttons.forEach(button=>button.disabled=true);
    try{
      await json('/social-live-api?action=config',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})
      });
      buttons.forEach(button=>button.classList.toggle('active',button.dataset.ondaSource===mode));
      await syncVitrine();
      const metricNav=document.querySelector('[data-page="metrics"]');
      if(metricNav){metricNav.click();setTimeout(syncVitrine,250)}
    }catch(error){
      alert(error.message);
    }finally{
      buttons.forEach(button=>button.disabled=false);
    }
  }

  async function openTikHub(){
    let config;
    try{config=await json('/social-live-api?action=config',{cache:'no-store'})}
    catch(error){alert(error.message);return}
    document.querySelector('.onda-tikhub-overlay')?.remove();
    const account=key=>config.accounts?.[key]||{id:'',enabled:true};
    const overlay=document.createElement('div');
    overlay.className='onda-tikhub-overlay';
    overlay.innerHTML=`<section class="onda-tikhub-modal" role="dialog" aria-modal="true" aria-label="Configurar TikHub">
      <div class="onda-tikhub-head"><div><small>TIKHUB API</small><h2>Contas sociais verdadeiras</h2><p>A chave fica somente no servidor. Cadastre as contas que devem alimentar a vitrine quando o modo Verdadeiro estiver ativo.</p></div><button class="onda-tikhub-close" type="button" aria-label="Fechar">×</button></div>
      <form data-tikhub-form>
        <div class="onda-tikhub-body">
          <div class="onda-tikhub-status ${config.tikhubConfigured?'ready':''}"><i></i><span>${config.tikhubConfigured?'TikHub configurada e pronta para consultar contas públicas':'TikHub ainda não configurada'}</span></div>
          <div class="onda-tikhub-grid">
            <label class="onda-tikhub-field wide"><span>API KEY TIKHUB</span><input name="apiKey" type="password" autocomplete="new-password" placeholder="${config.tikhubConfigured?'Deixe vazio para manter a chave atual':'Cole a API Key da tikhub.io'}"></label>
            <label class="onda-tikhub-field"><span>TIKTOK · @USUÁRIO</span><input name="tiktok" value="${esc(account('tiktok').id)}" placeholder="bebezaopodcast"><label class="onda-tikhub-check"><input name="tiktokEnabled" type="checkbox" ${account('tiktok').enabled!==false?'checked':''}> Usar na vitrine</label></label>
            <label class="onda-tikhub-field"><span>INSTAGRAM · @USUÁRIO</span><input name="instagram" value="${esc(account('instagram').id)}" placeholder="aquinocast"><label class="onda-tikhub-check"><input name="instagramEnabled" type="checkbox" ${account('instagram').enabled!==false?'checked':''}> Usar na vitrine</label></label>
            <label class="onda-tikhub-field wide"><span>YOUTUBE · CHANNEL ID OU @HANDLE</span><input name="youtube" value="${esc(account('youtube').id)}" placeholder="UC... ou @canal"><label class="onda-tikhub-check"><input name="youtubeEnabled" type="checkbox" ${account('youtube').enabled!==false?'checked':''}> Usar na vitrine</label></label>
          </div>
          <p class="onda-tikhub-note">O OAuth oficial continua disponível no modal anterior. Se uma rede estiver autenticada oficialmente e também configurada na TikHub, o dado oficial autenticado tem prioridade.</p>
          <p class="onda-tikhub-error" data-tikhub-error></p>
        </div>
        <div class="onda-tikhub-actions"><button class="cancel" type="button">Cancelar</button><button class="save" type="submit">Salvar TikHub</button></div>
      </form>
    </section>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('.onda-tikhub-close').onclick=close;
    overlay.querySelector('.cancel').onclick=close;
    overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
    const form=overlay.querySelector('[data-tikhub-form]');
    form.onsubmit=async event=>{
      event.preventDefault();
      const data=new FormData(form),button=form.querySelector('.save'),error=form.querySelector('[data-tikhub-error]');
      button.disabled=true;error.textContent='';
      try{
        await json('/social-live-api?action=config',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            apiKey:String(data.get('apiKey')||'').trim(),
            accounts:{
              tiktok:{id:String(data.get('tiktok')||'').trim(),enabled:data.has('tiktokEnabled')},
              instagram:{id:String(data.get('instagram')||'').trim(),enabled:data.has('instagramEnabled')},
              youtube:{id:String(data.get('youtube')||'').trim(),enabled:data.has('youtubeEnabled')},
            }
          })
        });
        close();
        await syncVitrine();
      }catch(saveError){error.textContent=saveError.message}
      finally{button.disabled=false}
    };
  }

  async function enhanceModal(){
    const list=document.querySelector('.modal-overlay .connection-list');
    if(!list || list.dataset.ondaTikHub==='1') return;
    list.dataset.ondaTikHub='1';
    let state={mode:'demo',tikhubConfigured:false};
    try{state=await json('/social-live-api?action=public',{cache:'no-store'})}catch{}

    const row=document.createElement('div');
    row.className='onda-tikhub-row';
    row.innerHTML=`<span class="onda-tikhub-brand">TH</span><div class="onda-tikhub-copy"><strong>TikHub API</strong><small>${state.tikhubConfigured?'Configurada · dados públicos reais':'Configurar API e contas públicas'}</small></div><button type="button" class="onda-tikhub-configure">${state.tikhubConfigured?'Gerenciar':'Configurar'}</button>`;
    list.appendChild(row);
    row.querySelector('.onda-tikhub-configure').onclick=openTikHub;

    const source=document.createElement('div');
    source.className='onda-vitrine-source-box';
    source.innerHTML=`<div><strong>O que aparece na vitrine?</strong><small>Escolha dados demonstrativos ou os dados verdadeiros das contas conectadas/TikHub.</small></div><div class="onda-vitrine-source-toggle"><button type="button" data-onda-source="demo" class="${state.mode==='demo'?'active':''}">Demonstrativo</button><button type="button" data-onda-source="real" class="${state.mode==='real'?'active':''}">Verdadeiro</button></div>`;
    const note=list.parentElement?.querySelector('.setup-note');
    if(note) note.before(source); else list.after(source);
    source.querySelectorAll('[data-onda-source]').forEach(button=>button.onclick=()=>setMode(button.dataset.ondaSource,source));
  }

  function scan(){
    ensureStyle();
    enhanceModal();
  }

  function schedule(){
    if(pending) return;
    pending=true;
    queueMicrotask(()=>{pending=false;scan()});
  }

  scan();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();