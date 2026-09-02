// Deterministic checks for u3's four forbidden-surface predicates (M1 review R35).
//
// P6.2-P6.5 are decidable by a script, and CLAUDE.md Engineering gives every
// tool-decidable rule to a deterministic check. Until this step existed they held
// "by construction" — that is, by nobody having broken them yet. Nothing else in
// `pnpm gate` decides any of the four: prettier, eslint, svelte-check, copy-check,
// contrast-check and kb:asset-check all look elsewhere.
//
// Fails closed: a check that cannot find its subject is an error, never a pass.
// Negative control: perturb any pinned surface below and this exits 1 naming it.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ROOT } from './kb/paths.mjs';

const SRC = join(ROOT, 'src');
const PACKAGE_TYPES = join(ROOT, 'node_modules', 'swipl-wasm', 'dist', 'common.d.ts');

/** The one module allowed to import the engine; everything else reaches it by message. */
const ENGINE_OWNER = 'src/engine/worker.ts';

/**
 * Members production code takes off `swipl-wasm` that its `.d.ts` does not declare.
 *
 * Load-bearing and accepted at M1 review R26, which is also why the package is
 * exact-pinned: a version bump must re-verify each one against the shipped types.
 */
const ACCEPTED_UNDECLARED = {
  Query: ['[Symbol.iterator]', 'close'],
  Prolog: ['Compound', 'List', 'Rational', 'String', 'Var'],
};

/** `terms.ts`'s whole export surface, so no decode path escapes the P3 trap battery. */
const TERMS_EXPORTS = [
  'PlInteger',
  'PlTerm',
  'PlBindings',
  'PrologConstructors',
  'DecodeError',
  'decodeTerm',
  'decodeBindings',
  'OnceResult',
  'decodeOnce',
  'createEncoder',
];

/** @type {string[]} */
const problems = [];

/**
 * @param {boolean} ok
 * @param {string} message
 */
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

/**
 * @param {string} dir
 * @returns {string[]} absolute paths of every `.ts` and `.svelte` file below `dir`
 */
const sources = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|svelte)$/.test(entry.name) ? [path] : [];
  });

const read = (/** @type {string} */ path) => readFileSync(path, 'utf8');
const rel = (/** @type {string} */ path) => relative(ROOT, path);

/**
 * Count top-level arguments in the call opening at `open`, which indexes its `(`.
 *
 * Regex cannot do this: a budget object literal, a nested call and an arrow body all
 * contain commas that belong to no argument of this call.
 *
 * @param {string} text
 * @param {number} open
 * @returns {number}
 */
const countArgs = (text, open) => {
  let depth = 0;
  let args = 1;
  let seen = false;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return seen ? args : 0;
    } else if (c === ',' && depth === 1) args += 1;
    else if (depth >= 1 && c !== undefined && !/\s/.test(c)) seen = true;
  }
  return -1;
};

const files = sources(SRC);
check(files.length > 0, 'engine-check found no sources under src/');

