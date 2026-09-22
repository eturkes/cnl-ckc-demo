# res-typesafe — TypeSafe System One: primitives, contracts, SDK, patterns, limits

Gate: `python3 -P /run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/validate-report.py /run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/agents/res-typesafe.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, ≤400 chars, dense/telegraphic, `→`/`=` notation, no prose padding.
`evidence` = the doc URL, or `path:line` in installed SDK types, ≥8 chars.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table keyed by row id: for `ts.api`, `ts.sdkjs`, `ts.choice`, `ts.noul`, `ts.score` write a detail section carrying the VERBATIM request/response schema or type signature — MAIN writes code against it.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| ts.model | System One models expose bounded typed judgments; flagship Jev returns answers plus probabilities, not generated prose or a reasoning trace. Repeatability and latency need verification on the model page. | https://docs.typesafe.ai/llms.txt |
| ts.build | Keep control flow, deterministic rules, arithmetic, filtering, side effects, and early exits in code; reserve narrow atomic questions for common-sense judgments over unstructured state, batch independent questions, then combine typed probabilities in code. | https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md |
| ts.choice | Let `Entry` mean string, object, or array. Request=`{type:"choice", instructions:Entry, criteria:Record<option,Entry-or-null>}` with ≤255 options. Response=`{type,choice,probabilities,confidence}`: read the selected key from `choice` and its probability from `probabilities[choice]`; add `other` for incomplete coverage. | https://docs.typesafe.ai/primitives/choice.md |
| ts.noul | Let `Entry` mean string, object, or array. Request=`{type:"noul", instructions:Entry, criteria?:{true?:Entry,false?:Entry}}`; response=`{type:"noul",noul:number}` where `noul`=P(yes), with no confidence field. Near 0.5 means yes/no are similarly probable, not medium intensity; use parallel Nouls for independent labels. | https://docs.typesafe.ai/primitives/noul.md |
| ts.score | `type: "score"` takes 2–10 concrete, self-contained criteria levels ordered low→high. Response includes each level's probability, legend, spread-based confidence, and `score` = probability-weighted level index; each level is judged independently without seeing its index/neighbours. | https://docs.typesafe.ai/primitives/score.md |
| ts.state | `state` accepts text, a JSON object, or an array of text values; objects preserve named relationships and are preferred for multi-part context. Instructions can reference nested fields with backticked paths such as `ticket.messages[0].text`; docs state no size/token/field limit. | https://docs.typesafe.ai/concepts/state.md |
| ts.conf | Choice/Score confidence is a 0–1 statistic derived from distribution concentration; Noul has none. It is not truth probability or a universal cutoff. Docs show 0.5 human-routing and 0.9 destructive-action gates only as examples; calibrate conservative, risk-specific thresholds on target data. | https://docs.typesafe.ai/confidence.md |
| ts.api | `POST https://api.typesafe.ai/v1/systemone` with Bearer auth and JSON `{state,model,questions}`; one request may mix named Noul/Choice/Score questions and returns same-key typed answers plus token usage. Errors documented: 401, 422, 429, 529; 429/529 use exponential backoff. | https://docs.typesafe.ai/api.md |
| ts.sdkjs | Published `@typesafe-ai/sdk@0.6.0` requires Node ≥20; `new TypeSafeClient(config).systemOne(request, options)` infers answer types. Default model=`jev-latest`, per-attempt timeout=10 s, retries=2. Browser construction refuses unless `dangerouslyAllowBrowser:true`, explicitly because that exposes the key. | https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.6.0/src/client.ts |
| ts.fanout | Put all independent and speculative questions over the same state in one request; they run in parallel, add little latency, and code ignores branch-inapplicable answers. Each speculative question must state its condition explicitly (for example, “if this is a bug report…”); extra questions still consume tokens. | https://docs.typesafe.ai/patterns/fan-out.md |
| ts.fncall | One request asks routing Choice `__tool__` plus all candidate functions’ argument questions; code reads only the chosen function’s answers. `Literal`→Choice, `list[Literal]`→one Noul per member, `bool`→Noul; a separate `stated` Noul omits unstated arguments so code defaults survive. | https://docs.typesafe.ai/cookbooks/function_calling.md |
| ts.extract | Select, never generate: code/regex finds high-recall source spans, Choice options are those exact candidates plus `none`, TypeSafe picks one, then code copies and normalizes it. Missing candidates are unrecoverable—the model cannot select an omitted value; Choice caps at 255, so narrow in stages beyond that. | https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md |
| ts.rerank | BM25 first retrieves 30 candidates, then one identically worded Noul judges each query–passage pair so probabilities are comparable and sortable. On 40 CLERC queries/1,200 pairs: top-1 5%→18%, top-5 15%→35%, top-10 38%→62%; 1,561,202 tokens cost $0.0645. No latency figure stated. | https://docs.typesafe.ai/cookbooks/rerank_typesafe.md |
| ts.hier | Each level is a Choice over the current node’s direct children; another request is warranted because level-1 probabilities determine which child nodes—and therefore which level-2 option sets—exist. Beam search keeps K paths, expands their sibling sets in parallel, and geometric-means edge probabilities; K=3 beat greedy 4/4 vs 2/4. | https://docs.typesafe.ai/cookbooks/hierarchical_classification.md |
| ts.cascade | Verify outputs against source with independent narrow wrongness Nouls (`hallucinated`, `off_target`, etc.); escalate when `max(P(wrong)) ≥ 0.7`, not an average or holistic judge. Citation checking analogously Choice-grades whether quoted context supports a claim and routes low-confidence cases to a human. | https://docs.typesafe.ai/cookbooks/sde_cascade.md |
| ts.cost | Jev 1.13.0 costs $0.042/M input tokens; output tokens are free. Limits: 250k tokens/s, 1,200 requests/min, 64k tokens/call, and 32k for state + longest question; 429 on excess and limits may change. Build guide says most queries ≈100 ms, but models page gives no SLA. | https://docs.typesafe.ai/models.md |
| ts.sec | No supported secure browser-only path: SDK refuses browser construction by default and says “Call the API from a server instead”; `dangerouslyAllowBrowser:true` only bypasses the guard while exposing the bearer key to every page user. Docs state no CORS policy; a static-only demo needs a server/edge proxy. | https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.6.0/src/client.ts |

