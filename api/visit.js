// /api/visit
// The Plan a Visit pop-up's server. One submit does three things:
//   1. Records a submission on the Planning Center "Plan a Visit" form (1302721), so
//      Planning Center does what it already does: matches or creates the person,
//      starts the New Here workflow card, and sends the form's emails.
//   2. Schedules a reminder email for Saturday morning before their Sunday (Resend).
//   3. If Planning Center refuses the submission, emails the details to the team
//      instead, so nobody who said they're coming gets lost.
//
//   POST /api/visit { sunday:'2026-11-08'|'', first, last, email, phone, kids, hp, ms }
//   GET  /api/visit?ics=2026-11-08     -> calendar file for that Sunday
//   GET  /api/visit?health=1           -> which settings are in place (no values)
//
// Settings in Vercel (Project > Settings > Environment Variables):
//   PCO_APP_ID, PCO_SECRET     a Planning Center Personal Access Token
//                              (api.planningcenteronline.com/oauth/applications).
//                              The person who makes it needs Editor in People and must
//                              be able to manage the Plan a Visit form.
//   RESEND_API_KEY             already set for the prayer wall
//   VISIT_FROM                 the reminder's sender, e.g. Axiom Church <hello@axiomchurch.com>.
//                              Must be on a domain verified in Resend. Until it's set,
//                              no reminders go out (Resend's test sender can't email visitors).
//   VISIT_ALERT_TO             optional, where the backup email goes. Defaults to prayer@axiomchurch.com.
//   VISIT_FORM_ID              optional, defaults to 1302721
//
// The pop-up also asks which Sunday and about kids. Those land in Planning Center only if the
// form has fields for them: a Date field with "Sunday" in its label, and a text field with
// "kid" or "child" in its label. Without them, the answers still go in the reminder and the
// backup email.

