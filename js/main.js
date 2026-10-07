(()=>{
 document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/slideshow.css">');
 const page=location.pathname.split('/').pop()||'index.html',mark='<span class="logo-image"><img src="assets/images/axiom-logo-dark.png" alt="Axiom Church logo"></span>';
 // Grouped nav. TODO: #rally-point, #baptism and #serve get Planning Center URLs; #rooted destination is undecided.
 const NAV=[['group','I\'m New','nav-new',[['visit.html','Plan a visit'],['kids.html','Kids']]],['group','About','nav-about',[['about.html','Who we are'],['beliefs.html','What we believe']]],['link','Messages','messages.html'],['group','Next Steps','nav-next',[['next-steps.html','What is my Next Step?'],['baptism.html','Get Baptized'],['teams.html','Join a Team'],['prayer.html','Need Prayer?'],['https://axiomcares.netlify.app','Need Help?','ext'],['https://axiomchurch.churchcenter.com/registrations/events','Events','ext']]],['link','Give','give.html']];
 const item=([h,l,x])=>`<a href="${h}"${x==='ext'?' target="_blank" rel="noopener"':''}${page===h?' class="active" aria-current="page"':''}>${l}</a>`;
 const menu=NAV.map(n=>n[0]==='link'?`<a class="link${page===n[2]?' active':''}" href="${n[2]}"${page===n[2]?' aria-current="page"':''}>${n[1]}</a>`:`<div class="group"><button class="trigger${n[3].some(i=>i[0]===page)?' active':''}" type="button" aria-expanded="false" aria-controls="${n[2]}">${n[1]}<span class="chev" aria-hidden="true"></span></button><div class="panel" id="${n[2]}">${n[3].map(item).join('')}</div></div>`).join('');
 document.querySelector('[data-header]').innerHTML=`<header class="header"><nav class="nav wrap" aria-label="Primary"><a class="logo" href="index.html">${mark}<b>Axiom Church</b></a><div class="menu" id="menu">${menu}<a class="pill fill menu-cta" href="visit.html">Plan a Visit</a></div><a class="pill fill" href="visit.html">Plan a Visit</a><button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu">☰</button></nav></header>`;
 document.querySelector('[data-footer]').innerHTML=`<footer class="footer"><div class="wrap"><div class="footer-main"><div><h3>A place you can<br>stop pretending.</h3><p>A brand new church for people who thought they would never step foot in one.</p></div><div><h4>I&rsquo;m New</h4><ul><li><a href="visit.html">Plan a visit</a></li><li><a href="kids.html">Kids</a></li><li><a href="messages.html">Messages</a></li></ul></div><div><h4>About</h4><ul><li><a href="about.html">Who we are</a></li><li><a href="beliefs.html">What we believe</a></li><li><a href="give.html">Give</a></li><li><a href="contact.html">Contact</a></li></ul></div><div><h4>Next Steps</h4><ul><li><a href="next-steps.html">What is my Next Step?</a></li><li><a href="baptism.html">Get Baptized</a></li><li><a href="teams.html">Join a Team</a></li><li><a href="prayer.html">Need Prayer?</a></li><li><a href="https://axiomcares.netlify.app" target="_blank" rel="noopener">Need Help?</a></li><li><a href="https://axiomchurch.churchcenter.com/registrations/events" target="_blank" rel="noopener">Events</a></li></ul></div><div><h4>Sunday</h4><p>10:00 AM<br>Camacho Elementary<br>501 Municipal Dr<br>Leander, TX 78641</p><a href="tel:5122655718">512-265-5718</a><div class="social"><a href="https://www.instagram.com/axiomchurchaustin/" target="_blank" rel="noopener" aria-label="Axiom on Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a><a href="https://www.facebook.com/axiomchurchaustin/" target="_blank" rel="noopener" aria-label="Axiom on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg></a><a href="https://www.youtube.com/@AxiomChurchTX" target="_blank" rel="noopener" aria-label="Axiom on YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg></a></div></div></div><div class="footer-bottom"><span>© 2026 Axiom Church</span><span>Leander, Texas</span></div></div></footer>`;
 const slides=[...document.querySelectorAll('.hero-slideshow img')];if(slides.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){let current=0;setInterval(()=>{slides[current].classList.remove('active');current=(current+1)%slides.length;slides[current].classList.add('active')},5500)}
 const h=document.querySelector('.header');addEventListener('scroll',()=>{if(scrollY>80)h.classList.add('compact');else if(scrollY<24)h.classList.remove('compact')},{passive:true});const t=document.querySelector('.menu-toggle'),m=document.querySelector('.menu'),groups=[...document.querySelectorAll('.menu .group')],narrow=matchMedia('(max-width: 900px)');const setOpen=(g,o)=>{g.classList.toggle('open',o);g.querySelector('.trigger').setAttribute('aria-expanded',o)};const closeAll=()=>groups.forEach(g=>setOpen(g,false));groups.forEach(g=>g.querySelector('.trigger').addEventListener('click',()=>{const o=!g.classList.contains('open');if(!narrow.matches)closeAll();setOpen(g,o)}));const setDrawer=o=>{m.classList.toggle('open',o);t.setAttribute('aria-expanded',o);t.textContent=o?'×':'☰';if(!o)closeAll()};t.addEventListener('click',()=>setDrawer(!m.classList.contains('open')));document.addEventListener('click',e=>{if(!e.target.closest('.menu .group'))closeAll()});document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const g=document.activeElement&&document.activeElement.closest('.menu .group');if(g&&g.classList.contains('open'))g.querySelector('.trigger').focus();closeAll();if(narrow.matches&&m.classList.contains('open')){setDrawer(false);t.focus()}});const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}}),{threshold:.1});document.querySelectorAll('[data-reveal]').forEach(x=>io.observe(x));document.querySelectorAll('.faq button').forEach(b=>b.onclick=()=>b.parentElement.classList.toggle('open'));