## Row prompts

Sources: start at `https://docs.typesafe.ai/llms.txt`. Mintlify serves Markdown by appending `.md` to a page path (e.g. `https://docs.typesafe.ai/primitives/choice.md`). Resolve relative links against `https://docs.typesafe.ai`. Prefer `WebFetch` on `.md` pages over `WebSearch`; your WebSearch allowance is 20 calls, shared session budget.

- `ts.model` — `concepts/system-one.md`: what a System One model IS, what Jev returns, what it does NOT do (no free text, no reasoning trace?), determinism/repeatability, typical latency. State the guarantees the vendor actually claims vs what a reader might assume.
- `ts.build` — `concepts/how-to-build-with-system-one.md`: the decomposition discipline — what stays in code, what becomes a judgment. Extract the concrete rules, not the slogan.
- `ts.choice` — `primitives/choice.md`: exact request shape, how options are declared, whether options carry descriptions, max option count, what the distribution contains, confidence semantics, no-match handling. Detail section = verbatim schema + one worked example.
- `ts.noul` — `primitives/noul.md`: exact shape, what the returned number means, the documented warning about ~0.5, when to use several Nouls vs one Choice. Detail section = verbatim schema + example.
- `ts.score` — `primitives/score.md`: level declaration, ordering requirement, what the returned value is (expected level? distribution?), guidance on writing levels. Detail section = verbatim schema + example.
- `ts.state` — `concepts/state.md` + `primitives.md`: how state is passed (string vs named JSON fields), backticked path references into nested state, any size/token limits, and how state relates to instructions/criteria.
- `ts.conf` — `confidence.md`: what confidence measures for each primitive, what it explicitly does NOT mean, and the documented guidance on thresholds. Report any concrete threshold numbers the docs give and label them as examples.
- `ts.api` — `api.md`: base URL, endpoint paths, auth header, the full request body schema for a multi-question call, the response schema, batching rules, rate limits, error codes, timeouts. Detail section = verbatim curl + verbatim JSON request and response.
- `ts.sdkjs` — `sdk/javascript.md` + the published package: package name, install command, current version, initialization, the typed call signature, whether it targets Node only or also the browser, and any stated requirement to keep the key server-side. Detail section = verbatim TypeScript example. If a package is installed locally or fetchable, cite its `.d.ts`.
- `ts.fanout` — `patterns/fan-out.md`: how speculative parallel questions work, how code consumes only the applicable branch, the cost model, and the rule about stating speculative premises explicitly.
- `ts.fncall` — `cookbooks/function_calling.md`: how a request selects a handler AND fills its typed parameters in one round. This is the closest published analog to "pick a query template and fill its slots" — extract the exact question layout it uses.
- `ts.extract` — `cookbooks/pre_parsed_value_extraction_cookbook.md`: the select-do-not-generate discipline — code finds candidate spans, the model selects. Extract the candidate-coverage warning and how candidates are presented to the model.
- `ts.rerank` — `cookbooks/rerank_typesafe.md`: scoring candidate documents against a query, the per-item comparability requirement, and measured quality/latency figures if given.
- `ts.hier` — `cookbooks/hierarchical_classification.md`: multi-level routing, when a second request is warranted, and how the level-1 answer constructs level-2 options.
- `ts.cascade` — `cookbooks/sde_cascade.md` + `cookbooks/citation_check.md`: verification and escalation — checking a produced value against its evidence, and routing uncertain cases onward. Extract the escalation trigger shape.
- `ts.cost` — Pricing, rate limits, token accounting, latency figures wherever the docs state them. If the docs do not state a number, say so explicitly rather than estimating.
- `ts.sec` — Credential handling: the documented rule for web apps, CORS posture, whether a browser-side call is supported at all, and what a static site with no server must do. This decides whether a client-only demo can call TypeSafe directly.

