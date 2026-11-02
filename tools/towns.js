// Builds the "church near <town>" pages from the list below:
//   /church-near-<slug>  (file church-near-<slug>.html), plus their sitemap entries.
// Edit TOWNS and run:  node tools/towns.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const SITE = 'https://www.axiomchurch.com';
const TOWNS = [
  { slug: 'round-rock', town: 'Round Rock', head: 'Worth the 25 minutes.',
    intro: 'Axiom Church is a casual, non-denominational church in Leander, about 25 minutes from Round Rock. Families already make the drive every Sunday.',
    route: 'Take 45 west to 183A north.' },
  { slug: 'cedar-park', town: 'Cedar Park', head: '15 minutes up 183A.',
    intro: 'Axiom Church is a casual, non-denominational church in Leander, about 15 minutes from Cedar Park.',
    route: 'Take 183A north.' },
  { slug: 'liberty-hill', town: 'Liberty Hill', head: '15 minutes down 29.',
    intro: 'Axiom Church is a casual, non-denominational church in Leander, about 15 minutes from Liberty Hill.',
    route: 'Take 29 east into Leander.' },
  { slug: 'georgetown', town: 'Georgetown', head: '25 minutes across 29.',
    intro: 'Axiom Church is a casual, non-denominational church in Leander, about 25 minutes from Georgetown.',
    route: 'Take SH 29 west, then US 183 south.' },
  { slug: 'north-austin', town: 'North Austin', head: '25 minutes up 183.',
    intro: 'Axiom Church is a casual, non-denominational church in Leander, about 25 minutes from North Austin.',
    route: 'Take US 183 or MoPac north to the 183A Toll.' },
];
const FAQ = [
  ['What kind of church is this?', 'Non-denominational. Casual. We teach from the Bible every week, but we\u2019re not afraid of your questions.'],
  ['Is it a good church for young families?', 'Bring the kids. Axiom Kids is birth through 5th grade, in three rooms: birth through 2, ages 3 to 5, and all of elementary together. Every volunteer is background checked, and only the person with the matching tag picks your kid up.'],
  ['What should I wear?', 'Wear what you would wear on Saturday. No dress code. Just please wear something.'],
  ['What is the time commitment?', 'About 65 minutes. A few songs, a Bible teaching you can use on Tuesday.'],
  ['Can I just sit in the back?', 'Yes. Nobody gets asked to stand up, raise a hand, or introduce themselves.'],
];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shell = fs.readFileSync(path.join(root, '404.html'), 'utf8');
for (const t of TOWNS) {
  const url = `${SITE}/church-near-${t.slug}`;
  const title = `Church near ${t.town} | Axiom Church`;
  const desc = esc(`${t.intro} Sundays at 10am at Camacho Elementary in Leander.`);
  const ld = { '@context': 'https://schema.org', '@type': 'Church', name: 'Axiom Church', url: SITE + '/',
    telephone: '+1-512-265-5718', areaServed: [t.town, 'Leander'],
    address: { '@type': 'PostalAddress', streetAddress: '501 Municipal Dr', addressLocality: 'Leander', addressRegion: 'TX', postalCode: '78641', addressCountry: 'US' } };
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  let h = shell;
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  h = h.replace(/\s*<meta name="robots" content="noindex" \/>/, '');
  h = h.replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*/, `$1${desc}`);
  h = h.replace(/(<meta name="description" content=")[^"]*/, `$1${desc}`);
  h = h.replace('</title>', `</title>\n    <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n    <script type="application/ld+json">${JSON.stringify(ld)}</script>\n    <script type="application/ld+json">${JSON.stringify(faqLd)}</script>`);
  h = h.replace(/<style>[\s\S]*?<\/style>/, `<style>
      .townpage{background:#fff;color:#111}
      .tw-wrap{max-width:760px;margin:0 auto;padding:clamp(48px,9vw,104px) 20px}
      .tw-kicker{font-family:Archivo,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;color:#c51c11;margin:0 0 12px}
      .townpage h1{font-family:Archivo,sans-serif;font-weight:900;font-size:clamp(2.4rem,8vw,4rem);letter-spacing:-.035em;line-height:.95;margin:0 0 24px;text-transform:none}
      .tw-wrap p{font-size:clamp(1.05rem,2.5vw,1.2rem);line-height:1.65;margin:0 0 18px;max-width:60ch}
      .townpage h2{font-family:Archivo,sans-serif;font-weight:800;font-size:clamp(1.3rem,3.5vw,1.6rem);letter-spacing:-.01em;margin:34px 0 10px}
      .tw-faq details{border-top:1px solid #e8e8e8;padding:14px 0}
      .tw-faq details:last-child{border-bottom:1px solid #e8e8e8}
      .tw-faq summary{font-weight:700;cursor:pointer;font-size:1.05rem}
      .tw-faq details p{margin:10px 0 0}
      .tw-when{border-top:3px solid #111;padding-top:20px;margin-top:30px}
      .tw-cta{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center;margin-top:26px}
      .tw-cta .btn{display:inline-block;background:#c51c11;color:#fff;font-family:Archivo,sans-serif;font-weight:800;padding:14px 22px;border-radius:4px;text-decoration:none}
      .tw-cta a.tl{color:#111;font-weight:700;text-decoration-color:#c51c11;text-decoration-thickness:2px;text-underline-offset:5px}
    </style>`);
  h = h.replace(/<main[\s\S]*?<\/main>/, `<main class="townpage">
      <div class="tw-wrap">
        <p class="tw-kicker">Church near ${esc(t.town)}</p>
        <h1>${esc(t.head)}</h1>
        <p>${esc(t.intro)}</p>
        <p>It&rsquo;s a church for people who thought they&rsquo;d never step foot in one. Loud music, so nobody hears you sing. No crap coffee. A message from the Bible that makes sense even if you&rsquo;ve never opened one.</p>
        <h2>What Sunday looks like</h2>
        <p>Casual. Wear what you&rsquo;d wear on a Saturday. Grab a coffee and find a seat. A few songs, then a Bible teaching you can use on Tuesday. About 65 minutes. Nobody asks you to stand up, raise a hand, or introduce yourself.</p>
        <h2>If you have young kids</h2>
        <p>Bring them. Axiom Kids is birth through 5th grade, in three rooms: birth through 2, ages 3 to 5, and all of elementary together. Every volunteer is background checked. Your kid gets a name tag that matches yours, and nobody else can pick them up. Fill out Plan a Visit and they&rsquo;re pre-registered, so Sunday morning is one less step.</p>
        <h2>Questions people ask</h2>
        <div class="tw-faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
        <p class="tw-when"><b>Sundays at 10am.</b> Camacho Elementary, 501 Municipal Dr, Leander, TX 78641. ${esc(t.route)}</p>
        <div class="tw-cta">
          <a class="btn" href="visit.html">Plan a Visit</a>
          <a class="tl" href="messages.html">Watch a message first &rarr;</a>
        </div>
      </div>
    </main>`);
  fs.writeFileSync(path.join(root, `church-near-${t.slug}.html`), h);
}
const sp = path.join(root, 'sitemap.xml');
let sm = fs.readFileSync(sp, 'utf8').replace(/\s*<url>\s*<loc>https:\/\/www\.axiomchurch\.com\/church-near-[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
const today = new Date().toISOString().slice(0, 10);
sm = sm.replace('</urlset>', TOWNS.map((t) => `  <url>\n    <loc>${SITE}/church-near-${t.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.7</priority>\n  </url>\n`).join('') + '</urlset>');
fs.writeFileSync(sp, sm);
execFileSync('node', [path.join(__dirname, 'bake-chrome.js')], { stdio: 'inherit' });
console.log('built', TOWNS.length, 'town pages');
