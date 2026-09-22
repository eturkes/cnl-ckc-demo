# res-judgment-1 — judgment provider + `JudgmentClient` seam

Fill every `finding` + `evidence` cell IN PLACE. Cells ≤250 chars. Evidence = a URL you
actually fetched, or `file:line` in this repo. Flush with `Edit` every 2 rows. Detail sections
carry API sketches.

WebSearch ration: ≤30 calls. Prefer `WebFetch` on vendor docs over search.

START HERE: `/run/host/home/eturkes/Projects/cnl-ckc-demo/.agent/archive/nl-intake.md` names the
judgment dependency the prior research selected. Resolve that name EXACTLY and report it in J1
before any web work; every later row is about that provider unless J1 shows the name is unusable.

| id | question | finding | evidence |
|---|---|---|---|
| J1 | Which judgment provider/model does the archive name, spelled exactly, and what evidence backs the choice? | TypeSafe System One model `jev-1.13.0`, called at `POST https://api.typesafe.ai/v1/systemone`; prior probes selected it after measuring routing, abstention, Japanese input, cost, and the hatch control. | `.agent/archive/nl-intake.md:46-69` |
| J2 | That provider's structured-output surface (JSON schema / tool call / grammar): exact request field names + guarantees. | `systemOne({state,model?,questions})`; questions use `type/instructions/criteria`. Answers keep IDs and fixed Noul/Choice shapes. No caller schema/tool/grammar or generated strings: unsupported terms need pre-enumerated candidates or other code. | https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md |
| J3 | Determinism controls: temperature, seed, top_p — what the vendor actually promises, not what is folklore. | No documented `temperature`, `seed`, or `top_p`, and no determinism promise. Vendor repeat tests changed an irrelevant `uid` and saw label flips; they cannot isolate identical-request variance. Pinning fixes model version only. | https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook.md |
| J4 | Model fit for one request returning ~24 boolean condition judgments + one scope choice + an `other` hatch: which model tier, and why. | Use pinned System One `jev-1.13.0`, not a moving alias. Noul + Choice exactly fit the job; 25 parallel questions fit far below its 64k context and 255-option cap. Keep related judgments independent and enforce relationships in code. | https://docs.typesafe.ai/models.md |
| J5 | Price per request at the payload size implied by 24 conditions + a free-text description, and latency. | Current price is $0.042/M input tokens; output is free. The closest repo run averaged 3,168 input tokens and 0.75 s: ≈$0.000133/request. This is a planning estimate; capture first live `usage` because 25 questions differ and no latency SLA is stated. | https://docs.typesafe.ai/models.md; `.agent/archive/nl-intake.md:85-86` |
| J6 | Error surface: rate limit, refusal, timeout, malformed JSON — the exact status codes/bodies a client must handle. | Terminal 400/401/403/404/422; retry 408/429/5xx (incl. 529), connection/timeout; abort never. Error body is untyped JSON/text plus `x-typesafe-request-id`; no refusal envelope. SDK casts any 2xx, so runtime-validate. | https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/client.ts; https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/errors.ts |
| J7 | Deterministic stub seam: the cleanest way to run the whole path offline with a fixture set, given the gate must stay network-free except `audit:check`. | Inject one domain `JudgmentClient`. Production posts to the Worker; a fixture stub exact-matches descriptions, returns cloned committed results, honors abort, and throws on misses. Gate tests never import the provider SDK or touch network. | `src/demo/DemoController.svelte.ts:51-64,120` |
| J8 | Browser-side fetch shape through a Worker proxy: request body, response body, streaming or not. | Browser posts `{description,catalogVersion}`. Worker owns fixed questions/key and returns validated `{catalogVersion,model,conditions,scope}`. Use one JSON response: System One has no streaming contract; atomic judgments have no useful partial state. | https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md |
| J9 | Held-out probe set + gold format: what shape lets a committed fixture grade accuracy without a live key. | Gold and replay stay separate. Gold holds id/locale/description plus expected outcome, condition IDs, scope, and unsupported terms. Jev snapshots hold probabilities, model, and request hash. Stub replays them; evaluator compares with fixed gold. | `.agent/archive/nl-intake.md:96-103` |
| J10 | The forced-arm control (hatch removed) — how other projects express a control that MUST fire, applied here. | Pair negative probes; mutate the real scope criteria by deleting only `other`. `requireFiring` must see ≥1 named baseline-refused case become answered/wrongly matched; zero is control failure. Commit paired Jev snapshots so the gate stays offline. | `tools/control.mjs:21-39`; `.agent/archive/nl-intake.md:54,68-72` |