## ts.api

`api.md` contains no curl command. Its verbatim transport block is:

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

Equivalent curl (derived directly from that block, not quoted from the docs):

```sh
curl https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @request.json
```

Verbatim request schema declarations:

```mdx
<ParamField body="state" type="string | object | array" required>
<ParamField body="model" type="string" required>
<ParamField body="questions" type="map<string, Question>" required>

<ParamField body="type" type="&#x22;noul&#x22;" required />
<ParamField body="instructions" type="string | object | array" required>
<ParamField body="criteria" type="object">
  <ParamField body="true" type="string | object | array">
  <ParamField body="false" type="string | object | array">

<ParamField body="type" type="&#x22;choice&#x22;" required />
<ParamField body="instructions" type="string | object | array" required>
<ParamField body="criteria" type="map<string, string | object | array | null>" required>

<ParamField body="type" type="&#x22;score&#x22;" required />
<ParamField body="instructions" type="string | object | array" required>
<ParamField body="criteria" type="array<string | object | array>" required>
```

Choice accepts at most 255 criteria entries. Score accepts 2–10 entries. The API page states no request-level question-count cap.

Verbatim worked JSON request:

```json
{
  "state": "Help! My payouts have been failing for 3 days.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "billing": "Payments, invoicing, refunds",
        "technical": "Bugs, outages, integrations",
        "sales": "Pricing, upgrades, new accounts"
      }
    }
  }
}
```

Verbatim response schema declarations:

```mdx
<ResponseField name="model" type="string" required>
<ResponseField name="answers" type="map<string, Answer>" required>
<ResponseField name="usage" type="object" required>
  <ResponseField name="input_tokens" type="integer" />
  <ResponseField name="output_tokens" type="integer" />

<ResponseField name="type" type="&#x22;noul&#x22;" required />
<ResponseField name="noul" type="number" required>

<ResponseField name="type" type="&#x22;choice&#x22;" required />
<ResponseField name="choice" type="string" required>
<ResponseField name="probabilities" type="map<string, number>" required>
<ResponseField name="confidence" type="number" required>

<ResponseField name="type" type="&#x22;score&#x22;" required />
<ResponseField name="score" type="number" required>
<ResponseField name="legend" type="map<string, string>" required>
<ResponseField name="probabilities" type="map<string, number>" required>
<ResponseField name="confidence" type="number" required>
```

Verbatim worked JSON response:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "billing",
      "probabilities": { "billing": 0.88, "technical": 0.12, "sales": 0.0 },
      "confidence": 0.81
    }
  },
  "usage": { "input_tokens": 318, "output_tokens": 34 }
}
```

The page documents JSON errors at 401, 422, 429, and 529, but no error-body field schema. It gives no numeric rate limit, rate-limit header, request timeout, question-count cap, or price. It directs 429/529 clients to exponential backoff; official SDK defaults already do this.

## ts.sdkjs

Registry metadata read with `pnpm view @typesafe-ai/sdk name version engines exports types --json`: package `@typesafe-ai/sdk`, current/latest `0.6.0`, Node `>=20`, ESM + CommonJS exports, bundled declarations.

Verbatim install and worked TypeScript example:

```sh
npm install @typesafe-ai/sdk
```

```ts
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient();
const response = await client.systemOne({
  state: { document: "I was charged twice. Please fix this ASAP." },
  questions: {
    category: choice("What is this ticket about?", {
      billing: null,
      technical: null,
      other: null,
    }),
  },
});

console.log(response.answers.category.choice);
```

Verbatim client call signature from tag `v0.6.0`:

```ts
systemOne<const Q extends Questions>(
  request: SystemOneRequest<Q>,
  options: RequestOptions = {},
): APIPromise<SystemOneResult<Q>>
```

Verbatim core request/result types:

```ts
export interface SystemOneRequest<Q extends Questions = Questions> {
  state: EntryType;
  questions: Q;
  model?: string;
}

export interface SystemOneResult<Q extends Questions> {
  readonly model: string;
  readonly answers: { readonly [K in keyof Q]: ResultFor<Q[K]> };
  readonly usage: Usage;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  retry?: Partial<RetryPolicy>;
  headers?: Record<string, string>;
}
```

Verbatim browser control and constructor behavior:

```ts
export interface TypeSafeClientConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  logLevel?: LogLevel;
  logger?: Logger;
  retry?: Partial<RetryPolicy>;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  dangerouslyAllowBrowser?: boolean;
  fetch?: Fetch;
}
```

```ts
constructor(config: TypeSafeClientConfig = {}) {
  if (isBrowser() && !config.dangerouslyAllowBrowser) refuseBrowser();
```

The exact refusal says: `TypeSafeClient is running in a browser, which would expose your API key to anyone using the page. Call the API from a server instead, or pass dangerouslyAllowBrowser: true if you understand the risk.` Defaults from the tagged source: model `jev-latest`; timeout 10,000 ms per attempt; two retries after the first attempt; retry HTTP 408, 429, and 500–599 plus connection/timeout errors.