if(document.querySelector('.fold-btn')){document.querySelectorAll('.fold-btn').forEach(b=>{b.addEventListener('click',()=>{const f=b.closest('.fold'),open=!f.classList.contains('open');f.classList.toggle('open',open);b.setAttribute('aria-expanded',open)})})}
/* kids page: quote reel. Duplicate the set once, drift left, loop; pause on touch, hover or focus. */
const reel=document.getElementById('reel'),track=document.getElementById('reelTrack');
if(reel&&track&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const n=track.children.length;for(let i=0;i<n;i++){const c=track.children[i].cloneNode(true);c.setAttribute('aria-hidden','true');track.appendChild(c)}let hold=false,resume=0,pos=0,last=0;const stop=()=>{hold=true;clearTimeout(resume)},go=()=>{clearTimeout(resume);resume=setTimeout(()=>{hold=false;pos=reel.scrollLeft},1800)};['pointerdown','touchstart','mouseenter','focusin','wheel'].forEach(e=>reel.addEventListener(e,stop,{passive:true}));['pointerup','touchend','mouseleave','focusout','wheel'].forEach(e=>reel.addEventListener(e,go,{passive:true}));requestAnimationFrame(function tick(t){const dt=last?Math.min(t-last,60):0;last=t;const loop=track.children[n].offsetLeft-track.children[0].offsetLeft;if(!hold){pos+=dt*0.035;if(pos>=loop)pos-=loop;reel.scrollLeft=pos}else if(reel.scrollLeft>=loop){reel.scrollLeft-=loop}requestAnimationFrame(tick)})}
})();

/* Home screen app: open to the Sunday screen (/app/), including shortcuts saved before it existed, and make the logo lead back to it. */
(function(){var sa=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(!sa)return;var p=location.pathname;try{if((p==='/'||p==='/index.html')&&!sessionStorage.getItem('axApp')){sessionStorage.setItem('axApp','1');location.replace('/app/');return;}sessionStorage.setItem('axApp','1');}catch(e){}document.querySelectorAll('.logo').forEach(function(a){a.setAttribute('href','/app/');});})();

