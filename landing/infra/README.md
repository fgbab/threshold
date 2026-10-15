# THRESHOLD: hosting and waitlist (threshold.gazum.ai)

**Prepared, not deployed.** Nothing here exists yet in AWS or Cloudflare. Every step below waits for the owner's OK.
Run each one from `~/Projects/threshold/landing`.

## What it is
- **The site:** a private S3 bucket behind CloudFront (Origin Access Control), the same setup as www.gazum.ai. A
  CloudFront Function serves folder pages: `/es/` gives `/es/index.html`, and `/es` redirects (301) to `/es/`.
- **The pages' own headers:**
  - a CSP that allows this site and nothing else (see "The CSP" below);
  - HSTS (2 years), nosniff, `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy`: no camera, microphone or location;
  - `Cross-Origin-Opener-Policy: same-origin`.
- **The waitlist at `/api/*`:**
  - one Lambda (Node 22, arm64) behind CloudFront. It refuses any call without CloudFront's `X-Origin-Verify` header;
  - DynamoDB: key `pk`, TTL, point-in-time recovery, deletion protection, kept if the stack goes;
  - Secrets Manager `{ resend, signing }`;
  - mail from `THRESHOLD <hello@email.gazum.ai>` through Resend; replies go to support@gazum.ai.
- **DNS:** Cloudflare. A DNS-only CNAME points `threshold.gazum.ai` at the distribution.
- **Names** (us-east-1, AWS profile `gazum`):
  - stack `threshold-site`;
  - Lambda `threshold-site-waitlist`, its log group `/aws/lambda/threshold-site-waitlist` (30 days);
  - `threshold-site-headers` (response headers), `threshold-site-api` (origin request);
  - `threshold-site-router` (the function), `threshold-site-oac`;
  - the bucket, table and secret get generated names, which the stack's outputs list.
- **Checked read-only on 15 Oct 2026:**
  - no `threshold-site` stack, certificate for threshold.gazum.ai, or `threshold-site-waitlist` function exists yet;
  - there's room under the quotas: 2 of 20 custom response headers policies and 3 of 20 origin request policies are
    in use;
  - `aws cloudformation validate-template` passes. It asks for `CAPABILITY_IAM`, which deploy.sh passes.

## Before you start
- **Credentials:**
  - AWS profile `gazum` (`aws login` if it has expired);
  - `~/.cloudflare-token`, which can edit DNS on gazum.ai;
  - `~/.resend-sending-key`: the send-only key the other games use (email.gazum.ai is already verified in Resend).
- **The page is finished:** checked in the lab (WebKit and Chromium), with the privacy page describing all of these:
  - the double opt-in;
  - unconfirmed addresses deleted after 30 days;
  - AWS (US) and Resend;
  - the one-click unsubscribe.
- **`infra/deploy.sh check`:** read-only. It checks:
  - who you are in AWS;
  - the template and the tests;
  - the CSP audit of `dist/`;
  - that the Cloudflare token reaches gazum.ai;
  - that the Resend key is there (never shown);
  - what's already deployed.

## The run order: cert → stack → secrets → api → publish → dns → smoke

| # | `infra/deploy.sh …` | What it creates or changes | Time | To undo |
|---|---|---|---|---|
| 1 | `cert` | An ACM certificate for threshold.gazum.ai (us-east-1, DNS validation). Its validation CNAME (`_….threshold.gazum.ai`, DNS-only) goes into Cloudflare. Waits until ISSUED. The ARN is kept in `infra/.cert-arn` (gitignored). Free. | 2–5 min | Delete the certificate in ACM and the CNAME in Cloudflare |
| 2 | `stack` | Builds the page and computes its CSP hashes. Then creates the stack `threshold-site`: the bucket, OAC and bucket policy, the router function, both policies, the table, the secret (its signing value generated inside AWS), the log group, the IAM role, the Lambda (a placeholder that answers 503 until step 4), its URL with both permissions, and the distribution. Writes `infra/.origin-verify` (gitignored, mode 600). | 5–15 min | `aws cloudformation delete-stack --stack-name threshold-site`. The bucket and the table stay (Retain); the table also needs its deletion protection turned off before it can be deleted |
| 3 | `secrets` | Puts the Resend key into the secret, keeping the signing value. Creates nothing. | seconds | n/a |
| 4 | `api` | Runs the waitlist's tests, then uploads `api/waitlist.mjs` as the Lambda's code. | seconds | Upload the previous version |
| 5 | `publish` | Builds with the form on (`/api/waitlist`). Checks the live CSP allows the build's inline scripts. Uploads `dist/`: hashed files cached for a year, everything else revalidated. Invalidates CloudFront. The site answers at the `d….cloudfront.net` address, not yet at threshold.gazum.ai. | about 1 min | Publish again |
| 6 | `dns` | The DNS-only CNAME `threshold.gazum.ai` → the distribution, in Cloudflare. **From here it is live.** | 1 min | Delete the record |
| 7 | `smoke` | Reads the live site (see below). Sends one email, to Resend's test inbox (`delivered@resend.dev`), then deletes that test address from the list. | 30 s | n/a |

**`smoke` checks:**
- every page and fixed file answers 200: `/`, `/es/`, both privacy pages, `/play/`, the favicons, the social images, `robots.txt`,
  the sitemap, and `/brand/wordmark.svg` and `/brand/wordmark-email.png`;
