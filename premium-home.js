'use strict';
// Nuevas zonas editoriales: nunca se inventan ofertas ni reseñas.
(() => {
  const picks = document.getElementById('editor-picks');
  const deals = document.getElementById('real-deals');
  const quickCart = document.getElementById('mobile-cart-btn');
  quickCart?.addEventListener('click', () => document.getElementById('cart-open')?.click());
  const euro = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
  const allowedImage = value => {
    const image = String(value || '');
    return /^assets\/[a-z\d_./-]+\.(?:png|jpe?g|webp)$/i.test(image) && !image.includes('..') ? image : 'assets/shaker.webp';
  };
  const node = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = String(content);
    return el;
  };
  const img = item => {
    const el = document.createElement('img');
    el.src = allowedImage(item.image);
    el.alt = String(item.name || 'Artículo ALANTIS');
    el.loading = 'lazy';
    return el;
  };
  async function populate() {
    if (!picks || !deals) return;
    try {
      const result = await fetch('products.json', {cache:'no-store'});
      if (!result.ok) throw Error('Catálogo no publicado');
      const raw = await result.json();
      if (!Array.isArray(raw)) throw Error('Formato incorrecto');
      const list = raw.filter(p => p && p.active !== false && typeof p.name === 'string' && Number.isFinite(Number(p.price)) && Number(p.price)>=0);
      list.sort((a,b)=>Number(b.featured===true)-Number(a.featured===true));
      picks.replaceChildren();
      for (const product of list.slice(0,3)) {
        const card = node('article','pick-card');
        const photo = node('div','pick-image'); photo.append(img(product));
        const copy = node('div','pick-copy');
        copy.append(node('span','pick-category',product.category || 'ALANTIS SPORT'));
        copy.append(node('h3','',product.name));
        const price = node('span','pick-price',euro.format(Number(product.price)));
        const old = Number(product.oldPrice);
        if (Number.isFinite(old) && old>Number(product.price)) price.append(node('del','',euro.format(old)));
        copy.append(price);
        const btn = node('button','pick-add',Number(product.stock)===0?'AGOTADO':'AÑADIR A MI CARRITO ↗');
        btn.type='button';btn.dataset.add=String(product.id || '');btn.disabled=Number(product.stock)===0;
        copy.append(btn);card.append(photo,copy);picks.append(card);
      }
      if(!list.length) picks.append(node('p','premium-loading','Todavía no hay productos publicados.'));
      const discounted = list.filter(p=>Number.isFinite(Number(p.oldPrice)) && Number(p.oldPrice)>Number(p.price)).slice(0,3);
      if(discounted.length){
        deals.replaceChildren();
        for(const product of discounted){
          const card=node('article','deal-card');card.append(img(product));
          const copy=node('div','deal-copy');
          copy.append(node('small','',Math.round((1-Number(product.price)/Number(product.oldPrice))*100)+' % MENOS EN EL CATÁLOGO'));
          copy.append(node('strong','',product.name));
          const price=node('p','',euro.format(Number(product.price)));
          price.append(node('del','',euro.format(Number(product.oldPrice))));copy.append(price);
          const go=node('a','premium-text-link','VER EN TIENDA ↗');go.href='#tienda';
          go.dataset.category=String(product.category||'Todos');copy.append(go);card.append(copy);deals.append(card);
        }
      }
    } catch (error) {
      picks.replaceChildren(node('p','premium-loading','No se pudo cargar la selección ahora. Consulta el catálogo principal.'));
      // The pre-rendered "próximamente" promotions remain visible.
    }
  }
  populate();
})();