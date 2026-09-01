const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { pathToFileURL } = require('node:url');
const { MessageChannel } = require('node:worker_threads');
const loadImageModule = require('swipl-wasm/dist/loadImageDefault');

const loadImageDefault = loadImageModule.default ?? loadImageModule;
const categoryAGoal =
  "guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),guideline_entity(actual,B,'category-A-recommendation',countable),guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)";
const termCases = [
  ['foo(bar,7)', 'X=foo(bar,7)'],
  ['1r3', 'X is 1 rdiv 3'],
  ['3r1', 'X is 3 rdiv 1'],
  ['atom', 'X=hello'],
  ['Prolog string', 'X="hello"'],
  ['big integer', 'X=123456789012345678901234567890'],
  ['operator term', 'X=(a-b)'],
  ['empty list', 'X=[]'],
  ['unbound variable', 'X=X'],
  ['nested compound', 'X=outer(inner(x),[y])'],
  ['improper list', 'X=[a|b]'],
];

const json = (value) =>
  JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? `${item}n` : item), 2);

async function engine() {
  const image = fs.readFileSync(path.resolve(__dirname, '../kb/generated/kb.pvm'));
  return loadImageDefault(image)({ arguments: ['-q'], print() {}, printErr() {} });
}

function solutions(module, goal, decodeBindings) {
  const query = module.prolog.query(`${goal}.`);
  const rows = [];
  for (;;) {
    const step = query.next();
    if (step.done) return rows;
    rows.push(decodeBindings(step.value));
  }
}

function rawSolutionCount(module, goal) {
  const query = module.prolog.query(`${goal}.`);
  let count = 0;
  for (;;) {
    const step = query.next();
    if (step.done) return count;
    count += 1;
  }
}

function prologText(value) {
  return typeof value === 'string' ? value : value.v;
}

function canonicalDisplay(module, createEncoder, term) {
  const encoded = createEncoder(module.prolog)(term);
  const result = module.prolog
    .query('term_string(Input,S,[quoted(true),numbervars(true),ignore_ops(true)]).', {
      Input: encoded,
    })
    .once();
  return prologText(result.S);
}

