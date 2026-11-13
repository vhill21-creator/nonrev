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
  if (origin !== new URL(request.url).origin) {
    return json({ error: 'Invalid request origin.' }, 403);
  }
  if (Number(request.headers.get('content-length') || 0) > 16000) {
    return json({ error: 'Message too large.' }, 413);
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'JSON is required.' }, 415);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: 'Message too large.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Invalid form data.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid form data.' }, 400);
  // A hidden field discourages automated spam.
  if (body.website) return json({ ok: true });
  const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const name = clean(body.name, 100);
  const email = clean(body.email, 160);
  const topic = clean(body.topic, 80);
  const message = clean(body.message, 5000);
  const allowed = new Set(['Music production', 'Music publishing', 'Artist development', 'Collaboration', 'Booking or event', 'General question', 'Music inquiry']);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !allowed.has(topic) || message.length < 10) {
    return json({ error: 'Please complete all required fields.' }, 400);
  }
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM || !env.CONTACT_TO) {
    return json({ error: 'Email service not configured. Please use the email link.' }, 503);
  }
  // Require server-verified Cloudflare Turnstile before sending outbound email.
  // Without a configured secret the form fails closed and the browser offers the mailto fallback.
  if (!env.TURNSTILE_SECRET) return json({ error: 'Spam protection is not configured.' }, 503);
  const token = clean(body['cf-turnstile-response'], 2048);
  if (!token) return json({ error: 'Please complete the security verification.' }, 403);
  try {
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET, response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || ''
      })
    });
    if (!verifyResponse.ok) return json({ error: 'Security verification unavailable.' }, 503);
    const verification = await verifyResponse.json();
    if (!verification.success || verification.hostname !== new URL(request.url).hostname) {
      return json({ error: 'Security verification failed.' }, 403);
    }
  } catch {
    return json({ error: 'Security verification unavailable.' }, 503);
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
