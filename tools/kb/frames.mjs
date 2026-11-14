// Sentence frames: the compiled clause sites read back into one frame per sentence variant, with
// negation kept — `parseClauseSites` flattens `\+`, so this reader re-reads each site's text.
// Contract `.agent/contracts/g1.md`; consumer `tools/kb/network.mjs` (g2).

import { parseClauseSites, parsePrologCall, splitTopLevel } from './provenance.mjs';

/** @typedef {{ name: string, args: string[] }} Literal */
/** @typedef {{ literal: Literal } | { naf: Item[] }} Item */
/** @typedef {{ line: number, name: string, args: string[], guards: { scope: string | null, supersession: string | null } }} Head */
/**
 * @typedef {{ document: string, sentence: number, variant: number, deps: string[], body: Item[],
 *   heads: Head[], guards: { scope: string[], supersession: string[] } }} Frame
 */
/** @typedef {{ document: string, sentence: number, line: number, name: string, args: string[] }} SentenceRecord */

export class FrameError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'FrameError';
  }
}

const VARIABLE = /^[A-Z_][A-Za-z0-9_]*$/u;
const TOKEN = /[A-Za-z_][A-Za-z0-9_]*/uy;
const NECK = ' :- ';
/** Records a sentence carries whatever its body: they state the sentence's status, not its content. */
const RECORDS = new Set(['guideline_supersession', 'guideline_exclusion']);

/** Index of the first top-level ` :- `, outside quotes and brackets; -1 when absent. @param {string} text */
const neckAt = (text) => {
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "'" && text[index + 1] === "'") index += 1;
      else if (char === "'") quoted = false;
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (depth === 0 && text.startsWith(NECK, index)) return index;
  }
  return -1;
};

/** @param {string} source @returns {Literal} */
const literal = (source) => {
  try {
    const { name, args } = parsePrologCall(source);
    return { name, args };
  } catch {
    throw new FrameError(`unsupported clause item: ${source}`);
  }
};

/** @param {string} source @returns {Item[]} */
const items = (source) => {
  /** @type {string[]} */
  let parts;
  try {
    parts = splitTopLevel(source);
  } catch {
    throw new FrameError(`unbalanced clause body: ${source}`);
  }
  return parts.map((part) => {
    if (!part.startsWith('\\+ ')) return { literal: literal(part) };
    const inner = part.slice(3).trim();
    const grouped = inner.startsWith('(') && inner.endsWith(')');
    return { naf: grouped ? items(inner.slice(1, -1)) : [{ literal: literal(inner) }] };
  });
};

/**
 * Read one compiled clause — `Head.` or `Head :- Item, …, Item.`, an item a schema literal,
 * `\+ Literal` or `\+ (Items)` — refusing any other shape.
 *
 * @param {string} text
 * @returns {{ head: Literal, body: Item[] }}
 */
export const readClause = (text) => {
  if (!text.endsWith('.')) throw new FrameError(`clause has no period: ${text}`);
  const clause = text.slice(0, -1);
  const at = neckAt(clause);
  return at < 0
    ? { head: literal(clause), body: [] }
    : { head: literal(clause.slice(0, at)), body: items(clause.slice(at + NECK.length)) };
};

/** @param {Literal} item */
const renderLiteral = ({ name, args }) => `${name}(${args.join(',')})`;

/** @param {Item[]} body @returns {string} */
const renderBody = (body) =>
  body
    .map((item) =>
      'literal' in item
        ? renderLiteral(item.literal)
        : item.naf.length === 1 && 'literal' in /** @type {Item} */ (item.naf[0])
          ? `\\+ ${renderBody(item.naf)}`
          : `\\+ (${renderBody(item.naf)})`,
    )
    .join(', ');

/** Render a clause back to the corpus's own spelling. @param {Literal} head @param {Item[]} body */
export const renderClause = (head, body) =>
  body.length === 0 ? `${renderLiteral(head)}.` : `${renderLiteral(head)}${NECK}${renderBody(body)}.`;

/**
 * Rename every variable in `text` through `names`, minting the next canonical name for a new one;
 * each `_` is a fresh variable, as Prolog reads it. Quoted atoms are left alone.
 *
 * @param {string} text @param {Map<string, string>} names @param {{ next: number }} counter
 */
const renameIn = (text, names, counter) => {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = /** @type {string} */ (text[index]);
    if (char === "'") {
      let end = index + 1;
      while (end < text.length) {
        if (text[end] === "'" && text[end + 1] === "'") end += 2;
        else if (text[end] === "'") break;
        else end += 1;
      }
      out += text.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    TOKEN.lastIndex = index;
    const word = TOKEN.exec(text)?.[0];
    if (word === undefined) {
      out += char;
      index += 1;
      continue;
    }
    if (VARIABLE.test(word)) {
      let name = word === '_' ? undefined : names.get(word);
      if (name === undefined) {
        name = `V${String(counter.next)}`;
        counter.next += 1;
        if (word !== '_') names.set(word, name);
      }
      out += name;
    } else out += word;
    index += word.length;
  }
  return out;
};

