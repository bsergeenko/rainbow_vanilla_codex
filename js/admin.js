import { state, labels, roles, esc, money, img, api, catalog, session, variants, priceText, sizeName, addressText, go, notice, field, textarea, customerFields, bindForm, heading, confirmAction } from './core.js';
import { ordersList, passwordForm, bindPassword } from './account.js';

export async function adminProducts(editId){
  await catalog();
  const main=document.querySelector('#main');
  if(editId){
    const p=state.products.find(p=>p.id===editId);if(!p){const e=new Error();e.status=404;throw e;}
    main.innerHTML=`${heading('Produkt bearbeiten',p.name,'Verwaltung / Produkte')}<form id="edit-product" class="form-grid panel narrow">${field('name','Produktname',p.name)}${textarea('description','Beschreibung',p.description,true)}${p.pricesBySize?p.sizes.map(s=>field('price-'+s,'Preis · '+sizeName(s)+' (€)',p.pricesBySize[s],{type:'number',min:'0',step:'0.01'})).join(''):field('price','Preis (€)',p.price,{type:'number',min:'0',step:'0.01'})}<div class="actions full"><button type="submit" class="button">Änderungen speichern</button><a href="/admin/produkte" class="button secondary">Abbrechen</a></div></form>`;
    bindForm('#edit-product',async(data)=>{const body={name:data.name,description:data.description};if(p.pricesBySize)body.pricesBySize=Object.fromEntries(p.sizes.map(s=>[s,Number(data['price-'+s])]));else body.price=Number(data.price);await api('/products/'+encodeURIComponent(p.id),{method:'PUT',body});go('/admin/produkte','Die Produktdaten wurden gespeichert.');});
  }else main.innerHTML=`${heading('Produkte','Produktinformationen und Preise verwalten.','Verwaltung')}<div class="admin-products">${state.products.map(p=>`<article class="admin-product panel">${img(variants(p)[0]?.p.imagesByColor[variants(p)[0]?.color]?.[0],p.name)}<div><span class="eyebrow">${labels[p.category]}${p.subcategory?' · '+labels[p.subcategory]:''}</span><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p>${p.pricesBySize?`<p>${p.sizes.map(s=>`${sizeName(s)}: ${money(p.pricesBySize[s])}`).join(' · ')}</p>`:`<p>${priceText(p)}</p>`}</div><a class="button secondary" href="/admin/produkte/${encodeURIComponent(p.id)}">Bearbeiten</a></article>`).join('')}</div>`;
}
export async function adminUsers(){
  const [users,orders]=await Promise.all([api('/users'),api('/orders')]);
  state.orders=orders;
  document.querySelector('#main').innerHTML=`${heading('Benutzer','Registrierte Benutzer und zugehörige Bestellungen.','Verwaltung')}${users.filter(u=>u.role==='user').length?users.filter(u=>u.role==='user').map(u=>`<section class="panel"><div class="section-intro"><div><h2>${esc(u.firstName)} ${esc(u.lastName)}</h2><p>${esc(u.email)}</p>${addressText(u.address)?`<p>${addressText(u.address)}</p>`:''}</div><span class="status">${roles[u.role]}</span></div><h3>Bestellungen</h3>${ordersList(orders.filter(o=>o.userId===u.id),true,true)}</section>`).join(''):'<p class="panel muted">Es sind keine normalen Benutzer registriert.</p>'}`;
}
export async function adminOrders(){state.orders=await api('/orders');document.querySelector('#main').innerHTML=`${heading('Bestellungen','Alle Bestellungen im Überblick.','Verwaltung')}<section class="panel">${ordersList(state.orders,true)}</section>`;}
export async function adminAdmins(editId,newAdmin=false,password=false){
  const admins=await api('/admins');
  admins.sort((a,b)=>(a.role==='main_admin'?-1:b.role==='main_admin'?1:new Date(a.createdAt||0)-new Date(b.createdAt||0)));
  const mainAdmin=state.user.role==='main_admin';
  const target=admins.find(a=>a.id===editId);
  const canEdit=target&&(mainAdmin||target.id===state.user.id);
  if(editId&&!canEdit){const e=new Error('Keine Berechtigung.');e.status=403;throw e;}
  if(newAdmin&&!mainAdmin){const e=new Error('Keine Berechtigung.');e.status=403;throw e;}
  document.querySelector('#main').innerHTML=`${heading('Administratoren','Administratorkonten und persönliche Daten.','Verwaltung')}${password?passwordForm():newAdmin||canEdit?`<form id="admin-form" class="panel form-grid narrow"><h2 class="full">${newAdmin?'Administrator anlegen':'Persönliche Daten bearbeiten'}</h2>${field('firstName','Vorname',target?.firstName)}${field('lastName','Nachname',target?.lastName)}${field('email','E-Mail-Adresse',target?.email,{type:'email'})}${newAdmin?field('password','Passwort','',{type:'password',autocomplete:'new-password'}):''}<div class="actions full"><button type="submit" class="button">${newAdmin?'Administrator anlegen':'Speichern'}</button><a class="button secondary" href="/admin/administratoren">Abbrechen</a></div></form>`:`${mainAdmin?'<a href="/admin/administratoren/neu" class="button back-link">Administrator anlegen +</a>':''}<div class="admin-list">${admins.map(a=>`<article class="panel admin-person"><div class="avatar">${esc(a.firstName?.[0]||'')}${esc(a.lastName?.[0]||'')}</div><div><span class="eyebrow">${roles[a.role]}${a.id===state.user.id?' · Dein Konto':''}</span><h2>${esc(a.firstName)} ${esc(a.lastName)}</h2><p>${esc(a.email)}</p></div><div class="actions">${mainAdmin||a.id===state.user.id?`<a class="button secondary" href="/admin/administratoren/${encodeURIComponent(a.id)}">Bearbeiten</a>`:''}${a.id===state.user.id?'<a class="text-link" href="/admin/administratoren?passwort=1">Passwort ändern</a>':''}${mainAdmin&&a.id!==state.user.id?`<button type="button" class="delete-link" data-delete-admin="${esc(a.id)}">Löschen</button>`:''}</div></article>`).join('')}</div>`}`;
  bindPassword();
  bindForm('#admin-form',async(data)=>{await api(newAdmin?'/admins':'/admins/'+encodeURIComponent(target.id),{method:newAdmin?'POST':'PUT',body:data});if(target?.id===state.user.id)await session();go('/admin/administratoren',newAdmin?'Der Administrator wurde angelegt.':'Die persönlichen Daten wurden gespeichert.');});
  document.querySelectorAll('[data-delete-admin]').forEach(b=>b.onclick=async()=>{if(!await confirmAction('Administrator löschen?','Soll dieses Administratorkonto endgültig gelöscht werden?'))return;try{await api('/admins/'+encodeURIComponent(b.dataset.deleteAdmin),{method:'DELETE'});await adminAdmins();notice('Der Administrator wurde gelöscht.');}catch(e){notice(e.message,true);}});
}
