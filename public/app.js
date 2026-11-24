const state = { products: [], categories: ['All'], activeCategory: 'All', sort: 'featured', user: null, cart: readCart(), query: '', modalMode: 'login', resumeCheckout: false, toastTimer: null, orderBusy: false };
const $ = selector => document.querySelector(selector);
const homeMarkup = $('#page-content').innerHTML;
const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
};
const money = amount => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
function readCart() { try { return JSON.parse(localStorage.getItem('sunday-cart') || '{}'); } catch { return {}; } }
function saveCart() { localStorage.setItem('sunday-cart', JSON.stringify(state.cart)); updateBagCount(); }
function countCart() { return Object.values(state.cart).reduce((sum, qty) => sum + Number(qty || 0), 0); }
function productById(id) { return state.catalog?.find(product => product.id === Number(id)) || state.products.find(product => product.id === Number(id)); }
function updateBagCount() { const count = countCart(); $('#bag-count').textContent = count; $('#drawer-count').textContent = count ? `(${count})` : ''; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('visible'), 2600); }

async function loadShop() {
  const params = new URLSearchParams();
  if (state.activeCategory !== 'All') params.set('category', state.activeCategory);
  if (state.query) params.set('q', state.query);
  try {
    const data = await api(`/api/products?${params}`);
    state.products = data.products; state.catalog = [...new Map([...(state.catalog || []), ...data.products].map(product => [product.id, product])).values()]; state.categories = data.categories;
    renderCategories(); renderProducts(); updateBagCount();
  } catch (error) { $('#product-grid').innerHTML = `<div class="empty-state">${escapeHtml(error.message)} <button data-action="retry">Try again</button></div>`; }
}

