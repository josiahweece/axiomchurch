// /recent-messages (rewritten to /api/recent-messages in vercel.json)
// A plain, readable page of the latest Sunday messages: title, series, speaker,
// date and the YouTube description for each. It is built on the server from
// YouTube's public feed (no key needed), so search engines and AI tools that
// don't run JavaScript can still read what Axiom teaches. New sermons show up
// on their own; Vercel caches the page for an hour.

const CHANNEL = 'UCpioqNfyWu7BqiqG4RqcRfA';
const FEEDS = [
  'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + CHANNEL.slice(2),
  'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL,
];
const SITE = 'https://www.axiomchurch.com';

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'to', 'for', 'on', 'is', 'at', 'or']);
const titleCase = (s) => s.toLowerCase().split(' ').map((w, i) => (i && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const tidy = (s) => (s === s.toUpperCase() ? titleCase(s) : s);

function parse(xml) {
  return xml.split('<entry>').slice(1).map((e) => {
    const pick = (re) => { const m = e.match(re); return m ? decode(m[1]) : ''; };
    const id = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = pick(/<title>([^<]*)<\/title>/);
    const published = pick(/<published>([^<]+)<\/published>/);
    const description = pick(/<media:description>([\s\S]*?)<\/media:description>/).trim();
    const parts = title.split('//').map((p) => p.trim()).filter(Boolean);
    const speaker = parts.length > 1 ? tidy(parts[parts.length - 1]) : '';
    const middle = parts.length > 2 ? parts.slice(1, -1) : [];
    const part = middle.find((p) => /^(pt|part|week)\.?\s*\d/i.test(p) || /week \d/i.test(p)) || '';
    const rest = middle.filter((p) => p !== part);
    const name = tidy(rest.length ? rest.join(' · ') : parts[0] || title);
    const series = rest.length ? tidy(parts[0]) + (part ? ', ' + part.replace(/^pt\.?\s*/i, 'Pt. ').replace(/\.$/, '') : '') : (part ? part : '');
    return { id, title, name, series, speaker, published, description };
  }).filter((v) => v.id && v.description);
}

async function load() {
  for (const url of FEEDS) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('feed answered ' + r.status);
      const list = parse(await r.text());
      if (list.length) return list;
    } catch (e) {
      console.error('recent-messages:', e.message);
    }
  }
  return [];
}

function page(list) {
  const day = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' });
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Recent messages from Axiom Church',
    itemListElement: list.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'VideoObject',
        name: v.title,
        description: v.description,
        uploadDate: v.published,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        publisher: { '@type': 'Church', name: 'Axiom Church', url: SITE + '/' },
      },
    })),
  };
  const items = list.map((v) => `
        <article class="rm-item" id="m-${esc(v.id)}">
          <p class="rm-meta">${esc(day(v.published))}${v.series ? ' · ' + esc(v.series) : ''}${v.speaker ? ' · ' + esc(v.speaker) : ''}</p>
          <h2>${esc(v.name)}</h2>
          <p>${esc(v.description)}</p>
          <a class="textlink" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">Watch it &rarr;</a>
        </article>`).join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-1PBV7QDMYQ"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-1PBV7QDMYQ');
    </script>
    <title>Recent Messages | Axiom Church</title>
    <meta name="description" content="What Axiom Church in Leander, TX has been teaching lately. Each Sunday message, in a few paragraphs, with a link to watch." />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
    <meta name="theme-color" content="#101010" />
    <meta property="og:site_name" content="Axiom Church" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Recent Messages | Axiom Church" />
    <meta property="og:description" content="What Axiom Church in Leander, TX has been teaching lately." />
    <meta property="og:image" content="${SITE}/assets/images/share.jpg" />
    <meta property="og:url" content="${SITE}/recent-messages" />
    <link rel="canonical" href="${SITE}/recent-messages" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/css/style.css" />
    <style>
      .rm { max-width: 760px; padding-top: 40px; padding-bottom: 64px; }
      .rm-item { padding: 28px 0; border-top: 1px solid rgba(255,255,255,.12); }
      .rm-item h2 { margin: 6px 0 12px; }
      .rm-item p { line-height: 1.6; }
      .rm-meta { font-size: 14px; opacity: .7; margin: 0; }
    </style>
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
  </head>
  <body>
    <div data-header></div>
    <main class="msgpage">
      <section class="rm wrap">
        <p class="m-kicker">Messages</p>
        <h1>What we've been talking about.</h1>
        <p class="lede">Every Sunday at 10am at Camacho Elementary in Leander. Here's the latest, in a few paragraphs each.</p>
        ${items || '<p>Messages are loading. <a class="textlink" href="/messages.html">Watch the latest &rarr;</a></p>'}
        <p style="margin-top:32px"><a class="btn" href="/visit.html">Plan a Visit</a> &nbsp; <a class="textlink" href="/messages.html">Watch the latest &rarr;</a></p>
      </section>
    </main>
    <div data-footer></div>
    <script src="/js/main.js"></script>
  </body>
</html>`;
}

module.exports = async (req, res) => {
  const list = await load();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', list.length ? 's-maxage=3600, stale-while-revalidate=86400' : 's-maxage=60');
  res.status(200).send(page(list));
};
