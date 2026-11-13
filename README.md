# Nonrev Christian Music

A responsive seven page website, configured for Cloudflare Workers with static assets and a server contact endpoint. The project is suitable for automatic deployments from GitHub to the existing `nonrev` Worker.

Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for the GitHub upload, Cloudflare configuration, troubleshooting, domain connection, and contact email setup.

## Site structure

- `public/` contains the seven pages, styles, JavaScript, media references, and 404 page.
- `wrangler.jsonc` tells Cloudflare where the static pages are.
- `src/worker.js` is the Worker entrypoint that serves the website and handles the contact API.
- `functions/api/contact.js` validates form input and sends email through Resend when configured. This handler is shared with a possible Pages deployment.
- `tests/` contains code checks and API simulations that do not send real email.

## Deploy

From the repository root, run `npx wrangler deploy`. GitHub connected Cloudflare Workers Builds can run that automatically.

Run local checks: `npm test` (requires Node.js 20 or later).

The source assets are referenced from the connected Wix media library. This is a custom reimplementation, not an exact export of the unverified Wix `/nonrevcreate` site.
