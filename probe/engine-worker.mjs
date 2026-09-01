import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const loaded = require('swipl-wasm/dist/loadImageDefault.js');
const loadImage = typeof loaded === 'function' ? loaded : loaded.default;
const port = parentPort;
if (port === null) throw new Error('worker requires a parent port');

const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';
const CATEGORY_A_DISPLAY_GOAL = `${CATEGORY_A_GOAL.slice(0, -1)},term_string(A,AS,[quoted(true),numbervars(true),ignore_ops(true)]).`;

let engine;
let diagnostics = [];

const record = (source, stream, text) => {
  diagnostics.push({ source, stream, text: String(text) });
};

const drainDiagnostics = () => {
  const drained = diagnostics;
  diagnostics = [];
  return drained;
};

const isRecord = (value) => typeof value === 'object' && value !== null;

const decodeNative = (value) => {
  if (typeof value === 'string') return { kind: 'atom', value };
  if (typeof value === 'bigint') return { kind: 'integer', value: value.toString() };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite native number');
    return {
      kind: Number.isSafeInteger(value) ? 'integer' : 'float',
      value,
    };
  }
  if (Array.isArray(value)) return { kind: 'list', items: value.map(decodeNative) };
  if (!isRecord(value)) throw new Error(`unsupported native value: ${String(value)}`);
  if (value.$t === 's' && typeof value.v === 'string') return { kind: 'string', value: value.v };
  if (value.$t === 'r') {
    return {
      kind: 'rational',
      numerator: String(value.n),
      denominator: String(value.d),
    };
  }
  if (value.$t === 'v') return { kind: 'variable', id: Number(value.v) };
  if (value.$t === 'l' && Array.isArray(value.v)) {
    return {
      kind: 'improper-list',
      items: value.v.map(decodeNative),
      tail: decodeNative(value.t),
    };
  }
  if (value.$t === 't' && typeof value.functor === 'string') {
    const packed = value[value.functor];
    if (!Array.isArray(packed) || packed.length !== 1 || !Array.isArray(packed[0])) {
      throw new Error(`compound ${value.functor} lacks its argument envelope`);
    }
    return {
      kind: 'compound',
      functor: value.functor,
      args: packed[0].map(decodeNative),
    };
  }
  if (typeof value.$tag === 'string' && value.$tag !== 'bindings') {
    return {
      kind: 'dict',
      tag: value.$tag,
      entries: Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== '$tag')
          .map(([key, item]) => [key, decodeNative(item)]),
      ),
    };
  }
  throw new Error(`unsupported native tag: ${String(value.$t ?? value.$tag)}`);
};

const normalizeOnce = (value) => {
  if (!isRecord(value)) throw new Error('query returned a non-record');
  if (value.error === true) return { kind: 'error', message: String(value.message) };
  if (value.success === false) return { kind: 'failure' };
  const bindings = {};
  for (const [name, term] of Object.entries(value)) {
    if (name !== '$tag' && name !== 'success') bindings[name] = decodeNative(term);
  }
  return { kind: 'bindings', bindings };
};

const requireEngine = () => {
  if (engine === undefined) throw new Error('engine is not booted');
  return engine;
};

const atomOrString = (value) => {
  const decoded = decodeNative(value);
  if (decoded.kind !== 'atom' && decoded.kind !== 'string') {
    throw new Error(`expected text, received ${decoded.kind}`);
  }
  return decoded.value;
};