// P6.2 — no unbudgeted query surface reaches the engine.
//
// Two halves: the two public entry points must REQUIRE a budget, and no call site may
// omit one. Requiring it in the signature is what a type-checker enforces; scanning the
// call sites is what catches a caller passing `undefined` through a widened parameter.
const clientSource = read(join(SRC, 'engine', 'client.ts'));
const serviceSource = read(join(SRC, 'questions', 'service.ts'));
check(
  /\bquery\(goal: string, budget: BudgetSpec, signal\?: AbortSignal\)/.test(clientSource),
  'P6.2 EngineClient.query no longer requires a budget as its second parameter',
);
check(
  /\bask\(\s*id: [^,]+,\s*budget: BudgetSpec,\s*signal\?: AbortSignal,?\s*\)/.test(serviceSource),
  'P6.2 AnswerService.ask no longer requires a budget as its second parameter',
);
for (const file of files) {
  const text = read(file);
  // `engine.prolog.query` is the raw SWI handle inside the worker, below the budget
  // boundary; every other receiver is the budgeted client or service.
  for (const match of text.matchAll(/([A-Za-z0-9_$.#[\]]*?)\.(query|ask)\(/g)) {
    const [whole, receiver = '', method] = match;
    if (receiver.endsWith('prolog')) continue;
    const open = match.index + whole.length - 1;
    const args = countArgs(text, open);
    check(
      args >= 2,
      `P6.2 ${rel(file)} calls ${receiver}.${method ?? '?'}() with ${args} argument(s); a budget is required`,
    );
  }
}

// P6.3 — the worker stays the sole owner of `swipl-wasm`.
// A bare side-effect `import 'swipl-wasm'` carries no `from`, and it pulls the whole
// engine onto whichever thread evaluates it — the mutation harness caught this form
// escaping an earlier `from`-anchored pattern.
const IMPORTS_ENGINE = /\b(?:from|import|require)\s*\(?\s*['"]swipl-wasm/;
const importers = files.filter((file) => IMPORTS_ENGINE.test(read(file))).map(rel);
check(
  importers.length === 1 && importers[0] === ENGINE_OWNER,
  `P6.3 swipl-wasm must be imported by ${ENGINE_OWNER} alone, found [${importers.join(', ')}]`,
);

// P6.4 — every undeclared runtime member is one this project already accepted.
//
// Derived, not transcribed: the declared set is read out of the installed package and
// the used set out of this project's own interfaces, so the check fails both when a new
// undeclared call appears and when a version bump changes what the package declares.
const packageTypes = read(PACKAGE_TYPES);
/**
 * @param {string} name
 * @returns {string[]} member names the package declares on that type
 */
const declaredMembers = (name) => {
  const body = new RegExp(`type ${name} = \\{([\\s\\S]*?)\\n\\};`).exec(packageTypes)?.[1];
  if (body === undefined) {
    problems.push(`P6.4 ${rel(PACKAGE_TYPES)} declares no type ${name}`);
    return [];
  }
  return [...body.matchAll(/^ {2}(\w+)[(<]/gm)].map((m) => m[1] ?? '');
};
/**
 * @param {string} source
 * @param {string} name
 * @returns {string[]} member names this project's interface depends on
 */
const usedMembers = (source, name) => {
  const body = new RegExp(`interface ${name}[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1];
  if (body === undefined) {
    problems.push(`P6.4 this project declares no interface ${name}`);
    return [];
  }
  return [...body.matchAll(/^ {2}(\[Symbol\.\w+\]|\w+)\??[(:<]/gm)].map((m) => m[1] ?? '');
};
const sessionSource = read(join(SRC, 'engine', 'session.ts'));
const termsSource = read(join(SRC, 'engine', 'terms.ts'));
for (const [type, used] of /** @type {[keyof typeof ACCEPTED_UNDECLARED, string[]][]} */ ([
  ['Query', usedMembers(sessionSource, 'PrologQuery')],
  ['Prolog', usedMembers(termsSource, 'PrologConstructors')],
])) {
  const declared = new Set(declaredMembers(type));
  const undeclared = used.filter((member) => !declared.has(member)).sort();
  const accepted = [...ACCEPTED_UNDECLARED[type]].sort();
  check(
    undeclared.join(',') === accepted.join(','),
    `P6.4 undeclared ${type} members are [${undeclared.join(', ')}], accepted [${accepted.join(', ')}]`,
  );
}

// P6.5 — the decode boundary's export surface is pinned.
//
// u3's own predicate reads "unchanged by this unit", which expires with the unit. The
// durable property it protected is that every decode and encode path stays inside the
// P3 trap battery, and a new export is exactly how one would escape it.
const termsExports = [...termsSource.matchAll(/^export (?:type|interface|class|function) (\w+)/gm)]
  .map((m) => m[1] ?? '')
  .sort();
check(
  termsExports.join(',') === [...TERMS_EXPORTS].sort().join(','),
  `P6.5 src/engine/terms.ts exports [${termsExports.join(', ')}], pinned [${[...TERMS_EXPORTS].sort().join(', ')}]`,
);

if (problems.length > 0) {
  for (const problem of problems) console.error(`engine-check: ${problem}`);
  process.exit(1);
}
console.log(
  `engine-check: ${String(files.length)} sources, P6.2-P6.5 hold ` +
    `(swipl-wasm owned by ${ENGINE_OWNER}, ${String(termsExports.length)} pinned terms exports)`,
);