- `/es` answers 301 and an unknown page 404;
- the CSP, HSTS, nosniff, frame and Permissions-Policy headers are there;
- the waitlist: a bad email gets 400, Resend's test inbox 201, a faded link 410, and the function URL without
  CloudFront 403.

If `smoke` prints `000` right after `dns`, your resolver hasn't seen the new record yet. Wait a few minutes, or test
through CloudFront's own address: `BASE=https://d….cloudfront.net infra/deploy.sh smoke` (the address that `stack`
printed).

**Afterwards:**
- `infra/deploy.sh status` shows the stack, the certificate, the DNS and the live site.
- To change things later:
  - the page: `publish`;
  - the waitlist's code: `api`;
  - the infrastructure or the CSP: `stack`.
- Link THRESHOLD's card on gazum.ai to threshold.gazum.ai only after `smoke` passes, so the link never points at
  nothing. The same goes for any post that links here.

## Cost: about 1 USD a month
- **The secret:** $0.40 a month, most of the bill.
- **CloudFront:** within its always-free monthly allowance (1 TB, 10 million requests, 2 million function runs). $0 at
  a landing page's traffic.
- **Lambda:** within its free allowance (1 million requests a month). $0.
- **DynamoDB** (on demand, with point-in-time recovery on a table of kilobytes), **S3** (a few MB) and **CloudWatch
  Logs:** cents.
- **Free:** the certificate and Cloudflare's DNS. Resend: the plan the other games already use.

## The CSP, for whoever builds `src/` and `scripts/`
**Allowed:**
- scripts, styles, fonts, images, sound and video from threshold.gazum.ai;
- images and sound from `data:` and `blob:` URLs;
- `fetch` only to this site: the waitlist, and audio files that Web Audio decodes. Web Audio itself needs nothing else.

**Inline scripts are allowed by their hash:**
- `stack` puts the hashes of the current build into the CSP and keeps the hashes of the live pages.
- `publish` refuses a build whose inline script the live CSP doesn't allow yet: run `stack` first.
- `PRUNE=1 infra/deploy.sh stack` drops the old hashes.

**Not allowed:**
- anything from another site: Google Fonts, a CDN, analytics, an embedded video or the prototype in an iframe. Links
  to other sites are fine;
- inline event handlers (`onclick="…"`) and `javascript:` links;
- `eval` and `new Function`;
- an AudioWorklet or module loaded from a `blob:` URL. Load it from a file in `/assets/`.

**Tools:**
- `node infra/csp.mjs audit dist` names what the CSP would block. Every build in deploy.sh runs it first.
- `node infra/csp.mjs policy dist` prints the exact policy, so a preview server can send it too.

**What the waitlist needs from the page:**
- **Two files at fixed addresses**, written by `scripts/build.mjs`: `/brand/wordmark.svg` for the confirmation pages,
  and `/brand/wordmark-email.png` (about 600 px wide) for the emails.
- **The form:** `POST /api/waitlist`, sending JSON `{ email, lang: 'en' | 'es', source: 'landing' }`. The answers:
  - 201: new. Say "check your inbox to confirm".
  - 200 `{ already: true }`: already on the list.
  - 400: not an email.
  - 429: too many sign-ups from here.
  - anything else: "write to support@gazum.ai".

## The waitlist (`api/waitlist.mjs`)
- **Double opt-in:**
  - Links are signed with HMAC, and a confirmation link lasts 7 days.
  - A GET only shows a button, because mail scanners open links. The button's POST confirms.
  - A faded or unknown link answers **410**, never 404, because CloudFront swaps every 403 and 404 for `/404.html`.
- **Forgetting:**
  - An address that is never confirmed is deleted after 30 days (TTL).
  - A confirmed one stays until it leaves, with one click (RFC 8058, plain or multipart).
- **Limits:**
  - 5 sign-ups a minute and 30 a day per visitor.
  - A visitor is an IPv4 address, or an IPv6 address's /64, hashed with the signing secret.
- **Its look:** THRESHOLD's viewfinder on night black: REC, `03:03:07 AM`, corner brackets, `ISO 3200 · 1/30 · ƒ1.8`.
  Cormorant (or its fallbacks) for the words, DM Mono for the camera, a thin gold line on the button, and crimson only
  for REC and for leaving. EN and ES.
  - The confirmation and unsubscribe pages send their own strict CSP: no scripts, and their one `<style>` allowed by
    hash.
- **Reading the list:** DynamoDB items `e#<email>`. A confirmed address has `confirmedAt`.
- **Emails to the list:** `listEmail()` builds them, with the unsubscribe link and headers. There's no sending tool
  yet.
- **Tests:**
  - `node --test api/test/*.test.mjs` (21);
  - `node --test infra/test/*.test.mjs` (8).
  - On Node 25, a bare folder (`node --test api/test/`) fails.

## Secrets (this repo is public)
- **Never in git:**
  - `infra/.origin-verify` and `infra/.cert-arn` (both in `.gitignore`);
  - `~/.resend-sending-key` and `~/.cloudflare-token`.
- **Never printed:** deploy.sh shows none of them.
- **Where they live:** the Resend key only in Secrets Manager. The signing secret is generated there and never leaves
  AWS.

## Lessons from the games before it (already applied)
- **A public function URL needs two permissions:** `lambda:InvokeFunctionUrl`, and `lambda:InvokeFunction` with
  `InvokedViaFunctionUrl`. With only the first, the URL answers 403 and CloudFront shows the 404 page.
- **A faded link answers 410, not 404.**
- **`smoke` deletes its test address,** which used to be done by hand.
