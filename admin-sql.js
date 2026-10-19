// ALANTIS SPORT | Consultas a servidor privado: nunca almacena credenciales en GitHub ni localStorage.
'use strict';
(() => {
  const byId=id=>document.getElementById(id);
  const url=byId('sql-api-url'), tokenField=byId('sql-api-token'), status=byId('sql-status');
  if(!url || !tokenField || !status)return;
  let backend='',token='';
  const setStatus=(value,error=false)=>{status.textContent=value;status.classList.toggle('error',error);};
  function validEndpoint(value){
    let u;
    try {u=new URL(value.trim());}catch{throw Error('Introduce la URL completa del servidor (https://...).');}
    if(u.protocol!=='https:' && !(u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname)))throw Error('El servidor debe utilizar HTTPS. HTTP solo se admite en localhost.');
    if(u.username || u.password || u.search || u.hash)throw Error('Introduce únicamente la URL base, sin claves ni parámetros.');
    return u.origin;
  }
  async function request(path, opts={}){
    if(!backend || !token)throw Error('Conecta primero el servidor privado.');
    const res=await fetch(backend+path,{...opts,cache:'no-store',headers:{'Authorization':'Bearer '+token,...opts.headers}});
    if(!res.ok)throw Error(res.status===401?'Token de administración incorrecto.':'Error del servidor ('+res.status+').');
    return res;
  }
  function cell(text){const td=document.createElement('td');td.textContent=String(text??'—');return td;}
  function listItems(data,id,keys){
    const node=byId(id);node.replaceChildren();
    if(!data.length){const p=document.createElement('p');p.className='sql-empty';p.textContent='Todavía no hay registros guardados.';node.append(p);return;}
    const table=document.createElement('table');table.className='sql-table';
    const thead=table.createTHead();const tr=thead.insertRow();
    keys.forEach(([_,title])=>{const th=document.createElement('th');th.textContent=title;tr.append(th);});
    const body=table.createTBody();
    data.forEach(obj=>{const row=body.insertRow();keys.forEach(([field])=>row.append(cell(obj[field])));});
    node.append(table);
  }
  async function refresh(){
    const [sum,orders,logs]=await Promise.all([
      request('/api/admin/summary').then(r=>r.json()),
      request('/api/admin/orders?limit=50').then(r=>r.json()),
      request('/api/admin/logs?limit=100').then(r=>r.json())
    ]);
    byId('sql-orders-count').textContent=sum.orders;
    byId('sql-webhooks-count').textContent=sum.webhooks;
    byId('sql-audit-count').textContent=sum.audit_events;
    listItems(orders.orders,'sql-orders-table',[['name','Pedido'],['created_at','Fecha'],['email','Cliente'],['total','Total'],['currency','Divisa'],['financial_status','Pago'],['fulfillment_status','Entrega']]);
    listItems(logs.logs,'sql-logs-table',[['created_at','Fecha'],['actor','Origen'],['action','Evento'],['target','Pedido / destino']]);
    setStatus('Conectado: datos recuperados del archivo SQL cifrado del servidor.');
  }
  byId('sql-connect').addEventListener('click',async()=>{
    let u;
    try{u=validEndpoint(url.value);}catch(e){setStatus(e.message,true);return;}
    const t=tokenField.value.trim();
    if(!t){setStatus('Introduce el token privado del servidor; no es el PIN visual.',true);return;}
    backend=u;token=t;tokenField.value='';
    try{await refresh();}catch(e){backend='';token='';setStatus('No se pudo conectar: '+e.message,true);}
  });
  byId('sql-refresh').addEventListener('click',()=>refresh().catch(e=>setStatus(e.message,true)));
  byId('sql-backup').addEventListener('click',async()=>{
    try{
      const response=await request('/api/admin/backup');
      const blob=await response.blob();
      const obj=URL.createObjectURL(blob);const a=document.createElement('a');
      a.href=obj;a.download='alantis-pedidos-'+new Date().toISOString().slice(0,10)+'.sql.enc';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(obj),2000);
      setStatus('Descargada la copia cifrada. Conserva la clave de cifrado fuera de GitHub.');
    }catch(e){setStatus(e.message,true);}
  });
  byId('sql-disconnect').addEventListener('click',()=>{
    backend='';token='';url.value='';tokenField.value='';
    for(const id of ['sql-orders-count','sql-webhooks-count','sql-audit-count'])byId(id).textContent='—';
    byId('sql-orders-table').replaceChildren();byId('sql-logs-table').replaceChildren();
    setStatus('Conexión cerrada y token descartado de esta pestaña.');
  });
  // Opcional: un éxito de publicación en GitHub se añade al registro cifrado si el
  // propietario ha abierto y autorizado previamente la conexión con su backend.
  window.alantisAudit=(action,target)=>{
    if(!backend||!token)return;
    request('/api/admin/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,target})})
      .then(()=>refresh()).catch(()=>setStatus('Publicado, pero no se registró en el servidor privado.',true));
  };
})();