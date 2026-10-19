'use strict';

// Catálogo DEMO: edita esta lista para cambiar nombres, precios e imágenes.
const PRODUCTS = [
  {id:'camiseta',name:'Camiseta Performance ALANTIS',category:'Ropa deportiva',price:24.99,oldPrice:null,reviews:128,image:'assets/camiseta.webp',rating:5},
  {id:'zapatillas',name:'Zapatillas Running Pro',category:'Calzado',price:79.99,oldPrice:null,reviews:86,image:'assets/zapatillas.webp',rating:5},
  {id:'guantes',name:'Guantes de Entrenamiento',category:'Equipamiento',price:34.99,oldPrice:null,reviews:64,image:'assets/guantes.webp',rating:5},
  {id:'proteina',name:'Proteína Whey Isolada',category:'Vitaminas',price:49.99,oldPrice:null,reviews:203,image:'assets/proteina.webp',rating:5},
  {id:'creatina',name:'Creatina Monohidrato',category:'Vitaminas',price:29.99,oldPrice:null,reviews:118,image:'assets/creatina.webp',rating:5},
  {id:'shaker',name:'Shaker Premium 700 ml',category:'Accesorios',price:14.99,oldPrice:null,reviews:91,image:'assets/shaker.webp',rating:5},
];
const EUR = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const byId = (id)=> document.getElementById(id);
const lookup = Object.fromEntries(PRODUCTS.map(p=>[p.id,p]));
const safeGet = (key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return value===null?fallback:value;}catch{return fallback;}};
const safeSet = (key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Guardado opcional */}};
const initialCart=safeGet('alantis-demo-cart',{});
let cart=Object.fromEntries(Object.entries(initialCart).filter(([id,n])=>!!lookup[id] && Number.isSafeInteger(n) && n>0 && n<100));
const initialWish=safeGet('alantis-demo-favs',[]);
let favorites=new Set(Array.isArray(initialWish)?initialWish.filter(id=>!!lookup[id]):[]);
let filter='Todos',search='',sort='featured',discountActive=false,toastTimeout=null,previousFocus=null,modalOpen=false,drawerOpen=false;

