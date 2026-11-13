// Cloudflare Pages Function. Configure RESEND_API_KEY, CONTACT_FROM and CONTACT_TO
// as encrypted environment variables in Cloudflare Pages before using web delivery.
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'Invalid request origin.' }, 403);
  }
  if (Number(request.headers.get('content-length') || 0) > 16000) {
    return json({ error: 'Message too large.' }, 413);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid form data.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid form data.' }, 400);
  // A hidden field discourages automated spam.
  if (body.website) return json({ ok: true });
  const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const name = clean(body.name, 100);
  const email = clean(body.email, 160);
  const topic = clean(body.topic, 80);
  const message = clean(body.message, 5000);
  const allowed = new Set(['Music inquiry', 'Collaboration', 'Booking or event', 'General question']);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !allowed.has(topic) || message.length < 10) {
    return json({ error: 'Please complete all required fields.' }, 400);
  }
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM || !env.CONTACT_TO) {
    return json({ error: 'Email service not configured. Please use the email link.' }, 503);
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: email,
        subject: 'Nonrev website: ' + topic,
        text: `From: ${name} <${email}>\nTopic: ${topic}\n\n${message}`
      })
    });
    if (!response.ok) return json({ error: 'Unable to send your message right now.' }, 502);
    return json({ ok: true });
  } catch {
    return json({ error: 'Unable to send your message right now.' }, 502);
  }
}