## Detail

### J2 — one Jev request

```ts
import {
  choice,
  noul,
  TypeSafeClient,
  type NoulQuestion,
  type Questions,
} from '@typesafe-ai/sdk';

import {
  CATALOG_VERSION,
  CONDITIONS,
  SCOPE_CRITERIA,
} from './judgment-catalog.js';

const conditionQuestions = Object.fromEntries(
  CONDITIONS.map(({ id, situation }) => [
    `condition:${id}`,
    noul(
      {
        task: 'Does `patientDescription` support every material element of `situation`?',
        situation,
      },
      {
        true: 'Every material element is stated or entailed by the description.',
        false: 'At least one material element is absent, contradicted, or only possible.',
      },
    ),
  ]),
) as Record<`condition:${string}`, NoulQuestion>;

const questions = {
  ...conditionQuestions,
  scope: choice(
    {
      task: 'Select the pain-type and therapy-phase scope best supported by `patientDescription`.',
      fallback: 'Select `other` when no listed scope fits.',
    },
    SCOPE_CRITERIA,
  ),
} satisfies Questions;

const jev = new TypeSafeClient({
  apiKey: env.TYPESAFE_API_KEY,
  defaultModel: 'jev-1.13.0',
  timeout: PROVIDER_TIMEOUT_MS,
});

const raw = await jev.systemOne(
  {
    state: { patientDescription: description },
    model: 'jev-1.13.0',
    questions,
  },
  {
    signal,
    timeout: PROVIDER_TIMEOUT_MS,
    retry: { maxRetries: PROVIDER_MAX_RETRIES },
  },
);

return parseJevResult(raw, {
  catalogVersion: CATALOG_VERSION,
  conditions: CONDITIONS,
  scopeCriteria: SCOPE_CRITERIA,
});
```

Assumptions MAIN must bind:

- This code runs inside the Worker. `env.TYPESAFE_API_KEY` is a Worker secret binding.
- `CONDITIONS` comes from the generated `clinical_rule/3` artifact. Its ids are stable and its
  24 situation strings are not rewritten in the adapter.
- `SCOPE_CRITERIA` is the generated pain-type × therapy-phase choice and contains `other`.
- Only the description enters provider `state`; catalog metadata stays code-side because irrelevant
  state is a documented accuracy hazard.
- **Binding gap:** 24 Nouls plus one scope Choice cannot emit an arbitrary unsupported phrase.
  Choice can only return a supplied option. The required no-vocabulary term list therefore needs
  deterministic/pre-parsed candidate discovery, or a user-approved extra typed judgment surface;
  this seam must not invent `unsupportedTerms`.
- `PROVIDER_TIMEOUT_MS` and `PROVIDER_MAX_RETRIES` fit the unit's total deadline. SDK timeout
  is per attempt; it supplies no total retry budget.
- `parseJevResult` is mandatory. SDK 0.6.0 only casts a 2xx body. It must require resolved model
  `jev-1.13.0`, all and only declared answer ids, answer discriminants, finite values in [0,1],
  the complete Choice distribution, an allowed `choice`, and a probability-sum tolerance.
- The native contract supplies typed Noul/Choice fields. It does not make the clinical judgment
  true and does not make repeated calls deterministic.

Sources: https://docs.typesafe.ai/sdk/javascript.md,
https://docs.typesafe.ai/primitives/noul.md,
https://docs.typesafe.ai/primitives/choice.md,
https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md,
https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/client.ts

### J7 — injectable replay client

```ts
export interface JudgmentRequest {
  readonly description: string;
  readonly catalogVersion: string;
}

export interface JudgmentResult {
  readonly schemaVersion: 1;
  readonly catalogVersion: string;
  readonly model: 'jev-1.13.0';
  readonly conditions: Readonly<Record<ConditionId, number>>;
  readonly scope: {
    readonly choice: ScopeId | 'other';
    readonly confidence: number;
    readonly probabilities: Readonly<Record<ScopeId | 'other', number>>;
  };
}

export interface JudgmentClient {
  judge(request: JudgmentRequest, signal?: AbortSignal): Promise<JudgmentResult>;
}

type ReplayCase = {
  readonly request: JudgmentRequest;
  readonly response: JudgmentResult;
};

const replayKey = ({ catalogVersion, description }: JudgmentRequest): string =>
  `${catalogVersion}\u0000${description}`;

export class ReplayJudgmentClient implements JudgmentClient {
  readonly #cases: ReadonlyMap<string, JudgmentResult>;

  constructor(cases: readonly ReplayCase[]) {
    this.#cases = new Map(cases.map(({ request, response }) => [replayKey(request), response]));
  }

  async judge(request: JudgmentRequest, signal?: AbortSignal): Promise<JudgmentResult> {
    signal?.throwIfAborted();
    const response = this.#cases.get(replayKey(request));
    if (response === undefined) throw new Error('No exact judgment replay for description');
    await Promise.resolve(); // Preserve the production async boundary.
    signal?.throwIfAborted();
    return structuredClone(response);
  }
}
```

