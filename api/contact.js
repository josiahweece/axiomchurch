// /api/contact
// Sends the contact form to Josiah by email through Resend. The visitor's
// address goes in Reply-To, so hitting Reply in the inbox writes back to them.
//
// Settings in Vercel (Project > Settings > Environment Variables):
//   RESEND_API_KEY     the same key the prayer wall uses
//   CONTACT_TO         optional, defaults to josiah.weece@axiomchurch.com
//   CONTACT_FROM       optional, a sender on a domain verified in Resend
//                      (falls back to PRAYER_ALERT_FROM, then Resend's test sender)

const TO = process.env.CONTACT_TO || 'josiah.weece@axiomchurch.com';
const FROM = process.env.CONTACT_FROM || process.env.PRAYER_ALERT_FROM || 'Axiom Church <onboarding@resend.dev>';
const clean = (s, max) => String(s || '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
const recent = new Map(); // light per-instance throttle; Resend's own limits back it up

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Not allowed.' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (b.website) return res.status(200).json({ ok: true }); // a bot filled the hidden field
    const name = clean(b.name, 80), email = clean(b.email, 120), phone = clean(b.phone, 30);
    const message = String(b.message || '').replace(/\r/g, '').trim().slice(0, 4000);
    if (!name) return res.status(400).json({ error: 'Add your name.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Add an email we can write back to.' });
    if (message.length < 2) return res.status(400).json({ error: 'Write a message first.' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const now = Date.now(), hits = (recent.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= 5) return res.status(429).json({ error: 'Too many messages from here in the last hour. Try again later.' });
    recent.set(ip, hits.concat(now));

    const key = process.env.RESEND_API_KEY;
    if (!key) return res.status(503).json({ error: "The contact form isn't connected yet. Email josiah.weece@axiomchurch.com." });
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: 'Website message from ' + name,
        text: ['From: ' + name, 'Email: ' + email, phone ? 'Phone: ' + phone : null, '', message].filter((x) => x !== null).join('\n'),
      }),
    });
    if (!r.ok) {
      console.error('contact: resend answered', r.status, await r.text());
      return res.status(502).json({ error: "That didn't send. Email josiah.weece@axiomchurch.com instead." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('contact:', e.message);
    return res.status(500).json({ error: 'Something went wrong. Try again in a minute.' });
  }
};
