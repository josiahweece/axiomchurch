// /api/prayer
// The prayer wall's server. Requests, prayed counts and answered marks live in
// an Upstash Redis database. Nothing goes on the public wall until someone on
// the prayer team approves it at /prayer-team.
//
// Visitors:
//   GET  /api/prayer                          -> { posts: [...] } approved requests, newest first
//   POST /api/prayer { action:'submit', name, text, private, email }
//   POST /api/prayer { action:'pray', id, undo }
// Prayer team (signed in with the shared password):
//   POST /api/prayer { action:'login', password } / { action:'logout' }
//   GET  /api/prayer?team=1                   -> { pending, private, live, handled }
//   POST /api/prayer { action:'approve'|'decline'|'answer'|'unanswer'|'remove'|'handled', id }
//
// Settings in Vercel (Project > Settings > Environment Variables):
//   PrayerTeam_REDIS_URL                added for you when you connected Redis in Vercel
//                                       (REDIS_URL, or Upstash's KV_REST_API_URL + _TOKEN, also work)
//   PRAYER_TEAM_PASSWORD                the shared password for /prayer-team
//   RESEND_API_KEY                      sends the new-request email
//   PRAYER_ALERT_TO                     optional, defaults to prayer@axiomchurch.com
//   PRAYER_ALERT_FROM                   optional, a sender on a domain verified in Resend

const crypto = require('crypto');

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD = process.env.PRAYER_TEAM_PASSWORD || '';
const ALERT_TO = process.env.PRAYER_ALERT_TO || 'prayer@axiomchurch.com';
const ALERT_FROM = process.env.PRAYER_ALERT_FROM || 'Axiom Prayer <onboarding@resend.dev>';
const COOKIE = 'axiom_prayer_team';
const THIRTY_DAYS = 30 * 24 * 3600;
const LISTS = { pending: 'prayer:pending', private: 'prayer:private', live: 'prayer:live', handled: 'prayer:handled' };

// Vercel's Redis add-on hands over one connection address (it shows up as
// PrayerTeam_REDIS_URL or REDIS_URL). Upstash hands over a REST address and a
// token instead. Either one works.
const REDIS_URL = process.env.PrayerTeam_REDIS_URL || process.env.REDIS_URL;
let redisClient = null;
async function tcp() {
  if (redisClient && redisClient.isOpen) return redisClient;
  const { createClient } = require('redis');
  redisClient = createClient({ url: REDIS_URL, socket: { connectTimeout: 5000 } });
  redisClient.on('error', (e) => console.error('redis:', e.message));
  await redisClient.connect();
  return redisClient;
}

async function db(commands) {
  if (!(DB_URL && DB_TOKEN) && REDIS_URL) {
    const c = await tcp();
    return Promise.all(commands.map((cmd) => c.sendCommand(cmd.map(String))));
  }
  if (!DB_URL || !DB_TOKEN) throw Object.assign(new Error('The prayer database is not connected yet.'), { code: 503 });
  const r = await fetch(DB_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + DB_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('database answered ' + r.status);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

const pairs = (arr) => {
  const o = {};
  for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
};

async function readList(key, limit, withEmail) {
  const [ids] = await db([['ZREVRANGE', key, '0', String(limit - 1)]]);
  if (!ids || !ids.length) return [];
  const rows = await db(ids.map((id) => ['HGETALL', 'prayer:' + id]));
  return rows
    .map((r, i) => {
      const p = pairs(r);
      if (!p.text) return null;
      const post = {
        id: ids[i],
        name: p.name || '',
        text: p.text,
        t: Number(p.t) || 0,
        prayed: Math.max(0, Number(p.prayed) || 0),
        answered: p.answered === '1',
      };
      if (withEmail && p.email) post.email = p.email;
      return post;
    })
    .filter(Boolean);
}

function sign(exp) {
  return crypto.createHmac('sha256', 'prayer-team:' + PASSWORD).update(String(exp)).digest('hex');
}
function isTeam(req) {
  if (!PASSWORD) return false;
  const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return false;
  const [exp, mac] = decodeURIComponent(m[1]).split('.');
  if (!exp || !mac || Number(exp) < Date.now() / 1000) return false;
  const good = sign(exp);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
}
function samePassword(given) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return PASSWORD.length > 0 && crypto.timingSafeEqual(a, b);
}

async function limited(req, kind, max) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = 'rl:' + kind + ':' + ip;
  const [n] = await db([['INCR', key]]);
  if (n === 1) await db([['EXPIRE', key, '3600']]);
  return n > max;
}

