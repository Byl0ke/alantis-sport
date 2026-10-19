'use strict';

// ALANTIS SPORT — Editor estático de productos.
// Las credenciales se mantienen ÚNICAMENTE en memoria, nunca en localStorage, URL ni repositorio.
const OWNER='Byl0ke', REPO='alantis-sport', BRANCH='main', PRODUCT_PATH='products.json';
const API=`https://api.github.com/repos/${OWNER}/${REPO}`;
const CATEGORIES=['Ropa deportiva','Calzado','Equipamiento','Vitaminas','Accesorios'];
const EUR=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const el=id=>document.getElementById(id);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeImage=(v)=>{const str=String(v||'');return /^(assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)|https:\/\/[a-zA-Z0-9._:/?=&%-]+)$/i.test(str)&&!str.includes('..')?str:'assets/shaker.webp';};
let catalog=[],selectedId=null,remoteSHA=null,token='',busy=false,dirty=false,pendingImage=null,photoPreviewURL=null;
const draftsKey='alantis-catalog-admin-draft-v1';

function normalized(p){
 if(!p || typeof p!=='object' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(p.id))) throw Error('Uno de los productos tiene un ID inválido.');
 const price=Number(p.price),stock=Number(p.stock),old=Number(p.oldPrice);
 if(!String(p.name||'').trim() || String(p.name).length>90) throw Error('Todos los productos necesitan un nombre de hasta 90 caracteres.');
 if(!CATEGORIES.includes(p.category)) throw Error('Categoría no válida.');
 if(!Number.isFinite(price)||price<0||price>999999) throw Error('Introduce un precio válido.');
 if(!Number.isSafeInteger(stock)||stock<0||stock>999999) throw Error('Introduce un stock válido.');
 if(String(p.image||'')!==safeImage(p.image)) throw Error('La imagen debe ser una ruta assets/ o una URL HTTPS válida.');
 return {id:String(p.id),name:String(p.name).trim(),category:p.category,price:Math.round(price*100)/100,oldPrice:p.oldPrice===null||p.oldPrice===''||!Number.isFinite(old)||old<=price?null:Math.round(old*100)/100,description:String(p.description||'').slice(0,400),reviews:Math.max(0,Math.min(99999,Number(p.reviews)||0)),rating:Math.max(0,Math.min(5,Number(p.rating)||0)),image:String(p.image),stock,active:p.active!==false,featured:p.featured!==false};
}
function validateCatalog(data){if(!Array.isArray(data))throw Error('products.json debe contener una lista de productos.');if(data.length>500)throw Error('El catálogo admite hasta 500 artículos.');const list=data.map(normalized);if(new Set(list.map(p=>p.id)).size!==list.length)throw Error('Existen identificadores repetidos.');return list;}
function setStatus(message,type=''){const node=el('status');node.textContent=message;node.className='status'+(type?' '+type:'');}
function setBusy(value){busy=value;['publish-top','publish-bottom','check-github','add-product','save-draft','duplicate-product','delete-product'].forEach(id=>{el(id).disabled=value;});}
function markDirty(){dirty=true;el('dirty-pill').hidden=false;el('stat-state').textContent='Sin publicar';el('stat-state-info').textContent='Cambios pendientes';setStatus('Tienes cambios locales sin publicar en GitHub.');}
function markClean(){dirty=false;el('dirty-pill').hidden=true;el('stat-state').textContent='Sincronizado';el('stat-state-info').textContent='Catálogo cargado';}
function imageFor(p){if(pendingImage && p.id===selectedId && photoPreviewURL)return photoPreviewURL;return safeImage(p.image);}
function renderStats(){el('stat-total').textContent=String(catalog.length);el('stat-visible').textContent=String(catalog.filter(p=>p.active).length);el('stat-empty').textContent=String(catalog.filter(p=>p.stock===0).length);el('products-count').textContent=String(catalog.length);}
function renderList(){const needle=el('admin-search').value.trim().toLowerCase();const list=catalog.filter(p=>(p.name+' '+p.category).toLowerCase().includes(needle));const holder=el('product-list');if(!list.length){holder.innerHTML='<div class="empty-list"><strong>No hay coincidencias</strong>Añade un producto o modifica tu búsqueda.</div>';return;}
 holder.innerHTML=list.map(p=>`<button class="product-row ${p.id===selectedId?'active':''}" type="button" data-select="${escapeHtml(p.id)}" aria-pressed="${p.id===selectedId}"><img src="${escapeHtml(safeImage(p.image))}" alt="" loading="lazy"/><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)} · ${p.stock===0?'<span class="status-tag">Agotado</span>':p.stock+' unidades'}${!p.active?' · Oculto':''}</small></span><b>${EUR.format(p.price)}</b></button>`).join('');}
