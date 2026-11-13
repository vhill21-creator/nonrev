// Cloudflare Workers entrypoint.
// Serve the HTML pages from ./public, and handle /api/contact using the
// existing validated email handler shared with the Pages deployment format.
import { onRequestPost } from '../functions/api/contact.js';

const json = (value, status, extra = {}) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  }
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') {
        return json({ error: 'Use POST to submit the contact form.' }, 405, {
          Allow: 'POST'
        });
      }
      return onRequestPost({ request, env, ctx });
    }

    // The binding handles the seven HTML pages, CSS, JS, robots.txt, and 404.
    // Normal requests for existing static assets bypass this Worker script.
    return env.ASSETS.fetch(request);
  }
};