const numberBinding = (result, name) => {
  const value = result[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${name} is not a safe integer`);
  }
  return value;
};

const readContract = () => {
  const prolog = requireEngine().prolog;
  const schema = prolog
    .query(
      'findall(V,guideline_schema_version(V),Vs),sort(Vs,Us),length(Us,D),max_list(Us,Hi),min_list(Us,Lo).',
    )
    .once();
  const documents = prolog.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).').once();
  return {
    schemaVersion: numberBinding(schema, 'Hi'),
    distinctSchemaVersions: numberBinding(schema, 'D'),
    documents: numberBinding(documents, 'N'),
  };
};

const boot = async () => {
  if (engine !== undefined) return { reused: true, contract: readContract(), bootMs: 0 };
  const start = performance.now();
  const image = new Uint8Array(readFileSync(workerData.imagePath));
  engine = await loadImage(image)({
    print: (line) => record('print', 'stdout', line),
    printErr: (line) => record('printErr', 'stderr', line),
    on_output: (text, stream) => record('on_output', stream, text),
    onAbort: (reason) => record('onAbort', 'stderr', reason),
  });
  return {
    reused: false,
    contract: readContract(),
    bootMs: performance.now() - start,
    diagnostics: drainDiagnostics(),
  };
};

const parseGoal = (goal) => {
  const parsed = normalizeOnce(
    requireEngine().prolog.query('term_string(T,S).', { S: goal }).once(),
  );
  if (parsed.kind !== 'bindings') {
    return {
      ok: false,
      error: {
        code: 'malformed-goal',
        message: parsed.kind === 'error' ? parsed.message : `goal does not parse: ${goal}`,
      },
    };
  }
  return { ok: true };
};

const runDriven = ({ goal, wallMs, cap, captureVar, displayVar }) => {
  const parsed = parseGoal(goal);
  if (!parsed.ok) return { status: 'error', error: parsed.error, count: 0, stepMs: [] };

  const prolog = requireEngine().prolog;
  const query = prolog.query(goal);
  const iterator = query[Symbol.iterator]();
  const started = performance.now();
  const deadline = started + wallMs;
  const stepMs = [];
  const captured = [];
  let count = 0;

  for (;;) {
    if (performance.now() >= deadline) {
      query.close();
      return {
        status: 'wallclock-limit',
        count,
        elapsedMs: performance.now() - started,
        stepMs,
        captured,
      };
    }
    if (count >= cap) {
      query.close();
      return {
        status: 'solution-limit',
        count,
        elapsedMs: performance.now() - started,
        stepMs,
        captured,
      };
    }

    const stepStarted = performance.now();
    const step = iterator.next();
    const stepEnded = performance.now();
    stepMs.push(stepEnded - stepStarted);

    if (stepEnded >= deadline) {
      query.close();
      return { status: 'wallclock-limit', count, elapsedMs: stepEnded - started, stepMs, captured };
    }
    if (step.error === true) {
      query.close();
      return {
        status: 'error',
        error: { code: 'prolog', message: String(step.message) },
        count,
        elapsedMs: stepEnded - started,
        stepMs,
        captured,
      };
    }
    if (step.value !== undefined) {
      if (
        captureVar !== undefined &&
        isRecord(step.value) &&
        step.value[captureVar] !== undefined
      ) {
        captured.push({
          term: decodeNative(step.value[captureVar]),
          display:
            displayVar !== undefined && step.value[displayVar] !== undefined
              ? atomOrString(step.value[displayVar])
              : undefined,
        });
      }
      count += 1;
    }
    if (step.done === true) {
      return {
        status: 'complete',
        count,
        elapsedMs: performance.now() - started,
        stepMs,
        captured,
      };
    }
  }
};

const slice = ({ runs, wallMs, cap }) => {
  const measured = [];
  for (let index = 0; index < runs; index += 1) {
    measured.push(
      runDriven({
        goal: index === 0 ? CATEGORY_A_DISPLAY_GOAL : CATEGORY_A_GOAL,
        wallMs,
        cap,
        captureVar: index === 0 ? 'A' : undefined,
        displayVar: index === 0 ? 'AS' : undefined,
      }),
    );
  }
  const capProbe = runDriven({ goal: 'between(1,100,X).', wallMs, cap: 5, captureVar: 'X' });
  return {
    runs,
    wallMs,
    cap,
    statuses: measured.map((run) => run.status),
    counts: measured.map((run) => run.count),
    elapsedMs: measured.map((run) => run.elapsedMs),
    stepMs: measured.flatMap((run) => run.stepMs),
    solutions: measured[0].captured,
    capProbe: {
      status: capProbe.status,
      count: capProbe.count,
      captured: capProbe.captured.map(({ term }) => term),
    },
  };
};

const state = () => {
  const result = requireEngine()
    .prolog.query(
      "findall(D,guideline_document(D,_,_),Ds),length(Ds,N),(guideline_document('__spike_overlay__',_,_)->Seen=true;Seen=false).",
    )
    .once();
  return {
    documents: numberBinding(result, 'N'),
    overlaySeen: String(result.Seen) === 'true',
  };
};

const overlay = () => {
  const result = normalizeOnce(
    requireEngine()
      .prolog.query(
        "dynamic(guideline_document/3),assertz(guideline_document('__spike_overlay__','__probe__','__probe__')).",
      )
      .once(),
  );
  return { result, state: state() };
};

const runtimeConsult = () => {
  const live = requireEngine();
  drainDiagnostics();
  live.FS.writeFile('probe-ok.pl', 'probe_runtime_ok(ready).\n');
  const valid = normalizeOnce(live.prolog.query("consult('probe-ok.pl').").once());
  const validDiagnostics = drainDiagnostics();

  live.FS.writeFile('probe-bad.pl', 'probe_runtime_bad(.\n');
  const malformed = normalizeOnce(live.prolog.query("consult('probe-bad.pl').").once());
  const malformedDiagnostics = drainDiagnostics();
  const parseGuard = parseGoal('probe_runtime_bad(');

  return {
    valid,
    validDiagnostics,
    malformed,
    malformedDiagnostics,
    failClosed: malformedDiagnostics.length > 0,
    parseGuard,
  };
};

const drainGoal = (goal, driven, wallMs, cap) => {
  if (driven) return runDriven({ goal, wallMs, cap });
  const query = requireEngine().prolog.query(goal);
  const iterator = query[Symbol.iterator]();
  let count = 0;
  for (;;) {
    const step = iterator.next();
    if (step.error === true) throw new Error(String(step.message));
    if (step.value !== undefined) count += 1;
    if (step.done === true) return count;
  }
};

const stats = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const quantile = (fraction) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
  return {
    count: sorted.length,
    meanMs: sum / sorted.length,
    medianMs: quantile(0.5),
    p95Ms: quantile(0.95),
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
};

const benchmark = ({ pairs, wallMs, cap }) => {
  const guardedPlain = () => {
    const parsed = parseGoal(CATEGORY_A_GOAL);
    if (!parsed.ok) throw new Error(parsed.error.message);
    return drainGoal(CATEGORY_A_GOAL, false, wallMs, cap);
  };
  guardedPlain();
  drainGoal(CATEGORY_A_GOAL, true, wallMs, cap);
  const plain = [];
  const driven = [];
  for (let index = 0; index < pairs; index += 1) {
    const order = index % 2 === 0 ? [false, true] : [true, false];
    for (const useDriver of order) {
      const started = performance.now();
      const result = useDriver ? drainGoal(CATEGORY_A_GOAL, true, wallMs, cap) : guardedPlain();
      const elapsed = performance.now() - started;
      if (useDriver) {
        if (result.status !== 'complete' || result.count !== 7)
          throw new Error('driver benchmark diverged');
        driven.push(elapsed);
      } else {
        if (result !== 7) throw new Error('plain benchmark diverged');
        plain.push(elapsed);
      }
    }
  }
  return {
    pairs,
    plain: stats(plain),
    driven: stats(driven),
    delta: stats(driven.map((value, index) => value - plain[index])),
  };
};

const memory = ({ stackLimit, cells }) => {
  const live = requireEngine();
  const prolog = live.prolog;
  const before = normalizeOnce(prolog.query('current_prolog_flag(stack_limit,L).').once());
  const configured = normalizeOnce(
    prolog
      .query(`set_prolog_flag(stack_limit,${stackLimit}),current_prolog_flag(stack_limit,L).`)
      .once(),
  );
  live.FS.writeFile(
    'probe-memory.pl',
    `probe_memory_allocate :- length(L,${cells}),nb_setval('__spike_hold__',L).\n`,
  );
  const helper = normalizeOnce(prolog.query("consult('probe-memory.pl').").once());
  const helperDiagnostics = drainDiagnostics();
  port.postMessage({ event: 'memory-start', cells, stackLimit, at: performance.now() });
  let allocation;
  let thrown;
  try {
    allocation = normalizeOnce(prolog.query('probe_memory_allocate.').once());
  } catch (cause) {
    thrown = {
      name: cause instanceof Error ? cause.name : typeof cause,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  const allocationDiagnostics = drainDiagnostics();
  let recovery;
  try {
    recovery = normalizeOnce(prolog.query('X=engine_recovered.').once());
  } catch (cause) {
    recovery = {
      kind: 'thrown',
      name: cause instanceof Error ? cause.name : typeof cause,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  return {
    before,
    configured,
    helper,
    helperDiagnostics,
    allocation,
    thrown,
    allocationDiagnostics,
    recovery,
  };
};

const heapRunaway = ({ chunkCells }) => {
  const prolog = requireEngine().prolog;
  const prepared = normalizeOnce(
    prolog.query("dynamic('__spike_heap__'/1),retractall('__spike_heap__'(_)).").once(),
  );
  drainDiagnostics();
  port.postMessage({ event: 'memory-start', chunkCells, at: performance.now() });
  let exhaustion;
  let thrown;
  try {
    exhaustion = normalizeOnce(
      prolog.query(`repeat,length(L,${chunkCells}),assertz('__spike_heap__'(L)),fail.`).once(),
    );
  } catch (cause) {
    thrown = {
      name: cause instanceof Error ? cause.name : typeof cause,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  const exhaustionDiagnostics = drainDiagnostics();
  let recovery;
  try {
    recovery = normalizeOnce(prolog.query('X=engine_recovered.').once());
  } catch (cause) {
    recovery = {
      kind: 'thrown',
      name: cause instanceof Error ? cause.name : typeof cause,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  let categoryRecovery;
  try {
    categoryRecovery = { kind: 'solutions', count: drainGoal(CATEGORY_A_GOAL, false) };
  } catch (cause) {
    categoryRecovery = {
      kind: 'thrown',
      name: cause instanceof Error ? cause.name : typeof cause,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  return {
    prepared,
    exhaustion,
    thrown,
    exhaustionDiagnostics,
    recovery,
    categoryRecovery,
  };
};

const dispatch = async (message) => {
  switch (message.kind) {
    case 'boot':
      return boot();
    case 'slice':
      return slice(message);
    case 'spin': {
      const timerStarted = performance.now();
      setTimeout(() => {
        port.postMessage({
          event: 'worker-timer',
          delayMs: performance.now() - timerStarted,
        });
      }, message.workerTimerMs);
      const query = requireEngine().prolog.query('repeat,fail.');
      const iterator = query[Symbol.iterator]();
      port.postMessage({ event: 'spin-start', at: performance.now() });
      const stepStarted = performance.now();
      const step = iterator.next();
      return { returned: true, stepMs: performance.now() - stepStarted, step };
    }
    case 'state':
      return state();
    case 'overlay':
      return overlay();
    case 'consult':
      return runtimeConsult();
    case 'benchmark':
      return benchmark(message);
    case 'memory':
      return memory(message);
    case 'heap':
      return heapRunaway(message);
    default:
      throw new Error(`unknown command: ${String(message.kind)}`);
  }
};

port.on('message', (message) => {
  void (async () => {
    try {
      const result = await dispatch(message);
      port.postMessage({ id: message.id, ok: true, result });
    } catch (cause) {
      port.postMessage({
        id: message.id,
        ok: false,
        error: {
          code: 'probe',
          name: cause instanceof Error ? cause.name : typeof cause,
          message: cause instanceof Error ? cause.message : String(cause),
        },
      });
    }
  })();
});
