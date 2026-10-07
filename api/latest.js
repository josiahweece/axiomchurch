// /api/latest
// The newest video on the Axiom YouTube channel, from the channel's public
// feed (no key needed): { id, title, published }. Vercel caches it for an
// hour. The home screen app uses it for the "Watch this week's message" card.

const CHANNEL = 'UCpioqNfyWu7BqiqG4RqcRfA';

module.exports = async (req, res) => {
  try {
    const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL);
    if (!r.ok) throw new Error('feed answered ' + r.status);
    const xml = await r.text();
    const entry = xml.split('<entry>')[1] || '';
    const pick = (re) => { const m = entry.match(re); return m ? m[1] : ''; };
    const id = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = pick(/<title>([^<]*)<\/title>/)
      .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const published = pick(/<published>([^<]+)<\/published>/);
    if (!id) throw new Error('no video in feed');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ id, title, published });
  } catch (e) {
    console.error('latest:', e.message);
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({ id: null });
  }
};
