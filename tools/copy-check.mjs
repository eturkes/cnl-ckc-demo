// `pnpm copy:check` — hold the demo's human-facing prose to the project's
// register, and hold the Japanese catalog at parity with the English one.
//
// Two graders, because the two languages admit different decidable rules. English
// grades on banned filler. Japanese grades on PARITY — every English key present, every
// value actually rewritten — plus register J2–J4. Sentence length stays a judgment, never a
// check (user ruling, global `CLAUDE.md` `Authoring`).
//
// The checker is static. There is no TypeScript runner in this repo, and adding
// one to read two string records would cost more than parsing them does. It
// therefore reads the literals out of the source, which also means it grades the
// bytes that ship rather than a re-export of them. Reading the source is also what
// lets `TEXT`, whose entries are functions, be compared across locales at all.
//
// Usage: node tools/copy-check.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { requireFiring } from './control.mjs';
import { ROOT } from './kb/paths.mjs';

/**
 * The wordmark the accepted surface ships, pinned so a rewording is a decision rather than a
 * drift: each catalog's value, the `<h1>` that renders it, and the brand mark beside it.
 */
const WORDMARK = [
  { file: 'src/i18n/en.ts', text: "wordmark: 'Clinical Knowledge Compiler'," },
  { file: 'src/i18n/ja.ts', text: "wordmark: '臨床知識コンパイラ'," },
  { file: 'src/App.svelte', text: '<h1 id="page-title">{t.DESCRIPTIONS.wordmark}</h1>' },
  { file: 'src/App.svelte', text: '<span>CNL / CKC</span>' },
];

/** @param {(file: string) => string} read @returns {string[]} */
const checkWordmark = (read) =>
  WORDMARK.filter(({ file, text }) => !read(file).includes(text)).map(
    ({ file, text }) => `${file}: wordmark ${JSON.stringify(text)} is not shipped`,
  );

/**
 * The two before/after pairs `.claude/rules/i18n.md` declares: each wraps a `<code>` element a
 * returned string cannot carry.
 */
const DECLARED_PAIRS = [
  ['LABELS.graphSelectedBefore', 'LABELS.graphSelectedAfter'],
  ['TEXT.graphHighlightOriginBefore', 'TEXT.graphHighlightOriginAfter'],
];

/** Words the project bans outright. */
const FILLER = ['simply', 'robust', 'seamlessly', 'leverage'];

const EN = 'src/i18n/en.ts';
const JA = 'src/i18n/ja.ts';

/**
 * The catalog's buckets, every one graded in both locales.
 *
 * @type {{name: string}[]}
 */
const BUCKETS = [
  { name: 'INSTRUCTIONS' },
  { name: 'DESCRIPTIONS' },
  { name: 'LABELS' },
  { name: 'TEXT' },
];

/**
 * Keys whose Japanese value is allowed to be byte-identical to its English one.
 *
 * Parity is what the gate can decide — every key present, and every value actually
 * rewritten.
 *
 * @type {Set<string>}
 */
const UNTRANSLATED_OK = new Set();

/**
 * String literals in a source region, with adjacent `'a' + 'b'` concatenations
 * joined so a wrapped sentence grades as one sentence. Both quote forms count: Prettier
 * rewrites a literal holding an apostrophe to `"…"`.
 *
 * @param {string} source @returns {{key: string, text: string}[]}
 */
const literals = (source) => {
  const out = [];
  // Import specifiers are paths, not prose.
  const body = source.replace(/^\s*import[^;]*;/gm, '');
  // The concatenation tail is `(?:\s*\+)?\s*`, not `\s*\+?\s*`: the latter splits a run of
  // whitespace two ways per iteration, which backtracks polynomially on a non-match. What
  // remains is star height, which the rule reads structurally; every iteration is anchored
  // on a quote, so no two of them can match the same span.
  const entry =
    // eslint-disable-next-line security/detect-unsafe-regex -- each iteration anchors on a quote, so matching stays linear
    /(?:^|\n)\s*(?:\/\*\*[\s\S]*?\*\/\s*)?([\w]+):\s*((?:(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(?:\s*\+)?\s*)+)/g;
  let rest = body;
  for (const match of body.matchAll(entry)) {
    const [whole, key, group] = match;
    if (key === undefined || group === undefined || match.index === undefined) continue;
    const text = [...group.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)]
      .map(([, single, double]) => single ?? double ?? '')
      .join('');
    out.push({ key, text });
    // Blanked for the standalone pass, so a keyed value grades once, under its key.
    const start = match.index + whole.length - group.length;
    rest = `${rest.slice(0, start)}${' '.repeat(group.length)}${rest.slice(start + group.length)}`;
  }
  // Standalone literals, which is how `TEXT`'s arrow bodies and every template
  // piece are reached — the entry pattern above sees quoted values alone. One scan takes both
  // quote forms, so a quote nested inside the other form never grades as a second literal.
  for (const [, quoted, double] of rest.matchAll(
    /(?:^|[^\w'"])(?:(?:'|`)((?:[^'`\\\n]|\\.){12,})(?:'|`)|"((?:[^"\\\n]|\\.){12,})")/g,
  )) {
    const text = quoted ?? double;
    if (text !== undefined) out.push({ key: '<literal>', text });
  }
  return out;
};

