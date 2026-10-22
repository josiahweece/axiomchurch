// /api/events
// The next few upcoming events on the church's Church Center events page, for the
// "This week at Axiom" block on the home page:
//   { "events": [ { "name": "...", "starts_at": "...", "url": "..." }, ... ] }
// Same guest-token approach as /api/steps (no key needed). Vercel caches the
// answer for an hour. If anything fails the page keeps its built-in link.

const SITE = 'https://axiomchurch.churchcenter.com';
const API = 'https://api.churchcenter.com/registrations/v2/events';

module.exports = async (req, res) => {
  try {
    const t = await fetch(SITE + '/sessions/tokens', { method: 'POST', headers: { Accept: 'application/json' } });
    if (!t.ok) throw new Error('token answered ' + t.status);
    const tj = await t.json();
    const token = tj && tj.data && tj.data.attributes && tj.data.attributes.token;
    if (!token) throw new Error('no token in answer');

    const r = await fetch(
      API + '?order=starts_at&filter=unarchived,published&fields[Event]=name,starts_at,ends_at,registration_state&per_page=100',
      { headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } },
    );
    if (!r.ok) throw new Error('events answered ' + r.status);
    const data = await r.json();

    const now = Date.now();
    const events = (data.data || [])
      .filter((e) => e && /^\d+$/.test(String(e.id)) && e.attributes && e.attributes.name && e.attributes.starts_at)
      .filter((e) => Date.parse(e.attributes.ends_at || e.attributes.starts_at) > now)
      .filter((e) => !e.attributes.registration_state || e.attributes.registration_state === 'open')
      .sort((a, b) => Date.parse(a.attributes.starts_at) - Date.parse(b.attributes.starts_at))
      .slice(0, 3)
      .map((e) => ({ name: String(e.attributes.name), starts_at: e.attributes.starts_at, url: SITE + '/registrations/events/' + e.id }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ events });
  } catch (err) {
    console.error('events:', err && err.message);
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(502).json({ error: 'unavailable' });
  }
};