function renderProducts(){
  let result=PRODUCTS.filter(p=> (filter==='Todos'||p.category===filter) && (`${p.name} ${p.category}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))));
  if(sort==='asc')result=result.sort((a,b)=>a.price-b.price);
  if(sort==='desc')result=result.sort((a,b)=>b.price-a.price);
  if(sort==='name')result=result.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const grid=byId('product-grid');
  grid.innerHTML=result.map((p)=>`<article class="product-card">
    <div class="product-image-wrap"><img class="product-image" src="${p.image}" alt="${p.name}" loading="lazy" width="450" height="456"/></div>
    <button type="button" class="heart-btn ${favorites.has(p.id)?'active':''}" data-favorite="${p.id}" aria-label="${favorites.has(p.id)?'Quitar de':'Añadir a'} favoritos: ${p.name}" aria-pressed="${favorites.has(p.id)}"><svg class="icon"><use href="#i-heart"/></svg></button>
    <div class="product-info"><div class="product-category">${p.category}</div><h3 class="product-name">${p.name}</h3><div class="rating" aria-label="Valoración ilustrativa: ${p.rating} de 5"><span class="rating-stars" aria-hidden="true">★★★★★</span><span>(${p.reviews})</span></div><div class="product-price">${EUR.format(p.price)}</div><button type="button" data-add="${p.id}" class="btn btn-gold buy-btn"><svg class="icon"><use href="#i-cart"/></svg>AÑADIR AL CARRITO</button></div>
  </article>`).join('');
  byId('no-results').hidden=result.length>0;
  byId('results-indicator').textContent=(search||filter!=='Todos')?`${result.length} producto${result.length===1?'':'s'} encontrado${result.length===1?'':'s'}${search?` para «${search}»`:''}`:'';
  document.querySelectorAll('[data-filter]').forEach(el=>{const active=el.dataset.filter===filter;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active))});
}
function persist(){safeSet('alantis-demo-cart',cart);safeSet('alantis-demo-favs',[...favorites]);}
function showToast(msg){const el=byId('toast');el.textContent=msg;el.classList.add('is-shown');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('is-shown'),3000);}
function changeFilter(next){filter=next;search='';byId('site-search').value='';renderProducts();closeMobileMenu();}
function changeQuantity(id,delta){const current=cart[id]||0;const next=Math.max(0,Math.min(99,current+delta));if(next)cart[id]=next;else delete cart[id];persist();renderCart();}
function addToCart(id){changeQuantity(id,1);showToast(`${lookup[id].name} añadido al carrito`);}
function renderCart(){
  const items=Object.entries(cart).filter(([id,q])=>lookup[id]&&q>0);
  const units=items.reduce((sum,[,q])=>sum+q,0);
  byId('cart-count').textContent=units;byId('cart-title-count').textContent=`(${units})`;
  byId('cart-items').innerHTML=items.length?items.map(([id,q])=>{const p=lookup[id];return `<div class="cart-line"><img src="${p.image}" alt=""/><div><strong>${p.name}</strong><small>${EUR.format(p.price)}</small><div class="quantity-control"><button type="button" data-qty="${id}" data-delta="-1" aria-label="Reducir cantidad de ${p.name}">−</button><span>${q}</span><button type="button" data-qty="${id}" data-delta="1" aria-label="Aumentar cantidad de ${p.name}">+</button></div></div><button class="remove-line" type="button" data-remove="${id}">Quitar</button></div>`;}).join(''):`<div class="empty-cart"><svg class="icon"><use href="#i-cart"/></svg><h3>¡TU CARRITO TE ESPERA!</h3><p>Añade tus productos favoritos<br/>y empieza a superarte.</p></div>`;
  const subtotal=items.reduce((sum,[id,q])=>sum+lookup[id].price*q,0);
  const discount=discountActive?Math.round(subtotal*10)/100:0;
  const shipping=items.length?(subtotal-discount>=60?0:4.95):0;
  byId('cart-subtotal').textContent=EUR.format(subtotal);
  byId('discount-row').hidden=!discountActive||!items.length;
  byId('cart-discount').textContent=`−${EUR.format(discount)}`;
  byId('cart-shipping').textContent=items.length&&shipping===0?'GRATIS*':EUR.format(shipping);
  byId('cart-total').textContent=EUR.format(subtotal-discount+shipping);
  byId('checkout-btn').disabled=!items.length;
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
byId('account-btn').addEventListener('click',()=>openModal('MI CUENTA','La creación de cuentas se activará cuando conectemos una plataforma de comercio electrónico (Shopify, WooCommerce o un sistema de pedidos).'));
byId('checkout-btn').addEventListener('click',()=>openModal('PAGO PENDIENTE DE ACTIVAR','Tu carrito funciona en modo demostración, pero todavía no procesa compras reales. Para recibir pedidos y pagos hay que vincular una plataforma ecommerce y configurar métodos de pago, impuestos, envíos y datos legales.'));
byId('apply-promo').addEventListener('click',()=>{const code=byId('promo-code').value.trim().toUpperCase();if(code==='ALANTIS10'){discountActive=true;byId('promo-message').textContent='10% aplicado a tu carrito de demostración.';showToast('Descuento demo del 10% aplicado');}else{discountActive=false;byId('promo-message').textContent='Código no válido. Prueba ALANTIS10 (demo).';}renderCart();});
byId('newsletter-form').addEventListener('submit',(event)=>{event.preventDefault();openModal('SUSCRIPCIÓN EN PREPARACIÓN','El formulario tiene diseño y validación, pero todavía no almacena tu email ni envía mensajes. Para activar suscripciones reales, conecta Mailchimp, Shopify Email u otra herramienta autorizada.');});
byId('modal-close').addEventListener('click',closeModal);
byId('modal-ok').addEventListener('click',closeModal);
byId('menu-toggle').addEventListener('click',()=>{const nav=byId('main-nav'),open=nav.classList.toggle('is-open');byId('menu-toggle').setAttribute('aria-expanded',String(open));document.querySelector('.search-form').classList.remove('is-expanded');});
document.querySelector('.search-form>button').addEventListener('click',(event)=>{if(window.matchMedia('(max-width:760px)').matches&&!document.querySelector('.search-form').classList.contains('is-expanded')){event.preventDefault();document.querySelector('.search-form').classList.add('is-expanded');byId('site-search').focus();closeMobileMenu();}});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){if(drawerOpen)closeCart();if(modalOpen)closeModal();closeMobileMenu();document.querySelector('.search-form').classList.remove('is-expanded');}});
byId('current-year').textContent=String(new Date().getFullYear());
renderProducts();renderCart();