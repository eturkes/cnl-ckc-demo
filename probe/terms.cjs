const SWIPL = require('swipl-wasm');

(async () => {
  const module = await SWIPL({ arguments: ['-q'], print() {}, printErr() {} });
  const goal = [
    'Atom=plain_atom',
    "Quoted='spaced atom'",
    'String="hello"',
    'Int=42',
    'Negative is -7',
    'Float=3.5',
    'Big=123456789012345678901234567890',
    'Rational is 1 rdiv 3',
    'List=[a,2,"s"]',
    'Improper=[a|b]',
    'Compound=foo(bar,7)',
    'Operator=(a-b)',
    'Dict=tag{k:v,n:2}',
    'term_string(Compound,Rendered,[quoted(true),numbervars(true)])',
    'term_string(Rational,RationalRendered,[quoted(true),numbervars(true)])',
  ].join(', ');
  const native = module.prolog.query(`${goal}.`).once();
  const inputs = [
    ['string', 'hello'],
    ['integer', 42],
    ['float', 3.5],
    ['boolean', true],
    ['null', null],
    ['array', ['a', 2]],
    ['object', { k: 'v', n: 2 }],
    ['compound-json-output-shape', { $t: 't', foo: [['bar', 7]] }],
    ['compound-flat-shape', { $t: 't', foo: ['bar', 7] }],
    ['compound-wrapper', new module.prolog.Compound('foo', 'bar', 7)],
    ['prolog-string-wrapper', new module.prolog.String('hello')],
    ['prolog-term-wrapper', new module.prolog.Term('foo(bar,7)')],
    ['rational-wrapper', new module.prolog.Rational(1, 3)],
  ];
  const roundTrips = [];
  for (const [kind, input] of inputs) {
    try {
      const result = module.prolog.query('X=Input,term_string(X,S,[quoted(true),numbervars(true)]).', { Input: input }).once();
      roundTrips.push({ kind, input, result });
    } catch (error) {
      roundTrips.push({ kind, input, error: String(error) });
    }
  }
  const iter = module.prolog.query('member(X,[a,b]).');
  const iterator = [iter.next(), iter.next(), iter.next()];
  console.log(JSON.stringify({ native, roundTrips, iterator }, (_, value) => typeof value === 'bigint' ? `${value}n` : value));
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