Assumptions MAIN must bind:

- The browser production implementation of this same interface posts to the Worker. The browser
  never imports `@typesafe-ai/sdk`.
- Exact description matching is deliberate. A missing case fails closed rather than silently
  returning a default judgment.
- `structuredClone` prevents one test from mutating the committed replay used by another.
- Tests inject the client into the intake controller, matching the existing `DemoEngine`
  constructor seam. Provider transport tests separately inject SDK `fetch`; end-to-end tests do
  not mock global `fetch`.

### J9 — gold and provider replay stay separate

```ts
interface ProbeGoldFile {
  readonly schemaVersion: 1;
  readonly catalogVersion: string;
  readonly cases: readonly {
    readonly id: ProbeId;
    readonly partition: 'development' | 'held-out' | 'forced-arm';
    readonly locale: 'en' | 'ja';
    readonly description: string;
    readonly gold:
      | { readonly outcome: 'refused'; readonly reason: 'other' }
      | {
          readonly outcome: 'no-match';
          readonly unsupportedTerms: readonly string[];
        }
      | {
          readonly outcome: 'answered';
          readonly conditionIds: readonly ConditionId[];
          readonly scope: ScopeId;
          readonly recommendationIds: readonly ClinicalRuleId[];
        };
  }[];
}

interface JevReplayFile {
  readonly schemaVersion: 1;
  readonly catalogVersion: string;
  readonly provider: 'typesafe';
  readonly model: 'jev-1.13.0';
  readonly cases: Readonly<
    Record<
      ProbeId,
      {
        readonly requestSha256: string;
        readonly response: JudgmentResult;
        readonly withoutOther?: {
          readonly requestSha256: string;
          readonly response: JudgmentResult;
        };
      }
    >
  >;
}
```

Commit these as two files. The evaluator joins on `id`, rejects catalog/model/request-hash
mismatch, replays `response` through the real selector and Prolog path, and compares the final
outcome plus exact recommendation ids with gold. `withoutOther` exists only on negative control
cases and feeds J10.

Assumptions MAIN must bind:

- Gold freezes before prompt tuning. Widening an accepted set is a contract change, never a way
  to make a score green.
- Every no-match case names the description's asserted terms that the generated vocabulary
  cannot represent. Those terms grade the separate candidate-discovery decision; they do not come
  from `JudgmentResult`, because Jev's chosen primitives cannot generate them.
- Offline replay proves request decoding, selection, Prolog derivation, outcome routing, and UI.
  It does **not** estimate current Jev accuracy. A keyed live probe reports that separately and
  records the resolved model plus per-case verdicts; never label replay accuracy as live accuracy.
- Accuracy acceptance is per-case and outcome-aware. An aggregate percentage never hides a
  refused/no-match/answered class failure.

### packaging

- Package: exact-pin `@typesafe-ai/sdk@0.6.0`. `jev-1.13.0` is a model id, not another package.
- Node: package engine is `>=20`; project Node 20.19.0 and deploy Node 22.12+ both satisfy it.
- Browser: constructor refuses browser execution by default. `dangerouslyAllowBrowser: true`
  exists but exposes the key and is forbidden for this product.
- Cloudflare Worker: vendor prose names Node only, so this is source-backed compatibility rather
  than an explicit support promise. Version 0.6.0 detects `Cloudflare-Workers`, tolerates absent
  `process`, uses global Fetch APIs, and its ESM distribution test rejects Node built-ins. Pass
  the secret explicitly: `new TypeSafeClient({ apiKey: env.TYPESAFE_API_KEY })`.
- Build: the package ships ESM, CommonJS, and declarations. Consumers do not build the SDK.
  Wrangler bundles the Worker normally; the SDK itself needs no `nodejs_compat` flag.

Sources: https://registry.npmjs.org/@typesafe-ai%2Fsdk/latest,
https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md,
https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/runtime.ts,
https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/env.ts

RES-JUDGMENT-1-DONE-1
