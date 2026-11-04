/* Plan a Visit pop-up.
   Google Analytics events, read by the Scoreboard's Plan a Visit funnel:
   visit_popup_open > visit_step_sunday > visit_step_name > visit_step_email > generate_lead.
   Every "Let us know you're coming" link (the Church Center form 1302721) opens this
   instead: one question at a time, then it goes to /api/visit, which files it in
   Planning Center and schedules a reminder email. If this script fails to load, the
   links still go to the Church Center form like before.
   Add ?visit=1 to any page address to open it right away. */
(function () {
  var FORM = 'forms/1302721', CC = 'https://axiomchurch.churchcenter.com/people/forms/1302721';
  var el, step = 0, opened = 0, lastFocus = null, autoOpen = false;
  var data = { sunday: '', first: '', last: '', email: '', phone: '', kids: '' };
  var track = function (name, p) { try { window.gtag && gtag('event', name, p || {}); } catch (e) {} };

  // Next four Sundays in Leander time. This Sunday counts until 10am.
  function sundays() {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var add = (7 - d.getDay()) % 7;
    if (add === 0 && now.getHours() >= 10) add = 7;
    d.setDate(d.getDate() + add);
    var out = [];
    for (var i = 0; i < 4; i++) {
      var x = new Date(d); x.setDate(d.getDate() + i * 7);
      var ymd = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      var label = x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var tag = i === 0 ? (add === 0 ? 'Today' : (add < 7 ? 'This Sunday' : 'Next Sunday')) : i === 1 && add < 7 ? 'Next Sunday' : '';
      out.push({ ymd: ymd, label: label, tag: tag });
    }
    return out;
  }
  var nice = function (ymd) { return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); };
  var esc = function (s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var CSS = '.axv-bg{position:fixed;inset:0;z-index:300;background:rgba(16,16,16,.55);display:flex;align-items:flex-end;justify-content:center;animation:axvf .2s both}' +
    '@keyframes axvf{from{opacity:0}}@keyframes axvu{from{transform:translateY(40px);opacity:0}}' +
    '.axv{position:relative;width:100%;max-width:460px;background:#fff;color:#1a1a1a;border-radius:22px 22px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom,0px));font-family:"DM Sans",system-ui,sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:axvu .35s cubic-bezier(.2,.8,.2,1) both;max-height:92vh;overflow:auto}' +
    '@media (min-width:700px){.axv-bg{align-items:center}.axv{border-radius:22px;padding:28px 28px 24px}}' +
    '.axv-top{display:flex;align-items:center;gap:8px;margin-bottom:18px;min-height:32px}' +
    '.axv-dots{display:flex;gap:6px;flex:1;justify-content:center}.axv-dots i{width:22px;height:4px;border-radius:4px;background:#e8e8e8}.axv-dots i.on{background:#C51C11}' +
    '.axv-ic{border:0;background:#f5f5f5;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#1a1a1a;flex:none}.axv-ic[hidden]{display:grid;visibility:hidden}' +
    '.axv-ic svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}' +
    '.axv h2{font:900 1.9rem/0.95 "Archivo",system-ui,sans-serif;font-stretch:62%;text-transform:uppercase;margin:0 0 6px;letter-spacing:.005em}' +
    '.axv p.sub{margin:0 0 18px;color:#5a5a5a;font-size:.95rem;line-height:1.4}' +
    '.axv-days{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.axv-day{border:1.5px solid #e8e8e8;background:#fff;border-radius:14px;padding:14px 12px;text-align:left;cursor:pointer;font:inherit;color:inherit;min-height:64px}' +
    '.axv-day b{display:block;font:800 1.05rem "Archivo",system-ui,sans-serif}.axv-day span{display:block;font-size:.78rem;color:#C51C11;font-weight:700;min-height:1em}' +
    '.axv-day:hover,.axv-day.sel{border-color:#C51C11}.axv-day.sel{background:#fdf0ef}' +
    '.axv-unsure{grid-column:1/-1;text-align:center;min-height:48px;padding:12px}' +
    '.axv label{display:block;font-weight:700;font-size:.85rem;margin:0 0 6px}.axv label small{font-weight:500;color:#888}' +
    '.axv input,.axv textarea{width:100%;box-sizing:border-box;border:1.5px solid #e8e8e8;border-radius:12px;padding:13px 14px;font:inherit;font-size:16px;color:#1a1a1a;background:#fff;margin:0 0 14px}' +
    '.axv textarea{min-height:84px;resize:vertical}.axv input:focus,.axv textarea:focus{outline:none;border-color:#C51C11}' +
    '.axv-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.axv-go{display:block;width:100%;border:0;border-radius:999px;background:#C51C11;color:#fff;font:700 .85rem "Archivo",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:16px;cursor:pointer;text-align:center;text-decoration:none;margin-top:4px}' +
    '.axv-go[disabled]{opacity:.5;cursor:default}.axv-go.ghost{background:#f5f5f5;color:#1a1a1a}' +
    '.axv-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.axv-two .axv-go{padding:16px 8px;white-space:nowrap}' +
    '.axv-err{color:#C51C11;font-size:.88rem;margin:-4px 0 12px;min-height:0}' +
    '.axv-err a{color:inherit}' +
    '.axv-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '.axv-done{text-align:center}.axv-done .tick{width:56px;height:56px;border-radius:50%;background:#fdf0ef;display:grid;place-items:center;margin:0 auto 14px}' +
    '.axv-done .tick svg{width:28px;height:28px;fill:none;stroke:#C51C11;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
    '.axv-done p.sub{margin-bottom:20px}' +
    '.axv button:focus-visible,.axv a:focus-visible{outline:3px solid #F05F56;outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.axv,.axv-bg{animation:none}}';

  var STEPS = 4;
  function screen() {
    var s = '';
    if (step === 0) {
      s = '<h2>Which Sunday?</h2><p class="sub">10:00 AM at Camacho Elementary in Leander.</p><div class="axv-days">' +
        sundays().map(function (d) { return '<button type="button" class="axv-day' + (data.sunday === d.ymd ? ' sel' : '') + '" data-day="' + d.ymd + '"><span>' + d.tag + '</span><b>' + d.label + '</b></button>'; }).join('') +
        '<button type="button" class="axv-day axv-unsure" data-day="">Not sure yet</button></div>';
    } else if (step === 1) {
      s = '<h2>Who&rsquo;s coming?</h2><p class="sub">So we know who to look for.</p>' +
        '<div class="axv-row"><div><label for="axv-first">First name</label><input id="axv-first" autocomplete="given-name" value="' + esc(data.first) + '"></div>' +
        '<div><label for="axv-last">Last name</label><input id="axv-last" autocomplete="family-name" value="' + esc(data.last) + '"></div></div>' +
        '<div class="axv-err" role="alert"></div><button type="button" class="axv-go" data-next>Next</button>';
    } else if (step === 2) {
      s = '<h2>Where should we<br>send a reminder?</h2><p class="sub">' + (data.sunday ? 'One email the day before. That&rsquo;s it.' : 'Just so we can say hi. No spam.') + '</p>' +
        '<label for="axv-email">Email</label><input id="axv-email" type="email" inputmode="email" autocomplete="email" value="' + esc(data.email) + '">' +
        '<label for="axv-phone">Phone <small>(optional)</small></label><input id="axv-phone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(data.phone) + '">' +
        '<input class="axv-hp" id="axv-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<div class="axv-err" role="alert"></div><button type="button" class="axv-go" data-next>Next</button>';
    } else if (step === 3) {
      s = '<h2>Bringing kids?</h2><p class="sub">Tell us their names and ages and you skip the check-in line.</p>' +
        '<div class="axv-two" id="axv-yn"><button type="button" class="axv-day axv-unsure" data-kids="no">No kids</button><button type="button" class="axv-day axv-unsure" data-kids="yes">Yes</button></div>' +
        '<div id="axv-kidbox" hidden><label for="axv-kids">Names and ages</label><textarea id="axv-kids" placeholder="Ava, 6. Leo, 3.">' + esc(data.kids) + '</textarea>' +
        '<div class="axv-err" role="alert"></div><button type="button" class="axv-go" data-send>Done</button></div>' +
        '<div class="axv-err" role="alert" id="axv-err2"></div>';
    } else if (step === 4) {
      s = '<div class="axv-done"><div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h2>You&rsquo;re all set, ' + esc(data.first) + '.</h2>' +
        '<p class="sub">' + (data.sunday ? 'See you ' + nice(data.sunday) + ' at 10:00 AM.' + (data.reminder ? ' We&rsquo;ll email you a reminder the day before.' : '') : 'We can&rsquo;t wait to meet you. Sundays at 10:00 AM.') + '</p>' +
        (data.sunday ? '<div class="axv-two"><a class="axv-go ghost" href="/api/visit?ics=' + data.sunday + '">Add to calendar</a><a class="axv-go" href="https://www.google.com/maps/dir/?api=1&amp;destination=501+Municipal+Dr%2C+Leander%2C+TX+78641" target="_blank" rel="noopener">Directions</a></div>'
          : '<a class="axv-go" href="/visit.html">What to expect</a>') + '</div>';
    }
    var dots = '';
    for (var i = 0; i < STEPS; i++) dots += '<i class="' + (i <= step && step < 4 ? 'on' : '') + '"></i>';
    el.querySelector('.axv-body').innerHTML = s;
    el.querySelector('.axv-dots').innerHTML = step < 4 ? dots : '';
    el.querySelector('[data-back]').hidden = step === 0 || step === 4;
    wire();
    var f = el.querySelector('.axv-body input:not(.axv-hp), .axv-body button, .axv-body a');
    if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60);
  }

  function err(msg, box) { var e = box || el.querySelector('.axv-err'); if (e) e.innerHTML = msg; }
  function val(id) { var x = el.querySelector('#' + id); return x ? x.value.trim() : ''; }

  function wire() {
    el.querySelectorAll('[data-day]').forEach(function (b) {
      b.addEventListener('click', function () { data.sunday = b.getAttribute('data-day'); track('visit_step_sunday', { sunday: data.sunday || 'not_sure' }); step = 1; screen(); });
    });
    var next = el.querySelector('[data-next]');
    if (next) next.addEventListener('click', advance);
    el.querySelectorAll('.axv-body input').forEach(function (i) {
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); advance(); } });
    });
    el.querySelectorAll('[data-kids]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('data-kids') === 'no') { data.kids = ''; send(b); return; }
        el.querySelector('#axv-yn').hidden = true;
        el.querySelector('#axv-kidbox').hidden = false;
        el.querySelector('#axv-kids').focus();
      });
    });
    var s = el.querySelector('[data-send]');
    if (s) s.addEventListener('click', function () {
      data.kids = val('axv-kids');
      if (!data.kids) { err('Add their names and ages, or tap back and choose No kids.', el.querySelector('#axv-kidbox .axv-err')); return; }
      send(s);
    });
  }

  function advance() {
    if (step === 1) {
      data.first = val('axv-first'); data.last = val('axv-last');
      if (!data.first || !data.last) return err('First and last name, please.');
      track('visit_step_name'); step = 2; screen();
    } else if (step === 2) {
      data.email = val('axv-email'); data.phone = val('axv-phone'); data.hp = val('axv-hp');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return err('That email doesn&rsquo;t look right.');
      track('visit_step_email'); step = 3; screen();
    }
  }

  function send(btn) {
    btn.disabled = true; var t = btn.textContent; btn.textContent = 'Sending…';
    var box = el.querySelector('#axv-kidbox:not([hidden]) .axv-err') || el.querySelector('#axv-err2');
    fetch('/api/visit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sunday: data.sunday, first: data.first, last: data.last, email: data.email, phone: data.phone, kids: data.kids, hp: data.hp || '', ms: Date.now() - opened }),
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'error'); return j; }); })
      .then(function (j) {
        data.reminder = !!j.reminder;
        track('generate_lead', { form_name: 'plan_a_visit', method: 'popup' });
        try { localStorage.setItem('axVisitDone', '1'); } catch (e) {}
        step = 4; screen();
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = t;
        err('Something went wrong on our end. <a href="' + CC + '" target="_blank" rel="noopener">Use this form instead</a>.', box);
      });
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      var f = [].slice.call(el.querySelectorAll('button:not([hidden]):not([disabled]), a, input:not(.axv-hp), textarea')).filter(function (x) { return x.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }

  function open() {
    if (el) return;
    lastFocus = document.activeElement; opened = Date.now();
    if (!document.getElementById('axv-css')) { var c = document.createElement('style'); c.id = 'axv-css'; c.textContent = CSS; document.head.appendChild(c); }
    el = document.createElement('div');
    el.className = 'axv-bg';
    el.innerHTML = '<div class="axv" role="dialog" aria-modal="true" aria-label="Plan a visit"><div class="axv-top">' +
      '<button type="button" class="axv-ic" data-back aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="axv-dots"></div>' +
      '<button type="button" class="axv-ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="axv-body"></div></div>';
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    el.querySelector('[data-close]').addEventListener('click', close);
    el.querySelector('[data-back]').addEventListener('click', function () { if (step === 3) data.kids = ''; step = Math.max(0, step - 1); screen(); });
    document.addEventListener('keydown', onKey);
    step = data.first && step === 4 ? 4 : 0;
    screen();
    track('visit_popup_open', { auto: autoOpen ? 'yes' : 'no' }); autoOpen = false;
  }

  function close() {
    if (!el) return;
    el.remove(); el = null;
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (step === 4) { step = 0; data = { sunday: '', first: '', last: '', email: '', phone: '', kids: '' }; }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // Capture phase, so the page's own Church Center click counter doesn't also count this as a lead.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="' + FORM + '"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    open();
  }, true);

  window.axPlanVisit = open;
  if (/[?&]visit=1/.test(location.search)) open();
  // Plan a Visit page: open on its own after a beat. Once per visit to the site, and never
  // again for someone who already signed up on this device.
  else if (/^\/(visit|plan-a-visit)(\.html)?\/?$/.test(location.pathname)) {
    var seen = false;
    try { seen = !!(sessionStorage.getItem('axVisitAuto') || localStorage.getItem('axVisitDone')); sessionStorage.setItem('axVisitAuto', '1'); } catch (e) {}
    if (!seen) setTimeout(function () { if (!el) { autoOpen = true; open(); } }, 1200);
  }
})();
