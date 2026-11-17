import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Uses the locally installed Chrome and its DevTools protocol; no test dependencies.
// Catalog/assets and the guest cart use the real API. Account, checkout and admin
// mutations are intercepted so the provided backend data remains untouched.
const origin='http://localhost:5173';
const port=Number(process.env.TEST_DEBUG_PORT||9333);
const artifacts=resolve('tests/artifacts');
await mkdir(artifacts,{recursive:true});
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--no-sandbox','--no-proxy-server','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port='+port,'--user-data-dir='+resolve('tests/.chrome-profile'),
  '--lang=de-DE','--window-size=1440,1000','about:blank'
],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
let requests=0;
let passed=0;
let failed=false;
const errors=[];
const seen=[];
let user=null;
let mock=false;
let wishlist=[];
let cart=[];
let orders=[];
let contacts=[];
let admins=[{id:'main-test',firstName:'Haupt',lastName:'Admin',email:'main@example.test',role:'main_admin'}, {id:'admin-test',firstName:'Normal',lastName:'Admin',email:'admin@example.test',role:'admin'}];
const customer={id:'user-test',firstName:'Test',lastName:'Kundin',email:'test@example.test',role:'user',address:{street:'Teststraße 1',postalCode:'12345',city:'Berlin',country:'Deutschland'}};
const products=await fetch('http://localhost:3000/products').then(r=>r.json());
const designs=await fetch('http://localhost:3000/designs').then(r=>r.json());
const shipping=await fetch('http://localhost:3000/shipping-options').then(r=>r.json());
let lastOrderBody;
let lastRegisterBody;
let lastPasswordBody;
let failProducts=false;
const pending=new Map();
const listeners=new Map();
function send(method,params={}){const id=++requests;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timed out: '+method));},12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value;}
async function wait(expression,description=expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(75);}throw new Error('Timed out: '+description);}
async function check(expression,label){assert.equal(await evaluate(expression),true,label);passed++;console.log('✓ '+label);}
async function click(selector){await wait(`!!document.querySelector(${JSON.stringify(selector)})`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function fill(name,value){await evaluate(`(()=>{const el=document.querySelector('[name="${name}"]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function choose(name,value){await click(`input[name="${name}"][value="${value}"]`);}
async function submit(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);await delay(120);}
async function navigate(path,ready='!!document.querySelector("#main h1")'){await send('Page.navigate',{url:origin+path});await wait(ready);}
async function spa(path,ready){await evaluate(`import('/js/core.js').then(m=>m.go(${JSON.stringify(path)}))`);await wait(ready||'!!document.querySelector("#main h1")');}
async function screenshot(name,width=1440,height=1000){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await delay(200);const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(artifacts,name+'.png'),Buffer.from(data.data,'base64'));}
async function noOverflow(label){await check('document.documentElement.scrollWidth <= innerWidth',label);}

async function intercept(event){
  const {requestId,request}=event;
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(!mock||path.startsWith('/assets/')||method==='OPTIONS'){await send('Fetch.continueRequest',{requestId});return;}
  const body=request.postData?JSON.parse(request.postData):{};
  seen.push({path,method,body});
  let data={};let status=200;
  if(path==='/me'&&method==='GET'){data=user||{message:'Nicht eingeloggt.'};status=user?200:401;}
  else if(path==='/login'){if(body.password==='wrong'){status=401;data={message:'Falsch'};}else{user=body.email.startsWith('main')?structuredClone(admins[0]):body.email.startsWith('admin')?structuredClone(admins[1]):structuredClone(customer);data=user;}}
  else if(path==='/logout'){user=null;cart=[];}
  else if(path==='/register'){lastRegisterBody=body;if(body.email==='duplicate@example.test'){status=409;data={message:'Diese E-Mail-Adresse ist bereits registriert.'};}else data={id:'registered-test'};}
  else if(path==='/products'&&method==='GET'){if(failProducts){status=503;data={message:'Produkte derzeit nicht verfügbar.'};}else data=products;}
  else if(path.startsWith('/products/')){const p=products.find(p=>p.id===path.split('/')[2]);if(!p){status=404;data={message:'Produkt nicht gefunden.'};}else{if(method==='PUT')Object.assign(p,body);data=p;}}
  else if(path==='/designs')data=designs;
  else if(path==='/custom-colors')data=[...new Set(products.filter(p=>p.customizable).flatMap(p=>p.colors))];
  else if(path==='/shipping-options')data=shipping;
  else if(path==='/wishlist'&&method==='GET')data=wishlist.map(i=>({...i,product:products.find(p=>p.id===i.productId)}));
  else if(path==='/wishlist'&&method==='POST'){wishlist.push({itemId:'wish-'+Date.now(),...body});data={message:'Gespeichert'};}
  else if(path.startsWith('/wishlist/')&&method==='DELETE'){wishlist=wishlist.filter(i=>i.itemId!==path.split('/')[2]);}
  else if(path==='/cart'&&method==='GET')data=cart;
  else if(path==='/cart'&&method==='POST'){const existing=cart.find(i=>i.productId===body.productId&&i.color===body.color&&i.size===body.size&&(i.designId||null)===(body.designId||null)&&(i.pocketRequest||'')===(body.pocketRequest||''));if(existing)existing.quantity+=body.quantity;else cart.push({itemId:'cart-'+Date.now(),...body});data=cart.at(-1);}
  else if(path.startsWith('/cart/')&&method==='PUT'){const item=cart.find(i=>i.itemId===path.split('/')[2]);Object.assign(item,body);data=item;}
  else if(path.startsWith('/cart/')&&method==='DELETE'){cart=cart.filter(i=>i.itemId!==path.split('/')[2]);}
  else if(path==='/orders'&&method==='GET')data=user?.role==='user'?orders.filter(o=>o.userId===user.id):orders;
  else if(path==='/orders'&&method==='POST'){
    lastOrderBody=body;
    const items=body.items.map(i=>{const p=products.find(p=>p.id===i.productId);const unitPrice=p.pricesBySize?.[i.size]??p.price;return {...i,unitPrice,itemTotal:unitPrice*i.quantity};});
    const subtotal=items.reduce((s,i)=>s+i.itemTotal,0),shippingCost=shipping.find(s=>s.id===body.shippingMethod).price;
    data={id:'order-test-'+orders.length,userId:user?.id||null,...body,items,subtotal,shippingCost,total:subtotal+shippingCost,status:'new',createdAt:new Date().toISOString()};
    orders.push(data);cart=[];if(user&&body.saveAddress)user.address=Object.fromEntries(['street','postalCode','city','country'].map(k=>[k,body.customer[k]]));
  }
  else if(/^\/orders\/[^/]+\/cancel$/.test(path)){const order=orders.find(o=>o.id===path.split('/')[2]);order.status='cancelled';data=order;}
  else if(/^\/orders\/[^/]+\/status$/.test(path)){const order=orders.find(o=>o.id===path.split('/')[2]);order.status=body.status;data=order;}
  else if(path==='/me'&&method==='PUT'){Object.assign(user,body);user.address=Object.fromEntries(['street','postalCode','city','country'].map(k=>[k,body[k]||'']));data=user;}
  else if(path==='/me/password'){lastPasswordBody=body;if(body.currentPassword==='wrong'){status=400;data={message:'Das aktuelle Passwort ist falsch.'};}}
  else if(path==='/me'&&method==='DELETE'){user=null;cart=[];wishlist=[];}
  else if(path==='/contact'){contacts.push(body);data={message:'Gesendet'};}
  else if(path==='/users')data=[customer];
  else if(path==='/admins'&&method==='GET')data=admins;
  else if(path==='/admins'&&method==='POST'){admins.push({id:'admin-created',role:'admin',createdAt:new Date().toISOString(),...body});data=admins.at(-1);}
  else if(path.startsWith('/admins/')&&method==='PUT'){data=admins.find(a=>a.id===path.split('/')[2]);Object.assign(data,body);}
  else if(path.startsWith('/admins/')&&method==='DELETE'){admins=admins.filter(a=>a.id!==path.split('/')[2]);}
  else{status=500;data={message:'Unexpected test request: '+method+' '+path};errors.push(data.message);}
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json; charset=utf-8'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Credentials',value:'true'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
}

try{
  let tabs;
  for(let i=0;i<60;i++){try{tabs=await fetch('http://localhost:'+port+'/json').then(r=>r.json());break;}catch{await delay(100);}}
  assert(tabs,'Chrome could not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);if(msg.error)p.reject(new Error(JSON.stringify(msg.error)));else p.resolve(msg.result);}}else{if(msg.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(msg.params.exceptionDetails));if(msg.method==='Fetch.requestPaused')intercept(msg.params).catch(e=>errors.push(e.stack));}};
  console.log('Chrome connected:',(await send('Browser.getVersion')).product);
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3000/*'}]});
  await navigate('/','document.querySelectorAll(".category-tile").length===4');
  await check('document.documentElement.lang==="de"','German document');
  await check('document.querySelector("h1").textContent.includes("Rainbow Design bringt Farbe in Regentage")','Required home slogan');
  await check('document.querySelectorAll(".home-motifs a").length===4','Four actual home motifs');
  await screenshot('home-desktop');await noOverflow('Desktop layout has no overflow');
  await screenshot('home-mobile',390,844);await noOverflow('Mobile home has no overflow');
  await click('#menu-toggle');await check('!document.querySelector("#mobile-nav").hidden','Mobile menu opens');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await spa('/kategorie/women','document.querySelectorAll(".product-card").length===18');
  await check('document.querySelectorAll(".product-card").length===18','Every women product image variant shown');
  await click('#open-search');await evaluate('document.querySelector("#search-input").value="Blau";document.querySelector("#search-input").dispatchEvent(new Event("input"))');
  await check('[...document.querySelectorAll(".search-result span")].every(e=>/blau/i.test(e.textContent))','Search matches German colors and their variants');
  await evaluate('document.querySelector("#search-input").value="Frauen";document.querySelector("#search-input").dispatchEvent(new Event("input"))');
  await check('document.querySelectorAll(".search-result").length===18','Search recognizes category synonym Frauen');
  await evaluate('document.querySelector("#search-input").value="xyzunbekannt";document.querySelector("#search-input").dispatchEvent(new Event("input"))');
  await check('document.querySelector("#search-results").textContent.includes("Keine Produkte gefunden.")','Search empty state');await click('#close-search');
  await spa('/kategorie/kids','document.querySelectorAll(".product-card").length===10');
  await click('a[href="/kategorie/kids?filter=boys"]');await wait('document.querySelectorAll(".product-card").length===3');
  await check('[...document.querySelectorAll(".card-info>span")].every(e=>e.textContent.startsWith("ab"))','Children show minimum price');
  await spa('/produkt/kids-raincoat-boys?farbe=blue','!!document.querySelector("#product-form")');
  await check('document.querySelector("[name=color]:checked").value==="blue"','Product card color is preselected');
  await check('document.querySelectorAll("[name=color]").length===3','Only colors with images available on product');
  await submit('#product-form');await check('!!document.querySelector("#product-form .form-error")&&document.querySelector("[data-cart-count]").hidden','Missing size prevents adding to cart and shows form error');
  await choose('size','8-12');await check('document.querySelector("#detail-price").textContent.includes("32,00")','Children price follows size');
  await click('.thumbnail:nth-child(2)');await check('document.querySelector("#large-image img").src.includes("detail")','Thumbnail changes large image');
  await submit('#product-form');await wait('document.querySelector("[data-cart-count]").textContent==="1"');
  await spa('/warenkorb','!!document.querySelector(".cart-item")');
  await check('document.querySelector(".cart-item").textContent.includes("8–12 Jahre")','Real guest cart persists chosen size');
  await click('[data-step="1"]');await wait('document.querySelector("[data-cart-count]").textContent==="2"');
  await check('document.querySelector(".cart-item>strong").textContent.includes("64,00")','Real cart quantity and position price update');
  await click('[data-delete]');await wait('document.querySelector("#main").textContent.includes("Dein Warenkorb ist leer.")');
  await check('document.querySelector("[data-cart-count]").hidden','Empty cart count hidden');
  await spa('/kasse','document.querySelector("#main").textContent.includes("Dein Warenkorb ist leer.")');
  await spa('/design','document.querySelectorAll(".design-card").length===113');
  await click('[data-filter="kids"]');await check('document.querySelectorAll(".design-card").length===42','Full motif catalog filtered for children');
  await click('[data-design="kids-design-01"]');await choose('target','dogs');await choose('color','magenta');await choose('size','M');
  await check('document.querySelector("#coat-preview").textContent.includes("kann trotzdem in dieser Farbe bestellt werden")','Missing preview still permits every shared color');
  await check('document.querySelector("#config-summary").textContent.includes("Kinder")','Children motif remains selected for dog');
  await submit('#design-form');await wait('document.querySelector("[data-cart-count]").textContent==="1"');
  await spa('/warenkorb','!!document.querySelector(".cart-item")');
  await check('document.querySelector(".cart-item>img").src.includes("/designs/kids/")','Configured cart uses motif as missing coat image fallback');
  await click('[data-delete]');await wait('document.querySelector("#main").textContent.includes("Dein Warenkorb ist leer.")');
  await spa('/design','document.querySelectorAll(".design-card").length===113');
  await click('[data-design="adult-design-01"]');await check('!document.querySelector("[name=target]:checked")','New configurator entry resets target');
  await spa('/produkt/missing','document.title.includes("Seite nicht gefunden")');
  await check('document.querySelector(".page-heading").textContent.includes("404")','Missing product gets 404');
  await spa('/does-not-exist','document.title.includes("Seite nicht gefunden")');
  await spa('/kategorie/men','document.querySelectorAll(".product-card").length===2');await click('[data-favorite]');await wait('!!document.querySelector("#login-form")');
  await check('location.pathname==="/login"','Guest favorite opens login');
  console.log('\nSwitching account/admin mutations to isolated API fixtures.');mock=true;
  await fill('email','test@example.test');await fill('password','wrong');await submit('#login-form');
  await check('document.querySelector(".form-error").textContent==="E-Mail-Adresse oder Passwort ist falsch."','Invalid credentials show required message');
  await click('a[href="/registrieren"]');await wait('!!document.querySelector("#register-form")');
  await fill('firstName','Test');await fill('lastName','Kundin');await fill('email','test@example.test');await fill('password','password');await fill('passwordConfirm','different');await submit('#register-form');
  await check('document.querySelector("[name=passwordConfirm]").getAttribute("aria-invalid")==="true"','Registration password confirmation validated');
  await fill('passwordConfirm','password');await submit('#register-form');await wait('!!document.querySelector("#login-form")');
  assert(!('passwordConfirm'in lastRegisterBody),'Confirmation must not be sent');passed++;
  await check('document.querySelector("#notifications").textContent.includes("erfolgreich")','Registration opens login with success notice');
  await fill('email','test@example.test');await fill('password','password');await submit('#login-form');await wait('!!document.querySelector(".account-menu")');
  await check('document.querySelector(".panel").textContent.includes("Teststraße 1")','Account displays saved address');
  await check('!document.querySelector("#profile-form")','Account starts with readable data, no edit inputs');
  await click('a[href="/konto?bearbeiten=1"]');await wait('!!document.querySelector("#profile-form")');await fill('street','');await fill('postalCode','');await fill('city','');await fill('country','');await submit('#profile-form');await wait('!!document.querySelector(".account-menu")&&!document.querySelector("#profile-form")');
  await check('!document.querySelector(".panel").textContent.includes("Adresse")','Empty optional address not displayed as missing');
  await spa('/konto?passwort=1','!!document.querySelector("#password-form")');await fill('currentPassword','wrong');await fill('newPassword','newpassword');await fill('newPasswordConfirm','newpassword');await submit('#password-form');
  await check('document.querySelector(".form-error").textContent.includes("aktuelle Passwort ist falsch")','Wrong current password error');
  await fill('currentPassword','password');await submit('#password-form');await wait('document.querySelector("#notifications").textContent.includes("Passwort wurde geändert")');
  assert.deepEqual(Object.keys(lastPasswordBody).sort(),['currentPassword','newPassword']);passed++;
  await spa('/kategorie/men','document.querySelectorAll(".product-card").length===2');await click('[data-favorite]');await wait('document.querySelector("[data-favorite]").getAttribute("aria-pressed")==="true"');
  await spa('/wunschliste?von=konto','document.querySelectorAll(".product-card").length===1');
  await check(`!!document.querySelector('a[href="/konto"].back-link')`,'Wishlist links directly back to account');
  await click('[data-favorite]');await wait('document.querySelector("#main").textContent.includes("Deine Wunschliste ist leer.")');
  await spa('/design?motiv=adult-design-04','!!document.querySelector("#design-form")');await choose('target','kids');await choose('subcategory','girls');await choose('color','plum');await choose('size','4-7');await fill('pocketRequest','Blumen bitte');await submit('#design-form');await wait('document.querySelector("[data-cart-count]").textContent==="1"');
  await spa('/kasse','!!document.querySelector("#checkout-form")');
  await check('document.querySelector("[name=firstName]").value==="Test"','Checkout prefills customer');
  await fill('street','Neue Straße 2');await fill('postalCode','54321');await fill('city','Trier');await fill('country','Deutschland');await choose('shippingMethod','express');await click('[name="saveAddress"]');
  await fill('cardNumber','123');await fill('expiry','14/25');await fill('securityCode','1');await submit('#checkout-form');
  await check('document.querySelector("[name=cardNumber]").getAttribute("aria-invalid")==="true"','Card number format validated');
  await fill('cardNumber','4242424242424242');await fill('expiry','12/29');await fill('securityCode','123');await submit('#checkout-form');await wait('location.pathname==="/bestellbestaetigung"&&!!document.querySelector(".order-heading")');
  assert.equal(lastOrderBody.paymentMethod,'card');assert.equal(lastOrderBody.saveAddress,true);assert(!('cardNumber'in lastOrderBody));assert(!('expiry'in lastOrderBody));assert(!('securityCode'in lastOrderBody));passed++;
  await check('document.querySelector(".order-heading").textContent.includes("order-test-0")','Order confirmation uses backend order number');
  await check('document.querySelector(".cart-item").textContent.includes("Blumen bitte")','Order details retain full configuration');
  await check('document.querySelector("[data-cart-count]").hidden','Cart clears after successful order');
  await spa('/konto','!!document.querySelector(".order-row")');await check('document.querySelector(".panel").textContent.includes("Neue Straße 2")','Save address updates account');
  await click('.order-row .text-link');await wait('!!document.querySelector("#cancel-order")');await click('#cancel-order');await check('document.querySelector("#confirm-dialog").open','Cancellation requires confirmation');
  await click('#confirm-dialog button[value="confirm"]');await wait('!!document.querySelector(".refund-note")');
  await check('document.querySelector(".refund-note").textContent.includes("37,99")','Refund includes shipping and total amount');
  await check('!document.querySelector("#cancel-order")','Cancelled order cannot be cancelled again');
  await spa('/kontakt','!!document.querySelector("#contact-form")');await check('document.querySelector("[name=email]").value==="test@example.test"','Contact prefills user email');await fill('subject','Frage');await fill('message','Wie schön!');await submit('#contact-form');await wait('document.querySelector("#notifications").textContent.includes("Vielen Dank für deine Nachricht.")');
  await check('[...document.querySelectorAll("#contact-form input,#contact-form textarea")].every(i=>i.value==="")','Contact success clears every field');
  await spa('/konto','!!document.querySelector("#delete-account")');await click('#delete-account');await click('#confirm-dialog button[value="cancel"]');await check('location.pathname==="/konto"','Account deletion can be cancelled');
  await click('#delete-account');await click('#confirm-dialog button[value="confirm"]');await wait('location.pathname==="/"&&!!document.querySelector(".category-grid")');
  assert.equal(user,null,'Confirmed account deletion logs user out');passed++;console.log('✓ Confirmed account deletion logs user out');
  await spa('/login','!!document.querySelector("#login-form")');await fill('email','main@example.test');await fill('password','password');await submit('#login-form');await wait('!!document.querySelector(".admin-header")&&!!document.querySelector(".admin-product")');
  await check('!document.querySelector(".site-header,.site-footer")','Admin uses its own interface');
  await check(`document.querySelectorAll('.admin-product').length===${products.length}`,'Admin lists every product');
  await click('a[href="/admin/produkte/kids-raincoat-girls"]');await wait('!!document.querySelector("#edit-product")');await fill('price-4-7','29');await submit('#edit-product');await wait('!!document.querySelector(".admin-products")');
  await check('document.querySelector(".admin-products").textContent.includes("29,00")','Admin children price changes shown after save');
  await spa('/admin/benutzer','!!document.querySelector(".order-row")');await check('document.querySelector("#main").textContent.includes("Test Kundin")','Admin user list contains normal user and orders');
  await click('.order-row .text-link');await wait('!!document.querySelector(".order-heading")');await check('!!document.querySelector(".admin-header")&&!document.querySelector(".site-footer")','Admin order details retain admin context');
  await check('!document.querySelector("#status-form")','Admin cannot change cancelled order status');
  await check('document.querySelector("#main").textContent.includes("user-test")','Admin order shows assigned user');
  orders.push({...structuredClone(orders[0]),id:'order-active',status:'processing',createdAt:new Date().toISOString()});
  await spa('/admin/bestellungen/order-active','!!document.querySelector("#status-form")');await fill('status','shipped');await submit('#status-form');await wait('document.querySelector(".order-heading .status").textContent==="Versendet"');
  await spa('/admin/administratoren','document.querySelectorAll(".admin-person").length===2');
  await check('document.querySelector(".admin-person").textContent.includes("Hauptadministrator")','Main administrator appears first');
  await check('document.querySelectorAll("[data-delete-admin]").length===1','Main admin cannot delete own account');
  await click('a[href="/admin/administratoren/neu"]');await wait('!!document.querySelector("#admin-form")');await fill('firstName','Neu');await fill('lastName','Admin');await fill('email','neu@example.test');await fill('password','password');await submit('#admin-form');await wait('document.querySelectorAll(".admin-person").length===3');
  await click('[data-delete-admin="admin-created"]');await click('#confirm-dialog button[value="confirm"]');await wait('document.querySelectorAll(".admin-person").length===2');
  await screenshot('admin-mobile',390,844);await noOverflow('Admin mobile layout has no overflow');
  await click('[data-logout]');await wait('location.pathname==="/"&&!!document.querySelector(".category-grid")');
  await spa('/login','!!document.querySelector("#login-form")');await fill('email','admin@example.test');await fill('password','password');await submit('#login-form');await wait('!!document.querySelector(".admin-products")');
  await spa('/admin/administratoren','document.querySelectorAll(".admin-person").length===2');
  await check(`!document.querySelector('[data-delete-admin]')&&!document.querySelector('a[href="/admin/administratoren/neu"]')`,'Normal admin has no create or delete actions');
  await check('document.querySelectorAll(".admin-person .button").length===1','Normal admin can edit only own account');
  await click('[data-logout]');await wait('location.pathname==="/"&&!!document.querySelector(".category-grid")');
  user=null;cart=[{itemId:'guest-test',productId:'men-raincoat',color:'black',size:'S',quantity:2}];
  await spa('/warenkorb','!!document.querySelector(".cart-login")');await click('a[href="/login?zurueck=warenkorb"]');await wait('!!document.querySelector("#login-form")');await fill('email','test@example.test');await fill('password','password');await submit('#login-form');await wait('location.pathname==="/warenkorb"&&!!document.querySelector(".cart-item")');
  await check('document.querySelector("[data-cart-count]").textContent==="2"','Login from cart returns to retained cart');
  await spa('/design?motiv=adult-design-01','!!document.querySelector("#design-form")');await choose('target','women');await choose('color','blue');await choose('size','L');await screenshot('config-mobile',390,844);await noOverflow('Configurator mobile layout has no overflow');
  await spa('/kasse','!!document.querySelector("#checkout-form")');await screenshot('checkout-mobile',390,844);await noOverflow('Checkout mobile layout has no overflow');
  await screenshot('checkout-tablet',768,1024);await noOverflow('Checkout tablet layout has no overflow');
  await spa('/produkt/women-raincoat?farbe=red','!!document.querySelector("#product-form")');await screenshot('product-mobile',390,844);await noOverflow('Product mobile layout has no overflow');
  await spa('/konto','!!document.querySelector(".account-menu")');await screenshot('account-mobile',390,844);await noOverflow('Account mobile layout has no overflow');
  await click('[data-logout]');await wait('location.pathname==="/"&&!!document.querySelector(".category-grid")');
  cart=[{itemId:'guest-checkout',productId:'dog-raincoat',color:'red',size:'S',quantity:1}];
  await spa('/kasse','!!document.querySelector("#checkout-form")');
  await check('!document.querySelector("[name=saveAddress]")','Guest checkout does not offer saving address to account');
  for(const [k,v] of Object.entries({firstName:'Gast',lastName:'Bestellung',email:'gast@example.test',street:'Gaststraße 2',postalCode:'12345',city:'Berlin',country:'Deutschland',cardNumber:'4242424242424242',expiry:'01/30',securityCode:'123'}))await fill(k,v);
  const orderCount=orders.length;await submit('#checkout-form');
  assert.equal(orders.length,orderCount,'Missing shipping prevents order submission');passed++;console.log('✓ Missing shipping prevents order submission');
  await choose('shippingMethod','standard');await submit('#checkout-form');await wait('location.pathname==="/bestellbestaetigung"&&!!document.querySelector(".order-heading")');
  assert.equal(orders.at(-1).userId,null,'Guest order not associated with an account');passed++;console.log('✓ Guest order not associated with an account');
  await check('document.querySelector("#main").textContent.includes("Gaststraße 2")','Guest confirmation contains checkout delivery address');
  for(const path of ['/','/kategorie/women','/design','/kontakt','/registrieren']){
    await spa(path,path==='/'?'!!document.querySelector(".category-grid")':path==='/design'?'!!document.querySelector(".design-grid")':path==='/kontakt'?'!!document.querySelector("#contact-form")':path==='/registrieren'?'!!document.querySelector("#register-form")':'!!document.querySelector(".product-card")');
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});await noOverflow('320px layout: '+path);
  }
  await spa('/kontakt','!!document.querySelector("#contact-form")');
  await check('[...document.querySelectorAll("input,textarea,select")].every(i=>i.labels?.length>0)','Every visible form input has an associated label');
  await click('#open-search');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await check('!document.querySelector("#search-dialog").open','Search dialog closes using Escape');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await check('document.activeElement.matches("a,button,input")&&document.activeElement.matches(":focus-visible")','Keyboard navigation has a visible focus state');
  const assets=[...new Set(['/assets/logo.svg',...['women','men','kids','dogs'].map(c=>'/assets/home/'+c+'.jpg'),...products.flatMap(p=>Object.values(p.imagesByColor).flat()),...Object.values(designs).flat().map(d=>d.image)])];
  for(let i=0;i<assets.length;i+=16){const results=await Promise.all(assets.slice(i,i+16).map(async path=>{let status=(await fetch('http://localhost:3000'+path,{method:'HEAD'})).status;if(status===404){for(const ext of ['jpeg','png']){status=(await fetch('http://localhost:3000'+path.replace(/\.jpg$/,'.'+ext),{method:'HEAD'})).status;if(status===200)break;}}return{path,status};}));for(const r of results)assert.equal(r.status,200,'Asset accessible directly or via extension recovery: '+r.path);}
  passed++;console.log(`✓ All ${assets.length} provided images accessible, including extension recovery`);
  await spa('/design','!!document.querySelector(".design-grid")');
  for(const [id,extension] of [['adult-design-64','jpeg'],['kids-design-22','png'],['kids-design-26','png']]){
    await evaluate(`document.querySelector('[data-design="${id}"]').scrollIntoView()`);
    await wait(`document.querySelector('[data-design="${id}"] img')?.naturalWidth>0`);
    await check(`document.querySelector('[data-design="${id}"] img').src.endsWith('.${extension}')`,'Catalog image extension recovered: '+id);
  }
  failProducts=true;await navigate('/kategorie/women','!!document.querySelector("#retry")');await check('document.querySelector("#main").textContent.includes("Produkte derzeit nicht verfügbar")','API failure shows understandable error and retry');failProducts=false;await click('#retry');await wait('document.querySelectorAll(".product-card").length===18');
  await check('document.querySelector("#notifications").textContent===""','Notices do not remain after navigation');
  assert.deepEqual(errors,[],'No uncaught browser errors');passed++;
  console.log(`\n${passed} checks passed. Screenshots: tests/artifacts/`);
}catch(e){failed=true;console.error(e.stack);if(ws?.readyState===WebSocket.OPEN){console.error('Page:',await evaluate('({url:location.href,text:document.querySelector("#main")?.textContent?.slice(0,2500)})').catch(()=>null));await screenshot('failure').catch(()=>{});}console.error('Browser errors:',errors);}
finally{if(ws?.readyState===WebSocket.OPEN){await send('Browser.close').catch(()=>{});ws.close();}chrome.kill();await writeFile(resolve(artifacts,'results.json'),JSON.stringify({passed,failed,errors,interceptedRequests:seen.length},null,2));}
if(failed)process.exitCode=1;
