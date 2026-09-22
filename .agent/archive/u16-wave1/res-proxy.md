# res-proxy-1 — Cloudflare Worker key-custody proxy

Fill every `finding` + `evidence` cell IN PLACE. Cells ≤250 chars. Evidence = a URL you
actually fetched, or `file:line` in this repo. Flush with `Edit` every 2 rows. Detail sections
carry code sketches.

WebSearch ration: ≤30 calls. Prefer `WebFetch` on vendor docs over search.

| id | question | finding | evidence |
|---|---|---|---|
| P1 | Current `wrangler` major, its Node engine requirement, and the current `compatibility_date` practice. | Current = Wrangler 4.136.2, Node `>=22`. Pin it locally. Start `compatibility_date` at deploy date (`2026-09-23` now); bump deliberately after reviewing flags/tests. Old dates remain supported. | https://registry.npmjs.org/wrangler/latest ; https://developers.cloudflare.com/workers/configuration/compatibility-dates/ |
| P2 | Minimal Worker that forwards a JSON judgment request to an LLM API with the key as a secret binding — smallest correct shape. | Module Worker POST path: exact origin/method/type, 64KiB body, bounded schema, aggregate Rate Limiting binding, 15s abort, fixed TypeSafe endpoint + Bearer secret, 256KiB JSON response, sanitized errors. Never accept a target URL or expose the key. | https://docs.typesafe.ai/api.md; https://developers.cloudflare.com/workers/configuration/secrets/; https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/; https://developers.cloudflare.com/workers/platform/limits/ |
| P3 | Abuse containment on the free/low tier: what Workers offers natively (Rate Limiting binding, WAF, Turnstile, KV counters) + the cost + limits of each. | Default RL binding: 10/60s windows, per-colo/eventual, no separate price shown. Turnstile: free/unlimited validations, 20 widgets × 10 hosts, adds UI. KV: no—1k writes/day, 1/s/key, eventual. Free WAF: 1 IP/path rule; needs owned zone. | https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/; https://developers.cloudflare.com/turnstile/plans/; https://developers.cloudflare.com/kv/platform/limits/; https://developers.cloudflare.com/waf/rate-limiting-rules/ |
| P4 | Origin pinning + CORS: how to allow exactly the Pages origin, preflight handling, and what an attacker gets if they spoof `Origin`. | Pin `Origin` to `https://eturkes.github.io`; preflight allows only POST + Content-Type; every response gets exact ACAO + `Vary: Origin`. This stops hostile browser sites, not raw clients: they can forge Origin, so rate limiting remains mandatory. | https://developers.cloudflare.com/workers/examples/cors-header-proxy/; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin |
| P5 | Where this demo deploys today, what the resulting origin is, and the exact `connect-src` value the Worker adds. | Publishes at `https://eturkes.github.io/cnl-ckc-demo/`; origin = `https://eturkes.github.io`. CSP: `connect-src 'self' https://cnl-ckc-intake.<ACCOUNT>.workers.dev;`. `<ACCOUNT>` is absent from repo: fill after first deploy or use a custom origin. | `.github/workflows/pages.yml:28-42`; `.git/config:6-7`; `README.md:113`; https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ |
| P6 | Local dev without a key: `wrangler dev` story vs a deterministic in-repo stub; which keeps the gate offline. | `wrangler dev --local` runs workerd locally, but ordinary upstream `fetch` still uses the network. Gate the in-repo `JudgmentClient` with a deterministic stub; reserve Wrangler + `.dev.vars` for manual keyed integration. | https://developers.cloudflare.com/workers/development-testing/ ; https://developers.cloudflare.com/workers/configuration/secrets/ |
| P7 | Deploy job for GitHub Actions: action name + version, required repo secrets, minimum permissions. | Use `cloudflare/wrangler-action@v4` (current v4.1.0) in a Node 22.12 job after `build`. Secrets: `CLOUDFLARE_API_TOKEN` (Workers edit, account-scoped), `CLOUDFLARE_ACCOUNT_ID`, `TYPESAFE_API_KEY`. GitHub token needs only `contents: read`. | https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/; https://github.com/cloudflare/wrangler-action/releases; `.github/workflows/pages.yml:15-42` |
| P8 | Free-tier request/CPU limits + what happens at the ceiling (throttle vs error), and the failure UX that implies. | Free = 100k requests/day + 10ms CPU/request. Overages fail, not queue: 1027 at daily cap (use fail-closed), 1102 on CPU. Browser maps network/non-JSON/5xx to ‘intake unavailable; retry’, preserves input, and never treats it as no match. | https://developers.cloudflare.com/workers/platform/limits/; https://developers.cloudflare.com/workers/observability/errors/ |
| P9 | Request/response size + timeout ceilings that bound the judgment payload. | Cloudflare Free accepts 100MB bodies, has 128MB memory and no response-body or outbound-fetch timeout; TypeSafe publishes no payload/time cap. Impose 64KiB request, 256KiB response and 15s abort locally; reject with 413/502/504. | https://developers.cloudflare.com/workers/platform/limits/; https://docs.typesafe.ai/api.md |
| P10 | Anything in this repo's toolchain caps (`.claude/rules/toolchain.md`) that constrains adding wrangler. | Keep gate/scanner jobs on Node 20.19 + secretlint 12/jsdom 29. Put Wrangler in its own Node 22 job; package engines already permit `>=22.12.0`. Do not lift the coupled caps merely for deploy tooling. | `.claude/rules/toolchain.md:24-30`; `package.json:9-10`; `.github/workflows/pages.yml:24` |

