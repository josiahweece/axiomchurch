// /api/steps
// Finds the next upcoming Rally Point, Base Camp, Rooted and baptism on the church's
// Church Center events page and returns a sign-up link for each:
//   { "steps": { "rally": { "url": "...", "name": "...", "starts_at": "..." } | null,
//                "base":  { ... } | null, "rooted": { ... } | null, "baptism": { ... } | null } }
// No key is needed: Church Center hands any visitor a short-lived guest
// token, the same one its own events page uses. Vercel caches the answer for
// an hour, so Church Center is asked about once an hour however many people
// visit. If anything fails the page keeps its built-in fallback links.

const SITE = 'https://axiomchurch.churchcenter.com';
const API = 'https://api.churchcenter.com/registrations/v2/events';
const WANT = { rally: /rally\s*point/i, base: /base\s*camp/i, rooted: /rooted/i, baptism: /baptis/i };

module.exports = async (req, res) => {
  try {
    const t = await fetch(SITE + '/sessions/tokens', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    if (!t.ok) throw new Error('token answered ' + t.status);
    const tj = await t.json();
    const token = tj && tj.data && tj.data.attributes && tj.data.attributes.token;
    if (!token) throw new Error('no token in answer');

    const url =
      API +
      '?order=starts_at&filter=unarchived,published' +
      '&fields[Event]=name,starts_at,ends_at,registration_state&per_page=100';
    const r = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
    });
    if (!r.ok) throw new Error('events answered ' + r.status);
    const data = await r.json();

    const now = Date.now();
    const upcoming = (data.data || [])
      .filter((e) => e && /^\d+$/.test(String(e.id)) && e.attributes && e.attributes.name)
      .filter((e) => {
        const end = Date.parse(e.attributes.ends_at || e.attributes.starts_at || '');
        return !end || end > now; // keep events with no date, drop ones already over
      })
      .filter((e) => !e.attributes.registration_state || e.attributes.registration_state === 'open')
      .sort((a, b) => (Date.parse(a.attributes.starts_at || '') || 0) - (Date.parse(b.attributes.starts_at || '') || 0));

    const steps = {};
    Object.keys(WANT).forEach((k) => {
      const e = upcoming.find((x) => WANT[k].test(x.attributes.name));
      steps[k] = e
        ? {
            url: SITE + '/registrations/events/' + e.id,
            name: String(e.attributes.name),
            starts_at: e.attributes.starts_at || null,
          }
        : null;
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ steps });
  } catch (err) {
    console.error('steps:', err && err.message);
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(502).json({ error: 'unavailable' });
  }
};
