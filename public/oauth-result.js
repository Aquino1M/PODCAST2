const result=document.querySelector("main");
window.opener?.postMessage({type:"social-connected"},result.dataset.origin);
if(result.dataset.success==="true")setTimeout(()=>window.close(),1200);