/** @param {Item[]} body @param {Map<string, string>} names @param {{ next: number }} counter @returns {Item[]} */
const renameBody = (body, names, counter) =>
  body.map((item) =>
    'literal' in item
      ? {
          literal: {
            name: item.literal.name,
            args: item.literal.args.map((arg) => renameIn(arg, names, counter)),
          },
        }
      : { naf: renameBody(item.naf, names, counter) },
  );

/**
 * Canonical spelling of a clause: variables renamed V0, V1, … by first occurrence, body first —
 * two lines of one variant, each written with its own letters, read alike.
 *
 * @param {Literal} head @param {Item[]} body
 */
export const canonicalClause = (head, body) => {
  /** @type {Map<string, string>} */
  const names = new Map();
  const counter = { next: 0 };
  const renamedBody = renameBody(body, names, counter);
  const renamedHead = { name: head.name, args: head.args.map((arg) => renameIn(arg, names, counter)) };
  return { head: renamedHead, body: renamedBody };
};

/** @param {Item} item @param {string} name */
const isLiteral = (item, name) => 'literal' in item && item.literal.name === name;

/**
 * Set aside the two guards the compiler appends to an operator-edge clause: the scope guard
 * `\+ guideline_exclusion(K)` and the supersession guard `guideline_evaluation_date(V),
 * guideline_satisfies(exactly,V,less,Date)`.
 *
 * @param {Item[]} body
 */
const splitGuards = (body) => {
  /** @type {string[]} */
  const scope = [];
  /** @type {string[]} */
  const supersession = [];
  /** @type {Item[]} */
  const rest = [];
  for (let index = 0; index < body.length; index += 1) {
    const item = /** @type {Item} */ (body[index]);
    const next = body[index + 1];
    if ('naf' in item && item.naf.length === 1 && isLiteral(/** @type {Item} */ (item.naf[0]), 'guideline_exclusion')) {
      const inner = /** @type {{ literal: Literal }} */ (item.naf[0]);
      scope.push(/** @type {string} */ (inner.literal.args[0]));
      continue;
    }
    if (
      'literal' in item &&
      item.literal.name === 'guideline_evaluation_date' &&
      next !== undefined &&
      'literal' in next &&
      next.literal.name === 'guideline_satisfies' &&
      next.literal.args.length === 4 &&
      next.literal.args[0] === 'exactly' &&
      next.literal.args[1] === item.literal.args[0] &&
      next.literal.args[2] === 'less'
    ) {
      supersession.push(/** @type {string} */ (next.literal.args[3]));
      index += 1;
      continue;
    }
    rest.push(item);
  }
  return { rest, scope, supersession };
};

