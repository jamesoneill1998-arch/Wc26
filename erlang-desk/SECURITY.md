# Erlang Desk security overview

Written for customers' security and procurement reviews. Keep it accurate as the product changes.

## Data handling

- **Customer contact data never reaches our servers.** CSV imports, forecasts, staffing and capacity plans are parsed, computed and stored in the user's browser (`localStorage`, origin-isolated). The server-side API only ever sees an email address and a subscription status.
- **No database.** Stripe is the system of record for customers, subscriptions and team membership, so there is no user table to breach.
- Users can export their workspace as a file and erase it from the device ("Erase all data on this device").

## Authentication

- Passwordless email sign-in. Links are HMAC-SHA256 signed, valid for 15 minutes, and **bound to the requesting browser** by a random nonce held in an `HttpOnly` cookie. A forwarded, intercepted or link-scanner-opened email cannot create a session elsewhere.
- Responses to sign-in requests are identical whether or not an account exists (no account enumeration).
- Sessions are signed tokens in `__Host-` prefixed cookies: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`. Lifetime is a fixed 7 days. Tokens are purpose-bound, so a login token can never be replayed as a session. Comparisons are constant-time.
- Plan entitlement is re-read from Stripe at most every 10 minutes, so cancellations and team removals take effect promptly.

## Request protection

- **CSRF:** every state-changing endpoint requires a same-origin `Origin` (or `Sec-Fetch-Site: same-origin`), accepts JSON bodies only, and relies on `SameSite` cookies.
- **Rate limiting:** sign-in (10 per IP and 5 per email per 15 minutes), checkout and team changes. Shared across instances via Upstash Redis when configured.
- **Input validation:** emails are normalised and pattern-checked, bodies are size-capped, plans are whitelisted and prices are fixed server-side. The app URL comes from configuration, never the `Host` header, so links and redirects can't be poisoned. Redirects only go to our own origin or to Stripe's hosted pages, which the client also checks.
- Errors return generic messages. Details go to server logs only, and misconfiguration fails closed (503).

## Browser hardening

- Content Security Policy: `default-src 'self'`, with no inline script, no third-party scripts, styles, fonts or connections, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`. Fonts are self-hosted.
- HSTS (2 years, subdomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict `Referrer-Policy` (and `no-referrer` on sign-in redirects), a restrictive `Permissions-Policy`, and `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy: same-origin`.
- Imported files are size-limited (CSV 25 MB, 500k rows) and workspace imports are rebuilt field by field from a whitelist, which blocks prototype pollution and oversized or malformed values.
- CSV exports neutralise spreadsheet formula injection (`=`, `+`, `-`, `@` prefixes).

## Payments

- Stripe Checkout and the Stripe customer portal. Card data never touches our infrastructure. The Stripe API version is pinned.

## Supply chain

- The server code has no runtime dependencies beyond Node's standard library. The client depends on React and a self-hosted font. `npm audit` is clean at the time of writing, and `npm ci` installs from the lockfile.

## Known limits

- Because computation is client-side, the paywall is enforced in the client, with the entitlement held server-side. A determined user could modify their own copy of the app; the terms of service cover licence misuse.
- Without Upstash configured, rate limits apply per serverless instance only.
- Workspaces in `localStorage` are only as secure as the device and browser profile. Advise customers against using shared machines, or to erase data afterwards.

## Reporting a vulnerability

Email the security contact listed on the website. We aim to acknowledge within two working days.
