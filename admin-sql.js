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
    const mysqlEndpoints = [
      ['/api/admin/customers?limit=50','sql-customers-table','customers', [['customer_id','ID'],['email','Email'],['first_name','Nombre'],['last_name','Apellidos']]],
      ['/api/admin/products?limit=50','sql-products-real-table','products', [['product_id','ID'],['title','Producto'],['status','Estado'],['vendor','Proveedor']]],
      ['/api/admin/sales?limit=50','sql-sales-table','sales', [['order_id','Pedido'],['gross_total','Importe'],['currency','Divisa'],['payment_status','Estado']]],
      ['/api/admin/inventory?limit=50','sql-inventory-table','inventory', [['inventory_item_id','ID artículo'],['location_id','Almacén'],['available','Unidades']]]
    ];
    // SQLite antiguo puede no disponer de estos endpoints; la vista básica sigue funcionando.
    const additional=await Promise.allSettled(mysqlEndpoints.map(async ([path,id,key,fields])=>{
      const response=await fetch(backend+path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(!response.ok)throw Error('Endpoint MySQL no disponible');
      const data=await response.json();listItems(data[key]||[],id,fields);
    }));
    const labels=['sql-customers-count','sql-products-count','sql-sales-count','sql-inventory-count'];
    const stats=[sum.customers,sum.products,sum.sales,sum.inventory];
    labels.forEach((id,i)=>{const node=byId(id);if(node)node.textContent=stats[i]??'—';});
    setStatus(additional.every(x=>x.status==='fulfilled')?'Conectado: datos MySQL consultados por HTTPS.':'Conectado al backend; algunas vistas requieren la versión MySQL.');
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
    for(const id of ['sql-orders-count','sql-webhooks-count','sql-audit-count','sql-customers-count','sql-products-count','sql-sales-count','sql-inventory-count'])byId(id).textContent='—';
    for(const id of ['sql-orders-table','sql-logs-table','sql-customers-table','sql-products-real-table','sql-sales-table','sql-inventory-table']){const node=byId(id);if(node)node.replaceChildren();}
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