/**
 * One bucket's source text, between its `export const` and its closing `as const`.
 *
 * @param {string} source @param {string} path @param {string} name @returns {string}
 */
const bucket = (source, path, name) => {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`${path}: no exported ${name}`);
  const end = source.indexOf('\n} as const;', start);
  if (end < 0) throw new Error(`${path}: ${name} is not a closed record`);
  return source.slice(start, end);
};

/**
 * A bucket's entries as `key -> its own source slice`, split on the two-space
 * indent that prettier gives every top-level key. Slicing the source rather than
 * the string value is what lets `TEXT`, whose entries are functions, be compared
 * across locales at all.
 *
 * @param {string} region @returns {Map<string, string>}
 */
const entries = (region) => {
  /** @type {Map<string, string>} */
  const out = new Map();
  const starts = [...region.matchAll(/^ {2}(\w+):/gm)];
  for (const [index, match] of starts.entries()) {
    const key = match[1];
    if (key === undefined || match.index === undefined) continue;
    out.set(key, region.slice(match.index, starts[index + 1]?.index ?? region.length));
  }
  return out;
};

/**
 * Every English key present in Japanese, and every Japanese value rewritten.
 *
 * @param {string[]} failures @param {string} en @param {string} ja @returns {number} keys compared
 */
const checkParity = (failures, en, ja) => {
  let compared = 0;
  for (const { name } of BUCKETS) {
    const source = entries(bucket(en, EN, name));
    const target = entries(bucket(ja, JA, name));
    for (const key of source.keys()) {
      if (!target.has(key)) failures.push(`${JA} ${name}.${key}: missing`);
    }
    for (const key of target.keys()) {
      if (!source.has(key)) failures.push(`${JA} ${name}.${key}: not a key of ${EN}`);
    }
    for (const [key, text] of source) {
      const other = target.get(key);
      if (other === undefined) continue;
      compared += 1;
      if (other === text && !UNTRANSLATED_OK.has(`${name}.${key}`)) {
        failures.push(`${JA} ${name}.${key}: untranslated`);
      }
    }
  }
  return compared;
};

/**
 * `index.html` ships the English title and description, and `locale.svelte.ts`
 * re-authors both from the catalog on every switch. Two sources for one string is a
 * drift seam nothing else can see: the shell would keep serving a title the app
 * replaces on mount, so no rendered assertion would ever disagree with it.
 *
 * @param {string[]} failures @param {string} en @param {string} html
 * @returns {number} shell strings compared
 */
const checkShell = (failures, en, html) => {
  const catalog = new Map(
    literals(bucket(en, EN, 'DESCRIPTIONS'))
      .filter(({ key }) => key !== '<literal>')
      .map(({ key, text }) => [key, text]),
  );
  /** @type {[string, string | undefined][]} */
  const shell = [
    ['documentTitle', /<title>([^<]*)<\/title>/.exec(html)?.[1]],
    ['documentDescription', /name="description"\s+content="([^"]*)"/.exec(html)?.[1]],
  ];
  for (const [key, shipped] of shell) {
    if (shipped === undefined) failures.push(`index.html: no ${key}`);
    else if (shipped.trim() !== catalog.get(key)) {
      failures.push(`index.html ${key} differs from ${EN} DESCRIPTIONS.${key}`);
    }
  }
  return shell.length;
};