function renderingComparison(module, createEncoder, term) {
  const encoded = createEncoder(module.prolog)(term);
  const result = module.prolog
    .query(
      'term_string(Input,S,[quoted(true),numbervars(true),ignore_ops(true)]),with_output_to(string(W),write_canonical(Input)),message_to_string(Input,M).',
      { Input: encoded },
    )
    .once();
  return {
    termString: prologText(result.S),
    writeCanonical: prologText(result.W),
    message: prologText(result.M),
  };
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function show(term) {
  switch (term.kind) {
    case 'atom':
      return `atom(${term.value})`;
    case 'string':
      return `string(${JSON.stringify(term.value)})`;
    case 'integer':
      return `integer(${term.value}${typeof term.value === 'bigint' ? 'n' : ''})`;
    case 'float':
      return `float(${term.value})`;
    case 'rational':
      return `rational(${term.numerator}/${term.denominator})`;
    case 'list':
      return `list(${term.items.map(show).join(',')})`;
    case 'improper-list':
      return `improper(${term.items.map(show).join(',')}|${show(term.tail)})`;
    case 'compound':
      return `compound(${term.functor};${term.args.map(show).join(',')})`;
    case 'variable':
      return 'variable(_)';
    case 'dict':
      return `dict(${term.tag};${Object.entries(term.entries)
        .map(([key, value]) => `${key}:${show(value)}`)
        .join(',')})`;
  }
}

(async () => {
  const decoderUrl = pathToFileURL(path.resolve(process.argv[2])).href;
  const mode = process.argv[3];
  const { createEncoder, decodeBindings, decodeOnce, decodeTerm } = await import(decoderUrl);
  const module = await engine();

  if (mode === 'slice' || mode === 'shape') {
    const documentCount = module.prolog
      .query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).')
      .once().N;
    const bindings = solutions(module, categoryAGoal, decodeBindings);
    const reply = {
      kind: 'solutions',
      requestId: 'slice-1',
      documentCount,
      solutions: bindings.map((row) => ({ bindings: { A: row.A }, display: {} })),
    };
    if (mode === 'slice') {
      console.log(
        json({
          documentCount,
          solutionCount: bindings.length,
          decodedA: bindings.map((row) => show(row.A)),
        }),
      );
      return;
    }
    const clone = structuredClone(reply);
    assert.deepStrictEqual(clone, reply);
    console.log(json({ cloneEqual: true, reply }));
    return;
  }

  if (mode === 'traps') {
    const raw = module.prolog
      .query(
        [
          'Compound=foo(bar,7)',
          'OneThird is 1 rdiv 3',
          'ThreeRone is 3 rdiv 1',
          'Atom=hello',
          'String="hello"',
          'Big=123456789012345678901234567890',
          'Operator=(a-b)',
          'Empty=[]',
          'Nested=outer(inner(x),[y])',
          'Improper=[a|b]',
          'Unbound=Unbound',
        ].join(',') + '.',
      )
      .once();
    const decoded = decodeBindings(raw);
    const checks = {
      'foo(bar,7)': ['Compound', 'compound(foo;atom(bar),integer(7))'],
      '1r3': ['OneThird', 'rational(1/3)'],
      '3r1': ['ThreeRone', 'integer(3)'],
      atom: ['Atom', 'atom(hello)'],
      'Prolog string': ['String', 'string("hello")'],
      'big integer': ['Big', 'integer(123456789012345678901234567890n)'],
      'operator term': ['Operator', 'compound(-;atom(a),atom(b))'],
      'empty list': ['Empty', 'list()'],
      'unbound variable': ['Unbound', 'variable(_)'],
      'nested compound': ['Nested', 'compound(outer;compound(inner;atom(x)),list(atom(y)))'],
      'improper list': ['Improper', 'improper(atom(a)|atom(b))'],
    };
    const results = Object.fromEntries(
      Object.entries(checks).map(([trap, [name, expected]]) => {
        const observed = show(decoded[name]);
        return [trap, { verdict: observed === expected ? 'PASS' : 'FAIL', observed }];
      }),
    );
    const failed = Object.values(results).filter(({ verdict }) => verdict === 'FAIL');
    if (failed.length) process.exitCode = 1;
    console.log(
      json({
        passed: Object.keys(results).length - failed.length,
        total: Object.keys(results).length,
        results,
      }),
    );
    return;
  }

  if (mode === 'roundtrip') {
    const results = {};
    for (const [name, bindingGoal] of termCases) {
      const original = decodeBindings(module.prolog.query(`${bindingGoal}.`).once()).X;
      const encoded = createEncoder(module.prolog)(original);
      const again = decodeBindings(module.prolog.query('Y=Input.', { Input: encoded }).once()).Y;
      const variant = module.prolog.query(`${bindingGoal},Input =@= X.`, { Input: encoded }).once();
      const before = show(original);
      const after = show(again);
      results[name] = {
        verdict: before === after && variant.success === true ? 'PASS' : 'FAIL',
        before,
        after,
        prologVariant: variant.success === true,
      };
    }
    const [liveRow] = solutions(module, categoryAGoal, decodeBindings);
    const liveBefore = show(liveRow.A);
    const liveEncoded = createEncoder(module.prolog)(liveRow.A);
    const liveResult = module.prolog
      .query("Y=Input,functor(Y,'$guideline_id',5),arg(4,Y,Ref),functor(Ref,ref,1),arg(5,Y,[]).", {
        Input: liveEncoded,
      })
      .once();
    const liveAfter = show(decodeBindings(liveResult).Y);
    results['live guideline answer'] = {
      verdict: liveBefore === liveAfter && liveResult.success === true ? 'PASS' : 'FAIL',
      before: liveBefore,
      after: liveAfter,
      prologVariant: liveResult.success === true,
    };
    const failed = Object.entries(results)
      .filter(([, result]) => result.verdict === 'FAIL')
      .map(([name]) => name);
    const total = Object.keys(results).length;
    if (failed.length) process.exitCode = 1;
    console.log(
      json({
        identical: total - failed.length,
        total,
        failed,
        results,
      }),
    );
    return;
  }

  if (mode === 'display') {
    const rows = solutions(module, categoryAGoal, decodeBindings);
    const comparisons = rows.map((row) => renderingComparison(module, createEncoder, row.A));
    const rounds = 100;
    for (let round = 0; round < 5; round += 1)
      for (const row of rows) canonicalDisplay(module, createEncoder, row.A);
    const started = performance.now();
    for (let round = 0; round < rounds; round += 1)
      for (const row of rows) canonicalDisplay(module, createEncoder, row.A);
    const elapsedMs = performance.now() - started;
    const writeCanonicalMatches = comparisons.filter(
      ({ termString, writeCanonical }) => termString === writeCanonical,
    ).length;
    const messageMatches = comparisons.filter(
      ({ termString, message }) => termString === message,
    ).length;
    console.log(
      json({
        bindings: rows.length,
        calls: rounds * rows.length,
        elapsedMs,
        msPerBinding: elapsedMs / (rounds * rows.length),
        writeCanonicalMatches,
        messageMatches,
        sample: comparisons[0],
      }),
    );
    return;
  }

  if (mode === 'errors') {
    const exceptionRaw = structuredClone(
      module.prolog.query("throw(error(domain_error(widget,bad),context(spike/0,'boom'))).").once(),
    );
    const failureRaw = structuredClone(module.prolog.query('fail.').once());
    const malformedQueryRaw = structuredClone(module.prolog.query('foo(.').once());
    let malformedTerm;
    try {
      new module.prolog.Term('foo(');
      malformedTerm = { thrown: false };
    } catch (error) {
      malformedTerm = {
        thrown: true,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        typed: { kind: 'error', error: { kind: 'decode', message: String(error) } },
      };
    }
    const typed = {
      exception: decodeOnce(exceptionRaw),
      failure: decodeOnce(failureRaw),
      malformedQuery: decodeOnce(malformedQueryRaw),
      malformedTerm: malformedTerm.typed,
    };
    assert.equal(typed.exception.kind, 'prolog-error');
    assert.equal(typed.failure.kind, 'failure');
    assert.equal(typed.malformedQuery.kind, 'prolog-error');
    assert.equal(malformedTerm.thrown, true);
    console.log(
      json({
        raw: {
          exception: exceptionRaw,
          failure: failureRaw,
          malformedQuery: malformedQueryRaw,
          malformedTerm,
        },
        typed,
        swallowed: [],
      }),
    );
    return;
  }

  if (mode === 'protocol') {
    const query = module.prolog.query(`${categoryAGoal}.`);
    const queryStarted = performance.now();
    const yieldMs = [];
    const rows = [];
    for (;;) {
      const step = query.next();
      if (step.done) break;
      yieldMs.push(performance.now() - queryStarted);
      rows.push(decodeBindings(step.value));
    }
    assert.equal(rows.length, 7);

    const send = (payloads) =>
      new Promise((resolve) => {
        const { port1, port2 } = new MessageChannel();
        const received = [];
        const started = performance.now();
        port2.on('message', (message) => {
          received.push(message);
          if (received.length === payloads.length) {
            const elapsedMs = performance.now() - started;
            port1.close();
            port2.close();
            resolve({ elapsedMs, received });
          }
        });
        for (const payload of payloads) port1.postMessage(payload);
      });

    const rounds = 200;
    const streamingPayloads = Array.from({ length: rounds }, (_, round) =>
      rows.map((row, index) => ({
        kind: 'solution',
        requestId: `stream-${round}`,
        index,
        binding: row.A,
      })),
    ).flat();
    const batchPayloads = Array.from({ length: rounds }, (_, round) => ({
      kind: 'solutions',
      requestId: `batch-${round}`,
      solutions: rows.map((row) => row.A),
    }));
    const streaming = await send(streamingPayloads);
    const batch = await send(batchPayloads);
    assert.equal(streaming.received[0].requestId, 'stream-0');
    assert.equal(streaming.received.at(-1).requestId, `stream-${rounds - 1}`);
    assert.equal(batch.received[0].requestId, 'batch-0');
    assert.equal(batch.received.at(-1).requestId, `batch-${rounds - 1}`);

    const timerScheduled = performance.now();
    const timer = new Promise((resolve) => setTimeout(() => resolve(performance.now()), 0));
    const blockingStarted = performance.now();
    assert.equal(rawSolutionCount(module, categoryAGoal), 7);
    const blockingEnded = performance.now();
    const timerFired = await timer;
    console.log(
      json({
        requestCorrelation: true,
        iterator: {
          firstSolutionMs: yieldMs[0],
          lastSolutionMs: yieldMs.at(-1),
          solutions: yieldMs.length,
        },
        channel: {
          rounds,
          streamedMessages: streamingPayloads.length,
          streamMsPerQuery: streaming.elapsedMs / rounds,
          streamMsPerSolution: streaming.elapsedMs / streamingPayloads.length,
          batchedMessages: batchPayloads.length,
          batchMsPerQuery: batch.elapsedMs / rounds,
        },
        cancellationConstraint: {
          synchronousQueryMs: blockingEnded - blockingStarted,
          zeroDelayTimerFiredMsAfterSchedule: timerFired - timerScheduled,
          timerLagAfterQueryMs: timerFired - blockingEnded,
          conclusion:
            'the worker cannot process a queued cancel while synchronous next() is running',
        },
      }),
    );
    return;
  }

  if (mode === 'types') {
    const typesUrl = new URL('./types.mjs', decoderUrl).href;
    const { replyKind, requireBinding, termKind } = await import(typesUrl);
    const [row] = solutions(module, categoryAGoal, decodeBindings);
    const binding = requireBinding(row, 'A');
    const reply = {
      kind: 'solutions',
      requestId: 'types-1',
      documentCount: 337,
      solutions: [{ bindings: row, display: {} }],
    };
    console.log(
      json({
        strictCompile: true,
        flags: [
          'strict',
          'noUncheckedIndexedAccess',
          'exactOptionalPropertyTypes',
          'verbatimModuleSyntax',
        ],
        termKind: termKind(binding),
        replyKind: replyKind(reply),
        enforcedNarrowing: [
          'unknown native values',
          'Record index may be undefined',
          'exhaustive discriminants',
        ],
      }),
    );
    return;
  }

  if (mode === 'deps') {
    const base = 'd1cf0c4';
    const cwd = path.resolve(__dirname, '..');
    const currentPackage = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const basePackage = JSON.parse(
      execFileSync('git', ['show', `${base}:package.json`], { cwd, encoding: 'utf8' }),
    );
    const packageDiff = spawnSync(
      'git',
      ['diff', '--quiet', base, '--', 'package.json', 'pnpm-lock.yaml'],
      { cwd },
    );
    const probeDiff = spawnSync('git', ['diff', '--quiet', base, '--', 'probe/decoder.mts'], {
      cwd,
    });
    const newDependencies = Object.keys(currentPackage.dependencies ?? {}).filter(
      (name) => !(name in (basePackage.dependencies ?? {})),
    );
    let consultCalls = 0;
    const consult = module.prolog.consult;
    module.prolog.consult = (...args) => {
      consultCalls += 1;
      return consult.apply(module.prolog, args);
    };
    assert.equal(solutions(module, categoryAGoal, decodeBindings).length, 7);
    module.prolog.consult = consult;
    assert.equal(packageDiff.status, 0);
    assert.equal(probeDiff.status, 1);
    assert.deepStrictEqual(newDependencies, []);
    assert.equal(consultCalls, 0);
    console.log(
      json({
        newDependencies,
        packageOrLockChanged: false,
        positiveControlProbeChanged: true,
        postImageConsultCalls: consultCalls,
        sourceBytes:
          fs.statSync(path.join(cwd, 'probe/decoder.mts')).size +
          fs.statSync(path.join(cwd, 'probe/types.mts')).size,
        buildSurface: ['probe/decoder.mts', 'probe/types.mts', 'existing TypeScript compiler'],
      }),
    );
    return;
  }

  if (mode === 'risk') {
    const query = module.prolog.query(`${categoryAGoal}.`);
    const first = query.next();
    assert.equal(first.done, false);
    const nativeBindings = first.value;
    for (;;) if (query.next().done) break;
    const decoded = decodeBindings(nativeBindings).A;
    const structuredDecoded = decodeBindings(structuredClone(nativeBindings)).A;
    assert.equal(show(structuredDecoded), show(decoded));

    const jsonBindings = JSON.parse(JSON.stringify(nativeBindings));
    let jsonDecodeError;
    try {
      decodeBindings(jsonBindings);
    } catch (error) {
      jsonDecodeError = error instanceof Error ? error.message : String(error);
    }
    const inspectInput = (input) => {
      const result = module.prolog
        .query(
          'term_string(Input,S,[quoted(true),numbervars(true),ignore_ops(true)]),functor(Input,F,N).',
          { Input: input },
        )
        .once();
      return { rendered: prologText(result.S), functor: result.F, arity: result.N };
    };
    const correct = inspectInput(createEncoder(module.prolog)(decoded));
    const jsonReentry = inspectInput(jsonBindings.A);

    const trapNative = module.prolog
      .query('Compound=foo(bar,7),Rational is 1 rdiv 3,String="hello".')
      .once();
    const trapJson = JSON.parse(JSON.stringify(trapNative));
    const collisionNative = module.prolog.query("Functor=functor(x),DollarT='$t'(x).").once();
    const collisions = {};
    for (const name of ['Functor', 'DollarT']) {
      try {
        collisions[name] = { decoded: show(decodeTerm(structuredClone(collisionNative[name]))) };
      } catch (error) {
        collisions[name] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    const declarations = fs.readFileSync(
      path.resolve(__dirname, '../node_modules/swipl-wasm/dist/common.d.ts'),
      'utf8',
    );
    assert.equal(correct.arity, 5);
    assert.equal(jsonReentry.arity, 1);
    assert.equal(typeof jsonDecodeError, 'string');
    assert.equal(declarations.includes('next(): unknown'), true);
    console.log(
      json({
        structuredClone: { decodedEqual: true, realAnswer: correct },
        json: {
          strictDecoderRejected: jsonDecodeError,
          realAnswerReentry: jsonReentry,
          traps: trapJson,
        },
        metadataFunctorCollisions: collisions,
        declarationsExposeUnknown: true,
      }),
    );
    return;
  }

  if (mode === 'cost') {
    const nativeRows = [];
    const nativeQuery = module.prolog.query(`${categoryAGoal}.`);
    for (;;) {
      const step = nativeQuery.next();
      if (step.done) break;
      nativeRows.push(step.value);
    }
    assert.equal(nativeRows.length, 7);
    const adapt = () => {
      const rows = nativeRows.map(decodeBindings);
      const reply = {
        kind: 'solutions',
        requestId: 'cost-1',
        documentCount: 337,
        solutions: rows.map((row) => ({
          bindings: { A: row.A },
          display: { A: canonicalDisplay(module, createEncoder, row.A) },
        })),
      };
      structuredClone(reply);
      return rows.length;
    };
    for (let warmup = 0; warmup < 3; warmup += 1) rawSolutionCount(module, categoryAGoal);
    for (let warmup = 0; warmup < 10; warmup += 1) adapt();
    const plainMs = [];
    const plainRounds = 20;
    for (let round = 0; round < plainRounds; round += 1) {
      const started = performance.now();
      assert.equal(rawSolutionCount(module, categoryAGoal), 7);
      plainMs.push(performance.now() - started);
    }
    const adapterRounds = 200;
    const adapterStarted = performance.now();
    for (let round = 0; round < adapterRounds; round += 1) assert.equal(adapt(), 7);
    const adapterMsPerQuery = (performance.now() - adapterStarted) / adapterRounds;
    console.log(
      json({
        solutionsPerQuery: 7,
        plainRounds,
        plainMeanMs: mean(plainMs),
        plainMedianMs: median(plainMs),
        plainRangeMs: [Math.min(...plainMs), Math.max(...plainMs)],
        adapterRounds,
        adapterMsPerQuery,
        adapterMsPerSolution: adapterMsPerQuery / 7,
        percentOfLocalPlainMean: (adapterMsPerQuery / mean(plainMs)) * 100,
        percentOfEstablishedPlainRange: [
          (adapterMsPerQuery / 220) * 100,
          (adapterMsPerQuery / 140) * 100,
        ],
      }),
    );
    return;
  }

  throw new Error(`unknown mode: ${mode}`);
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