/* "Keep Axiom on your phone" banner: phones only, from someone's 3rd visit, never inside the
   saved app or on /save, /app or the prayer team page. Closing it hides it for good.
   Add ?banner=1 to any address to see it right away. */
(function(){
  var p=location.pathname,force=/[?&]banner=1/.test(location.search);
  var phone=/iPhone|iPad|iPod|Android/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var sa=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(sa||!phone||/^\/(save|app)\b|prayer-team/.test(p))return;
  var visits=0;
  try{
    if(localStorage.getItem('axSaveBanner')==='closed'&&!force)return;
    visits=+(localStorage.getItem('axVisits')||0);
    if(!sessionStorage.getItem('axCounted')){visits++;localStorage.setItem('axVisits',visits);sessionStorage.setItem('axCounted','1');}
  }catch(e){if(!force)return;}
  if(visits<3&&!force)return;
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel',deferred=null;
  var css=document.createElement('style');
  css.textContent='.axsb{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:200;background:#fff;color:#101010;border-radius:16px;padding:12px;box-shadow:0 14px 34px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;font-family:"DM Sans",sans-serif;animation:axsb .45s cubic-bezier(.2,.8,.2,1) both}'+
   '.axsb.lift{bottom:calc(96px + env(safe-area-inset-bottom,0px))}'+
   '@keyframes axsb{from{transform:translateY(24px);opacity:0}}'+
   '.axsb img{width:42px;height:42px;border-radius:10px;flex:none}'+
   '.axsb div{flex:1;min-width:0}.axsb b{display:block;font:800 .9rem "Archivo",sans-serif}.axsb span{display:block;font-size:.78rem;color:#5a5a5a;line-height:1.3}'+
   '.axsb a.go,.axsb button.go{flex:none;border:0;border-radius:999px;background:#C51C11;color:#fff;font:700 .72rem "Archivo",sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:10px 13px;text-decoration:none;cursor:pointer}'+
   '.axsb .x{flex:none;align-self:flex-start;border:0;background:none;color:#888;font-size:1.1rem;line-height:1;padding:2px 4px;cursor:pointer}'+
   '.axsb a:focus-visible,.axsb button:focus-visible{outline:3px solid #F05F56;outline-offset:2px}'+
   '@media (min-width:900px){.axsb{display:none}}';
  document.head.appendChild(css);
  var bar=document.createElement('div');bar.className='axsb';bar.setAttribute('role','region');bar.setAttribute('aria-label','Add Axiom to your home screen');
  bar.innerHTML='<img src="/assets/icons/apple-touch-icon.png" alt=""><div><b>Keep Axiom on your phone</b><span>Messages, giving and prayer in one tap.</span></div>'+
    '<a class="go" href="/save/">How</a><button class="x" type="button" aria-label="Close">&#10005;</button>';
  /* wait until they scroll past the top of the page, so it never covers the first screen's buttons */
  var shown=false;function maybe(){if(shown||(scrollY<500&&!force))return;shown=true;removeEventListener('scroll',maybe);document.body.appendChild(bar);lift();addEventListener('scroll',function(){requestAnimationFrame(lift);},{passive:true});}
  /* sit above any sticky bottom button (Plan a Visit, Join a team) whenever it's showing */
  function lift(){var st=document.querySelector('.stickycta, main.visit .sticky, .sticky.on');bar.classList.toggle('lift',!!(st&&getComputedStyle(st).display!=='none'));}
  addEventListener('scroll',maybe,{passive:true});maybe();
  var go=bar.querySelector('.go');
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;
    var b=document.createElement('button');b.className='go';b.type='button';b.textContent='Add';go.replaceWith(b);go=b;
    b.addEventListener('click',function(){deferred.prompt();deferred.userChoice.then(function(r){if(r.outcome==='accepted')close();});});});
  function close(){try{localStorage.setItem('axSaveBanner','closed');}catch(e){}bar.remove();}
  bar.querySelector('.x').addEventListener('click',close);
})();