/**
 * The English register: one failure per banned word.
 *
 * `filler` is a parameter so the control can grade the SHIPPED strings against a word every page
 * carries, which proves the whole path from bucket location to comparison without writing a
 * broken string into `en.ts`.
 *
 * @param {string} source @param {string[]} filler @returns {{failures: string[], graded: number}}
 */
const gradeEnglish = (source, filler) => {
  /** @type {string[]} */
  const failures = [];
  let graded = 0;
  for (const { name } of BUCKETS) {
    const region = bucket(source, EN, name);
    const found = literals(region);
    if (found.length === 0) throw new Error(`${EN}: ${name} yielded no strings to grade`);
    for (const { key, text } of found) {
      graded += 1;
      for (const word of filler) {
        if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
          failures.push(`${EN} ${name}.${key}: banned word "${word}"`);
        }
      }
    }
  }
  return { failures, graded };
};

/**
 * Every component under `src/`, found by walking the tree rather than listed by path, so a
 * component added tomorrow is graded the day it lands.
 *
 * @param {string} dir @returns {string[]}
 */
const components = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return components(path);
      return name.endsWith('.svelte') ? [path] : [];
    });

/** @param {string} dir @returns {string[]} every `.ts` module under `dir` */
const walkTs = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walkTs(path);
      return name.endsWith('.ts') ? [path] : [];
    });

/**
 * The literal prose a component renders: its markup text nodes plus the human-facing attribute
 * values, with script, style, comments and every `{…}` expression removed. Tags are segment
 * boundaries, so two adjacent labels never merge into one long sentence.
 *
 * @param {string} source @returns {string[]}
 */
const componentText = (source) => {
  let markup = source
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const attributes = [
    ...markup.matchAll(/\b(?:aria-label|aria-description|title|alt|placeholder)="([^"{}]+)"/g),
  ].map(([, value]) => value ?? '');
  let previous;
  do {
    previous = markup;
    markup = markup.replace(/\{[^{}]*\}/g, '\n');
  } while (markup !== previous);
  return [...markup.split(/<[^>]*>/), ...attributes]
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text) => /\p{L}{2,}/u.test(text));
};

/**
 * @param {readonly string[]} filler
 * @returns {string[]}
 */
const gradeFiller = (filler) =>
  filler.length === 0
    ? ['FILLER table is empty, so the English register grades no banned word']
    : [];

/**
 * A catalog value's source slice ends a sentence when its last quoted character is terminal
 * punctuation.
 *
 * @param {string | undefined} slice
 */
