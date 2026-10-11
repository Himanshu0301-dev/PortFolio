(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, rootEl=document) => rootEl.querySelector(s);
  const $$ = (s, rootEl=document) => [...rootEl.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Same condition as the CSS "lite" block, so JS and CSS always agree about what counts as mobile/touch.
  const isLite = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)').matches;
  // Run each feature in isolation so one failure can never block the loader or the other features.
  const safe = (name, fn) => { try { fn(); } catch (err) { console.error('[portfolio] ' + name + ' failed:', err); } };

  // Weak-phone hint (never applied on desktop). CSS turns the infinite decorative loops off for html.low-end.
  const conn = navigator.connection || {};
  const weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
  if (isLite && weakDevice) root.classList.add('low-end');

  // State shared between features.
  let loaderDone = false, heroVisible = true, typing = false, typeTimer;

  // ---------------------------------------------------------------------------
  // Loader: time-based (not tick-based), waits for the hero photo to be decoded,
  // can never hang (hard stop), and removes itself from the DOM when finished.
  // ---------------------------------------------------------------------------
  const loader = $('#loader'), bar = $('#load-bar'), number = $('#load-number'), state = $('#load-state'), caption = $('#load-caption');
  const stages = [{at:0,state:'BOOTING INTERFACE',caption:'RENDERING VISUAL SYSTEM'},{at:28,state:'LOADING ASSETS',caption:'PREPARING DIGITAL SPACE'},{at:55,state:'BUILDING EXPERIENCE',caption:'CALIBRATING MOTION ENGINE'},{at:82,state:'FINALIZING DETAILS',caption:'ALMOST READY TO EXPLORE'}];
  const minMs = reduceMotion ? 250 : isLite ? 1500 : 2800;   // shortest the loader is shown
  const maxMs = 4500;                                         // longest we ever wait for the photo
  let loaderFinished = false, shown = -1, heroReady = false;

  function paintLoader(p){
    if (p === shown) return;
    shown = p;
    bar.style.width = p + '%';
    number.textContent = String(p).padStart(2,'0') + '%';
    const stage = [...stages].reverse().find(s => p >= s.at) || stages[0];
    state.textContent = stage.state; caption.textContent = stage.caption;
  }
  function onLoaderDone(){
    loaderDone = true;
    root.classList.remove('loading');
    root.classList.add('ready');
    syncTyping();
    setTimeout(startFpsProbe, 800);
  }
  function finishLoader(){
    if (loaderFinished) return;
    loaderFinished = true;
    clearTimeout(hardStop);
    paintLoader(100); state.textContent = 'ACCESS GRANTED'; caption.textContent = 'WELCOME TO THE EXPERIENCE';
    setTimeout(() => {
      loader.classList.add('done');
      const removeLoader = () => loader.remove();           // frees its large animated layers for good
      loader.addEventListener('transitionend', e => { if (e.target === loader) removeLoader(); });
      setTimeout(removeLoader, reduceMotion ? 50 : 1300);   // fallback when transitions are disabled
      onLoaderDone();
    }, reduceMotion ? 0 : 450);
  }
  const hardStop = setTimeout(() => { console.warn('[portfolio] loader hard stop reached'); finishLoader(); }, maxMs + 500);

  safe('loader', () => {
    if (!loader || !bar || !number || !state || !caption) { console.warn('[portfolio] loader markup missing; skipping loader'); loaderFinished = true; clearTimeout(hardStop); onLoaderDone(); return; }
    const hero = $('.portrait-frame img');
    if (hero) {
      const decoded = () => { (hero.decode ? hero.decode() : Promise.resolve()).catch(err => console.warn('[portfolio] hero image decode skipped:', err)).then(() => { heroReady = true; }); };
      if (hero.complete) decoded();
      else {
        hero.addEventListener('load', decoded, {once:true});
        hero.addEventListener('error', () => { console.warn('[portfolio] hero image failed to load: ' + hero.currentSrc); heroReady = true; }, {once:true});
      }
    } else heroReady = true;
    const t0 = performance.now();
    const tick = now => {
      if (loaderFinished) return;
      const elapsed = Math.max(0, now - t0), t = Math.min(1, elapsed / minMs);   // rAF timestamps can precede t0 slightly
      const waiting = t >= 1 && !heroReady;                 // timeline done, photo not ready yet
      paintLoader(waiting ? 99 : Math.round(100 * (1 - Math.pow(1 - t, 2.4))));
      if ((t >= 1 && heroReady) || elapsed >= maxMs) finishLoader(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // ---------------------------------------------------------------------------
  // Page chrome
  // ---------------------------------------------------------------------------
  safe('year', () => { $('#year').textContent = new Date().getFullYear(); });

  const nav = $('#nav'), menu = $('#menu');
  safe('menu', () => {
    menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? '×' : '☰'; });
    $$('#nav-links a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = '☰'; }));
  });

  // Scroll progress: one rAF-batched transform write per frame (no layout), instead of a width write on every scroll event.
  safe('scroll progress', () => {
    const progressLine = $('#scroll-progress');
    let queued = false;
    const update = () => { queued = false; const max = root.scrollHeight - innerHeight, ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0; progressLine.style.transform = 'scaleX(' + (ratio > .998 ? 1 : ratio) + ')'; };   // snap: sub-pixel rounding at the very bottom
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, {passive:true});
    addEventListener('resize', queue, {passive:true});
    update();
  });

  // Scroll reveal, active navigation link, and pausing of decorative animation while off-screen.
  safe('observers', () => {
    if (!('IntersectionObserver' in window)) { $$('.reveal,.stagger').forEach(el => el.classList.add('visible')); return; }
    const revealObserver = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } }, {threshold:0, rootMargin:'0px 0px -10% 0px'});
    $$('.reveal,.stagger').forEach(el => revealObserver.observe(el));

    const navLinks = $$('#nav-links a');
    let activeId = null;
    const navObserver = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting && activeId !== entry.target.id) { activeId = entry.target.id; navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + activeId)); } }, {rootMargin:'-30% 0px -60% 0px'});
    $$('main section[id]').forEach(section => navObserver.observe(section));

    // Toggles .is-off on #home and each .project-art; CSS pauses their infinite animations while off-screen and resumes when they return.
    const offObserver = new IntersectionObserver(entries => { for (const entry of entries) { entry.target.classList.toggle('is-off', !entry.isIntersecting); if (entry.target.id === 'home') { heroVisible = entry.isIntersecting; syncTyping(); } } }, {rootMargin:'120px 0px'});
    const home = $('#home'); if (home) offObserver.observe(home);
    $$('.project-art').forEach(el => offObserver.observe(el));

    // Portrait animation (touch devices, see CSS): .is-still pauses it until >=20% of the portrait is on screen, and again once it leaves.
    const heroVisual = $('#hero-visual');
    if (heroVisual) new IntersectionObserver(entries => { for (const entry of entries) entry.target.classList.toggle('is-still', entry.intersectionRatio < .2); }, {threshold:[0, .2]}).observe(heroVisual);
  });

  // Typed role line: only runs while the hero is on screen, the tab is visible and the loader is gone.
  const phrases = ['Building digital experiences','Frontend + backend','Learning through projects','Always improving'];
  let phraseIndex = 0, charIndex = 0, deleting = false;
  const typed = $('#typed');
  function typeLoop(){
    const phrase = phrases[phraseIndex];
    charIndex += deleting ? -1 : 1;
    typed.textContent = phrase.slice(0, charIndex);
    let delay = deleting ? 35 : 65;
    if (!deleting && charIndex === phrase.length) { deleting = true; delay = 1100; }
    else if (deleting && charIndex === 0) { deleting = false; phraseIndex = (phraseIndex + 1) % phrases.length; delay = 250; }
    typeTimer = setTimeout(typeLoop, delay);
  }
  function syncTyping(){
    const should = !!typed && !reduceMotion && loaderDone && heroVisible && !document.hidden;
    if (should && !typing) { typing = true; typeTimer = setTimeout(typeLoop, 400); }
    else if (!should && typing) { typing = false; clearTimeout(typeTimer); }
  }
  document.addEventListener('visibilitychange', () => { root.classList.toggle('tab-hidden', document.hidden); syncTyping(); });

  // Pointer-driven 3D portrait, card tilt and cursor light: fine-pointer desktops only, and batched to one update per frame.
  safe('pointer effects', () => {
    if (!(matchMedia('(hover:hover) and (pointer:fine)').matches && !reduceMotion)) return;
    const visual = $('#hero-visual'), frame = $('#portrait-frame');
    let tiltEvt = null, tiltQueued = false;
    const applyTilt = () => { tiltQueued = false; if (!tiltEvt) return; const r = visual.getBoundingClientRect(), x = (tiltEvt.clientX - r.left) / r.width - .5, y = (tiltEvt.clientY - r.top) / r.height - .5; frame.style.transform = `rotateY(${x*15-5}deg) rotateX(${-y*10+3}deg)`; };
    visual.addEventListener('pointermove', e => { tiltEvt = e; if (!tiltQueued) { tiltQueued = true; requestAnimationFrame(applyTilt); } }, {passive:true});
    visual.addEventListener('pointerleave', () => { tiltEvt = null; frame.style.transform = 'rotateY(-9deg) rotateX(3deg)'; });

    let cardEl = null, cardEvt = null, cardQueued = false;
    const applyCard = () => { cardQueued = false; if (!cardEl || !cardEvt) return; const card = cardEl, r = card.getBoundingClientRect(), x = (cardEvt.clientX - r.left) / r.width, y = (cardEvt.clientY - r.top) / r.height; card.style.setProperty('--mx', (x*100) + '%'); card.style.setProperty('--my', (y*100) + '%'); if (card.classList.contains('skill-card')) card.style.transform = `perspective(800px) rotateX(${(.5-y)*7}deg) rotateY(${(x-.5)*8}deg) translateY(-3px)`; };
    $$('.panel,.skill-card').forEach(card => {
      card.addEventListener('pointermove', e => { cardEl = card; cardEvt = e; if (!cardQueued) { cardQueued = true; requestAnimationFrame(applyCard); } }, {passive:true});
      card.addEventListener('pointerleave', () => { if (cardEl === card) { cardEl = null; cardEvt = null; } card.style.transform = ''; card.style.removeProperty('--mx'); card.style.removeProperty('--my'); });
    });
  });

  // If a phone still can't hold ~40fps after the page settles, switch to low-end mode (static decorative loops).
  function startFpsProbe(){
    if (!isLite || reduceMotion || root.classList.contains('low-end')) return;
    const deltas = []; let aborted = false, last = performance.now(); const t0 = last;
    const onVis = () => { if (document.hidden) aborted = true; };
    document.addEventListener('visibilitychange', onVis);
    const step = now => {
      if (aborted) { document.removeEventListener('visibilitychange', onVis); return; }
      if (now - t0 > 500) deltas.push(now - last);
      last = now;
      if (now - t0 < 3500) { requestAnimationFrame(step); return; }
      document.removeEventListener('visibilitychange', onVis);
      if (deltas.length < 20) return;
      deltas.sort((a, b) => a - b);
      const median = deltas[deltas.length >> 1];
      if (median > 26) { root.classList.add('low-end'); console.info('[portfolio] ~' + Math.round(1000 / median) + 'fps median detected; decorative animation reduced.'); }
    };
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // Features unchanged in behaviour
  // ---------------------------------------------------------------------------
  safe('skill filters', () => {
    $$('.skill-tab').forEach(tab => tab.addEventListener('click', () => {
      $$('.skill-tab').forEach(t => { const active = t === tab; t.classList.toggle('active', active); t.setAttribute('aria-selected', String(active)); });
      $$('.skill-card').forEach(card => card.classList.toggle('hidden', tab.dataset.filter !== 'all' && card.dataset.cat !== tab.dataset.filter));
    }));
  });

  safe('projects', () => {
    const projectData = {
      portfolio:{kicker:'PROJECT / 01 · PERSONAL',title:'Cinematic Portfolio',description:'This portfolio uses a monochrome editorial system, CSS perspective, mouse-driven depth, a cinematic loader, scroll reveals, and responsive layouts.',tags:['HTML','CSS 3D','JavaScript'],actions:[{label:'GitHub profile ↗',url:'https://github.com/Himanshu0301-dev'}]}
    };
    const modal = $('#project-modal');
    function openProject(key){
      const data = projectData[key]; if (!data) return;
      $('#modal-kicker').textContent = data.kicker; $('#modal-title').textContent = data.title; $('#modal-description').textContent = data.description;
      $('#modal-tags').innerHTML = ''; data.tags.forEach(tag => { const el = document.createElement('span'); el.className = 'tag'; el.textContent = tag; $('#modal-tags').appendChild(el); });
      const actions = $('#modal-actions'); actions.innerHTML = '';
      data.actions.forEach(item => { const a = document.createElement('a'); a.className = 'btn secondary'; a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = item.label; actions.appendChild(a); });
      modal.classList.add('open'); document.body.style.overflow = 'hidden'; $('#modal-close').focus();
    }
    function closeProject(){ modal.classList.remove('open'); document.body.style.overflow = ''; }
    $$('.project-card').forEach(card => { card.addEventListener('click', () => openProject(card.dataset.project)); card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(card.dataset.project); } }); });
    $('#modal-close').addEventListener('click', closeProject); modal.addEventListener('click', e => { if (e.target === modal) closeProject(); }); document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProject(); });

    const projectGrid = $('#projects-grid');
    function rotateProjects(direction){
      const cards = $$('.project-card', projectGrid);
      if (cards.length < 2) return;
      if (direction === 'next') projectGrid.appendChild(cards[0]); else projectGrid.insertBefore(cards[cards.length - 1], cards[0]);
      if (!reduceMotion) { const first = direction === 'next' ? cards[1] : cards[cards.length - 1]; first.animate([{opacity:.55, transform:'translateY(8px) scale(.985)'}, {opacity:1, transform:'translateY(0) scale(1)'}], {duration:360, easing:'cubic-bezier(.2,.75,.25,1)'}); }
    }
    const projectPrev = $('#project-prev'), projectNext = $('#project-next');
    projectPrev.disabled = true; projectNext.disabled = true;
    projectPrev.style.opacity = '.35'; projectNext.style.opacity = '.35';
    projectPrev.style.cursor = 'default'; projectNext.style.cursor = 'default';
    projectPrev.addEventListener('click', () => rotateProjects('prev'));
    projectNext.addEventListener('click', () => rotateProjects('next'));
  });

  // Contact form prepares an email; no backend or data storage is implied.
  safe('contact form', () => {
    $('#contact-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#name').value.trim(), email = $('#email').value.trim(), message = $('#message').value.trim();
      if (!name || !email || !message) { $('#form-status').textContent = 'Please complete all fields.'; return; }
      const subject = encodeURIComponent('Portfolio enquiry from ' + name);
      const body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + message);   // real line breaks (the original wrote a literal "\n")
      $('#form-status').textContent = 'Opening your email app…';
      window.location.href = 'mailto:himanshukumarsingh872@gmail.com?subject=' + subject + '&body=' + body;
    });
  });
})();

/* Independent failsafe: ensures the page becomes visible if initialization fails. */
/* Independent failsafe: runs even if the main script has a syntax error or is blocked.
   Never leave a visitor on the loader or facing invisible content. */
setTimeout(function () {
  var d = document.documentElement;
  if (d.classList.contains('ready')) return;
  console.error('[portfolio] main script did not finish initialising; forcing the page visible.');
  var l = document.getElementById('loader'); if (l && l.parentNode) l.parentNode.removeChild(l);
  d.classList.remove('loading'); d.classList.add('ready');
  var els = document.querySelectorAll('.reveal,.stagger');
  for (var i = 0; i < els.length; i++) els[i].classList.add('visible');
}, 8000);
