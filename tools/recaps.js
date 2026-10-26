// Builds the written message recaps from messages/recaps.json (newest first):
//   - one page per message at /messages/<slug> (file messages/<slug>.html)
//   - the "Recent messages" list on messages.html (between the recaps markers)
//   - their entries in sitemap.xml
// Then bakes the header and footer into the new pages.
// To add a message: put a new entry at the top of messages/recaps.json and run
//   node tools/recaps.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const SITE = 'https://www.axiomchurch.com';
const recaps = JSON.parse(fs.readFileSync(path.join(root, 'messages/recaps.json'), 'utf8'));
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
const shell = fs.readFileSync(path.join(root, '404.html'), 'utf8');

function page(r) {
  const url = `${SITE}/messages/${r.slug}`;
  const meta = [r.series && `${r.series}${r.part ? ', ' + r.part : ''}`, day(r.date), r.speaker].filter(Boolean).join(' · ');
  const desc = esc(r.summary[0]);
  const watch = r.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(r.videoId)}` : 'https://www.youtube.com/@AxiomChurchTX/videos';
  const ld = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: r.title, datePublished: r.date,
    author: { '@type': 'Person', name: r.speaker }, isPartOf: r.series ? { '@type': 'CreativeWorkSeries', name: r.series } : undefined,
    publisher: { '@type': 'Church', name: 'Axiom Church', url: SITE + '/' }, description: r.summary.join(' '), url,
  };
  let h = shell;
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(r.title)} | Messages | Axiom Church</title>`);
  h = h.replace(/\s*<meta name="robots" content="noindex" \/>/, '');
  h = h.replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(r.title)} | Axiom Church`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*/, `$1${desc}`);
  h = h.replace(/(<meta name="description" content=")[^"]*/, `$1${desc}`);
  h = h.replace('</title>', `</title>\n    <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n    <script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  h = h.replace(/<style>[\s\S]*?<\/style>/, `<style>
      .recappage{background:#fff;color:#111}
      .rc-wrap{max-width:760px;margin:0 auto;padding:clamp(48px,9vw,104px) 20px}
      .rc-kicker{font-family:Archivo,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;color:#c51c11;margin:0 0 12px}
      .recappage h1{font-family:Archivo,sans-serif;font-weight:900;font-size:clamp(2.3rem,7.5vw,3.8rem);letter-spacing:-.035em;line-height:.98;margin:0 0 26px;text-transform:none}
      .rc-body p{font-size:clamp(1.05rem,2.5vw,1.2rem);line-height:1.65;margin:0 0 18px;max-width:60ch}
      .rc-refs{list-style:none;margin:26px 0 0;padding:16px 0 0;border-top:1px solid #e8e8e8;display:flex;flex-wrap:wrap;gap:8px}
      .rc-refs li{font-family:Archivo,sans-serif;font-weight:700;font-size:.8rem;border:1.5px solid #111;border-radius:99px;padding:3px 10px}
      .rc-cta{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center;margin:34px 0 0}
      .rc-cta .btn{display:inline-block;background:#c51c11;color:#fff;font-family:Archivo,sans-serif;font-weight:800;padding:14px 22px;border-radius:4px;text-decoration:none}
      .rc-cta a.tl{color:#111;font-weight:700;text-decoration-color:#c51c11;text-decoration-thickness:2px;text-underline-offset:5px}
      .rc-visit{margin-top:clamp(40px,7vw,72px);padding-top:26px;border-top:3px solid #111}
      .rc-visit h2{font-family:Archivo,sans-serif;font-weight:900;font-size:clamp(1.6rem,5vw,2.2rem);letter-spacing:-.03em;margin:0 0 8px;text-transform:none}
      .rc-visit p{margin:0 0 18px;color:#444}
    </style>`);
  h = h.replace(/<main[\s\S]*?<\/main>/, `<main class="recappage">
      <article class="rc-wrap">
        <p class="rc-kicker">${esc(meta)}</p>
        <h1>${esc(r.title)}</h1>
        <div class="rc-body">
${r.summary.map((p) => `          <p>${esc(p)}</p>`).join('\n')}
        </div>
        <ul class="rc-refs" aria-label="Scripture">
${r.scriptures.map((s) => `          <li>${esc(s)}</li>`).join('\n')}
        </ul>
        <div class="rc-cta">
          <a class="btn" href="${watch}" target="_blank" rel="noopener">Watch the message</a>
          <a class="tl" href="messages.html">All messages &rarr;</a>
        </div>
        <section class="rc-visit">
          <h2>Hear the next one in person.</h2>
          <p>Sundays at 10am. Camacho Elementary, 501 Municipal Dr, Leander.</p>
          <a class="btn" href="visit.html" style="display:inline-block;background:#111;color:#fff;font-family:Archivo,sans-serif;font-weight:800;padding:14px 22px;border-radius:4px;text-decoration:none">Plan a Visit</a>
        </section>
      </article>
    </main>`);
  return h;
}

fs.mkdirSync(path.join(root, 'messages'), { recursive: true });
for (const r of recaps) fs.writeFileSync(path.join(root, 'messages', r.slug + '.html'), page(r));

// Recent messages list on messages.html
const list = recaps.slice(0, 6).map((r) => `          <li><a href="messages/${r.slug}"><span class="rk">${esc([r.series && r.series + (r.part ? ', ' + r.part : ''), day(r.date)].filter(Boolean).join(' · '))}</span><b>${esc(r.title)}</b><span class="rs">${esc(r.summary[0])}</span></a></li>`).join('\n');
const block = `<!--recaps:start-->
      <section class="recaps" aria-labelledby="recaps-h">
        <div class="recaps-in">
          <h2 id="recaps-h">Recent messages, in short.</h2>
          <ul class="recap-list">
${list}
          </ul>
        </div>
      </section>
      <!--recaps:end-->`;
const mp = path.join(root, 'messages.html');
let m = fs.readFileSync(mp, 'utf8');
if (m.includes('<!--recaps:start-->')) m = m.replace(/<!--recaps:start-->[\s\S]*?<!--recaps:end-->/, block);
else m = m.replace('      <section class="room">', '      ' + block + '\n\n      <section class="room">');
fs.writeFileSync(mp, m);

// Sitemap
const sp = path.join(root, 'sitemap.xml');
let sm = fs.readFileSync(sp, 'utf8').replace(/\s*<url>\s*<loc>https:\/\/www\.axiomchurch\.com\/messages\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
const entries = recaps.map((r) => `\n  <url>\n    <loc>${SITE}/messages/${r.slug}</loc>\n    <lastmod>${r.date}</lastmod>\n    <priority>0.6</priority>\n  </url>`).join('');
sm = sm.replace('</urlset>', entries.replace(/^\n/, '\n') + '\n</urlset>');
fs.writeFileSync(sp, sm);

execFileSync('node', [path.join(__dirname, 'bake-chrome.js')], { stdio: 'inherit' });
console.log('built', recaps.length, 'recap page(s)');