const endsSentence = (slice) => /[.!?。！？](?:'|"|`)\s*\)?\s*,?\s*$/u.test(slice ?? '');

/**
 * No string may be built by joining catalog fragments (`.claude/rules/i18n.md`): two catalog
 * references a component renders side by side, or joins with `+` or one template literal, must
 * be a declared before/after pair, or the first must end a sentence in BOTH locales — two whole
 * sentences keep each language's own order.
 *
 * @param {{path: string, source: string}[]} files @param {string} en @param {string} ja
 * @returns {{failures: string[], joins: number}}
 */
const gradeComposition = (files, en, ja) => {
  /** @param {string} source @param {string} key */
  const slice = (source, key) => {
    const [name = '', member = ''] = key.split('.');
    return entries(bucket(source, EN, name)).get(member);
  };
  const REF = '(?:t|messages\\.current)\\.((?:LABELS|TEXT|DESCRIPTIONS|INSTRUCTIONS)\\.\\w+)';
  const adjacent = [
    new RegExp(`\\{${REF}[^}]*\\}[^<{}\\n]*\\{${REF}`, 'gu'),
    new RegExp(`${REF}(?:\\([^)]*\\))?\\s*\\+\\s*${REF}`, 'gu'),
    new RegExp(`\\$\\{${REF}[^}\`]*\\}[^\`]*?\\$\\{${REF}`, 'gu'),
  ];
  /** @type {string[]} */
  const failures = [];
  let joins = 0;
  for (const { path, source } of files) {
    for (const pattern of adjacent) {
      for (const [, first = '', second = ''] of source.matchAll(pattern)) {
        joins += 1;
        const declared = DECLARED_PAIRS.some(([a, b]) => a === first && b === second);
        if (declared || (endsSentence(slice(en, first)) && endsSentence(slice(ja, first))))
          continue;
        failures.push(`${path}: joins catalog fragments ${first} + ${second}`);
      }
    }
  }
  return { failures, joins };
};

/**
 * Japanese register (`.agent/contracts/mnt-d3.md`) J2–J4; its J1 sentence ceilings are retired
 * with the English caps.
 *
 * J2: an English source naming the pattern carries the fixed Japanese term (`i18n.md`). */
const JA_TERMS = [
  ['knowledge base', '知識ベース'],
  ['compiled', 'コンパイル済み'],
  ['controlled natural language', '制御自然言語'],
  ['proof', '証明'],
  ['citation', '出典'],
  ['clause', '節'],
  ['concept', '概念'],
  ['relationship', '関係'],
];

/** J3: a sentence ending in hiragana ends in a です・ます form; answer words are exempt. */
const POLITE =
  /(?:ます|ません|ました|ませんでした|です|でした|でしょう|ましょう|ください|はい|いいえ)$/u;

/** Every quoted or template string body in a source slice. @param {string} slice @returns {string[]} */
const stringBodies = (slice) =>
  [...slice.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(
    ([, quoted, double, template]) => quoted ?? double ?? template ?? '',
  );

/**
 * J2–J4 over the Japanese catalog. A sentence runs up to and including `。`, `！` or `？`; a
 * trailing run with no terminator is a label, which keeps its dictionary form.
 *
 * @param {string} en @param {string} ja @param {string[][]} terms
 * @returns {{failures: string[], graded: number}}
 */
const gradeJapanese = (en, ja, terms) => {
  /** @type {string[]} */
  const failures = [];
  let graded = 0;
  for (const { name } of BUCKETS) {
    const english = entries(bucket(en, EN, name));
    for (const [key, slice] of entries(bucket(ja, JA, name))) {
      const at = `${JA} ${name}.${key}`;
      const bodies = stringBodies(slice);
      for (const body of bodies) {
        for (const [sentence] of body.matchAll(/[^。！？]*[。！？]/gu)) {
          graded += 1;
          const core = sentence
            .trim()
            .slice(0, -1)
            .replace(/（[^）]*）$/u, '');
          if (/[\u3040-\u309f]$/u.test(core) && !POLITE.test(core)) {
            failures.push(`${at}: plain-form ending in ${JSON.stringify(sentence.trim())}`);
          }
        }
      }
      const source = stringBodies(english.get(key) ?? '')
        .join(' ')
        .toLowerCase();
      const target = bodies.join('');
      // `i18n.md`: a label and its value are separated by an ASCII `: `, never `：`.
      if (target.includes('：')) failures.push(`${at}: fullwidth colon ：, write ": "`);
      for (const [pattern = '', term = ''] of terms) {
        if (source.includes(pattern) && !target.includes(term)) {
          failures.push(`${at}: "${pattern}" must read ${term}`);
        }
      }
    }
  }
  return { failures, graded };
};

/**
 * Internal ids no shipped string may name (user ruling): milestones, units, claim-registry rows
 * and review rows — `M1`–`M5`, `u12`, `R045`, `U7-26`. Components render catalog values alone
 * and `index.html` mirrors `DESCRIPTIONS`, so the two catalogs are every shipped string.
 */
const INTERNAL_ID = /\b(?:M[1-5]|u\d{1,2}[a-h]?|R\d{3}|U\d+-\d+)\b/u;

/** @param {{path: string, source: string}[]} catalogs @returns {{failures: string[], graded: number}} */
const gradeInternalIds = (catalogs) => {
  const found = catalogs.flatMap(({ path, source }) =>
    BUCKETS.flatMap(({ name }) =>
      literals(bucket(source, path, name)).map(({ key, text }) => ({
        at: `${path} ${name}.${key}`,
        hit: INTERNAL_ID.exec(text)?.[0],
      })),
    ),
  );
  return {
    failures: found.flatMap(({ at, hit }) =>
      hit === undefined ? [] : [`${at}: names internal id ${hit}`],
    ),
    graded: found.length,
  };
};

/** The one literal a component may render: the brand mark `WORDMARK` pins. */
const BRAND = 'CNL / CKC';

/**
 * Every human-facing string lives in `src/i18n/`: a component renders catalog values, never a
 * literal text node or labelling attribute, the brand mark aside. A walk that finds no component
 * would pass every component vacuously, so it refuses.
 *
 * @param {{path: string, source: string}[]} files
 * @returns {{failures: string[], graded: number}}
 */
const gradeLiterals = (files) => {
  const components = files.filter(({ path }) => path.endsWith('.svelte'));
  if (components.length === 0) {
    return {
      failures: ['no .svelte component found under src, so component copy grades nothing'],
      graded: 0,
    };
  }
  return {
    failures: components.flatMap(({ path, source }) =>
      componentText(source)
        .filter((text) => text !== BRAND)
        .map((text) => `${path}: human-facing literal ${JSON.stringify(text)} outside src/i18n`),
    ),
    graded: components.length,
  };
};

const main = () => {
  const en = readFileSync(join(ROOT, EN), 'utf8');
  const ja = readFileSync(join(ROOT, JA), 'utf8');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const banned = FILLER[0] ?? '';
  const sources = components(join(ROOT, 'src'))
    .concat(walkTs(join(ROOT, 'src')))
    .map((path) => ({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') }));
  const keyed = literals(bucket(en, EN, 'DESCRIPTIONS')).find(
    ({ key, text }) => key !== '<literal>' && en.includes(`'${text}'`),
  );
  if (keyed === undefined) throw new Error(`${EN}: DESCRIPTIONS holds no single-literal value`);
  // An apostrophe is what makes Prettier double-quote a literal.
  const doubled = `The reader's answer ${banned} arrives.`;

  // One control per grader, each breaking the input this grader reads. `en` standing in for
  // `ja` is the parity mutation: every value is then byte-identical to its English source.
  const controls = [
    requireFiring(
      'copy',
      {
        mutation: 'the shipped English graded against a filler list holding "the"',
        expect: ['banned word "the"'],
      },
      () => gradeEnglish(en, ['the']).failures,
    ),
    requireFiring(
      'copy',
      {
        mutation: `one keyed DESCRIPTIONS value given the banned word "${FILLER[0] ?? ''}"`,
        expect: [`DESCRIPTIONS.${keyed.key}: banned word "${FILLER[0] ?? ''}"`],
      },
      // Exactly one line, by key: a second, keyless line for the same string is the double grade.
      () => {
        const found = gradeEnglish(
          en.replace(`'${keyed.text}'`, `'${keyed.text} ${banned}'`),
          FILLER,
        ).failures;
        return found.length === 1 ? found : [];
      },
    ),
    requireFiring(
      'copy',
      {
        mutation:
          'one keyed DESCRIPTIONS value rewritten as a double-quoted sentence holding a banned word',
        expect: [`${EN} DESCRIPTIONS.${keyed.key}: banned word "${banned}"`],
      },
      // Exactly one line, by key: a keyless `<literal>` line means the value escaped its key.
      () => {
        const found = gradeEnglish(en.replace(`'${keyed.text}'`, `"${doubled}"`), FILLER).failures;
        return found.length === 1 ? found : [];
      },
    ),
    requireFiring(
      'copy',
      {
        mutation: `the Japanese DESCRIPTIONS.${keyed.key} rewritten double-quoted, ending in する。`,
        expect: [`${JA} DESCRIPTIONS.${keyed.key}: plain-form ending in`],
      },
      () =>
        gradeJapanese(
          en,
          ja.replace(
            entries(bucket(ja, JA, 'DESCRIPTIONS')).get(keyed.key) ?? '',
            `  ${keyed.key}: "CDCの説明はここで終わる。",\n`,
          ),
          JA_TERMS,
        ).failures,
    ),
    requireFiring(
      'copy',
      {
        mutation: 'a component joining two catalog labels added to the real set',
        expect: ['src/zz-join.svelte: joins catalog fragments LABELS.run + LABELS.cancel'],
      },
      () =>
        gradeComposition(
          [
            ...sources,
            { path: 'src/zz-join.svelte', source: '<p>{t.LABELS.run} {t.LABELS.cancel}</p>' },
          ],
          en,
          ja,
        ).failures,
    ),
    requireFiring(
      'copy',
      {
        mutation: 'a component rendering a literal label added to the real set',
        expect: ['src/zz-literal.svelte: human-facing literal "Hello reader" outside src/i18n'],
      },
      () =>
        gradeLiterals([
          ...sources,
          { path: 'src/zz-literal.svelte', source: '<p>Hello reader</p>' },
        ]).failures,
    ),
    requireFiring(
      'copy',
      { mutation: 'the FILLER table emptied', expect: ['FILLER table is empty'] },
      () => gradeFiller([]),
    ),
    requireFiring(
      'copy',
      { mutation: 'en.ts read as the Japanese catalog', expect: [': untranslated'] },
      () => {
        /** @type {string[]} */
        const found = [];
        checkParity(found, en, en);
        return found;
      },
    ),
    requireFiring(
      'copy',
      { mutation: 'the derived component set emptied', expect: ['no .svelte component found'] },
      () => gradeLiterals([]).failures,
    ),
    requireFiring(
      'copy',
      {
        mutation: 'the English wordmark with one letter changed',
        expect: ['src/i18n/en.ts: wordmark "wordmark: \'Clinical Knowledge Compiler\',"'],
      },
      () =>
        checkWordmark((file) =>
          file === EN
            ? en.replace('Clinical Knowledge Compiler', 'Clinical Knowledge Compilers')
            : readFileSync(join(ROOT, file), 'utf8'),
        ),
    ),
    requireFiring(
      'copy',
      {
        mutation: `one keyed DESCRIPTIONS value naming unit u12`,
        expect: [`${EN} DESCRIPTIONS.${keyed.key}: names internal id u12`],
      },
      () =>
        gradeInternalIds([
          {
            path: EN,
            source: en.replace(
              `${keyed.key}: '${keyed.text}'`,
              `${keyed.key}: '${keyed.text} (u12)'`,
            ),
          },
        ]).failures,
    ),
    requireFiring(
      'copy',
      {
        mutation: 'every 知識ベース in the Japanese catalog read as ナレッジベース',
        expect: ['"knowledge base" must read 知識ベース'],
      },
      () => gradeJapanese(en, ja.replaceAll('知識ベース', 'ナレッジベース'), JA_TERMS).failures,
    ),
    requireFiring(
      'copy',
      {
        mutation: 'the first ": " in a Japanese string read as ：',
        expect: ['fullwidth colon'],
      },
      () => {
        const labelled =
          BUCKETS.flatMap(({ name }) => stringBodies(bucket(ja, JA, name))).find((body) =>
            body.includes(': '),
          ) ?? '';
        return gradeJapanese(en, ja.replace(labelled, labelled.replace(': ', '：')), JA_TERMS)
          .failures;
      },
    ),
    requireFiring(
      'copy',
      { mutation: 'the first します。 read as する。', expect: ['plain-form ending in'] },
      () => gradeJapanese(en, ja.replace('します。', 'する。'), JA_TERMS).failures,
    ),
    requireFiring(
      'copy',
      { mutation: 'the shell title prefixed', expect: ['documentTitle differs from'] },
      () => {
        /** @type {string[]} */
        const found = [];
        checkShell(found, en, html.replace('<title>', '<title>zz '));
        return found;
      },
    ),
  ];

  const failures = gradeFiller(FILLER);
  const { failures: englishFailures, graded } = gradeEnglish(en, FILLER);
  failures.push(...englishFailures);
  failures.push(...checkWordmark((file) => readFileSync(join(ROOT, file), 'utf8')));
  const { failures: joinFailures, joins } = gradeComposition(sources, en, ja);
  const { failures: literalFailures, graded: componentFiles } = gradeLiterals(sources);
  failures.push(...joinFailures, ...literalFailures);
  const { failures: idFailures, graded: idStrings } = gradeInternalIds([
    { path: EN, source: en },
    { path: JA, source: ja },
  ]);
  failures.push(...idFailures);
  const compared = checkParity(failures, en, ja);
  const { failures: registerFailures, graded: jaSentences } = gradeJapanese(en, ja, JA_TERMS);
  failures.push(...registerFailures);
  const shell = checkShell(failures, en, html);

  if (failures.length > 0) {
    console.error(`copy: ${failures.length} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(
    `copy: ${graded} en strings pass, ` +
      `${compared} ja keys at parity, ${String(jaSentences)} ja sentences within J3 and no fullwidth colon, ${String(joins)} catalog joins whole sentences or declared, ${String(componentFiles)} components render no literal ` +
      `beyond the brand mark, ` +
      `${WORDMARK.length} wordmark pins shipped, ${String(idStrings)} catalog strings name no internal id, ` +
      `${shell} shell strings match index.html; controls: ${controls.join(', ')}`,
  );
};

main();
