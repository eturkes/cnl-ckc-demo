# res-proxy — serverless proxy host for a keyed API call from a GitHub Pages static demo

Gate: `python3 -P /run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/validate-report.py /run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/agents/res-proxy.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, ≤400 chars, dense/telegraphic, `→`/`=` notation, no prose padding.
`evidence` = vendor doc URL, or `path:line`, ≥8 chars. Keep `|` out of cell text (escape as `\|`).
One physical line per row. Flush after EVERY row — never batch.

Problem: `cnl-ckc-demo` ships as static files to GitHub Pages (`.github/workflows/pages.yml`,
`pnpm gate` then publish `dist/`). It must call `POST https://api.typesafe.ai/v1/systemone`
with a Bearer key. Pages serves no server → the key needs a serverless proxy on another host.
Traffic shape measured: ~2 requests per user question, ~0.81 s per request, ~22K tokens per
question, payload = the user's typed phrase + the KB's own concept names (no secrets, no PHI).
The proxy is a thin pass-through: inject `Authorization`, forward JSON, return JSON.

Decide by evidence, not popularity. Name real current limits with their source.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| px.abuse | Cloudflare = strongest free containment: Workers Rate Limiting binding keys on IP/arbitrary value with per-colo 10/60 s counters; Turnstile adds a free browser challenge. Keep Workers Free so its daily request quota bounds blast radius. Vercel/Netlify/Deno/Val Town otherwise need app-state or paid controls; CORS is no guard. | https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ |
| px.host | Recommend Cloudflare Workers; Deno Deploy runner-up. Decider = Workers' edge Rate Limiting binding plus a 100,000-request/day Free ceiling; Deno gives 1M requests/month and documented sub-100 ms small-app cold starts, but no comparable distributed limiter. A one-fetch proxy fits Workers' 10 ms CPU because network wait is excluded. | https://developers.cloudflare.com/workers/platform/limits/ , https://docs.deno.com/deploy/reference/runtime/ |
| px.free | Cloudflare Free: 100k req/day, 10 ms CPU/invocation, egress uncharged; excess = 1027/bypass by route mode. Deno: 1M/mo, 20 GiB, 10 CPU-h; app pauses. Vercel Hobby: 1M/mo, 100 GB, 4 CPU-h; project pauses. Netlify: shared 300 credits (~1.5M requests only if nothing else); account pauses. Val Town: 100k runs/day; CPU/egress unpublished. | https://developers.cloudflare.com/workers/platform/pricing/ , https://deno.com/deploy/pricing , https://vercel.com/docs/functions/usage-and-pricing , https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ , https://www.val.town/pricing |
| px.cold | Deno publishes <100 ms for hello-world and a few hundred ms for larger apps. Cloudflare's V8-isolate model claims no VM-style cold start but gives no representative ms. Vercel, Netlify and current Val Town publish no typical/guaranteed figure; Val Town's 2024 preview measured ~100 ms cold/~10 ms warm, now historical. None documents a multi-second start. | https://docs.deno.com/deploy/reference/runtime/ , https://developers.cloudflare.com/workers/reference/how-workers-works/ , https://vercel.com/docs/functions , https://docs.netlify.com/build/edge-functions/overview/ , https://blog.val.town/http-preview |
| px.cors | Return exact `Access-Control-Allow-Origin: https://<user>.github.io` after Origin validation, `Vary: Origin`, methods `POST`, headers `Content-Type`; intercept OPTIONS with 204 before auth/upstream. Cloudflare, Deno, Vercel and Netlify require handler/config; Netlify static `_headers` cannot affect function output. Val Town auto-adds permissive CORS/preflight → override it. | https://developers.cloudflare.com/workers/examples/cors-header-proxy/ , https://docs.deno.com/examples/http_server_cors/ , https://vercel.com/kb/guide/how-to-enable-cors , https://docs.netlify.com/manage/routing/headers/ , https://docs.val.town/troubleshooting/cors/ |
| px.secret | Use each secret type, never plaintext env: Cloudflare encrypted binding (hidden after set; `wrangler secret put` rotates via new version); Deno secret env (hidden; UI/CLI replace); Vercel Sensitive env (non-readable; replace + redeploy); Netlify secret value (UI/API cannot read; update + redeploy); Val Town private env (update applies next request). Logs expose one only if code prints it. | https://developers.cloudflare.com/workers/configuration/secrets/ , https://docs.deno.com/deploy/reference/env_vars_and_contexts/ , https://vercel.com/docs/environment-variables/rotating-secrets , https://docs.netlify.com/build/environment-variables/overview/ , https://docs.val.town/reference/environment-variables |
| px.deploy | Cloudflare: official `cloudflare/wrangler-action@v4`, `CLOUDFLARE_API_TOKEN` + `ACCOUNT_ID`. Deno: pinned `deno deploy`, `DENO_DEPLOY_TOKEN` (`deployctl` is obsolete). Vercel: pinned CLI, `TOKEN/ORG_ID/PROJECT_ID`. Netlify: pinned CLI, `AUTH_TOKEN/SITE_ID`. Val Town: `vt push`, `VAL_TOWN_API_KEY`. Run only after `pnpm gate` or via `needs: gate`; failure skips deploy. | https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ , https://docs.deno.com/runtime/reference/cli/deploy/ , https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel , https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/ , https://docs.val.town/guides/github-sync/github-actions |
| px.csp | Cloudflare-only: no CSP ships in HTML; change the documented host header to `connect-src 'self' https://<worker>.<subdomain>.workers.dev` (or the exact custom proxy origin). Workers injects no browser origin. Turnstile would also require `script-src` + `frame-src https://challenges.cloudflare.com`. | README.md:112 , https://developers.cloudflare.com/turnstile/reference/content-security-policy/ |
| px.local | Cloudflare-only: `wrangler dev` runs the Worker locally beside `pnpm dev`. It resolves the same secret binding name from ignored `.dev.vars`/`.env`; production has a separate value via `wrangler secret put`. Point Vite dev at Wrangler's local URL; no deploy required. | https://developers.cloudflare.com/workers/local-development/environment-variables/ |
| px.pin | Cloudflare-only: `wrangler@4.129.1` exact-pins locally, but current Wrangler supports only Current/Active/Maintenance Node releases. Node 20 is EOL, so it is unsupported → repo's Node-20 law blocks the current CLI; deployment needs an approved Node-22 job or an older audited pin. | https://developers.cloudflare.com/workers/wrangler/install-and-update/ |