const GID = /^'\$guideline_id'\(/u;

/** Decode `'$guideline_id'(Role,Doc,S,ref(N)|box(N),Deps)`; null for any other term. @param {string} term */
export const decodeId = (term) => {
  if (!GID.test(term) || !term.endsWith(')')) return null;
  const [role = '', document = '', sentence = '', slot = '', deps = ''] = splitTopLevel(
    term.slice("'$guideline_id'(".length, -1),
  );
  const at = /^(ref|box)\(([1-9][0-9]*)\)$/u.exec(slot);
  if (at === null || !deps.startsWith('[') || !deps.endsWith(']')) {
    throw new FrameError(`malformed guideline id: ${term}`);
  }
  return {
    role,
    document: document.slice(1, -1),
    sentence: Number(sentence),
    kind: /** @type {'ref' | 'box'} */ (at[1]),
    n: Number(at[2]),
    deps: deps === '[]' ? [] : splitTopLevel(deps.slice(1, -1)),
  };
};

/**
 * One reading of a head or body argument: `actual`, `ref(N)`, `box(B)`, `dep(k)` (the k-th
 * antecedent top-level referent), a canonical variable, or the term's own text.
 *
 * @param {Frame} frame @param {string} term
 */
export const referent = (frame, term) => {
  const id = decodeId(term);
  if (id !== null) return `${id.kind}(${String(id.n)})`;
  if (VARIABLE.test(term)) {
    const k = frame.deps.indexOf(term);
    return k < 0 ? term : `dep(${String(k)})`;
  }
  return term;
};

/**
 * The operator chain of a consequent context, outermost first; `[]` for `actual`.
 *
 * @param {Frame} frame @param {string} context
 * @returns {string[]}
 */
export const chainOf = (frame, context) => {
  /** @type {Map<string, { outer: string, operator: string }>} */
  const boxes = new Map();
  for (const head of frame.heads) {
    if (head.name !== 'guideline_operator') continue;
    boxes.set(referent(frame, /** @type {string} */ (head.args[1])), {
      outer: referent(frame, /** @type {string} */ (head.args[0])),
      operator: /** @type {string} */ (head.args[2]),
    });
  }
  /** @type {string[]} */
  const chain = [];
  let at = referent(frame, context);
  const seen = new Set();
  while (at !== 'actual') {
    const box = boxes.get(at);
    if (box === undefined || seen.has(at)) throw new FrameError(`${frameKey(frame)}: context ${at} reaches no root`);
    seen.add(at);
    chain.unshift(box.operator);
    at = box.outer;
  }
  return chain;
};

/**
 * The antecedent's negation and modal boxes: each body `guideline_operator(actual, V, Op)` binds
 * box variable V, and a body literal whose context is V stands under Op.
 *
 * @param {Frame} frame
 * @returns {Map<string, string>}
 */
export const bodyBoxes = (frame) => {
  /** @type {Map<string, string>} */
  const boxes = new Map();
  /** @param {Item[]} items */
  const walk = (items) => {
    for (const item of items) {
      if ('naf' in item) walk(item.naf);
      else if (item.literal.name === 'guideline_operator' && item.literal.args[0] === 'actual') {
        boxes.set(/** @type {string} */ (item.literal.args[1]), /** @type {string} */ (item.literal.args[2]));
      }
    }
  };
  walk(frame.body);
  return boxes;
};

/** @param {{ document: string, sentence: number, variant: number }} frame */
export const frameKey = ({ document, sentence, variant }) => `${document}:${String(sentence)}#${String(variant)}`;

/**
 * Every sentence's frames and records from the clause sites.
 *
 * @param {ReturnType<typeof parseClauseSites>} sites
 * @returns {{ frames: Frame[], records: SentenceRecord[] }}
 */
export const sentenceFrames = (sites) => {
  /** @type {Map<string, Frame>} */
  const byKey = new Map();
  /** @type {Map<string, number>} */
  const variants = new Map();
  /** @type {SentenceRecord[]} */
  const records = [];
  for (const site of sites) {
    if (site.sentence === null) continue;
    const { head, body } = readClause(site.text);
    if (head.name !== site.predicate) throw new FrameError(`line ${String(site.line)}: head ${head.name} != ${site.predicate}`);
    if (RECORDS.has(head.name)) {
      records.push({ document: site.document, sentence: site.sentence, line: site.line, name: head.name, args: head.args });
      continue;
    }
    const { rest, scope, supersession } = splitGuards(body);
    const canonical = canonicalClause(head, rest);
    const sentenceKey = `${site.document}:${String(site.sentence)}`;
    const groupKey = `${sentenceKey}\u0000${renderBody(canonical.body)}`;
    let frame = byKey.get(groupKey);
    if (frame === undefined) {
      const variant = (variants.get(sentenceKey) ?? 0) + 1;
      variants.set(sentenceKey, variant);
      frame = {
        document: site.document,
        sentence: site.sentence,
        variant,
        deps: [],
        body: canonical.body,
        heads: [],
        guards: { scope: [], supersession: [] },
      };
      byKey.set(groupKey, frame);
    }
    const deps = canonical.head.args.map(decodeId).find((id) => id !== null && id.deps.length > 0)?.deps;
    if (deps !== undefined) {
      if (frame.deps.length === 0) frame.deps = deps;
      else if (frame.deps.join(',') !== deps.join(',')) {
        throw new FrameError(`line ${String(site.line)}: Skolem dependencies differ inside ${frameKey(frame)}`);
      }
    }
    for (const id of canonical.head.args.map(decodeId)) {
      if (id !== null && (id.document !== site.document || id.sentence !== site.sentence)) {
        throw new FrameError(`line ${String(site.line)}: id names ${id.document}:${String(id.sentence)}`);
      }
    }
    frame.heads.push({
      line: site.line,
      name: canonical.head.name,
      args: canonical.head.args,
      guards: { scope: scope[0] ?? null, supersession: supersession[0] ?? null },
    });
    if (scope.length > 1 || supersession.length > 1) throw new FrameError(`line ${String(site.line)}: a guard repeats`);
    for (const key of scope) if (!frame.guards.scope.includes(key)) frame.guards.scope.push(key);
    for (const date of supersession) if (!frame.guards.supersession.includes(date)) frame.guards.supersession.push(date);
  }
  return { frames: [...byKey.values()], records };
};

/** @param {Map<string, Uint8Array>} files */
export const deriveFrames = (files) => sentenceFrames(parseClauseSites(files));
