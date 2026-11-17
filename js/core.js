export const API = 'http://localhost:3000';
export const state = { user: null, products: [], designs: [], colors: [], cart: [], wishlist: [], shipping: [], orders: [] };
export const labels = { women: 'Damen', men: 'Herren', kids: 'Kinder', dogs: 'Hunde', girls: 'Mädchen', boys: 'Jungen' };
export const colorNames = { black: 'Schwarz', red: 'Rot', blue: 'Blau', aquablue: 'Aquablau', turquoise: 'Türkis', pink: 'Rosa', yellow: 'Gelb', plum: 'Pflaume', green: 'Grün', grey: 'Grau', magenta: 'Magenta', beige: 'Beige', brown: 'Braun', orange: 'Orange', silver: 'Silber' };
export const colorHex = { black: '#242424', red: '#cc2638', blue: '#2354a4', aquablue: '#39b5df', turquoise: '#25a9a2', pink: '#ec9bb4', yellow: '#e9c84d', plum: '#713556', green: '#438166', grey: '#919391', magenta: '#bc2677', beige: '#d4c2a2', brown: '#79513a', orange: '#db773d', silver: '#c6cbd0' };
export const statuses = { new: 'Bestätigt', processing: 'In Bearbeitung', shipped: 'Versendet', delivered: 'Zugestellt', cancelled: 'Storniert' };
export const roles = { user: 'Benutzer', admin: 'Administrator', main_admin: 'Hauptadministrator' };
export const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
export const sizeName = s => ({ '2-3': '2–3 Jahre', '4-7': '4–7 Jahre', '8-12': '8–12 Jahre' }[s] || s);
export const asset = p => p?.startsWith('/assets/') ? API + p : '';
const resolvedImages = new Map();
export const img = (p, alt, cls = '', eager = false) => p ? `<img src="${esc(asset(resolvedImages.get(p) || p))}" data-source="${esc(p)}" alt="${esc(alt)}" class="${cls}" loading="${eager ? 'eager' : 'lazy'}">` : '';
// Some catalog entries use .jpg while the supplied file is .jpeg or .png.
// Resolve that mismatch without changing API records or any supplied asset.
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.dataset.source?.startsWith('/assets/')) return;
  const source = image.dataset.source;
  const extension = source.match(/\.(jpg|jpeg|png)$/i)?.[1]?.toLowerCase();
  const alternatives = ['jpg', 'jpeg', 'png'].filter(ext => ext !== extension);
  const attempt = Number(image.dataset.imageAttempt || 0);
  if (extension && attempt < alternatives.length) {
    image.dataset.imageAttempt = attempt + 1;
    image.src = asset(source.replace(/\.(jpg|jpeg|png)$/i, '.' + alternatives[attempt]));
  } else {
    const message = document.createElement('span');
    message.className = 'image-error'; message.textContent = 'Bild derzeit nicht verfügbar.';
    image.replaceWith(message);
  }
}, true);
document.addEventListener('load', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.dataset.source && image.dataset.imageAttempt) resolvedImages.set(image.dataset.source, new URL(image.src).pathname);
}, true);
export const isAdmin = () => ['admin', 'main_admin'].includes(state.user?.role);
export const unitPrice = (p, size) => p?.pricesBySize ? (p.pricesBySize[size] ?? Math.min(...Object.values(p.pricesBySize))) : p?.price || 0;
export const priceText = (p, size) => `${p.pricesBySize && !size ? 'ab ' : ''}${money(unitPrice(p, size))}`;
export const variants = p => Object.entries(p.imagesByColor || {}).filter(([, images]) => images?.length).map(([color]) => ({ p, color }));
export const productURL = (p, color) => `/produkt/${encodeURIComponent(p.id)}?farbe=${encodeURIComponent(color)}`;
export const findProduct = id => state.products.find(p => p.id === id);
export const findDesign = id => state.designs.find(d => d.id === id);
export const designName = d => d ? (d.name || `Motiv ${d.id.split('-').at(-1)} · ${d.group === 'kids' ? 'Kinder' : 'Erwachsene'}`) : 'Keine Angabe';
export const dateText = d => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
export const icon = (name, filled = false) => {
  const paths = { search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>', user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>', heart: '<path d="M20.5 5.5a5.2 5.2 0 0 0-7.4 0L12 6.7l-1.1-1.2a5.2 5.2 0 0 0-7.4 7.4L12 21l8.5-8.1a5.2 5.2 0 0 0 0-7.4Z"/>', bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', check: '<path d="m5 12 4 4L19 6"/>', rain: '<path d="M5 14a5 5 0 0 1 0-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8H5Zm2 3-1 3m6-3-1 3m6-3-1 3"/>', needle: '<path d="m5 20 6-10 7-7c3-2 5 0 3 3l-7 7-9 7Zm9-10 4-4"/>', star: '<path d="m12 2 2.6 6.5L22 9l-5.5 4.8 1.7 7.2-6.2-4-6.2 4 1.7-7.2L2 9l7.4-.5L12 2Z"/>' };
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};
let pendingRequests = 0;
function loading(delta) { pendingRequests += delta; const el = document.querySelector('#network-status'); if(el) el.hidden = pendingRequests === 0; }
export async function api(path, options = {}) {
  loading(1);
  try {
  let response;
  try { response = await fetch(API + path, { credentials: 'include', ...(!options.method && state.routeController ? { signal: state.routeController.signal } : {}), ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Die Verbindung konnte nicht hergestellt werden. Bitte versuche es erneut.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'Die Anfrage konnte nicht verarbeitet werden.'); error.status = response.status; throw error; }
  return data;
  } finally { loading(-1); }
}
export async function session() {
  try { state.user = await api('/me'); } catch (e) { if (e.status === 401 || e.status === 404) state.user = null; else throw e; }
}
export async function catalog() { state.products = await api('/products'); }
export async function designs() {
  const data = await api('/designs');
  state.designs = Object.entries(data).flatMap(([group, rows]) => rows.map(d => ({ ...d, group })));
}
export async function refreshCart() { state.cart = await api('/cart'); updateCount(); }
export async function refreshWishlist() { state.wishlist = state.user ? await api('/wishlist') : []; }
export function updateCount() { document.querySelectorAll('[data-cart-count]').forEach(el => { const n = state.cart.reduce((s, i) => s + i.quantity, 0); el.textContent = n || ''; el.hidden = !n; }); }
export function go(path, message) { history.pushState({}, '', path); window.dispatchEvent(new CustomEvent('navigate', { detail: { message } })); }
let noticeTimer;
export function clearNotice() { clearTimeout(noticeTimer); document.querySelector('#notifications').replaceChildren(); }
export function notice(message, error = false) {
  clearNotice();
  const el = document.querySelector('#notifications');
  el.innerHTML = `<div class="notice ${error ? 'error' : ''}" role="status"><span>${esc(message)}</span><button class="icon-button" aria-label="Hinweis schließen">${icon('close')}</button></div>`;
  el.querySelector('button').onclick = clearNotice;
  noticeTimer = setTimeout(clearNotice, 6500);
}
export async function confirmAction(title, text) {
  const dialog = document.querySelector('#confirm-dialog');
  dialog.querySelector('#confirm-title').textContent = title;
  dialog.querySelector('#confirm-text').textContent = text;
  dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
export function field(name, label, value = '', { type = 'text', required = true, ...attrs } = {}) {
  const attributes = Object.entries(attrs).map(([k,v]) => `${k}="${esc(v)}"`).join(' ');
  return `<label class="field"><span class="field-label">${label}${required ? ' <span aria-hidden="true">*</span>' : ''}</span><input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${attributes}><small class="field-error" aria-live="polite"></small></label>`;
}
export const textarea = (name, label, value = '', required = false) => `<label class="field full"><span class="field-label">${label}${required ? ' *' : ''}</span><textarea name="${name}" rows="4" ${required ? 'required' : ''}>${esc(value)}</textarea><small class="field-error" aria-live="polite"></small></label>`;
export function customerFields(user = {}, requiredAddress = false) {
  const a = user.address || user;
  return field('firstName', 'Vorname', user.firstName, { autocomplete: 'given-name' }) + field('lastName', 'Nachname', user.lastName, { autocomplete: 'family-name' }) + field('email', 'E-Mail-Adresse', user.email, { type: 'email', autocomplete: 'email' }) + field('street', 'Straße und Hausnummer', a.street, { required: requiredAddress, autocomplete: 'street-address' }) + field('postalCode', 'Postleitzahl', a.postalCode, { required: requiredAddress, autocomplete: 'postal-code' }) + field('city', 'Ort', a.city, { required: requiredAddress, autocomplete: 'address-level2' }) + field('country', 'Land', a.country, { required: requiredAddress, autocomplete: 'country-name' });
}
export function formError(form, text) {
  let el = form.querySelector('.form-error');
  if (!el) { el = document.createElement('p'); el.className = 'form-error full'; el.setAttribute('role', 'alert'); form.append(el); }
  el.textContent = text;
}
function validateField(input) {
  input.setCustomValidity('');
  if (input.required && !input.value.trim()) input.setCustomValidity('Bitte fülle dieses Feld aus.');
  else if (input.validity.valueMissing) input.setCustomValidity('Bitte wähle eine Option aus.');
  else if (input.type === 'email' && input.validity.typeMismatch) input.setCustomValidity('Bitte gib eine gültige E-Mail-Adresse ein.');
  else if (input.validity.patternMismatch) input.setCustomValidity(input.dataset.validation || 'Bitte überprüfe das Format.');
  else if (input.validity.rangeUnderflow) input.setCustomValidity(`Bitte gib einen Wert ab ${input.min} ein.`);
  else if (input.validity.rangeOverflow) input.setCustomValidity(`Bitte gib einen Wert bis ${input.max} ein.`);
  else if (input.validity.stepMismatch || input.validity.badInput) input.setCustomValidity('Bitte gib eine gültige Zahl ein.');
  if (input.name === 'passwordConfirm' || input.name === 'newPasswordConfirm') {
    const original = input.form.elements[input.name === 'passwordConfirm' ? 'password' : 'newPassword'];
    if (input.value !== original.value) input.setCustomValidity('Die Passwörter stimmen nicht überein.');
  }
  const error = input.closest('.field')?.querySelector('.field-error');
  if (error) error.textContent = input.validationMessage;
  input.setAttribute('aria-invalid', String(!input.validity.valid));
  return input.validity.valid;
}
export function bindForm(selector, handler) {
  const form = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!form) return;
  form.noValidate = true;
  form.addEventListener('focusout', e => { if (e.target.matches('input,textarea,select')) { e.target.dataset.touched = 'true'; validateField(e.target); } });
  form.addEventListener('input', e => { if (e.target.dataset.touched || form.dataset.submitted) validateField(e.target); });
  form.addEventListener('change', e => { if (e.target.type === 'radio' && form.dataset.submitted) form.querySelectorAll(`input[name="${e.target.name}"]`).forEach(validateField); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); form.dataset.submitted = 'true';
    const fields = [...form.querySelectorAll('input,textarea,select')];
    const validity = fields.map(validateField);
    if (validity.includes(false)) { formError(form, 'Bitte überprüfe die markierten Felder und wähle alle erforderlichen Optionen aus.'); fields[validity.indexOf(false)].focus(); return; }
    const button = form.querySelector('[type="submit"]');
    const previous = button?.innerHTML;
    if (button) { button.disabled = true; button.textContent = 'Wird gespeichert …'; }
    form.querySelector('.form-error')?.remove();
    try { await handler(Object.fromEntries([...new FormData(form)].map(([k,v]) => [k, typeof v === 'string' ? (k.toLowerCase().includes('password') ? v : v.trim()) : v])), form); }
    catch (err) { formError(form, err.message); }
    finally { if (button?.isConnected) { button.disabled = false; button.innerHTML = previous; } }
  });
}
export function addressText(a = {}) { return [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).map(esc).join('<br>'); }
export const empty = (text, link = '/design', caption = 'Dein Design entdecken') => `<div class="empty">${icon('rain')}<h2>${text}</h2><a class="button secondary" href="${link}">${caption}${icon('arrow')}</a></div>`;
export const heading = (title, sub = '', eyebrow = 'Rainbow.design') => `<header class="page-heading"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;
export function choice(name, values, selected = '', swatches = false) {
  return `<div class="choices ${swatches ? 'swatches' : ''}">${values.map(([value, label]) => `<label class="choice ${selected === value ? 'selected' : ''}"><input type="radio" name="${name}" value="${esc(value)}" ${selected === value ? 'checked' : ''} required>${swatches ? `<span class="swatch" style="--swatch:${colorHex[value] || '#ccc'}"></span>` : ''}<span>${esc(label)}</span></label>`).join('')}</div>`;
}