const FORM_ID = process.env.VISIT_FORM_ID || '1302721';
const APP_ID = process.env.PCO_APP_ID || '';
const SECRET = process.env.PCO_SECRET || '';
const RESEND = process.env.RESEND_API_KEY || '';
const FROM = process.env.VISIT_FROM || '';
const ALERT_TO = process.env.VISIT_ALERT_TO || 'prayer@axiomchurch.com';
const ALERT_FROM = FROM || 'Axiom Church <onboarding@resend.dev>';
const TZ = 'America/Chicago';
const PLACE = 'Camacho Elementary, 501 Municipal Dr, Leander, TX 78641';
const MAPS = 'https://www.google.com/maps/dir/?api=1&destination=501+Municipal+Dr%2C+Leander%2C+TX+78641';

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// "2026-11-08" -> Date for that day at hh:mm in Leander time
function centralTime(ymd, hh, mm) {
  const guess = new Date(`${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(guess).find((p) => p.type === 'timeZoneName').value; // "GMT-6"
  const h = parseInt(off.replace('GMT', ''), 10) || -6;
  return new Date(guess.getTime() - h * 3600 * 1000);
}
const prettyDay = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const validSunday = (ymd) => /^\d{4}-\d{2}-\d{2}$/.test(ymd) && new Date(`${ymd}T12:00:00Z`).getUTCDay() === 0;

async function pco(path, opts = {}) {
  const r = await fetch(`https://api.planningcenteronline.com${path}`, {
    ...opts,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${APP_ID}:${SECRET}`).toString('base64'),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (body.errors || []).map((e) => e.detail || e.title).join('; ') || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return body;
}

let fieldCache = null;
async function formFields() {
  if (fieldCache && fieldCache.at > Date.now() - 10 * 60 * 1000) return fieldCache.list;
  const b = await pco(`/people/v2/forms/${FORM_ID}/fields?per_page=100`);
  const list = (b.data || []).map((f) => ({ id: f.id, label: f.attributes.label || '', type: f.attributes.field_type, required: f.attributes.required }));
  fieldCache = { at: Date.now(), list };
  return list;
}

async function submitToPCO(v) {
  const fields = await formFields();
  const values = [];
  const phoneF = fields.find((f) => f.type === 'phone_number');
  if (phoneF && v.phone) values.push({ form_field_id: phoneF.id, value: { number: v.phone, location: 'Mobile' } });
  const dayF = fields.find((f) => /sunday|date|when/i.test(f.label) && /date/.test(f.type));
  if (dayF && v.sunday) values.push({ form_field_id: dayF.id, value: v.sunday });
  const kidsF = fields.find((f) => /kid|child/i.test(f.label) && /string|text/.test(f.type));
  if (kidsF && v.kids) values.push({ form_field_id: kidsF.id, value: v.kids });

  const body = {
    data: {
      type: 'FormSubmission',
      attributes: {
        person_attributes: {
          first_name: v.first,
          last_name: v.last,
          emails_attributes: [{ location: 'Home', address: v.email }],
        },
      },
    },
    included: values.map((x) => ({ type: 'FormSubmissionValue', attributes: x })),
  };
  return pco(`/people/v2/forms/${FORM_ID}/form_submissions`, { method: 'POST', body: JSON.stringify(body) });
}

async function resend(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Saturday 10am before their Sunday. Too late for that? Sunday 7:30am. Too late for that? Skip.
function reminderTime(ymd) {
  const sun = new Date(`${ymd}T12:00:00Z`);
  const sat = new Date(sun.getTime() - 864e5).toISOString().slice(0, 10);
  const soon = Date.now() + 15 * 60 * 1000;
  for (const t of [centralTime(sat, 10, 0), centralTime(ymd, 7, 30)]) if (t.getTime() > soon) return t;
  return null;
}

function reminderEmail(v, sameDay) {
  const p = (t) => `<p style="margin:0 0 14px">${t}</p>`;
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:520px">
${p(`Hey ${esc(v.first)},`)}
${p(`Just a heads-up: we'll see you ${sameDay ? 'this morning' : 'tomorrow'}. Sunday at 10:00 AM.`)}
${p(`<b>${esc(PLACE)}</b><br><a href="${MAPS}" style="color:#C51C11">Get directions</a>`)}
${p(`It's casual, so dress however you like. We'll have coffee ready if you want it.`)}
${p(`Someone will be out front to point you in the right direction. And if you make it inside without anyone stopping to say hi, find the New Here area. They'll take care of you.`)}
<p style="margin:0">See you soon,<br>Axiom Church</p></div>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const q = req.query || {};
    if (q.health) {
      return res.status(200).json({
        planningCenter: APP_ID && SECRET ? 'set' : 'missing',
        reminderSender: FROM ? 'set' : 'missing (no reminders until VISIT_FROM is set)',
        resend: RESEND ? 'set' : 'missing',
        formId: FORM_ID,
      });
    }
    if (q.ics && validSunday(String(q.ics))) {
      const ymd = String(q.ics);
      const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const start = centralTime(ymd, 10, 0);
      const end = new Date(start.getTime() + 75 * 60 * 1000);
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Axiom Church//Plan a Visit//EN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT', `UID:visit-${ymd}@axiomchurch.com`, `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, 'SUMMARY:Sunday at Axiom Church',
        `LOCATION:${PLACE.replace(/,/g, '\\,')}`, 'DESCRIPTION:Come as you are. Someone will be out front to say hi.',
        'URL:https://www.axiomchurch.com/visit.html',
        'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Church at 10', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR', '',
      ].join('\r\n');
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="axiom-sunday.ics"');
      return res.status(200).send(ics);
    }
    return res.status(400).json({ error: 'bad request' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  // Bots fill the hidden field and submit instantly. Pretend it worked.
  if (b.hp || (Number(b.ms) && Number(b.ms) < 2500)) return res.status(200).json({ ok: true });

  const v = {
    sunday: validSunday(String(b.sunday || '')) ? String(b.sunday) : '',
    first: clean(b.first, 60),
    last: clean(b.last, 60),
    email: clean(b.email, 120).toLowerCase(),
    phone: clean(b.phone, 30),
    kids: clean(b.kids, 300),
  };
  if (!v.first || !v.last || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) {
    return res.status(400).json({ error: 'Need a first name, last name and email.' });
  }

  let pcoOk = false, pcoErr = '';
  if (APP_ID && SECRET) {
    try { await submitToPCO(v); pcoOk = true; } catch (e) { pcoErr = e.message; console.error('pco:', e.message); }
  } else pcoErr = 'Planning Center keys are not set in Vercel.';

  let reminder = false;
  if (v.sunday && RESEND && FROM) {
    const at = reminderTime(v.sunday);
    if (at) {
      try {
        await resend({
          from: FROM, to: [v.email], subject: at.getUTCDay() === 0 ? 'See you this morning at Axiom' : 'See you tomorrow at Axiom',
          html: reminderEmail(v, at.getUTCDay() === 0), scheduled_at: at.toISOString(),
        });
        reminder = true;
      } catch (e) { console.error('reminder:', e.message); }
    }
  }

  // Planning Center didn't take it: email the team so someone still follows up.
  let backup = false;
  if (!pcoOk && RESEND) {
    try {
      await resend({
        from: ALERT_FROM, to: [ALERT_TO], subject: `Plan a Visit: ${v.first} ${v.last}`,
        html: `<p>Someone planned a visit, but it didn't make it into Planning Center. Please add them by hand.</p>
<p><b>${esc(v.first)} ${esc(v.last)}</b><br>${esc(v.email)}${v.phone ? '<br>' + esc(v.phone) : ''}<br>
Sunday: ${v.sunday ? esc(prettyDay(v.sunday)) : 'Not sure yet'}<br>Kids: ${esc(v.kids || 'None')}</p>
<p style="color:#888">Planning Center said: ${esc(pcoErr)}</p>`,
      });
      backup = true;
    } catch (e) { console.error('backup:', e.message); }
  }

  if (!pcoOk && !backup) return res.status(502).json({ error: 'Could not save. Please try the other form.' });
  return res.status(200).json({ ok: true, reminder });
};