Row meanings:

- `px.abuse` — HIGHEST PRIORITY. A public demo proxying to a metered paid key is an open
  wallet. What abuse control does each candidate host give at the edge, free: per-IP rate
  limiting, bot/turnstile challenge, request budget caps, spend alarms. Name the mechanism,
  its free-tier availability and its granularity. Answer this row FIRST.
- `px.host` — the recommendation, one named host, with the runner-up and the deciding
  criterion. Candidates worth weighing: Cloudflare Workers, Deno Deploy, Vercel Functions,
  Netlify Functions, Val Town. Weigh against `px.abuse` + `px.free` + `px.cold`.
- `px.free` — free-tier limits that bind a public demo: requests/day, CPU ms per request,
  egress, and what happens AT the limit (hard 429, soft throttle, surprise bill).
- `px.cold` — measured cold-start latency per candidate. The call budget is 5 s end to end
  and the API alone takes ~1.6 s, so a multi-second cold start is disqualifying.
- `px.cors` — exact response-header mechanics for a `https://<user>.github.io` origin,
  including OPTIONS preflight: does the host answer preflight itself or must the function.
- `px.secret` — where the key lives per host (encrypted binding, env var, secret store),
  whether it is readable from a deploy log or a dashboard, and how it is rotated.
- `px.deploy` — deploying from the EXISTING GitHub Actions workflow: required action, the
  repo secret it needs, and whether deploy can be gated on `pnpm gate` passing.
- `px.csp` — the `connect-src` change the demo's own CSP needs, and any EXTRA origin the
  host injects (analytics, challenge script) that would also need allowing.
- `px.local` — offline dev: does the host CLI run the function locally so `pnpm dev` works
  with no deploy, and does it read the same secret source.
- `px.pin` — exact-version pinning for the host runtime/CLI. Repo law pins exactly and keeps
  Node 20. Say whether each candidate's CLI is installable pinned and Node-20-compatible.