async function alert(post, isPrivate) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const lines = [
    isPrivate ? 'A private request came in. It is only for the prayer team and will not be posted.' : 'A new request is waiting for review.',
    '',
    'From: ' + (post.name || 'Anonymous'),
    post.email ? 'Wants follow-up: ' + post.email : 'No follow-up requested.',
    '',
    post.text,
    '',
    'Review it: https://' + (process.env.VERCEL_PROJECT_PRODUCTION_URL || 'axiomchurch-lac.vercel.app') + '/prayer-team.html',
  ];
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: [ALERT_TO],
        subject: isPrivate ? 'Private prayer request' : 'New prayer request to review',
        text: lines.join('\n'),
      }),
    });
  } catch (e) {
    console.error('prayer alert email failed:', e.message);
  }
}

const clean = (s, max) => String(s || '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if (req.query && req.query.team) {
        if (!isTeam(req)) return res.status(401).json({ error: 'Sign in first.' });
        const [pending, priv, live, handled] = await Promise.all([
          readList(LISTS.pending, 200, true),
          readList(LISTS.private, 200, true),
          readList(LISTS.live, 300, true),
          readList(LISTS.handled, 50, true),
        ]);
        return res.status(200).json({ pending, private: priv, live, handled });
      }
      return res.status(200).json({ posts: await readList(LISTS.live, 150, false) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Not allowed.' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const id = /^\d+$/.test(String(b.id || '')) ? String(b.id) : null;

    if (b.action === 'submit') {
      if (b.website) return res.status(200).json({ ok: true }); // a bot filled the hidden field
      const text = clean(b.text, 500);
      if (text.length < 3) return res.status(400).json({ error: 'Tell us what to pray for first.' });
      const email = clean(b.email, 120);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "That email doesn't look right. Fix it or leave it blank." });
      if (await limited(req, 'submit', 6)) return res.status(429).json({ error: 'Too many requests from here in the last hour. Try again later.' });
      const isPrivate = !!b.private;
      const post = { name: clean(b.name, 30), text, email, t: Date.now() };
      const [n] = await db([['INCR', 'prayer:nextid']]);
      await db([
        ['HSET', 'prayer:' + n, 'name', post.name, 'text', post.text, 'email', post.email, 't', String(post.t), 'prayed', '0', 'answered', '0'],
        ['ZADD', isPrivate ? LISTS.private : LISTS.pending, String(post.t), String(n)],
      ]);
      await alert(post, isPrivate);
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'pray') {
      if (!id) return res.status(400).json({ error: 'Missing request.' });
      const [score] = await db([['ZSCORE', LISTS.live, id]]);
      if (score === null) return res.status(404).json({ error: 'That request is no longer on the wall.' });
      if (await limited(req, 'pray', 120)) return res.status(429).json({ error: 'Slow down a little.' });
      const [n] = await db([['HINCRBY', 'prayer:' + id, 'prayed', b.undo ? '-1' : '1']]);
      if (n < 0) await db([['HSET', 'prayer:' + id, 'prayed', '0']]);
      return res.status(200).json({ prayed: Math.max(0, n) });
    }

    if (b.action === 'login') {
      if (!PASSWORD) return res.status(503).json({ error: 'The prayer team password has not been set in Vercel yet.' });
      if (await limited(req, 'login', 10)) return res.status(429).json({ error: 'Too many tries. Wait an hour and try again.' });
      if (!samePassword(b.password)) return res.status(401).json({ error: "That password isn't right." });
      const exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS;
      res.setHeader('Set-Cookie', `${COOKIE}=${exp}.${sign(exp)}; Path=/; Max-Age=${THIRTY_DAYS}; HttpOnly; Secure; SameSite=Lax`);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'logout') {
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      return res.status(200).json({ ok: true });
    }

    if (!isTeam(req)) return res.status(401).json({ error: 'Sign in first.' });
    if (!id) return res.status(400).json({ error: 'Missing request.' });
    const key = 'prayer:' + id;
    const move = (from, to) => [['ZREM', from, id], ['ZADD', to, String(Date.now()), id]];
    switch (b.action) {
      case 'approve':
        await db([...move(LISTS.pending, LISTS.live), ['HSET', key, 't', String(Date.now())]]);
        break;
      case 'answer':
        await db([['HSET', key, 'answered', '1']]);
        break;
      case 'unanswer':
        await db([['HSET', key, 'answered', '0']]);
        break;
      case 'handled':
        await db(move(LISTS.private, LISTS.handled));
        break;
      case 'decline':
      case 'remove':
        await db([['ZREM', LISTS.pending, id], ['ZREM', LISTS.live, id], ['ZREM', LISTS.private, id], ['DEL', key]]);
        break;
      default:
        return res.status(400).json({ error: 'Unknown action.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('prayer:', e.message);
    return res.status(e.code || 500).json({ error: e.code === 503 ? e.message : 'Something went wrong. Try again in a minute.' });
  }
};
