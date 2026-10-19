'use strict';

// Catálogo de reserva: se usa si products.json no se puede leer (p. ej., archivo local).
let PRODUCTS = [
  {id:'camiseta',name:'Camiseta Performance ALANTIS',category:'Ropa deportiva',price:24.99,oldPrice:null,reviews:128,image:'assets/camiseta.webp',rating:5},
  {id:'zapatillas',name:'Zapatillas Running Pro',category:'Calzado',price:79.99,oldPrice:null,reviews:86,image:'assets/zapatillas.webp',rating:5},
  {id:'guantes',name:'Guantes de Entrenamiento',category:'Equipamiento',price:34.99,oldPrice:null,reviews:64,image:'assets/guantes.webp',rating:5},
  {id:'proteina',name:'Proteína Whey Isolada',category:'Vitaminas',price:49.99,oldPrice:null,reviews:203,image:'assets/proteina.webp',rating:5},
  {id:'creatina',name:'Creatina Monohidrato',category:'Vitaminas',price:29.99,oldPrice:null,reviews:118,image:'assets/creatina.webp',rating:5},
  {id:'shaker',name:'Shaker Premium 700 ml',category:'Accesorios',price:14.99,oldPrice:null,reviews:91,image:'assets/shaker.webp',rating:5},
];
const EUR = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const byId = (id)=> document.getElementById(id);
let lookup = Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));
const escapeHtml=(v)=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const CATEGORIES=['Ropa deportiva','Calzado','Equipamiento','Vitaminas','Accesorios'];
const safeImage=(v)=>{const src=String(v||'');return /^(assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)|https:\/\/[a-zA-Z0-9._:/?=&%-]+)$/i.test(src)&&!src.includes('..')?src:'assets/shaker.webp';};
const safeProduct=(p)=>{if(!p||typeof p!=='object'||!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(p.id)))return null;const price=Number(p.price);if(!Number.isFinite(price)||price<0||price>999999)return null;return {id:String(p.id),name:String(p.name||'Producto').slice(0,90),category:CATEGORIES.includes(p.category)?p.category:'Accesorios',price:Math.round(price*100)/100,oldPrice:Number.isFinite(Number(p.oldPrice))&&Number(p.oldPrice)>price?Number(p.oldPrice):null,description:String(p.description||'').slice(0,400),reviews:Math.max(0,Math.min(99999,Number(p.reviews)||0)),rating:Math.max(0,Math.min(5,Number(p.rating)||0)),image:safeImage(p.image),stock:Number.isInteger(Number(p.stock))?Math.max(0,Math.min(999999,Number(p.stock))):99,active:p.active!==false,featured:p.featured!==false,shopifyVariantId:/^[0-9]{6,20}$/.test(String(p.shopifyVariantId||''))?String(p.shopifyVariantId):''};};
async function loadCatalog(){try{const response=await fetch('products.json',{cache:'no-store'});if(!response.ok)throw Error('Catálogo no encontrado');const items=await response.json();if(!Array.isArray(items))throw Error('Formato inválido');const ids=new Set();PRODUCTS=items.map(safeProduct).filter(p=>{if(!p||ids.has(p.id))return false;ids.add(p.id);return true;});lookup=Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));cart=Object.fromEntries(Object.entries(cart).filter(([id,q])=>lookup[id]?.active&&lookup[id].stock>0).map(([id,q])=>[id,Math.min(q,lookup[id].stock)]));favorites=new Set([...favorites].filter(id=>lookup[id]));persist();renderProducts();renderCart();}catch(error){console.warn('ALANTIS SPORT: usando catálogo de reserva',error.message);}}
const safeGet = (key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return value===null?fallback:value;}catch{return fallback;}};
const safeSet = (key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Guardado opcional */}};
const initialCart=safeGet('alantis-demo-cart',{});
let cart=Object.fromEntries(Object.entries(initialCart).filter(([id,n])=>!!lookup[id] && Number.isSafeInteger(n) && n>0 && n<100));
const initialWish=safeGet('alantis-demo-favs',[]);
let favorites=new Set(Array.isArray(initialWish)?initialWish.filter(id=>!!lookup[id]):[]);
let filter='Todos',search='',sort='featured',activeCoupon=null,toastTimeout=null,previousFocus=null,modalOpen=false,drawerOpen=false;
let STORE_CONFIG={offersBanner:{active:true,eyebrow:'SOLO EN ALANTIS SPORT',title:'OFERTAS ESPECIALES',subtitle:'LAS MEJORES COLECCIONES, AL MEJOR ESTILO',buttonText:'EXPLORAR PRODUCTOS'},shipping:{freeFrom:60,flatRate:4.95},coupons:[],commerce:{provider:'shopify',shopDomain:'psm7b6-qs.myshopify.com',checkoutEnabled:false}};
function normalizeCommerce(raw){
 const domain=String(raw?.shopDomain||'').trim().toLowerCase();
 return {provider:'shopify',shopDomain:/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)?domain:'',checkoutEnabled:raw?.checkoutEnabled===true};
}
function getShopifyCartLink(){
 const commerce=STORE_CONFIG.commerce||{};
 if(!commerce.checkoutEnabled||!commerce.shopDomain)return {url:'',reason:'La tienda todavía no tiene habilitada la compra real en Shopify.'};
 const lines=Object.entries(cart).filter(([id,qty])=>lookup[id]?.active&&qty>0);
 if(!lines.length)return {url:'',reason:'El carrito está vacío.'};
 const missing=lines.filter(([id])=>!lookup[id].shopifyVariantId).map(([id])=>lookup[id].name);
 if(missing.length)return {url:'',reason:'Estos productos todavía no están vinculados a Shopify: '+missing.join(', ')+'.'};
 const grouped=new Map();
 for(const [id,qty] of lines){const variant=lookup[id].shopifyVariantId;grouped.set(variant,(grouped.get(variant)||0)+qty);}
 return {url:'https://'+commerce.shopDomain+'/cart/'+[...grouped].map(([id,qty])=>id+':'+qty).join(','),reason:''};
}
async function loadStoreConfig(){try{const r=await fetch('store-config.json',{cache:'no-store'});if(!r.ok)throw Error('Sin configuración publicada');const data=await r.json();if(data&&typeof data==='object'&&Array.isArray(data.coupons)){
STORE_CONFIG={...STORE_CONFIG,offersBanner:{...STORE_CONFIG.offersBanner,...data.offersBanner},shipping:{...STORE_CONFIG.shipping,...data.shipping},coupons:data.coupons,commerce:normalizeCommerce(data.commerce)};
const b=STORE_CONFIG.offersBanner,section=byId('ofertas');section.hidden=b.active===false;
section.querySelector('.eyebrow').textContent=String(b.eyebrow||'OFERTAS');byId('offers-title').textContent=String(b.title||'OFERTAS ESPECIALES');
section.querySelector('.offers-content>p:not(.eyebrow)').textContent=String(b.subtitle||'');byId('offers-button').firstChild.textContent=String(b.buttonText||'VER PRODUCTOS')+' ';
renderCart();}}catch(e){console.info('Usando configuración de reserva:',e.message);}}
function todayLocal(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function validCoupon(code,subtotal){const coupon=STORE_CONFIG.coupons.find(c=>c.code===code&&c.active);if(!coupon)return {coupon:null,message:'Cupón no válido o desactivado.'};const today=todayLocal();if(coupon.start&&today<coupon.start)return {coupon:null,message:'Este cupón aún no está activo.'};if(coupon.end&&today>coupon.end)return {coupon:null,message:'Este cupón ha caducado.'};if(subtotal<Number(coupon.minOrder||0))return {coupon:null,message:'Compra mínima: '+EUR.format(coupon.minOrder||0)};return {coupon,message:'Cupón aplicado a la cesta de demostración.'};}

function renderProducts(){
  let result=PRODUCTS.filter(p=> p.active && (filter==='Todos'||p.category===filter) && (`${p.name} ${p.category}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))));
  if(sort==='featured')result=result.sort((a,b)=>Number(b.featured)-Number(a.featured));
  if(sort==='asc')result=result.sort((a,b)=>a.price-b.price);
  if(sort==='desc')result=result.sort((a,b)=>b.price-a.price);
  if(sort==='name')result=result.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const grid=byId('product-grid');
  grid.innerHTML=result.map((p)=>{const soldOut=p.stock===0;return `<article class="product-card">
    <div class="product-image-wrap"><img class="product-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" width="450" height="456"/>${soldOut?'<span class="stock-pill">AGOTADO</span>':p.oldPrice>p.price?`<span class="sale-pill">−${Math.round(100*(1-p.price/p.oldPrice))}%</span>`:''}</div>
    <button type="button" class="heart-btn ${favorites.has(p.id)?'active':''}" data-favorite="${escapeHtml(p.id)}" aria-label="${favorites.has(p.id)?'Quitar de':'Añadir a'} favoritos: ${escapeHtml(p.name)}" aria-pressed="${favorites.has(p.id)}"><svg class="icon"><use href="#i-heart"/></svg></button>
    <div class="product-info"><div class="product-category">${escapeHtml(p.category)}</div><h3 class="product-name">${escapeHtml(p.name)}</h3><div class="rating" aria-label="Valoración ilustrativa: ${p.rating} de 5"><span class="rating-stars" aria-hidden="true">★★★★★</span><span>(${p.reviews})</span></div><div class="product-price">${EUR.format(p.price)}${p.oldPrice?` <del>${EUR.format(p.oldPrice)}</del>`:''}</div><button type="button" data-add="${escapeHtml(p.id)}" class="btn btn-gold buy-btn" ${soldOut?'disabled':''}><svg class="icon"><use href="#i-cart"/></svg>${soldOut?'SIN EXISTENCIAS':'AÑADIR AL CARRITO'}</button></div>
  </article>`;}).join('');
  byId('no-results').hidden=result.length>0;
  byId('results-indicator').textContent=(search||filter!=='Todos')?`${result.length} producto${result.length===1?'':'s'} encontrado${result.length===1?'':'s'}${search?` para «${search}»`:''}`:'';
  document.querySelectorAll('[data-filter]').forEach(el=>{const active=el.dataset.filter===filter;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active))});
}
function persist(){safeSet('alantis-demo-cart',cart);safeSet('alantis-demo-favs',[...favorites]);}
function showToast(msg){const el=byId('toast');el.textContent=msg;el.classList.add('is-shown');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('is-shown'),3000);}
function changeFilter(next){filter=next;search='';byId('site-search').value='';renderProducts();closeMobileMenu();}
function changeQuantity(id,delta){const current=cart[id]||0;const next=Math.max(0,Math.min(99,lookup[id]?.stock??99,current+delta));if(next)cart[id]=next;else delete cart[id];persist();renderCart();}
function addToCart(id){if(!lookup[id]?.active||lookup[id].stock<1){showToast('Producto agotado');return;}if((cart[id]||0)>=lookup[id].stock){showToast('Has alcanzado el stock disponible');return;}changeQuantity(id,1);showToast(`${lookup[id].name} añadido al carrito`);}
function renderCart(){
  const items=Object.entries(cart).filter(([id,q])=>lookup[id]&&q>0);
  const units=items.reduce((sum,[,q])=>sum+q,0);
  byId('cart-count').textContent=units;byId('cart-title-count').textContent=`(${units})`;
  byId('cart-items').innerHTML=items.length?items.map(([id,q])=>{const p=lookup[id];return `<div class="cart-line"><img src="${escapeHtml(p.image)}" alt=""/><div><strong>${escapeHtml(p.name)}</strong><small>${EUR.format(p.price)}</small><div class="quantity-control"><button type="button" data-qty="${id}" data-delta="-1" aria-label="Reducir cantidad de ${escapeHtml(p.name)}">−</button><span>${q}</span><button type="button" data-qty="${id}" data-delta="1" aria-label="Aumentar cantidad de ${escapeHtml(p.name)}">+</button></div></div><button class="remove-line" type="button" data-remove="${id}">Quitar</button></div>`;}).join(''):`<div class="empty-cart"><svg class="icon"><use href="#i-cart"/></svg><h3>¡TU CARRITO TE ESPERA!</h3><p>Añade tus productos favoritos<br/>y empieza a superarte.</p></div>`;
  const subtotal=items.reduce((sum,[id,q])=>sum+lookup[id].price*q,0);
  const result=activeCoupon?validCoupon(activeCoupon,subtotal):{coupon:null};
  const coupon=result.coupon;
  const discount=coupon?(coupon.type==='fixed'?Math.min(subtotal,Number(coupon.value)):Math.round(subtotal*Number(coupon.value))/100):0;
  const threshold=Number(STORE_CONFIG.shipping.freeFrom),flat=Number(STORE_CONFIG.shipping.flatRate);
  const shipping=items.length?(subtotal-discount>=threshold?0:flat):0;
  byId('cart-subtotal').textContent=EUR.format(subtotal);
  byId('discount-row').hidden=!coupon||!items.length;
  byId('cart-discount').textContent=`−${EUR.format(discount)}`;
  byId('cart-shipping').textContent=items.length&&shipping===0?'GRATIS*':EUR.format(shipping);
  byId('cart-total').textContent=EUR.format(subtotal-discount+shipping);
  const commerce=STORE_CONFIG.commerce||{};
 const checkout=byId('checkout-btn');
 checkout.disabled=!items.length;
 checkout.firstChild.textContent=commerce.checkoutEnabled?'CONTINUAR A SHOPIFY ':'FINALIZAR PEDIDO (DEMO) ';
 const info=byId('checkout-info');
 info.textContent=commerce.checkoutEnabled?'Pago, impuestos, stock y envío se verifican en Shopify. Los precios y cupones de esta web son orientativos; solo los descuentos creados en Shopify se aplican al pago.':'Escaparate en modo demo: todavía no se aceptan pagos ni pedidos reales.';
}
function showOverlay(){const el=byId('screen-overlay');el.hidden=false;requestAnimationFrame(()=>el.classList.add('is-visible'));document.body.classList.add('locked');}
function hideOverlay(){const el=byId('screen-overlay');el.classList.remove('is-visible');el.hidden=true;document.body.classList.remove('locked');}
function openCart(){if(modalOpen)closeModal();drawerOpen=true;previousFocus=document.activeElement;closeMobileMenu();showOverlay();const d=byId('cart-drawer');d.classList.add('is-open');d.setAttribute('aria-hidden','false');d.focus();}
function closeCart(){if(!drawerOpen)return;drawerOpen=false;const d=byId('cart-drawer');d.classList.remove('is-open');d.setAttribute('aria-hidden','true');hideOverlay();previousFocus?.focus?.();}
function openModal(title,description){if(drawerOpen)closeCart();previousFocus=document.activeElement;modalOpen=true;byId('modal-title').textContent=title;byId('modal-description').textContent=description;showOverlay();const m=byId('info-modal');m.classList.add('is-open');m.setAttribute('aria-hidden','false');m.focus();}
function closeModal(){if(!modalOpen)return;modalOpen=false;const m=byId('info-modal');m.classList.remove('is-open');m.setAttribute('aria-hidden','true');hideOverlay();previousFocus?.focus?.();}
function closeMobileMenu(){byId('main-nav').classList.remove('is-open');byId('menu-toggle').setAttribute('aria-expanded','false');}

const INFO={
  nosotros:['SOBRE ALANTIS SPORT','ALANTIS SPORT es una propuesta de tienda de ropa, equipamiento y nutrición deportiva. Esta es una demo visual que podrás personalizar con tu historia, equipo y productos reales.'],
  envios:['ENVÍOS Y DEVOLUCIONES','Antes de poner la tienda en marcha se deberán indicar transportistas, zonas de envío, plazos, tarifas y una política de devoluciones adaptada a la legislación aplicable.'],
  tallas:['GUÍA DE TALLAS','La guía de tallas se añadirá cuando estén definidos los productos y los fabricantes. Consulta medidas en centímetros y características de cada modelo antes de publicar.'],
  preguntas:['PREGUNTAS FRECUENTES','Cuando conectes los pedidos y los pagos, aquí podrás resolver dudas de envíos, devoluciones, seguimiento de pedidos y suplementos.'],
  legal:['TÉRMINOS Y CONDICIONES','Esta página es un prototipo. Antes de vender deben incorporarse las condiciones de contratación, información del titular de la tienda y demás textos legales revisados para España/UE.'],
  privacidad:['POLÍTICA DE PRIVACIDAD','Esta es una demo sin servidor ni recogida real de correos. Debes configurar tu política de privacidad, consentimiento y tratamiento de datos antes de activar formularios, analítica o pagos.'],
  contacto:['CONTACTO','Añade aquí tu correo comercial auténtico, redes, domicilio profesional y/o formulario de contacto cuando tengas los datos definitivos.'],
  redes:['REDES SOCIALES','Estos iconos aún son demostrativos. Podrás enlazarlos con tus perfiles oficiales de Instagram, TikTok y YouTube.'],
};

document.addEventListener('click',(event)=>{
  const fav=event.target.closest('[data-favorite]');if(fav){const id=fav.dataset.favorite;if(favorites.has(id)){favorites.delete(id);showToast('Eliminado de favoritos');}else{favorites.add(id);showToast('Añadido a favoritos');}persist();renderProducts();return;}
  const add=event.target.closest('[data-add]');if(add){addToCart(add.dataset.add);return;}
  const qty=event.target.closest('[data-qty]');if(qty){changeQuantity(qty.dataset.qty,Number(qty.dataset.delta));return;}
  const remove=event.target.closest('[data-remove]');if(remove){delete cart[remove.dataset.remove];persist();renderCart();return;}
  const chip=event.target.closest('[data-filter]');if(chip){changeFilter(chip.dataset.filter);return;}
  const info=event.target.closest('[data-info]');if(info){const [title,desc]=INFO[info.dataset.info];openModal(title,desc);return;}
  const category=event.target.closest('[data-category]');if(category){changeFilter(category.dataset.category);return;}
  if(event.target.closest('#all-products-link')||event.target.closest('#offers-button')){changeFilter('Todos');}
});
byId('search-form').addEventListener('submit',(e)=>{e.preventDefault();const field=byId('site-search');search=field.value.trim();filter='Todos';renderProducts();byId('tienda').scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('.search-form').classList.remove('is-expanded');field.blur();});
byId('sort-select').addEventListener('change',(e)=>{sort=e.target.value;renderProducts();});
byId('reset-filters').addEventListener('click',()=>changeFilter('Todos'));
byId('cart-open').addEventListener('click',openCart);
byId('cart-close').addEventListener('click',closeCart);
byId('continue-shopping').addEventListener('click',closeCart);
byId('screen-overlay').addEventListener('click',()=>{if(drawerOpen)closeCart();if(modalOpen)closeModal();});
byId('account-btn').addEventListener('click',()=>{const commerce=STORE_CONFIG.commerce;if(commerce?.checkoutEnabled&&commerce.shopDomain){window.location.assign('https://'+commerce.shopDomain+'/account');return;}openModal('MI CUENTA','Las cuentas de clientes estarán disponibles a través de Shopify cuando la tienda comercial esté activa.');});
byId('checkout-btn').addEventListener('click',()=>{
 const checkout=getShopifyCartLink();
 if(!checkout.url){openModal('PAGO NO DISPONIBLE',checkout.reason+' Configura los artículos reales desde el panel de administración y activa la compra solo cuando Shopify esté preparado.');return;}
 // No se envían precios locales, tokens ni datos personales: Shopify determina el importe real.
 window.location.assign(checkout.url);
});
byId('apply-promo').addEventListener('click',()=>{const code=byId('promo-code').value.trim().toUpperCase();const subtotal=Object.entries(cart).reduce((sum,[id,q])=>sum+(lookup[id]?.price||0)*q,0);const result=validCoupon(code,subtotal);activeCoupon=result.coupon?code:null;byId('promo-message').textContent=result.message;if(activeCoupon)showToast('Cupón aplicado (demostración)');renderCart();});
byId('newsletter-form').addEventListener('submit',(event)=>{event.preventDefault();openModal('SUSCRIPCIÓN EN PREPARACIÓN','El formulario tiene diseño y validación, pero todavía no almacena tu email ni envía mensajes. Para activar suscripciones reales, conecta Mailchimp, Shopify Email u otra herramienta autorizada.');});
byId('modal-close').addEventListener('click',closeModal);
byId('modal-ok').addEventListener('click',closeModal);
byId('menu-toggle').addEventListener('click',()=>{const nav=byId('main-nav'),open=nav.classList.toggle('is-open');byId('menu-toggle').setAttribute('aria-expanded',String(open));document.querySelector('.search-form').classList.remove('is-expanded');});
document.querySelector('.search-form>button').addEventListener('click',(event)=>{if(window.matchMedia('(max-width:760px)').matches&&!document.querySelector('.search-form').classList.contains('is-expanded')){event.preventDefault();document.querySelector('.search-form').classList.add('is-expanded');byId('site-search').focus();closeMobileMenu();}});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){if(drawerOpen)closeCart();if(modalOpen)closeModal();closeMobileMenu();document.querySelector('.search-form').classList.remove('is-expanded');}});
byId('current-year').textContent=String(new Date().getFullYear());
renderProducts();renderCart();
loadCatalog();
loadStoreConfig();