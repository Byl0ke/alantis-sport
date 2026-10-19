// ALANTIS SPORT | Entrada visual al editor. IMPORTANTE: NO es seguridad real.
// En una página estática cualquier visitante puede acceder al código fuente y a los JSON.
// La publicación exige credenciales propias y autorizadas de GitHub (jamás embebidas aquí).
'use strict';
(() => {
  const gate=document.getElementById('admin-gate');
  const shell=document.getElementById('admin-shell');
  const form=document.getElementById('pin-form');
  const input=document.getElementById('admin-pin');
  const status=document.getElementById('pin-message');
  const submit=document.getElementById('pin-submit');
  const visible=document.getElementById('pin-visibility');
  const SESSION_KEY='alantis-sport-admin-access-v1';
  const SALT='ALANTIS-SPORT:gate:v1:public-not-a-security-measure:';
  const DIGEST='7a304b5a455423461fdbcb3ed00116e033d3a84e36aacc77c0aac50110835760';
  let processing=false;
  const setMessage=(message)=>{status.textContent=message;status.classList.toggle('error',Boolean(message));};
  const access=()=>{
    gate.hidden=true;
    shell.hidden=false;
    document.body.classList.add('admin-unlocked');
    const title=shell.querySelector('.topbar h1');
    title.setAttribute('tabindex','-1');
    title.focus({preventScroll:true});
    window.scrollTo(0,0);
  };
  const lock=()=>{
    if(typeof window.dirty!=='undefined' && window.dirty && !confirm('Hay cambios pendientes. ¿Bloquear el panel?')) return;
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  };
  async function sha256(value){
    const data=new TextEncoder().encode(value);
    const digest=await crypto.subtle.digest('SHA-256',data);
    return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  const unlock=async (evt)=>{
    evt.preventDefault();if(processing)return;
    const pin=input.value.trim();
    if(!/^\d{6}$/.test(pin)){setMessage('Introduce un PIN de 6 cifras.');return;}
    processing=true;submit.disabled=true;
    try{
      const digest=await sha256(SALT+pin);
      if(digest===DIGEST){sessionStorage.setItem(SESSION_KEY,DIGEST);input.value='';setMessage('');access();}
      else{input.value='';setMessage('PIN incorrecto. Vuelve a intentarlo.');input.focus();}
    }catch{setMessage('No se ha podido comprobar el PIN en este navegador. Usa la versión HTTPS publicada.');}
    finally{processing=false;submit.disabled=false;}
  };
  form.addEventListener('submit',unlock);
  input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,6);setMessage('');});
  document.querySelector('.pin-pad').addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.dataset.digit!==undefined)input.value=(input.value+btn.dataset.digit).slice(0,6);
    else if(btn.dataset.key==='clear')input.value='';
    else if(btn.dataset.key==='back')input.value=input.value.slice(0,-1);
    setMessage('');input.focus();
  });
  visible.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';visible.textContent=show?'Ocultar':'Mostrar';visible.setAttribute('aria-pressed',String(show));visible.setAttribute('aria-label',show?'Ocultar PIN':'Mostrar PIN');input.focus();});
  document.getElementById('logout-top').addEventListener('click',lock);
  document.getElementById('logout-side').addEventListener('click',lock);
  if(sessionStorage.getItem(SESSION_KEY)===DIGEST)access();else{gate.hidden=false;shell.hidden=true;}
})();