function selected(){return catalog.find(p=>p.id===selectedId)||null;}
function renderPreview(){const p=selected();if(!p)return;el('preview-image').src=imageFor(p);el('preview-title').textContent=p.name||'Producto sin nombre';el('preview-category').textContent=p.category+(p.stock===0?' · Agotado':'');el('preview-price').textContent=EUR.format(Number(p.price)||0);}
function loadForm(id){const p=catalog.find(row=>row.id===id);if(!p)return;selectedId=id;
 for(const [field,value] of [['name',p.name],['category',p.category],['price',p.price],['oldprice',p.oldPrice??''],['stock',p.stock],['description',p.description||''],['image',p.image]])el('field-'+field).value=value;
 el('field-active').checked=p.active;el('field-featured').checked=p.featured;el('field-photo').value='';resetPendingImage();renderList();renderPreview();el('editor-kicker').textContent='EDITAR ARTÍCULO · '+p.id;}
function resetPendingImage(){if(photoPreviewURL){URL.revokeObjectURL(photoPreviewURL);photoPreviewURL=null;}pendingImage=null;el('file-hint').textContent='Se optimizará a formato WebP al publicar.';}
function updateFromForm(){const p=selected();if(!p)return;
 p.name=el('field-name').value.slice(0,90);p.category=el('field-category').value;p.price=Number(el('field-price').value)||0;const old=el('field-oldprice').value;p.oldPrice=old===''?null:Number(old);p.stock=Math.max(0,Math.trunc(Number(el('field-stock').value)||0));p.description=el('field-description').value.slice(0,400);p.image=el('field-image').value.trim();p.active=el('field-active').checked;p.featured=el('field-featured').checked;
 markDirty();renderStats();renderList();renderPreview();}
