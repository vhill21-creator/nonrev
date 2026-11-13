# Nonrev Christian Music: Security audit and content editor setup

This document describes the code review performed November 13, 2026 and the remaining administrator setup required. It does not represent a penetration test, malware scan of every visitor device, or a guarantee that attacks are impossible.

## Verified source: github.com/vhill21-creator/nonrev

This is a Cloudflare Worker using static assets. It is not a separate Cloudflare Pages project.

### Corrections already made
1. Repaired server-side contact topic validation for Music production, Music publishing, Artist development, Collaboration, Booking or event, and General question.
2. Required the same Origin on contact form requests, checked JSON content type, and enforced request limits.
3. Added security headers, including a Content Security Policy, anti-clickjacking rules, no-sniff, a restrictive referrer policy, and HSTS with a conservative initial lifetime.
4. Added server-side Cloudflare Turnstile validation before the Worker is permitted to send any email through Resend. If email or Turnstile is not configured, the public form falls back to the visitor's email program.
5. Checked that linked external sites using target=_blank have rel=noopener, and did not find insecure HTTP image/script URLs or inline scripts in the eight HTML pages.
6. Built a content editor that is closed by default and uses Cloudflare Access RS256 JWT verification, allowed editor emails, a KV namespace, an origin check, and a tight list of editable fields.
7. Rendered edited text using textContent rather than innerHTML. Image overrides are limited to https://static.wixstatic.com/media URLs. YouTube overrides accept only 11-character IDs.
8. Added GitHub Actions checks that test the site and parse all changed JavaScript.

### Remaining configuration to complete yourself in Cloudflare
No Cloudflare administrative credentials or namespace IDs are present in the repository. Do not put secrets in GitHub or chat.

1. Open Cloudflare dashboard, select Workers & Pages > nonrev > Settings > Bindings. Create a Workers KV namespace called nonrev-site-content, and bind it with variable name **SITE_CONTENT**.
2. For long-term stability across future Wrangler deployments, find the real KV namespace ID in Cloudflare and add the following object to wrangler.jsonc at top level, using your actual ID: "kv_namespaces": [{"binding": "SITE_CONTENT", "id": "YOUR_REAL_NAMESPACE_ID"}]. Never commit a fabricated ID. Wrangler is the source of truth for bindings; dashboard-only bindings can be overwritten by future deployments.
3. Enable Cloudflare Zero Trust if it is not already enabled. Under Zero Trust > Access > Applications, create a self-hosted application to protect both https://nonrevchristianmusic.com/admin and https://nonrevchristianmusic.com/api/admin/* (the exact path configuration may use two application entries). Permit only your intended editor email. Verify that the protection also covers any alternative hostname you publish; the Worker separately checks signed tokens so other hostnames cannot bypass authorization.
4. Copy the Cloudflare Access application Audience (AUD) tag and your Zero Trust team domain, for example YOURTEAM.cloudflareaccess.com.
5. Open Worker Settings > Variables and Secrets. Configure these names:
   * CF_ACCESS_TEAM_DOMAIN: your actual team domain, such as YOURTEAM.cloudflareaccess.com
   * CF_ACCESS_AUD: the Audience tag for the Access application
   * EDITOR_EMAILS: comma-separated approved editor email addresses
   * RESEND_API_KEY, CONTACT_FROM, CONTACT_TO: only if sending contact form messages using Resend
   * TURNSTILE_SECRET: private Cloudflare Turnstile secret
   * TURNSTILE_SITE_KEY: public Cloudflare Turnstile site key
6. Use an actual Cloudflare Turnstile widget scoped to nonrevchristianmusic.com. The client widget loads automatically after TURNSTILE_SITE_KEY is configured. Server-side validation is mandatory for any email submission to be sent.
7. After deploying the variables and KV binding, visit https://nonrevchristianmusic.com/admin while signed in through Cloudflare Access. Your admin email must match EDITOR_EMAILS.
8. Test invalid users and anonymous access: both /admin and /api/admin/content must reject them. Verify an approved editor can save one short text correction and it appears on the public website shortly after, then restore it.
9. Avoid setting the entire Worker behind Access because the public site must remain accessible without login. Protect only the private editor routes.
10. Verify the Worker custom domain, HTTPS, redirect from www, DNS email records, and Cloudflare WAF security rules.

## Free-plan operation

Cloudflare Workers Free allows 100,000 Worker requests per day (requests for static assets generally avoid invoking the Worker). Workers KV Free includes 100,000 reads and 1,000 writes per day, subject to current published limits. The public content API uses 30-second browser caching. Make sure you monitor usage and avoid enabling high-frequency automated content refreshes.

Cloudflare Access and Turnstile have free options, but verify your account's eligibility and configured plan before enabling them. No subscriptions have been started by this code.

## Editable content

The editor supports these types of changes: home introduction; about mission; God of Wonders description and official Wix media cover URL; Otisia Hill biography and official Wix media portrait URL; featured video title, description, and YouTube ID; contact introduction.

For image changes, upload the approved image to your own Wix Media Manager and paste its https://static.wixstatic.com/media URL in the editor. The editor does not upload image files or store raw images in KV.

For layout, navigation, colors, new albums and new pages, use GitHub and redeploy through the existing build workflow.

## Additional recommended security practices

Use passkeys or two-factor authentication on GitHub and Cloudflare. Keep the GitHub repository's default branch protected where your plan and settings permit. Store email API keys only as Cloudflare secrets. Check Cloudflare Turnstile analytics and Worker logs for contact abuse. Apply Cloudflare managed WAF rules as available on your plan. Regularly review every connected third-party image, video, font and music platform link.

Perform a real external penetration test if formal security assurance is required. The current review inspects known code paths and configuration only. The live custom domain was not fully reachable using the remote inspection tool, so live TLS, WAF, firewall rules, accessibility, browser rendering and real authenticated editor flows remain to be verified.
