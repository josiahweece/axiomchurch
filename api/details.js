// /api/details?ids=ID1,ID2
// Title, publish date and full YouTube description for each video id, so the
// Messages page can unfold "what this message is about" under a + button.
//   { "videos": { "<id>": { "title": "...", "date": "...", "description": "..." } } }
// Uses the YouTube Data API key in YOUTUBE_API_KEY (never sent to the browser).
// Falls back to the channel's public feed (recent videos only) if the key is
// missing or YouTube refuses. Vercel caches each answer for a day.

const CHANNEL = 'UCpioqNfyWu7BqiqG4RqcRfA';
const FEED = 'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + CHANNEL.slice(2);

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function fromApi(ids, key) {
  const url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50&id=' +
    ids.map(encodeURIComponent).join(',') + '&key=' + encodeURIComponent(key);
  const r = await fetch(url);
  if (!r.ok) throw new Error('YouTube answered ' + r.status);
  const data = await r.json();
  const out = {};
  (data.items || []).forEach((i) => {
    if (!i || !i.id || !i.snippet) return;
    out[i.id] = { title: i.snippet.title || '', date: i.snippet.publishedAt || '', description: i.snippet.description || '' };
  });
  return out;
}

async function fromFeed(ids) {
  const r = await fetch(FEED);
  if (!r.ok) throw new Error('feed answered ' + r.status);
  const xml = await r.text();
  const out = {};
  xml.split('<entry>').slice(1).forEach((e) => {
    const pick = (re) => { const m = e.match(re); return m ? decode(m[1]) : ''; };
    const id = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!ids.includes(id)) return;
    out[id] = {
      title: pick(/<title>([^<]*)<\/title>/),
      date: pick(/<published>([^<]+)<\/published>/),
      description: pick(/<media:description>([\s\S]*?)<\/media:description>/).trim(),
    };
  });
  return out;
}

module.exports = async (req, res) => {
  const raw = String((req.query && req.query.ids) || '');
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => /^[\w-]{6,20}$/.test(s)))].slice(0, 50);
  if (!ids.length) { res.status(400).json({ error: 'ids required' }); return; }
  let videos = {};
  const key = process.env.YOUTUBE_API_KEY;
  try {
    if (key) videos = await fromApi(ids, key);
  } catch (e) {
    console.error('details:', e.message);
  }
  if (Object.keys(videos).length < ids.length) {
    try {
      const more = await fromFeed(ids.filter((id) => !videos[id]));
      videos = { ...more, ...videos };
    } catch (e) {
      console.error('details feed:', e.message);
    }
  }
  res.setHeader('Cache-Control', Object.keys(videos).length ? 's-maxage=86400, stale-while-revalidate=604800' : 's-maxage=60');
  res.status(200).json({ videos });
};