async function loadFromSite(){try{const res=await fetch('products.json?ts='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('No se encontró products.json ('+res.status+').');catalog=validateCatalog(await res.json());selectedId=catalog[0]?.id||null;if(selectedId)loadForm(selectedId);renderStats();markClean();setStatus('Catálogo cargado. Puedes editar los productos y publicar cuando quieras.','success');}catch(error){el('stat-state').textContent='Error';el('stat-state-info').textContent='No se pudo cargar';setStatus('Error cargando catálogo: '+error.message,'error');}}
function snapshot(){return validateCatalog(catalog);}
function idFor(name){let base=String(name||'producto').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,25)||'producto';let id=base+'-'+Math.random().toString(36).slice(2,8);while(catalog.some(p=>p.id===id))id=base+'-'+Math.random().toString(36).slice(2,8);return id;}
function addProduct(){if(busy)return;const p={id:idFor('producto'),name:'Nuevo producto',category:'Ropa deportiva',price:0,oldPrice:null,description:'',reviews:0,rating:0,image:'assets/shaker.webp',stock:0,active:false,featured:false};catalog.unshift(p);el('admin-search').value='';loadForm(p.id);markDirty();renderStats();el('field-name').focus();}
function duplicateProduct(){const p=selected();if(!p)return;const copy={...p,id:idFor(p.name),name:p.name+' (copia)',active:false};catalog.splice(catalog.indexOf(p)+1,0,copy);loadForm(copy.id);renderStats();markDirty();}
function deleteProduct(){const p=selected();if(!p)return;if(!window.confirm('¿Eliminar «'+p.name+'» del catálogo? Las fotografías antiguas permanecerán en GitHub.'))return;catalog=catalog.filter(x=>x.id!==p.id);resetPendingImage();selectedId=catalog[0]?.id||null;if(selectedId)loadForm(selectedId);else el('product-form').hidden=true;renderStats();renderList();markDirty();}
function utf8Base64(s){const bytes=new TextEncoder().encode(s);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
function saveJson(){const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'});downloadBlob(blob,'alantis-sport-products.json');}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function saveDraft(){try{localStorage.setItem(draftsKey,JSON.stringify({savedAt:new Date().toISOString(),catalog:snapshot()}));setStatus('Borrador guardado en este navegador. No está publicado.','success');}catch(error){setStatus('No se pudo guardar el borrador local: '+error.message,'error');}}
function restoreDraft(){try{const data=JSON.parse(localStorage.getItem(draftsKey)||'null');if(!data)throw Error('No hay ningún borrador guardado.');if(!window.confirm('¿Cargar el borrador guardado el '+new Date(data.savedAt).toLocaleString('es-ES')+'? Reemplazará los cambios locales actuales.'))return;catalog=validateCatalog(data.catalog);el('product-form').hidden=false;selectedId=catalog[0]?.id||null;if(selectedId)loadForm(selectedId);else renderList();renderStats();markDirty();setStatus('Borrador local restaurado. Pulsa Publicar para enviar a GitHub.','success');}catch(error){setStatus(error.message,'error');}}
function githubHeaders(){return {'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};}
async function api(path,options={}){if(!token)throw Error('Introduce primero tu token de GitHub.');const response=await fetch(API+path,{...options,headers:githubHeaders(),cache:'no-store'});let body={};try{body=await response.json();}catch{}if(!response.ok){const explanation=response.status===401?'Token no válido o caducado.':response.status===403?'Sin permiso para escribir en este repositorio. Revisa Contents: Read and write.':response.status===409?'Conflicto: el repositorio ha cambiado. Actualiza el catálogo antes de volver a intentar.':response.status===422?'Los archivos han cambiado o GitHub rechazó el contenido.':String(body.message||response.status);throw Error(explanation);}return body;}
async function connect(){const next=el('github-token').value.trim();if(!next){setStatus('Introduce un token temporal de GitHub.','error');return;}token=next;el('github-token').value='';setBusy(true);setStatus('Comprobando permisos de GitHub...');try{const file=await api('/contents/'+PRODUCT_PATH+'?ref='+BRANCH);if(file.type!=='file'||!file.sha)throw Error('No se ha encontrado el catálogo en el repositorio.');remoteSHA=file.sha;setStatus('GitHub conectado: catálogo encontrado. Puedes publicar cambios.','success');}catch(error){token='';remoteSHA=null;setStatus('No se pudo conectar: '+error.message,'error');}finally{setBusy(false);}}
async function optimizeImage(file){if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Solo se admiten PNG, JPG y WebP.');if(file.size>8*1024*1024)throw Error('La fotografía debe pesar menos de 8 MB.');const bmp=await createImageBitmap(file);const max=1200,ratio=Math.min(1,max/Math.max(bmp.width,bmp.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*ratio));canvas.height=Math.max(1,Math.round(bmp.height*ratio));canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo optimizar la imagen.')),'image/webp',0.83));if(blob.size>3*1024*1024)throw Error('La imagen optimizada es demasiado grande.');return blob;}
async function blobToBase64(blob){const buffer=await blob.arrayBuffer(),bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
async function photoChange(file){resetPendingImage();if(!file)return;try{const blob=await optimizeImage(file);pendingImage={id:selectedId,blob};photoPreviewURL=URL.createObjectURL(blob);el('file-hint').textContent='Imagen lista: '+(blob.size/1024).toFixed(0)+' KB. Se subirá junto con el catálogo.';markDirty();renderPreview();}catch(error){el('field-photo').value='';setStatus(error.message,'error');}}
async function publish(){if(busy)return;try{snapshot();}catch(error){setStatus(error.message,'error');return;}if(!token){setStatus('Para publicar, pega tu token y pulsa «Comprobar acceso».','error');el('github-token').focus();return;}
 if(!window.confirm('¿Publicar '+catalog.length+' productos en ALANTIS SPORT? Se guardarán en el repositorio main y aparecerán en la web tras el despliegue.'))return;
 setBusy(true);try{
  setStatus('Comprobando la última versión del catálogo...');const current=await api('/contents/'+PRODUCT_PATH+'?ref='+BRANCH);if(remoteSHA&&current.sha!==remoteSHA)throw Error('El catálogo cambió en GitHub desde que conectaste. Recarga la página antes de sobrescribir cambios de otra sesión.');
  if(pendingImage){setStatus('Subiendo fotografía a GitHub...');const p=catalog.find(x=>x.id===pendingImage.id);if(!p)throw Error('El producto de la fotografía ya no existe.');const path='assets/catalog/'+p.id+'-'+Date.now()+'.webp';await api('/contents/'+path,{method:'PUT',body:JSON.stringify({message:'assets: fotografía de '+p.name,content:await blobToBase64(pendingImage.blob),branch:BRANCH})});p.image=path;el('field-image').value=p.image;}
  setStatus('Publicando products.json...');const result=await api('/contents/'+PRODUCT_PATH,{method:'PUT',body:JSON.stringify({message:'catalog: actualizar productos desde panel ALANTIS SPORT',content:utf8Base64(JSON.stringify(snapshot(),null,2)+'\n'),sha:current.sha,branch:BRANCH})});remoteSHA=result.content?.sha||null;resetPendingImage();renderPreview();renderList();markClean();try{localStorage.removeItem(draftsKey);}catch{}setStatus('✓ Productos publicados en GitHub. La web tardará unos instantes en mostrar los cambios.','success');
 }catch(error){setStatus('No se pudo publicar: '+error.message+(pendingImage?' Si la foto se subió, puedes volver a publicar sin volver a subirla.':''),'error');}finally{setBusy(false);}}

el('product-list').addEventListener('click',event=>{const button=event.target.closest('[data-select]');if(button&&!busy)loadForm(button.dataset.select);});
el('admin-search').addEventListener('input',renderList);
el('product-form').addEventListener('input',event=>{if(event.target.id==='field-photo')return;updateFromForm();});
el('product-form').addEventListener('change',event=>{if(event.target.id==='field-photo')return;updateFromForm();});
el('field-photo').addEventListener('change',event=>photoChange(event.target.files?.[0]));
el('product-form').addEventListener('submit',event=>{event.preventDefault();try{snapshot();saveDraft();}catch(error){setStatus(error.message,'error');}});
el('add-product').addEventListener('click',addProduct);
el('duplicate-product').addEventListener('click',duplicateProduct);
el('delete-product').addEventListener('click',deleteProduct);
el('download-json').addEventListener('click',()=>{try{saveJson();setStatus('Copia de seguridad JSON descargada.','success');}catch(error){setStatus(error.message,'error');}});
el('restore-draft').addEventListener('click',restoreDraft);
el('check-github').addEventListener('click',connect);
el('publish-top').addEventListener('click',()=>{el('publish-heading').scrollIntoView({behavior:'smooth'});publish();});
el('publish-bottom').addEventListener('click',publish);
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
el('year').textContent=String(new Date().getFullYear());
loadFromSite();