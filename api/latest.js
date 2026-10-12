// /api/latest
// The newest full-length video on the Axiom YouTube channel, from YouTube's
// public feed (no key needed): { id, title, published }. It reads the
// "long-form uploads" list first, so a Short never shows up as the message,
// and falls back to the plain channel feed. Vercel caches the answer for five
// minutes, so a new sermon shows up within minutes of being posted.
// Used by the home screen app's message card and the Messages page player.

const CHANNEL = 'UCpioqNfyWu7BqiqG4RqcRfA';
const FEEDS = [
  'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + CHANNEL.slice(2),
  'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL,
];

async function newest(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('feed answered ' + r.status);
  const xml = await r.text();
  const entry = xml.split('<entry>')[1] || '';
  const pick = (re) => { const m = entry.match(re); return m ? m[1] : ''; };
  const id = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
  const title = pick(/<title>([^<]*)<\/title>/)
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const published = pick(/<published>([^<]+)<\/published>/);
  if (!id) throw new Error('no video in feed');
  return { id, title, published };
}

module.exports = async (req, res) => {
  for (const url of FEEDS) {
    try {
      const v = await newest(url);
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(v);
    } catch (e) {
      console.error('latest:', e.message);
    }
  }
  res.setHeader('Cache-Control', 's-maxage=60');
  return res.status(200).json({ id: null });
};
