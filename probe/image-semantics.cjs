'use strict';

const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { generateImageBuffer } = require('swipl-wasm/dist/generateImage');
const loadImageDefault = require('swipl-wasm/dist/loadImageDefault').default;

const kbDir = process.env.KB_PL_DIR || process.argv[2];
if (!kbDir) throw new Error('set KB_PL_DIR or pass the payload directory');

const files = readdirSync(kbDir).filter((name) => name.endsWith('.pl')).sort();
const join = (ordered) => ordered
  .map((name) => `\n% file:${name}\n${readFileSync(`${kbDir}/${name}`, 'utf8')}\n`)
  .join('');
const describe = (buffer) => ({
  sha256: createHash('sha256').update(buffer).digest('hex'),
  bytes: buffer.length,
});
const documents = (module) => module.prolog
  .query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).')
  .once().N;

async function load(image) {
  const diagnostics = [];
  const module = await loadImageDefault(image)({
    arguments: ['-q'],
    print() {},
    printErr() {},
    on_output(text, stream) { diagnostics.push({ stream, text }); },
  });
  return { module, diagnostics };
}

function attempt(module, goal) {
  const consoleOutput = [];
  const originalLog = console.log;
  console.log = (...parts) => consoleOutput.push(parts.join(' '));
  try {
    return { returned: module.prolog.query(goal).once(), consoleOutput };
  } catch (error) {
    return { threw: String(error), consoleOutput };
  } finally {
    console.log = originalLog;
  }
}

async function main() {
  const sortedImage = Buffer.from(await generateImageBuffer(join(files)));
  const reversedImage = Buffer.from(await generateImageBuffer(join([...files].reverse())));
  const sorted = await load(sortedImage);
  const reversed = await load(reversedImage);

  const predicates = [
    ['guideline_schema_version/1', 'guideline_schema_version(_)'],
    ['guideline_document/3', 'guideline_document(_,_,_)'],
    ['guideline_entity/4', 'guideline_entity(_,_,_,_)'],
    ['guideline_cardinality/5', 'guideline_cardinality(_,_,_,_,_)'],
    ['guideline_event/3', 'guideline_event(_,_,_)'],
    ['guideline_arg/4', 'guideline_arg(_,_,_,_)'],
    ['guideline_pp/4', 'guideline_pp(_,_,_,_)'],
    ['guideline_property/4', 'guideline_property(_,_,_,_)'],
    ['guideline_operator/3', 'guideline_operator(_,_,_)'],
  ];
  const properties = Object.fromEntries(predicates.map(([indicator, head]) => {
    const result = sorted.module.prolog.query([
      `(predicate_property(${head},multifile)->M=true;M=false)`,
      `(predicate_property(${head},dynamic)->D=true;D=false)`,
      `predicate_property(${head},number_of_clauses(N))`,
    ].join(',')).once();
    return [indicator, { multifile: result.M, dynamic: result.D, numberOfClauses: result.N }];
  }));

  const overlay = "guideline_entity(actual,'$spike_overlay',spike_overlay,countable)";
  const direct = await load(sortedImage);
  const directAssert = attempt(direct.module, `assertz(${overlay}).`);
  const directVisible = attempt(direct.module, `${overlay}.`);
  const mutable = await load(sortedImage);
  const dynamicAssert = attempt(mutable.module, `dynamic(guideline_entity/4),assertz(${overlay}).`);
  const dynamicVisible = attempt(mutable.module, `${overlay}.`);
  const dynamicProperty = attempt(
    mutable.module,
    '(predicate_property(guideline_entity(_,_,_,_),dynamic)->D=true;D=false).',
  );
  const fresh = await load(sortedImage);
  const freshVisible = attempt(fresh.module, `${overlay}.`);

  process.stdout.write(`${JSON.stringify({
    orderSensitivity: {
      sorted: { ...describe(sortedImage), documents: documents(sorted.module), diagnostics: sorted.diagnostics },
      reversed: { ...describe(reversedImage), documents: documents(reversed.module), diagnostics: reversed.diagnostics },
    },
    properties,
    mutability: {
      overlay,
      directAssert,
      directVisible,
      directDiagnostics: direct.diagnostics,
      dynamicAssert,
      dynamicVisible,
      dynamicProperty,
      mutableDiagnostics: mutable.diagnostics,
      freshVisible,
      freshDiagnostics: fresh.diagnostics,
    },
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