## Detail

### P2

Assumptions:

- `worker/worker.js` + root `wrangler.jsonc`; raw HTTP avoids an SDK/runtime dependency.
- The browser sends one TypeSafe `SystemOneRequest`: fixed `jev-latest`, ≤32 Noul/Choice
  questions, no caller-selected URL. The generated u16 artifact should tighten this structural
  bound to its exact IDs/types when both surfaces can import it.
- `https://eturkes.github.io` is the sole production browser origin. A Pages path is not part
  of an origin.
- The 10/minute limiter is a conservative per-location public-demo budget. It is approximate;
  tune from observed use or add Turnstile if distributed abuse appears.
- `workers.dev` stays enabled until the Cloudflare account subdomain or a custom domain is
  chosen. The first deployment supplies the CSP hostname.

`worker/worker.js`:

```js
const ALLOWED_ORIGIN = 'https://eturkes.github.io';
const ENDPOINT_PATH = '/v1/judgments';
const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

class BodyTooLarge extends Error {}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validQuestion(value) {
  if (!isRecord(value) || !('instructions' in value)) return false;
  if (value.type === 'noul') {
    return value.criteria === undefined || isRecord(value.criteria);
  }
  if (value.type !== 'choice' || !isRecord(value.criteria)) return false;
  const optionCount = Object.keys(value.criteria).length;
  return optionCount >= 2 && optionCount <= 255;
}

function validPayload(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 3 || !keys.every((key) => ['state', 'model', 'questions'].includes(key))) {
    return false;
  }
  const stateIsValid =
    typeof value.state === 'string' || Array.isArray(value.state) || isRecord(value.state);
  if (!stateIsValid || value.model !== 'jev-latest' || !isRecord(value.questions)) return false;
  const questions = Object.values(value.questions);
  return questions.length > 0 && questions.length <= 32 && questions.every(validQuestion);
}

async function readLimited(stream, maximum) {
  if (stream === null) return new Uint8Array();
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel().catch(() => {});
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function declaredTooLarge(headers, maximum) {
  const raw = headers.get('content-length');
  return raw !== null && (!/^\d+$/.test(raw) || Number(raw) > maximum);
}

function corsHeaders(extra = {}) {
  return new Headers({
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
}

function errorResponse(status, code, extra = {}) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: corsHeaders(extra),
  });
}

function forbiddenOrigin() {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin !== ALLOWED_ORIGIN) return forbiddenOrigin();
    if (url.pathname !== ENDPOINT_PATH) return errorResponse(404, 'not_found');

    if (request.method === 'OPTIONS') {
      const requestedMethod = request.headers.get('access-control-request-method');
      const requestedHeaders = (request.headers.get('access-control-request-headers') ?? '')
        .split(',')
        .map((header) => header.trim().toLowerCase())
        .filter(Boolean);
      if (
        requestedMethod !== 'POST' ||
        requestedHeaders.length !== 1 ||
        requestedHeaders[0] !== 'content-type'
      ) {
        return errorResponse(403, 'forbidden');
      }
      const headers = corsHeaders({
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      });
      headers.delete('Content-Type');
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', { Allow: 'POST, OPTIONS' });
    }
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json' || request.headers.has('content-encoding')) {
      return errorResponse(415, 'unsupported_media_type');
    }
    if (declaredTooLarge(request.headers, MAX_REQUEST_BYTES)) {
      return errorResponse(413, 'payload_too_large');
    }
    if (typeof env.TYPESAFE_API_KEY !== 'string' || env.TYPESAFE_API_KEY.length === 0) {
      return errorResponse(503, 'intake_unavailable');
    }

    let allowed;
    try {
      ({ success: allowed } = await env.INTAKE_RATE_LIMITER.limit({ key: 'public-intake' }));
    } catch {
      return errorResponse(503, 'intake_unavailable');
    }
    if (!allowed) return errorResponse(429, 'rate_limited', { 'Retry-After': '60' });

    let payload;
    try {
      const bytes = await readLimited(request.body, MAX_REQUEST_BYTES);
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
      if (error instanceof BodyTooLarge) return errorResponse(413, 'payload_too_large');
      return errorResponse(400, 'invalid_request');
    }
    if (!validPayload(payload)) return errorResponse(400, 'invalid_request');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let upstream;
    try {
      upstream = await fetch(TYPESAFE_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      return errorResponse(controller.signal.aborted ? 504 : 502, 'intake_unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      await upstream.body?.cancel();
      const status = upstream.status === 429 || upstream.status === 529 ? 503 : 502;
      return errorResponse(status, 'intake_unavailable', status === 503 ? { 'Retry-After': '5' } : {});
    }
    if (
      !upstream.headers.get('content-type')?.toLowerCase().startsWith('application/json') ||
      declaredTooLarge(upstream.headers, MAX_RESPONSE_BYTES)
    ) {
      await upstream.body?.cancel();
      return errorResponse(502, 'intake_unavailable');
    }

    let body;
    try {
      body = await readLimited(upstream.body, MAX_RESPONSE_BYTES);
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    } catch {
      return errorResponse(502, 'intake_unavailable');
    }
    return new Response(body, { status: 200, headers: corsHeaders() });
  },
};
```

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "cnl-ckc-intake",
  "main": "worker/worker.js",
  "compatibility_date": "2026-09-23",
  "workers_dev": true,
  "secrets": {
    "required": ["TYPESAFE_API_KEY"]
  },
  "ratelimits": [
    {
      "name": "INTAKE_RATE_LIMITER",
      "namespace_id": "1001",
      "simple": {
        "limit": 10,
        "period": 60
      }
    }
  ]
}
```

### P7

Assumptions: splice this job under `jobs:` in `.github/workflows/pages.yml`; keep the existing
Node 20 `build` job unchanged; pin Wrangler in `package.json`/`pnpm-lock.yaml`; create the three
named GitHub secrets. The API token uses Cloudflare's **Edit Cloudflare Workers** permission
and is scoped to only the deployment account.

```yaml
  worker:
    name: Deploy intake proxy
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22.12.0
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          packageManager: pnpm
          command: deploy
          secrets: |
            TYPESAFE_API_KEY
        env:
          TYPESAFE_API_KEY: ${{ secrets.TYPESAFE_API_KEY }}
```

RES-PROXY-1-DONE-1