function renderCategories() {
  $('#category-filters').innerHTML = state.categories.map(category => `<button class="filter-chip ${category === state.activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
}
function renderProducts() {
  const grid = $('#product-grid');
  const products = [...state.products];
  if (state.sort === 'price-low') products.sort((a,b) => a.price-b.price);
  if (state.sort === 'price-high') products.sort((a,b) => b.price-a.price);
  if (state.sort === 'name') products.sort((a,b) => a.name.localeCompare(b.name));
  $('#result-count').textContent = `${products.length} ${products.length === 1 ? 'piece' : 'pieces'}`;
  if (!products.length) { grid.innerHTML = `<div class="empty-state">Nothing here just yet. Try another search or category.<button data-action="reset-filters">Clear filters</button></div>`; return; }
  grid.innerHTML = products.map((product, index) => `<article class="product-card" style="--card-index:${index}">
    <a class="product-photo" href="/product/${encodeURIComponent(product.slug)}" data-route aria-label="View ${escapeHtml(product.name)}"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy"/><span class="photo-index">0${index + 1}</span>${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}<span class="quick-add" data-add="${product.id}" role="button" tabindex="0" aria-label="Add ${escapeHtml(product.name)} to bag">+</span></a>
    <div class="product-info"><div><a class="product-name" href="/product/${encodeURIComponent(product.slug)}" data-route>${escapeHtml(product.name)}</a><span class="product-category">${escapeHtml(product.category)}</span></div><span class="product-price">${money(product.price)}</span></div>
  </article>`).join('');
}

async function routeTo(path, { push = true } = {}) {
  if (push) history.pushState({}, '', path);
  const match = path.match(/^\/product\/([^/]+)/);
  if (!match) { $('#page-content').classList.remove('detail-view'); $('#page-content').innerHTML = homeMarkup; await loadShop(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  try {
    const data = await api(`/api/products/${encodeURIComponent(decodeURIComponent(match[1]))}`);
    const product = data.product; $('#page-content').classList.add('detail-view');
    $('#page-content').innerHTML = `<div class="detail-back"><a href="/" data-route>← Back to the collection</a><span>OBJECTS / ${escapeHtml(product.category.toUpperCase())}</span></div><section class="product-detail"><div class="detail-image"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}"/><span class="detail-image-number">SUNDAY OBJECTS · NO. ${String(product.id).padStart(2,'0')}</span></div><div class="detail-copy"><div class="eyebrow"><span class="eyebrow-rule"></span> ${escapeHtml(product.category.toUpperCase())}</div><h1>${escapeHtml(product.name)}</h1><div class="detail-price">${money(product.price)}</div><p class="detail-description">${escapeHtml(product.description)}</p><div class="detail-rule"></div><div class="detail-material">${escapeHtml(product.details)}</div><div class="detail-stock"><i></i> In stock · Ships in 2–3 days</div><button class="primary-add" data-add="${product.id}">Add to bag <span>↗</span></button><div class="detail-small"><span>Complimentary shipping over ₹5,000</span><span>Easy returns within 14 days</span></div><div class="detail-accordion"><details open><summary>A little more</summary><p>${escapeHtml(product.description)} Each piece is selected for its honest materials and the way it settles into everyday life.</p></details><details><summary>Shipping & returns</summary><p>Carefully packed and dispatched in 2–3 business days. Returns are welcome within 14 days of delivery.</p></details></div><div class="detail-edition">A FEW GOOD THINGS. NOTHING MORE.</div></div></section><section class="related-products"><div class="section-intro"><div><div class="eyebrow"><span class="eyebrow-rule"></span> A FEW MORE GOOD THINGS</div><h2>Made to go<br/><em>with you.</em></h2></div><a class="text-link" href="/#shop" data-route>Shop the collection ↗</a></div><div class="product-grid" id="related-grid"></div></section>`;
    const related = (state.catalog || state.products).filter(item => item.id !== product.id).slice(0,4);
    $('#related-grid').innerHTML = related.map((item,index) => `<article class="product-card"><a class="product-photo" href="/product/${encodeURIComponent(item.slug)}" data-route><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy"/><span class="photo-index">0${index+1}</span><span class="quick-add" data-add="${item.id}" role="button" tabindex="0">+</span></a><div class="product-info"><div><a class="product-name" href="/product/${encodeURIComponent(item.slug)}" data-route>${escapeHtml(item.name)}</a><span class="product-category">${escapeHtml(item.category)}</span></div><span class="product-price">${money(item.price)}</span></div></article>`).join('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) { $('#page-content').innerHTML = `<div class="detail-missing"><div class="eyebrow"><span class="eyebrow-rule"></span> A LITTLE DETOUR</div><h1>We couldn't find<br/><em>that piece.</em></h1><a class="hero-link" href="/" data-route>Back to the collection ↗</a></div>`; }
}

function addToBag(id) {
  const product = productById(id);
  if (!product) return toast('This piece is not available right now.');
  const qty = Number(state.cart[id] || 0);
  if (qty >= Math.min(product.stock, 8)) return toast(`Only ${product.stock} available for ${product.name}.`);
  state.cart[id] = qty + 1; saveCart(); toast(`${product.name} added to your bag.`);
}
function openDrawer() { renderCart(); $('#drawer-scrim').hidden = false; $('#cart-drawer').classList.add('open'); $('#cart-drawer').setAttribute('aria-hidden','false'); document.body.classList.add('no-scroll'); }
function closeDrawer() { $('#cart-drawer').classList.remove('open'); $('#cart-drawer').setAttribute('aria-hidden','true'); $('#drawer-scrim').hidden = true; document.body.classList.remove('no-scroll'); }
function renderCart() {
  const items = Object.entries(state.cart).map(([id, quantity]) => ({ product: productById(id), id, quantity: Number(quantity) })).filter(item => item.product);
  const container = $('#cart-items');
  if (!items.length) { container.innerHTML = `<div class="empty-bag"><span class="empty-bag-icon">✳</span><h3>Your bag is taking<br/><em>a quiet moment.</em></h3><p>Find something that feels like you.</p><button data-action="shop-more">Explore the collection <span>↗</span></button></div>`; $('#shipping-progress').innerHTML = ''; $('#cart-footer').innerHTML = ''; updateBagCount(); return; }
  const subtotal = items.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const left = Math.max(0,5000-subtotal);
  $('#shipping-progress').innerHTML = `<div class="shipping-copy">${left ? `You’re ${money(left)} away from complimentary shipping` : 'Your delivery is on us ✳'}</div><div class="progress-track"><i style="width:${Math.min(100,subtotal/5000*100)}%"></i></div>`;
  container.innerHTML = items.map(({product,quantity,id}) => `<article class="cart-item"><a href="/product/${encodeURIComponent(product.slug)}" data-route class="cart-photo"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}"/></a><div class="cart-item-copy"><a href="/product/${encodeURIComponent(product.slug)}" data-route class="cart-item-name">${escapeHtml(product.name)}</a><span>${escapeHtml(product.category)}</span><strong>${money(product.price)}</strong><div class="quantity-stepper"><button data-qty="${id}" data-delta="-1" aria-label="Remove one ${escapeHtml(product.name)}">−</button><span>${quantity}</span><button data-qty="${id}" data-delta="1" aria-label="Add one ${escapeHtml(product.name)}">+</button><button class="remove-item" data-remove="${id}">Remove</button></div></div></article>`).join('');
  const shipping = subtotal >= 5000 ? 0 : 99;
  $('#cart-footer').innerHTML = `<div class="cart-total-row"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="cart-total-row shipping-row"><span>Shipping</span><span>${shipping ? money(shipping) : 'Complimentary'}</span></div><button class="checkout-button" data-action="checkout">Continue to checkout <span>↗</span></button><div class="cart-secure">✳ Secure checkout · Easy returns within 14 days</div>`;
  updateBagCount();
}

function openModal(content, className = '') { $('#modal-content').innerHTML = content; $('#modal').className = `modal ${className}`; $('#modal').hidden = false; $('#modal-scrim').hidden = false; document.body.classList.add('no-scroll'); $('#modal-content input, #modal-content button')?.focus?.(); }
function closeModal() { $('#modal').hidden = true; $('#modal-scrim').hidden = true; document.body.classList.remove('no-scroll'); state.resumeCheckout = false; }
function authModal(mode = 'login', resumeCheckout = false) {
  state.modalMode = mode; state.resumeCheckout = resumeCheckout;
  openModal(`<div class="auth-panel"><div class="auth-emblem">s<span>o</span></div><div class="eyebrow"><span class="eyebrow-rule"></span> A LITTLE SPACE FOR YOU</div><h2 id="modal-title">${mode === 'login' ? 'Welcome back.' : 'Come on in.'}</h2><p>${mode === 'login' ? 'Sign in to see your orders and pick up where you left off.' : 'Create an account to keep your Sunday favourites close.'}</p><form id="auth-form" data-mode="${mode}">${mode === 'register' ? `<label>Your name<input name="name" autocomplete="name" minlength="2" maxlength="70" required placeholder="The name we should use"/></label>` : ''}<label>Email address<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"/></label><label>Password<input type="password" name="password" autocomplete="${mode === 'login' ? 'current-password':'new-password'}" minlength="${mode === 'register' ? '10':'1'}" maxlength="128" required placeholder="${mode === 'register'?'At least 10 characters':'Your password'}"/></label><div class="form-error" id="auth-error" hidden></div><button class="primary-add auth-submit" type="submit">${mode === 'login' ? 'Sign in' : 'Create account'} <span>↗</span></button></form><div class="auth-switch">${mode === 'login' ? 'New here? <button data-switch-auth="register">Create an account</button>' : 'Already have an account? <button data-switch-auth="login">Sign in</button>'}</div><div class="auth-privacy">Your details stay private. We never share your information.</div></div>`, 'auth-modal');
}

function accountModal() {
  openModal(`<div class="account-panel"><div class="eyebrow"><span class="eyebrow-rule"></span> YOUR SUNDAY</div><h2 id="modal-title">Hello, ${escapeHtml(state.user.name.split(' ')[0])}.</h2><p>${escapeHtml(state.user.email)}</p><div id="account-orders" class="account-orders"><div class="loading-state">Bringing your orders together…</div></div><button class="sign-out-button" data-action="sign-out">Sign out <span>↗</span></button></div>`, 'auth-modal');
  api('/api/orders').then(({orders}) => {
    const el = $('#account-orders'); if (!el) return;
    el.innerHTML = orders.length ? `<h3>Recent orders</h3>${orders.map(order=>`<div class="account-order"><div><b>Order ${escapeHtml(order.id.slice(0,8).toUpperCase())}</b><span>${new Date(order.created_at+'Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} · ${order.items.reduce((s,i)=>s+i.quantity,0)} pieces</span></div><strong>${money(order.total_paise/100)}</strong></div>`).join('')}` : `<div class="no-orders"><span>✳</span><b>No orders yet.</b><small>Your next good thing is waiting.</small></div>`;
  }).catch(() => { const el=$('#account-orders'); if(el) el.innerHTML='<div class="no-orders"><span>✳</span><b>Orders will appear here.</b></div>'; });
}

function checkoutModal() {
  const entries = Object.entries(state.cart).map(([id,quantity])=>({product:productById(id),quantity:Number(quantity)})).filter(x=>x.product);
  if (!entries.length) return toast('Your bag is empty.');
  if (!state.user) { closeDrawer(); return authModal('login', true); }
  const subtotal = entries.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const shipping = subtotal >= 5000 ? 0 : 99;
  openModal(`<div class="checkout-panel"><div class="checkout-heading"><div><div class="eyebrow"><span class="eyebrow-rule"></span> THE LAST LITTLE STEP</div><h2 id="modal-title">Let’s get it<br/><em>to your door.</em></h2></div><div class="checkout-total"><span>ORDER TOTAL</span><b>${money(subtotal+shipping)}</b></div></div><form id="checkout-form"><div class="checkout-fields"><h3>Delivery details</h3><label>Full name<input name="name" autocomplete="name" required maxlength="80" value="${escapeHtml(state.user.name)}"/></label><label class="field-wide">Street address<input name="address" autocomplete="street-address" required minlength="6" maxlength="180" placeholder="House number and street"/></label><label>City<input name="city" autocomplete="address-level2" required maxlength="80"/></label><label>State / region<input name="region" autocomplete="address-level1" required maxlength="80"/></label><label>Postal code<input name="postalCode" autocomplete="postal-code" required minlength="4" maxlength="12"/></label></div><div class="checkout-summary"><div><span>${entries.reduce((s,i)=>s+i.quantity,0)} pieces</span><b>${money(subtotal)}</b></div><div><span>Shipping</span><b>${shipping ? money(shipping):'Complimentary'}</b></div><div class="checkout-summary-total"><span>Total</span><b>${money(subtotal+shipping)}</b></div></div><div class="payment-note"><span>✳</span><div><b>Pay on delivery</b><small>No payment is collected in this demo checkout.</small></div></div><div class="form-error" id="checkout-error" hidden></div><button class="primary-add place-order" type="submit">Place your order <span>↗</span></button><div class="checkout-foot">By placing your order, you agree to our simple returns policy.</div></form></div>`, 'checkout-modal');
}

async function restoreUser() { try { state.user = (await api('/api/auth/me')).user; } catch { state.user = null; } }

document.addEventListener('click', async event => {
  const route = event.target.closest('a[data-route]');
  if (route) { event.preventDefault(); const href = route.getAttribute('href') || '/'; if (href.startsWith('/#')) { history.pushState({},'',href); closeModal(); closeDrawer(); document.querySelector(href.slice(1))?.scrollIntoView({behavior:'smooth'}); return; } await routeTo(href); return; }
  const add = event.target.closest('[data-add]');
  if (add) { event.preventDefault(); event.stopPropagation(); addToBag(add.dataset.add); return; }
  const category = event.target.closest('[data-category]');
  if (category) { state.activeCategory=category.dataset.category; await loadShop(); document.querySelector('#shop')?.scrollIntoView({behavior:'smooth'}); return; }
  const navCategory = event.target.closest('[data-nav-category]');
  if (navCategory) { event.preventDefault(); state.activeCategory=navCategory.dataset.navCategory; await loadShop(); document.querySelector('#shop')?.scrollIntoView({behavior:'smooth'}); return; }
  const quantity = event.target.closest('[data-qty]');
  if (quantity) { const id=quantity.dataset.qty, next=Number(state.cart[id]||0)+Number(quantity.dataset.delta); const product=productById(id); if(next>0 && next<=Math.min(product?.stock||8,8)) state.cart[id]=next; else if(next===0) delete state.cart[id]; else toast('That is the available quantity for this piece.'); saveCart(); renderCart(); return; }
  const remove = event.target.closest('[data-remove]');
  if (remove) { delete state.cart[remove.dataset.remove]; saveCart(); renderCart(); toast('Removed from your bag.'); return; }
  const switchAuth = event.target.closest('[data-switch-auth]');
  if (switchAuth) { authModal(switchAuth.dataset.switchAuth,state.resumeCheckout); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  switch(button.dataset.action) {
    case 'bag': openDrawer(); break;
    case 'close-drawer': closeDrawer(); break;
    case 'shop-more': closeDrawer(); document.querySelector('#shop')?.scrollIntoView({behavior:'smooth'}); break;
    case 'close-modal': closeModal(); break;
    case 'search': $('#search-bar').hidden=!$('#search-bar').hidden; if(!$('#search-bar').hidden) $('#search-input').focus(); break;
    case 'close-search': $('#search-bar').hidden=true; $('#search-input').value=''; state.query=''; loadShop(); break;
    case 'account': if(state.user) accountModal(); else authModal('login'); break;
    case 'checkout': closeDrawer(); checkoutModal(); break;
    case 'sign-out': await api('/api/auth/logout',{method:'POST'}); state.user=null; closeModal(); toast('You’re signed out. See you soon.'); break;
    case 'reset-filters': state.activeCategory='All'; state.query=''; $('#search-input').value=''; await loadShop(); break;
    case 'retry': await loadShop(); break;
    case 'menu': document.querySelector('.main-nav').classList.toggle('mobile-open'); break;
  }
});

$('#sort-select').addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });

document.addEventListener('submit', async event => {
  if (event.target.id === 'newsletter-form') {
    event.preventDefault(); const email=$('#newsletter-email').value.trim(); const message=$('#newsletter-message');
    try { await api('/api/newsletter',{method:'POST',body:JSON.stringify({email})}); message.textContent='Thank you. We’ll write when we have something worth sharing.'; event.target.reset(); }
    catch (err) { message.textContent=err.message; }
    return;
  }
  if (event.target.id === 'auth-form') {
    event.preventDefault(); const form=event.target, mode=form.dataset.mode, data=Object.fromEntries(new FormData(form)); const error=$('#auth-error'); error.hidden=true;
    try {
      const result=await api(`/api/auth/${mode}`,{method:'POST',body:JSON.stringify(data)}); state.user=result.user; const resume=state.resumeCheckout; closeModal(); toast(mode==='register'?'Welcome to Sunday. Your account is ready.':'Welcome back.'); if(resume) checkoutModal();
    } catch (err) { error.textContent=err.message; error.hidden=false; }
    return;
  }
  if (event.target.id === 'checkout-form') {
    event.preventDefault(); if(state.orderBusy)return; state.orderBusy=true; const form=event.target; const error=$('#checkout-error'); error.hidden=true;
    const items=Object.entries(state.cart).map(([productId,quantity])=>({productId:Number(productId),quantity:Number(quantity)}));
    try {
      const result=await api('/api/orders',{method:'POST',body:JSON.stringify({items,shipping:Object.fromEntries(new FormData(form))})});
      state.cart={}; saveCart(); const order=result.order; openModal(`<div class="order-success"><div class="success-mark">✓</div><div class="eyebrow"><span class="eyebrow-rule"></span> A GOOD THING IS ON ITS WAY</div><h2 id="modal-title">Consider it<br/><em>taken care of.</em></h2><p>Thank you, ${escapeHtml(state.user.name.split(' ')[0])}. Your order is confirmed, and we’ll get it ready with care.</p><div class="order-number"><span>ORDER REFERENCE</span><b>${escapeHtml(order.id.slice(0,8).toUpperCase())}</b></div><div class="order-recap"><span>${order.itemCount} ${order.itemCount===1?'piece':'pieces'}</span><b>${money(order.total/100)}</b></div><button class="primary-add" data-action="close-modal">Back to Sunday <span>↗</span></button><div class="order-payment">Pay on delivery · No payment collected</div></div>`, 'success-modal');
    } catch (err) { error.textContent=err.message; error.hidden=false; }
    finally { state.orderBusy=false; }
    return;
  }
});

let searchTimer;
$('#search-input').addEventListener('input', event => { clearTimeout(searchTimer); state.query=event.target.value.trim(); searchTimer=setTimeout(loadShop,220); });
window.addEventListener('popstate', () => routeTo(location.pathname,{push:false}));
document.addEventListener('keydown', event => { if(event.key==='Escape'){closeDrawer();closeModal();$('#search-bar').hidden=true;} if(event.key==='Enter' && event.target.matches('[data-add]')) addToBag(event.target.dataset.add); });

async function init() {
  updateBagCount(); await restoreUser(); await loadShop();
  if(location.pathname.startsWith('/product/')) await routeTo(location.pathname,{push:false});
  const hash=location.hash; if(hash) setTimeout(()=>document.querySelector(hash)?.scrollIntoView(),180);
}
init();
