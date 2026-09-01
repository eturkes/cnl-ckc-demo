const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const loadImageModule = require('swipl-wasm/dist/loadImageDefault');

const loadImageDefault = loadImageModule.default ?? loadImageModule;
const categoryAGoal =
  "guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),guideline_entity(actual,B,'category-A-recommendation',countable),guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)";

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
  const { createEncoder, decodeBindings } = await import(decoderUrl);
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

  if (mode === 'encode-smoke') {
    const [row] = solutions(module, categoryAGoal, decodeBindings);
    const encoded = createEncoder(module.prolog)(row.A);
    console.log(
      json(
        module.prolog
          .query('term_string(Input,S,[quoted(true),numbervars(true),ignore_ops(true)]).', {
            Input: encoded,
          })
          .once(),
      ),
    );
    return;
  }

  throw new Error(`unknown mode: ${mode}`);
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
