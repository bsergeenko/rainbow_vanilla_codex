import { state, labels, colorNames, esc, icon, img, priceText, productURL, variants, api, session, catalog, designs, refreshCart, refreshWishlist, isAdmin, updateCount, go, clearNotice, notice, heading, empty } from './core.js';
import { home, categoryPage, bindFavorites, productPage, designPage, cartPage, wishlistPage, checkoutPage, contactPage, bindContact } from './shop.js';
import { loginPage, bindLogin, registerPage, bindRegister, accountPage, orderPage, orderDetails, bindLogout } from './account.js';
import { adminProducts, adminUsers, adminOrders, adminAdmins } from './admin.js';

const navigation = [['/kategorie/women','Damen'],['/kategorie/men','Herren'],['/kategorie/kids','Kinder'],['/kategorie/dogs','Hunde'],['/design','Dein Design'],['/#ueber-uns','Über uns'],['/kontakt','Kontakt']];
const links = () => navigation.map(([href,label])=>`<a href="${href}" ${location.pathname===href?'aria-current="page"':''}>${label}</a>`).join('');
const logo = () => `<a class="brand" href="/" aria-label="Rainbow.design – Startseite">${img('/assets/logo.svg','Rainbow.design','',true)}</a>`;
function shell(admin=false){
  const app=document.querySelector('#app');
  app.className=admin?'admin-app':'';
  if(admin){
    app.innerHTML=`<header class="admin-header"><a class="admin-brand" href="/admin/produkte">Rainbow.design <span>Verwaltung</span></a><nav aria-label="Admin-Navigation">${[['produkte','Produkte'],['benutzer','Benutzer'],['bestellungen','Bestellungen'],['administratoren','Administratoren']].map(([v,l])=>`<a href="/admin/${v}" ${location.pathname.startsWith('/admin/'+v)?'aria-current="page"':''}>${l}</a>`).join('')}<button type="button" data-logout>Abmelden</button></nav></header><main id="main" class="page-content admin-content" tabindex="-1"><p class="loading" role="status">Daten werden geladen …</p></main>`;
    bindLogout();return;
  }
  app.innerHTML=`<div class="announcement">Einzigartige Regenmäntel. Mit Liebe handgefertigt.</div><header class="site-header">${logo()}<nav class="desktop-nav" aria-label="Hauptnavigation">${links()}</nav><div class="header-actions"><button class="icon-button" id="open-search" aria-label="Suche öffnen">${icon('search')}</button><a class="icon-button" href="${state.user?'/konto':'/login'}" aria-label="Benutzerkonto">${icon('user')}</a><a class="icon-button" href="/wunschliste" aria-label="Wunschliste">${icon('heart')}</a><a class="icon-button cart-link" href="/warenkorb" aria-label="Warenkorb">${icon('bag')}<span class="cart-count" data-cart-count hidden></span></a><button class="icon-button menu-toggle" id="menu-toggle" aria-label="Menü öffnen" aria-expanded="false" aria-controls="mobile-nav">${icon('menu')}</button></div><nav id="mobile-nav" class="mobile-nav" aria-label="Mobile Hauptnavigation" hidden>${links()}</nav></header><main id="main" class="page-content" tabindex="-1"><p class="loading" role="status">Daten werden geladen …</p></main><footer class="site-footer"><div class="footer-top"><div>${logo()}<p>Farbe für Regentage.<br>Persönlichkeit für jeden Tag.</p></div><div class="footer-links"><span class="eyebrow">Entdecken</span>${navigation.slice(0,4).map(([h,l])=>`<a href="${h}">${l}</a>`).join('')}</div><div class="footer-links"><span class="eyebrow">Rainbow.design</span>${navigation.slice(4).map(([h,l])=>`<a href="${h}">${l}</a>`).join('')}</div><div class="footer-links"><span class="eyebrow">Bleib bunt.</span><a href="https://www.instagram.com/rainbow.georgiandesign?stkn=dGE4M3drcmIxYndu" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.facebook.com/rainbow.georgiandesign" target="_blank" rel="noopener noreferrer">Facebook ↗</a></div></div><div class="footer-bottom"><span>© Rainbow.design</span><span>Ein bisschen Regen steht dir gut.</span><a href="#main" class="text-link">Nach oben ↑</a></div></footer><dialog id="search-dialog" aria-labelledby="search-title"><div class="search-header"><h2 id="search-title">Finde dein Lieblingsstück.</h2><button class="icon-button" id="close-search" aria-label="Suche schließen">${icon('close')}</button></div><label class="field search-field">Suche<div class="search-input-wrap">${icon('search')}<input id="search-input" type="search" placeholder="Zum Beispiel: Damen, Regenmantel, Blau" autocomplete="off"></div></label><div id="search-results" aria-live="polite"><p class="muted">Wonach suchst du?</p></div></dialog>`;
  updateCount();
  const toggle=document.querySelector('#menu-toggle'),mobile=document.querySelector('#mobile-nav');
  toggle.onclick=()=>{const opened=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',opened);toggle.setAttribute('aria-label',opened?'Menü schließen':'Menü öffnen');toggle.innerHTML=icon(opened?'close':'menu');mobile.hidden=!opened;};
  const dialog=document.querySelector('#search-dialog');
  document.querySelector('#open-search').onclick=()=>{dialog.showModal();document.querySelector('#search-input').focus();};
  document.querySelector('#close-search').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  document.querySelector('#search-input').oninput=search;
}
const normalize=s=>s.toLocaleLowerCase('de').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/ß/g,'ss');
function search(e){
  const q=normalize(e.target.value.trim());
  const synonyms={women:'damen frau frauen',men:'herren mann manner',kids:'kinder kind madchen jungen',dogs:'hunde hund'};
  const results=state.products.flatMap(variants).filter(({p,color})=>q.split(/\s+/).every(term=>normalize(`${p.name} ${synonyms[p.category]} ${colorNames[color]||color}`).includes(term)));
  document.querySelector('#search-results').innerHTML=!q?'<p class="muted">Wonach suchst du?</p>':!results.length?'<p>Keine Produkte gefunden.</p>':`<p class="small muted">${results.length} Ergebnisse</p><div class="search-results">${results.map(({p,color})=>`<a class="search-result" href="${productURL(p,color)}">${img(p.imagesByColor[color][0],p.name)}<div><strong>${esc(p.name)}</strong><span>${labels[p.category]} · ${colorNames[color]}</span></div><strong>${priceText(p)}</strong>${icon('arrow')}</a>`).join('')}</div>`;
}
let routeVersion=0;
let initial=true;
async function route(message){
  const version=++routeVersion;
  state.routeController?.abort();
  state.routeController=new AbortController();
  clearNotice();
  const url=new URL(location.href),path=url.pathname,parts=path.split('/').filter(Boolean);
  const adminRoute=parts[0]==='admin';
  if(isAdmin()&&!adminRoute){history.replaceState({},'','/admin/produkte');return route(message);}
  if(adminRoute&&!isAdmin()){go('/login');return;}
  const protectedPage=['konto','wunschliste','bestellungen'].includes(parts[0]);
  if(protectedPage&&!state.user){go('/login');return;}
  shell(adminRoute);
  const main=document.querySelector('#main');
  document.title='Rainbow.design – Farbe für Regentage';
  if(!initial)window.scrollTo({top:0,behavior:'instant'});initial=false;
  try{
    if(!state.products.length)await catalog();
    if(version!==routeVersion)return;
    if(path==='/'){
      if(!state.designs.length)await designs();
      main.classList.add('home-main'); main.innerHTML=home();
    }else if(parts[0]==='kategorie'&&parts.length===2&&['women','men','kids','dogs'].includes(parts[1])){
      document.title=labels[parts[1]]+' – Rainbow.design';main.innerHTML=categoryPage(parts[1],url.searchParams.get('filter')||'');
    }else if(parts[0]==='produkt'&&parts.length===2)await productPage(decodeURIComponent(parts[1]),url.searchParams.get('farbe'));
    else if(path==='/design'){if(!state.designs.length)await designs();await designPage(url.searchParams.get('motiv'));}
    else if(path==='/warenkorb'){if(!state.designs.length)await designs();await cartPage();}
    else if(path==='/wunschliste')main.innerHTML=await wishlistPage(url.searchParams.get('von')==='konto');
    else if(path==='/login'){main.innerHTML=loginPage(url.searchParams.get('zurueck'));bindLogin(url.searchParams.get('zurueck'));}
    else if(path==='/registrieren'){main.innerHTML=registerPage(url.searchParams.get('zurueck'));bindRegister(url.searchParams.get('zurueck'));}
    else if(path==='/konto')await accountPage(url.searchParams.has('bearbeiten'),url.searchParams.has('passwort'));
    else if(parts[0]==='bestellungen'&&parts.length===2){if(!state.designs.length)await designs();await orderPage(decodeURIComponent(parts[1]));}
    else if(path==='/kasse'){if(!state.designs.length)await designs();await checkoutPage();}
    else if(path==='/bestellbestaetigung'){
      const order=JSON.parse(sessionStorage.getItem('rainbow-last-order')||'null');
      if(!order){go('/');return;}
      if(!state.designs.length)await designs();state.shipping=await api('/shipping-options');main.innerHTML=orderDetails(order,false,true);
    }else if(path==='/kontakt'){main.innerHTML=contactPage();bindContact();}
    else if(path==='/admin'||path==='/admin/'){go('/admin/produkte');return;}
    else if(parts[0]==='admin'&&parts[1]==='produkte'&&parts.length<=3)await adminProducts(parts[2]);
    else if(path==='/admin/benutzer')await adminUsers();
    else if(path==='/admin/bestellungen')await adminOrders();
    else if(parts[0]==='admin'&&parts[1]==='bestellungen'&&parts.length===3){if(!state.designs.length)await designs();await orderPage(decodeURIComponent(parts[2]),true);}
    else if(parts[0]==='admin'&&parts[1]==='administratoren'&&parts.length<=3)await adminAdmins(parts[2]==='neu'?null:parts[2],parts[2]==='neu',url.searchParams.has('passwort'));
    else render404(main);
    if(version!==routeVersion)return;
    bindFavorites();
    if(location.hash){requestAnimationFrame(()=>document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());}
    else main.focus({preventScroll:true});
    if(message)notice(message);
  }catch(e){
    if(version!==routeVersion)return;
    if(e.status===404)render404(main);
    else if(e.status===401){state.user=null;go('/login','Bitte melde dich erneut an.');}
    else{main.innerHTML=`${heading('Das hat leider nicht geklappt.')}<div class="empty"><p>${esc(e.message||'Bitte versuche es erneut.')}</p><button type="button" class="button" id="retry">Erneut versuchen</button></div>`;document.querySelector('#retry').onclick=()=>route();}
  }
}
function render404(main){document.title='Seite nicht gefunden – Rainbow.design';main.innerHTML=`${heading('Hier regnet es ins Leere.','Diese Seite oder dieses Produkt wurde nicht gefunden.','404')}${empty('Zurück zu den bunten Seiten.','/','Zur Startseite')}`;}
document.addEventListener('click',e=>{
  const a=e.target.closest('a');if(!a||a.target==='_blank'||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
  const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;
  if(url.pathname===location.pathname&&url.search===location.search&&url.hash){const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth'});target.focus?.({preventScroll:true});}return;}
  e.preventDefault();document.querySelector('#search-dialog')?.close();go(url.pathname+url.search+url.hash);
});
window.addEventListener('popstate',()=>route());
window.addEventListener('navigate',e=>route(e.detail?.message));
document.addEventListener('change',e=>{if(e.target.matches('.choice input')){document.querySelectorAll(`input[name="${e.target.name}"]`).forEach(i=>i.closest('.choice')?.classList.toggle('selected',i.checked));}});
async function start(){
  try{await session();if(!isAdmin())await Promise.all([refreshCart(),refreshWishlist()]);await route();}
  catch(e){shell(false);document.querySelector('#main').innerHTML=`${heading('Rainbow.design')}<p class="form-error">${esc(e.message)}</p><button class="button" id="startup-retry">Erneut versuchen</button>`;document.querySelector('#startup-retry').onclick=start;}
}
start();
