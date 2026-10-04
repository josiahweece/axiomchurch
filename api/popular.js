// /api/popular
// Returns this channel's most watched full-length videos as JSON:
//   { "videos": [ { "id": "...", "title": "...", "date": "..." }, ... ] }
// The YouTube key lives in the Vercel environment variable YOUTUBE_API_KEY.
// It is never sent to the browser. Vercel caches the answer for a day, so
// YouTube is asked about once a day no matter how many people visit.

const CHANNEL_ID = 'UCpioqNfyWu7BqiqG4RqcRfA';
const HOW_MANY = 12;

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ error: 'not configured' });
    return;
  }
  try {
    const url =
      'https://www.googleapis.com/youtube/v3/search' +
      '?part=snippet&type=video&order=viewCount&videoDuration=long' +
      '&maxResults=' + HOW_MANY +
      '&channelId=' + CHANNEL_ID +
      '&key=' + encodeURIComponent(key);
    const r = await fetch(url);
    if (!r.ok) throw new Error('YouTube answered ' + r.status);
    const data = await r.json();
    const videos = (data.items || [])
      .filter((i) => i && i.id && i.id.videoId && i.snippet)
      .map((i) => ({
        id: i.id.videoId,
        title: decode(i.snippet.title),
        date: i.snippet.publishedAt || null,
      }));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ videos });
  } catch (err) {
    console.error('popular:', err && err.message);
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(502).json({ error: 'unavailable' });
  }
};
