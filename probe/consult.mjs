import { inspect } from 'node:util';
import { boot } from './lib.mjs';

const { engine, diagnostics } = await boot();
const files = {
  syntax: "probe_before.\nprobe_broken(.\nprobe_after.\n",
  directive: ":- definitely_missing_runtime_predicate.\nprobe_after_directive.\n",
};
for (const [name, source] of Object.entries(files)) {
  engine.FS.writeFile(`/${name}.pl`, source);
}
const results = {};
for (const name of Object.keys(files)) {
  const diagnosticStart = diagnostics.length;
  try {
    results[name] = { kind: 'return', value: engine.prolog.query(`consult('/${name}.pl').`).once() };
  } catch (error) {
    results[name] = { kind: 'throw', value: error };
  }
  results[name].diagnostics = diagnostics.slice(diagnosticStart);
  results[name].fatal = results[name].diagnostics.some((line) => line.startsWith('stderr:ERROR:'));
}
for (const [name, result] of Object.entries(results)) {
  console.log(`${name}_kind=${result.kind}`);
  console.log(`${name}_value=${inspect(result.value, { depth: null, colors: false, compact: true })}`);
  console.log(`${name}_fatal=${result.fatal}`);
  console.log(`${name}_diagnostics=${inspect(result.diagnostics, { depth: null, colors: false })}`);
}
for (const predicate of ['probe_before/0', 'probe_after/0', 'probe_after_directive/0']) {
  const raw = engine.prolog.query(`current_predicate(${predicate}).`).once();
  console.log(`${predicate}_loaded=${raw?.success === true}`);
}
