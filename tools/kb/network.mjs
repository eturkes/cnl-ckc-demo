// g2 clinical projection (`.agent/contracts/g2.md`): g1's frames → the clinical concept network.
// This file holds the frame view every later step reads, and the corpus census the declared
// tables (`tools/kb/network-tables.mjs`) are graded total over (N12).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { bodyBoxes, canonicalClause, chainOf, deriveFrames, frameKey, readClause, referent } from './frames.mjs';
import { parseClauseSites } from './provenance.mjs';
import * as TABLES from './network-tables.mjs';

/** @typedef {import('./frames.mjs').Frame} Frame */
/** @typedef {{ name: string, args: string[] }} Literal */

/**
 * One event of a frame. `ref` names it within its frame; `context` is `actual`, a body box
 * variable or a head `box(N)`; `chain` = its operator walk to `actual`, outermost first.
 *
 * @typedef {{
 *   side: 'head' | 'body',
 *   ref: string,
 *   verb: string,
 *   context: string,
 *   chain: string[],
 *   negated: boolean,
 *   args: Map<number, string>,
 *   pps: { prep: string, object: string }[],
 *   line: number | null,
 * }} FrameEvent
 */

/** @typedef {{ frame: Frame, nouns: Map<string, string>, properties: Map<string, string>, events: FrameEvent[] }} FrameView */

/** Nouns that never form a concept (g2 `Terms`): the generic actor and the bare patient, benefit, risk. */
export const NON_CONCEPTS = new Set(['clinician', 'patient', 'benefit', 'risk']);

/** S2's treatment-in-course verbs. */
export const TREATMENT_VERBS = new Set(['start', 'continue', 'prescribe', 'give', 'receive']);

/** `'acute-pain'` → `acute-pain`. @param {string} atom */
export const atomText = (atom) => (atom.startsWith("'") ? atom.slice(1, -1).replaceAll("''", "'") : atom);

/** @param {string} noun */
export const readable = (noun) => noun.replaceAll('-', ' ');

/**
 * The literal-level view of one frame: every entity noun and property by referent, and every
 * event with its arguments, phrases, context and negation.
 *
 * @param {Frame} frame
 * @returns {FrameView}
 */
export const viewOf = (frame) => {
  const boxes = bodyBoxes(frame);
  /** @type {{ literal: Literal, naf: boolean, line: number | null, head: boolean }[]} */
  const literals = [];
  /** @param {import('./frames.mjs').Item[]} items @param {boolean} naf */
  const walk = (items, naf) => {
    for (const item of items) {
      if ('naf' in item) walk(item.naf, true);
      else literals.push({ literal: item.literal, naf, line: null, head: false });
    }
  };
  walk(frame.body, false);
  for (const head of frame.heads) literals.push({ literal: head, naf: false, line: head.line, head: true });

  /** @type {Map<string, string>} */
  const nouns = new Map();
  /** @type {Map<string, string>} */
  const properties = new Map();
  /** @type {Map<string, FrameEvent>} */
  const events = new Map();
  const at = (/** @type {string} */ term) => referent(frame, term);
  for (const { literal, naf, line, head } of literals) {
    const [context = '', subject = ''] = literal.args;
    if (literal.name === 'guideline_entity') nouns.set(at(subject), atomText(literal.args[2] ?? ''));
    else if (literal.name === 'guideline_property') properties.set(at(subject), atomText(literal.args[2] ?? ''));
    else if (literal.name === 'guideline_event') {
      const chain = head ? chainOf(frame, context) : context === 'actual' ? [] : [boxes.get(context) ?? '?'];
      events.set(at(subject), {
        side: head ? 'head' : 'body',
        ref: at(subject),
        verb: atomText(literal.args[2] ?? ''),
        context: at(context),
        chain,
        negated: naf || chain.includes('-'),
        args: new Map(),
        pps: [],
        line,
      });
    }
  }
  for (const { literal } of literals) {
    const event = events.get(at(literal.args[1] ?? ''));
    if (event === undefined) continue;
    if (literal.name === 'guideline_arg') event.args.set(Number(literal.args[2]), at(literal.args[3] ?? ''));
    else if (literal.name === 'guideline_pp') {
      event.pps.push({ prep: atomText(literal.args[2] ?? ''), object: at(literal.args[3] ?? '') });
    }
  }
  return { frame, nouns, properties, events: [...events.values()] };
};

/** Referents an event names past its subject: argument 2+ and every phrase object. @param {FrameEvent} event */
const objectsOf = (event) => [
  ...[...event.args].filter(([n]) => n >= 2).map(([, ref]) => ref),
  ...event.pps.map(({ object }) => object),
];

/**
 * Directed embedding over a frame's consequent events (g2 `Terms`): E sits in P when E's subject
 * is not P's and either — same context — E's subject is an object of P, or — P's context a strict
 * ancestor of E's — any referent of E is. `null` = the parent links form a cycle, so the sentence
 * falls back whole to a statement.
 *
 * @param {FrameView} view
 * @returns {Map<string, string> | null} embedded event ref → parent event ref
 */
export const embedding = (view) => {
  const heads = view.events.filter(({ side }) => side === 'head');
  /** @type {Map<string, string[]>} context → its strict ancestors */
  const ancestors = new Map();
  const outerOf = new Map(
    view.frame.heads
      .filter(({ name }) => name === 'guideline_operator')
      .map(({ args }) => [referent(view.frame, args[1] ?? ''), referent(view.frame, args[0] ?? '')]),
  );
  /** @param {string} context @returns {string[]} */
  const above = (context) => {
    const known = ancestors.get(context);
    if (known !== undefined) return known;
    /** @type {string[]} */
    const chain = [];
    for (let at = outerOf.get(context); at !== undefined; at = outerOf.get(at)) {
      chain.push(at);
      if (at === 'actual') break;
    }
    ancestors.set(context, chain);
    return chain;
  };
  /** @type {Map<string, string>} */
  const parent = new Map();
  for (const e of heads) {
    const subject = e.args.get(1);
    for (const p of heads) {
      if (p === e || subject === undefined || p.args.get(1) === subject) continue;
      const objects = new Set(objectsOf(p));
      const same = p.context === e.context && objects.has(subject);
      const nested =
        above(e.context).includes(p.context) &&
        [...e.args.values(), ...e.pps.map(({ object }) => object)].some((ref) => objects.has(ref));
      if (same || nested) {
        parent.set(e.ref, p.ref);
        break;
      }
    }
  }
  for (const start of parent.keys()) {
    const seen = new Set([start]);
    for (let at = parent.get(start); at !== undefined; at = parent.get(at)) {
      if (seen.has(at)) return null;
      seen.add(at);
    }
  }
  return parent;
};

/**
 * S2's starts: argument-2 concepts of condition events in context `actual` and not negated, in
 * body order — patient-role subjects first, then the treatment in course — deduplicated. The
 * target is removed by the caller.
 *
 * @param {FrameView} view @param {ReadonlySet<string>} roles
 * @returns {string[]}
 */
export const startsOf = (view, roles) => {
  const noun = (/** @type {string | undefined} */ ref) => (ref === undefined ? undefined : view.nouns.get(ref));
  const conditions = view.events.filter(
    ({ side, context, negated }) => side === 'body' && context === 'actual' && !negated,
  );
  const ordered = [
    ...conditions.filter((event) => roles.has(noun(event.args.get(1)) ?? '')),
    ...conditions.filter((event) => TREATMENT_VERBS.has(event.verb)),
  ];
  /** @type {string[]} */
  const starts = [];
  for (const event of ordered) {
    const concept = noun(event.args.get(2));
    if (concept !== undefined && !NON_CONCEPTS.has(concept) && !starts.includes(concept)) starts.push(concept);
  }
  return starts;
};

/**
 * The census every declared table is graded total over (g2 N12), from the whole corpus.
 *
 * - `subjects`: noun → condition verbs it is the subject of, over every antecedent event in
 *   context `actual` and not negated (S2's ⟨patient-role⟩ candidates).
 * - `had`: noun → subject nouns that `have` it, any side, any context (S3's ⟨situation⟩ candidates
 *   once the subject is a patient role).
 * - `appropriateFor`: nouns a condition states something is `appropriate for` (S3).
 * - `complements`: `verb prep` → phrase-object nouns, over main consequent events with no
 *   argument 2 (T3's ⟨complement⟩ candidates).
 * - `targets`: T1–T3 target nouns of main consequent events before ⟨time-data⟩ drops any — the
 *   time-data candidates are those whose last word names time (`TIME_WORD`).
 * - `situations`: `for`-phrase nouns of main events whose actor is no concept and whose starts,
 *   minus the target, are empty — exactly where S3 decides (⟨situation⟩ candidates).
 *
 * Each value lists the frame keys it was read from.
 *
 * @param {Frame[]} frames
 * @param {{ PATIENT_ROLES: ReadonlySet<string>, COMPLEMENTS: ReadonlySet<string>, TIME_DATA: ReadonlySet<string> }} tables
 */
export const census = (frames, tables) => {
  /** @type {Record<'subjects' | 'had' | 'appropriateFor' | 'complements' | 'targets' | 'situations', Map<string, Map<string, string[]>>>} */
  const out = {
    subjects: new Map(),
    had: new Map(),
    appropriateFor: new Map(),
    complements: new Map(),
    targets: new Map(),
    situations: new Map(),
  };
  /** @param {Map<string, Map<string, string[]>>} table @param {string} key @param {string} sub @param {string} where */
  const note = (table, key, sub, where) => {
    /** @type {Map<string, string[]>} */
    const row = table.get(key) ?? new Map();
    table.set(key, row);
    const sites = row.get(sub) ?? [];
    if (!sites.includes(where)) sites.push(where);
    row.set(sub, sites);
  };
  for (const frame of frames) {
    const view = viewOf(frame);
    const where = frameKey(frame);
    const noun = (/** @type {string | undefined} */ ref) => (ref === undefined ? undefined : view.nouns.get(ref));
    for (const event of view.events) {
      const subject = noun(event.args.get(1));
      if (event.side === 'body' && event.context === 'actual' && !event.negated && subject !== undefined) {
        note(out.subjects, subject, event.verb, where);
      }
      const object = noun(event.args.get(2));
      if (event.verb === 'have' && subject !== undefined && object !== undefined) note(out.had, object, subject, where);
      const property = view.properties.get(event.args.get(2) ?? '');
      if (event.side === 'body' && property === 'appropriate') {
        for (const { prep, object: ref } of event.pps) {
          const target = noun(ref);
          if (prep === 'for' && target !== undefined) note(out.appropriateFor, target, 'appropriate for', where);
        }
      }
    }
    const parents = embedding(view) ?? new Map();
    const starts = startsOf(view, tables.PATIENT_ROLES);
    for (const event of view.events) {
      if (event.side !== 'head' || parents.has(event.ref)) continue;
      const candidate = targetOf(view, event, tables.COMPLEMENTS);
      if (candidate !== null) note(out.targets, candidate.noun, `${candidate.rule} ${event.verb}`, where);
      const target = candidate === null || tables.TIME_DATA.has(candidate.noun) ? null : candidate.noun;
      const actor = noun(event.args.get(1));
      if ((actor === undefined || NON_CONCEPTS.has(actor)) && starts.every((start) => start === target)) {
        for (const { prep, object: ref } of event.pps) {
          const situation = noun(ref);
          if (prep === 'for' && situation !== undefined) note(out.situations, situation, event.verb, where);
        }
      }
      if (event.args.has(2)) continue;
      for (const { prep, object: ref } of event.pps) {
        note(out.complements, `${event.verb} ${prep}`, noun(ref) ?? '(none)', where);
      }
    }
  }
  return out;
};

// ── Projection ────────────────────────────────────────────────────────────────────────────────

export const NETWORK_SCHEMA_VERSION = 1;
export const NETWORK_PATH = 'graph/clinical-network.json';

/** A projection the contract refuses, named by its sentence. */
export class NetworkError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

const PL_FILE = /^data\/guidelines\/[^/]+\/pl\/([^/]+)\.pl$/u;
const MARKER = /^% S([1-9][0-9]*): (.*)$/u;

/**
 * The independent sentence enumeration (N1): every `% S<n>:` marker of every payload file, with
 * its ACE text — the condition text every reading shows (N11). Never derived from g1's frames.
 *
 * @param {Map<string, Uint8Array>} files
 * @returns {Map<string, { document: string, sentence: number, text: string }>}
 */
export const sentenceTexts = (files) => {
  /** @type {Map<string, { document: string, sentence: number, text: string }>} */
  const out = new Map();
  for (const [path, bytes] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const document = PL_FILE.exec(path)?.[1];
    if (document === undefined) continue;
    for (const line of Buffer.from(bytes).toString('utf8').split('\n')) {
      const at = MARKER.exec(line);
      if (at === null) continue;
      const sentence = Number(at[1]);
      out.set(`${document}:${String(sentence)}`, { document, sentence, text: at[2] ?? '' });
    }
  }
  return out;
};

/** @typedef {'recommendation' | 'implementation' | 'supporting'} DocumentKind */

/**
 * Each document's kind from its coverage section (Decisions: every line names its kind): a
 * `Recommendation N` box statement, anything under `Implementation considerations`, else
 * supporting text.
 *
 * @param {Map<string, Uint8Array>} files
 * @returns {Map<string, DocumentKind>}
 */
export const documentKinds = (files) => {
  /** @type {Map<string, DocumentKind>} */
  const out = new Map();
  for (const [path, bytes] of files) {
    if (!/^data\/guidelines\/[^/]+\/coverage\.tsv$/u.test(path)) continue;
    for (const row of Buffer.from(bytes).toString('utf8').split('\n')) {
      const [, , , section = '', status = ''] = row.split('\t');
      const document = /^ace\(([^)]+)\)$/u.exec(status.trim())?.[1];
      if (document === undefined) continue;
      const parts = section.split(' > ');
      out.set(
        document,
        parts.some((part) => /^Recommendation [0-9]+$/u.test(part))
          ? 'recommendation'
          : parts.includes('Implementation considerations')
            ? 'implementation'
            : 'supporting',
      );
    }
  }
  return out;
};

/** @param {string} noun */
const isConcept = (noun) => !NON_CONCEPTS.has(noun);

/** @param {string} verb @returns {string[]} the finite forms a fact may spell its verb in */
const finiteForms = (verb) => {
  if (verb === 'be') return ['is', 'are'];
  if (verb === 'have') return ['has', 'have'];
  const third = /(s|x|z|ch|sh)$/u.test(verb)
    ? `${verb}es`
    : /[^aeiou]y$/u.test(verb)
      ? `${verb.slice(0, -1)}ies`
      : `${verb}s`;
  return [third, verb];
};

/**
 * A reading's words: the operator chain (root `-` = `it is false that`, a later `-` = `not`), the
 * qualifier words, the verb (finite for a fact, as its own sentence spells it), then a property
 * and its preposition (T2) or a complement preposition (T3), each word once.
 *
 * @param {{ chain: string[], qualifiers: string[], verb: string, property?: string | undefined, prep?: string | undefined }} parts
 * @param {string} text the sentence's ACE text
 * @param {string} where
 */
const readingOf = ({ chain, qualifiers, verb, property, prep }, text, where) => {
  const modal = chain.some((op) => op !== '-');
  let form = verb;
  if (!modal) {
    const found = finiteForms(verb).find((candidate) => new RegExp(`(^|[^a-z-])${candidate}([^a-z-]|$)`, 'u').test(text));
    if (found === undefined) throw new NetworkError(`${where}: the fact verb ${verb} has no finite form in its sentence`);
    form = found;
  }
  return [
    ...chain.map((op, index) => (op === '-' ? (index === 0 ? 'it is false that' : 'not') : op)),
    ...qualifiers,
    form,
    ...(property === undefined ? [] : [property]),
    ...(prep === undefined ? [] : [prep]),
  ].join(' ');
};

/** A frame head rendered with its referents named: a noun where one is known. @typedef {{ name: string, args: string[], line: number }} PayloadItem */

/**
 * One occurrence: a main consequent event of one frame (g2 `Roles of an occurrence`).
 *
 * @typedef {{
 *   key: string, document: string, sentence: number, variant: number, event: string,
 *   kind: DocumentKind, bucket: 'line' | 'loop' | 'shared' | 'statement' | 'example',
 *   reading: string, chain: string[], actor: string | null, target: string | null,
 *   rule: { target: 'T1' | 'T2' | 'T3' | null, sources: 'S1' | 'S2' | 'S3' | 'S4' },
 *   sources: string[], payload: PayloadItem[], lines: number[],
 *   guards: { scope: string | null, supersession: string | null },
 *   superseded: { law: string, url: string, date: number } | null,
 * }} Occurrence
 */

/**
 * Every head an occurrence owns: its event's own literals, its embedded events' literals, and
 * the entities, cardinalities, properties and units of every product referent those name —
 * never another main event's. Operator heads belong to the chain.
 *
 * @param {FrameView} view @param {FrameEvent} event @param {Map<string, string>} parents
 * @returns {import('./frames.mjs').Head[]}
 */
const ownedHeads = (view, event, parents) => {
  const at = (/** @type {string} */ term) => referent(view.frame, term);
  const main = new Set(view.events.filter(({ side, ref }) => side === 'head' && !parents.has(ref)).map(({ ref }) => ref));
  const owned = new Set([event.ref]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [child, parent] of parents) {
      if (owned.has(parent) && !owned.has(child)) {
        owned.add(child);
        grew = true;
      }
    }
  }
  const heads = view.frame.heads.filter(({ name }) => name !== 'guideline_operator');
  /** @type {Set<import('./frames.mjs').Head>} */
  const out = new Set();
  for (let grew = true; grew; ) {
    grew = false;
    for (const head of heads) {
      if (out.has(head) || !owned.has(at(head.args[1] ?? ''))) continue;
      out.add(head);
      grew = true;
      for (const arg of head.args.slice(2)) {
        const ref = at(arg);
        if (/^ref\([0-9]+\)$/u.test(ref) && !owned.has(ref) && (ref === event.ref || !main.has(ref))) owned.add(ref);
      }
    }
  }
  return heads.filter((head) => out.has(head));
};

/** @param {FrameView} view @param {import('./frames.mjs').Head} head @returns {PayloadItem} */
const payloadItem = (view, head) => ({
  name: head.name.replace(/^guideline_/u, ''),
  args: head.args.slice(1).map((arg) => {
    const ref = referent(view.frame, arg);
    return view.nouns.get(ref) ?? view.properties.get(ref) ?? atomText(ref);
  }),
  line: head.line,
});

/**
 * T1–T3 before ⟨time-data⟩: T1 argument 2 is an entity → its noun; T2 argument 2 is a property
 * and the event has a `for` phrase → that phrase's noun; T3 no argument 2 and (verb,
 * preposition) is in ⟨complement⟩ → that phrase's noun. The caller drops a time-data noun.
 *
 * @param {FrameView} view @param {FrameEvent} event @param {ReadonlySet<string>} complements
 * @returns {{ rule: 'T1' | 'T2' | 'T3', ref: string, noun: string, property?: string, prep?: string } | null}
 */
export const targetOf = (view, event, complements) => {
  const second = event.args.get(2);
  if (second !== undefined) {
    const noun = view.nouns.get(second);
    if (noun !== undefined) return { rule: 'T1', ref: second, noun };
    const property = view.properties.get(second);
    const phrase = event.pps.find((pp) => pp.prep === 'for' && view.nouns.has(pp.object));
    if (property === undefined || phrase === undefined) return null;
    return { rule: 'T2', ref: phrase.object, noun: view.nouns.get(phrase.object) ?? '', property, prep: 'for' };
  }
  // A bare patient is never a target, so a concept object wins a tie (`collaborate with a patient
  // on an opioid-taper-plan`); two concept objects never meet (N12).
  const admitted = event.pps.filter((pp) => complements.has(`${event.verb} ${pp.prep}`) && view.nouns.has(pp.object));
  const phrase = admitted.find((pp) => isConcept(view.nouns.get(pp.object) ?? '')) ?? admitted[0];
  return phrase === undefined
    ? null
    : { rule: 'T3', ref: phrase.object, noun: view.nouns.get(phrase.object) ?? '', prep: phrase.prep };
};

/**
 * Project one frame's main events into occurrences (roles + payload), before bucketing.
 *
 * @param {FrameView} view
 * @param {Map<string, string>} parents
 * @param {{ text: string, kind: DocumentKind, superseded: Occurrence['superseded'] }} sentence
 * @param {typeof import('./network-tables.mjs')} tables
 * @returns {Omit<Occurrence, 'bucket'>[]}
 */
const occurrencesOf = (view, parents, sentence, tables) => {
  const { frame } = view;
  const noun = (/** @type {string | undefined} */ ref) => (ref === undefined ? undefined : view.nouns.get(ref));
  const starts = startsOf(view, tables.PATIENT_ROLES);
  /** @type {Omit<Occurrence, 'bucket'>[]} */
  const out = [];
  for (const event of view.events) {
    if (event.side !== 'head' || parents.has(event.ref)) continue;
    const where = `${frameKey(frame)}@${event.ref}`;
    const heads = ownedHeads(view, event, parents);
    /** @type {Set<import('./frames.mjs').Head>} */
    const consumed = new Set();
    const at = (/** @type {string} */ term) => referent(frame, term);
    const own = (/** @type {(head: import('./frames.mjs').Head) => boolean} */ test) => {
      for (const head of heads) if (test(head)) consumed.add(head);
    };
    const describe = (/** @type {string} */ ref) =>
      own(
        (head) =>
          at(head.args[1] ?? '') === ref &&
          (head.name === 'guideline_entity' ||
            (head.name === 'guideline_cardinality' && head.args.slice(2).join(',') === 'na,eq,1')),
      );
    own((head) => head.name === 'guideline_event' && at(head.args[1] ?? '') === event.ref);
    const qualifiers = heads
      .filter((head) => head.name === 'guideline_qualifier' && at(head.args[1] ?? '') === event.ref)
      .map((head) => atomText(head.args[3] ?? ''));
    own((head) => head.name === 'guideline_qualifier' && at(head.args[1] ?? '') === event.ref);
    const argHead =
      (/** @type {number} */ n) =>
      (/** @type {import('./frames.mjs').Head} */ head) =>
      head.name === 'guideline_arg' && at(head.args[1] ?? '') === event.ref && head.args[2] === String(n);
    const actorRef = event.args.get(1);
    const actor = noun(actorRef) ?? null;
    own(argHead(1));
    if (actorRef !== undefined) describe(actorRef);

    const candidate = targetOf(view, event, tables.COMPLEMENTS);
    const chosen = candidate !== null && !tables.TIME_DATA.has(candidate.noun) ? candidate : null;
    const rule = chosen?.rule ?? null;
    const target = chosen?.noun ?? null;
    const property = chosen?.property;
    const prep = chosen?.prep;
    if (chosen !== null) {
      const second = event.args.get(2);
      if (chosen.rule !== 'T3') own(argHead(2));
      if (chosen.rule === 'T2' && second !== undefined) {
        own((head) => head.name === 'guideline_property' && at(head.args[1] ?? '') === second);
      }
      if (chosen.rule !== 'T1') {
        own(
          (head) =>
            head.name === 'guideline_pp' &&
            at(head.args[1] ?? '') === event.ref &&
            at(head.args[3] ?? '') === chosen.ref &&
            atomText(head.args[2] ?? '') === chosen.prep,
        );
      }
      describe(chosen.ref);
    }

    /** @type {Occurrence['rule']['sources']} */
    let sourceRule = 'S4';
    /** @type {string[]} */
    let sources = [];
    if (actor !== null && isConcept(actor)) {
      sourceRule = 'S1';
      sources = [actor];
    } else {
      const fromStarts = starts.filter((start) => start !== target);
      if (fromStarts.length > 0) {
        sourceRule = 'S2';
        sources = fromStarts;
      } else {
        const situation = event.pps
          .filter(({ prep: p }) => p === 'for')
          .map(({ object }) => noun(object))
          .find((candidate) => candidate !== undefined && tables.SITUATIONS.has(candidate));
        if (situation !== undefined) {
          sourceRule = 'S3';
          sources = [situation];
        }
      }
    }
    // A guard rides the deontic edge clause (the `should`/`must`/`may` operator head), never the
    // event head: read it off every head the occurrence owns and every operator on its chain.
    /** @type {import('./frames.mjs').Head[]} */
    const chainHeads = [];
    for (let context = event.context; context !== 'actual'; ) {
      const box = frame.heads.find((h) => h.name === 'guideline_operator' && at(h.args[1] ?? '') === context);
      if (box === undefined) break;
      chainHeads.push(box);
      context = at(box.args[0] ?? '');
    }
    const guarded = [...heads, ...chainHeads];
    const guards = {
      scope: guarded.map((h) => h.guards.scope).find((guard) => guard !== null) ?? null,
      supersession: guarded.map((h) => h.guards.supersession).find((guard) => guard !== null) ?? null,
    };
    out.push({
      key: `${frameKey(frame)}@${event.ref}`,
      document: frame.document,
      sentence: frame.sentence,
      variant: frame.variant,
      event: event.ref,
      kind: sentence.kind,
      reading: readingOf({ chain: event.chain, qualifiers, verb: event.verb, property, prep }, sentence.text, where),
      chain: event.chain,
      actor,
      target,
      rule: { target: rule, sources: sourceRule },
      sources,
      payload: heads.filter((h) => !consumed.has(h)).map((h) => payloadItem(view, h)),
      lines: [...new Set(heads.map(({ line }) => line))].sort((a, b) => a - b),
      guards,
      superseded: sentence.superseded,
    });
  }
  return out;
};

const SHARED_OPERATORS = new Set(['-', 'may', 'can']);
const SOURCE_PATTERN = /^source\('((?:[^']|'')*)','((?:[^']|'')*)'\)$/u;

/** @param {Record<string, unknown>} value */
const keyOf = (value) => JSON.stringify(value);

/**
 * The clinical concept network asset (`.agent/contracts/g2.md`, `gi-interfaces.md` `Network asset`).
 *
 * @param {Map<string, Uint8Array>} files the verified bag's payload
 * @param {{ input: string, producer: string, tables: string }} envelope source digests
 * @param {typeof import('./network-tables.mjs')} tables
 */
export const deriveClinicalNetwork = (files, envelope, tables) => {
  const texts = sentenceTexts(files);
  const kinds = documentKinds(files);
  const { frames, records } = deriveFrames(files);
  const kindOf = (/** @type {string} */ document) => {
    const kind = kinds.get(document);
    if (kind === undefined) throw new NetworkError(`${document}: no coverage section names its kind`);
    return kind;
  };

  /** @type {Map<string, Occurrence['superseded']>} */
  const superseded = new Map();
  /** @type {Set<string>} */
  const excluded = new Set();
  for (const record of records) {
    const key = `${record.document}:${String(record.sentence)}`;
    if (record.name === 'guideline_exclusion') excluded.add(key);
    else {
      const source = SOURCE_PATTERN.exec(record.args[2] ?? '');
      if (source === null) throw new NetworkError(`${key}: unreadable supersession source`);
      superseded.set(key, {
        law: (source[1] ?? '').replaceAll("''", "'"),
        url: (source[2] ?? '').replaceAll("''", "'"),
        date: Number(record.args[3]),
      });
    }
  }

  /** @typedef {{ document: string, sentence: number, text: string, form: 'advice' | 'exclusion' | 'grade' | 'eventless' | 'fallback', variants: number, occurrences: string[], grades?: PayloadItem[] }} Coverage */
  /** @type {Map<string, Coverage>} */
  const coverage = new Map(
    [...texts].map(([key, { document, sentence, text }]) => [
      key,
      { document, sentence, text, form: 'advice', variants: 0, occurrences: [] },
    ]),
  );
  /** @type {Occurrence[]} */
  const occurrences = [];
  /** @type {{ id: string, form: 'statement' | 'eventless' | 'fallback' | 'shared', sentence: string, occurrences: string[], concepts: string[], document: string | null }[]} */
  const statements = [];
  /** @type {{ occurrence: string, sentence: string, items: string[] }[]} */
  const examples = [];

  for (const frame of frames) {
    const sentenceKey = `${frame.document}:${String(frame.sentence)}`;
    const record = coverage.get(sentenceKey);
    if (record === undefined) throw new NetworkError(`${frameKey(frame)}: no % S marker states this sentence`);
    record.variants += 1;
    if (excluded.has(sentenceKey)) {
      record.form = 'exclusion';
      continue;
    }
    const view = viewOf(frame);
    const named = [...new Set([...view.nouns.values()].filter(isConcept))].sort();
    const onSentence = (/** @type {'statement' | 'eventless' | 'fallback' | 'shared'} */ form, /** @type {string[]} */ keys, /** @type {string[]} */ concepts) =>
      statements.push({
        id: `${frameKey(frame)}#${form}${keys.length > 0 ? `@${keys.join('+')}` : ''}`,
        form,
        sentence: sentenceKey,
        occurrences: keys,
        concepts,
        document: concepts.length === 0 ? frame.document : null,
      });
    if (frame.heads.some(({ name }) => name === 'guideline_grade')) {
      record.form = 'grade';
      record.grades = frame.heads.map((head) => payloadItem(view, head));
      continue;
    }
    if (!view.events.some(({ side }) => side === 'head')) {
      record.form = 'eventless';
      onSentence('eventless', [], named);
      continue;
    }
    const parents = embedding(view);
    if (parents === null) {
      record.form = 'fallback';
      onSentence('fallback', [], named);
      continue;
    }
    const projected = occurrencesOf(
      view,
      parents,
      { text: record.text, kind: kindOf(frame.document), superseded: superseded.get(sentenceKey) ?? null },
      tables,
    );
    // Nothing in the consequent is dropped: every non-operator head belongs to an occurrence.
    const covered = new Set(projected.flatMap(({ payload, lines }) => [...payload.map(({ line }) => line), ...lines]));
    const orphan = frame.heads.find(({ name, line }) => name !== 'guideline_operator' && !covered.has(line));
    if (orphan !== undefined) throw new NetworkError(`${frameKey(frame)}: line ${String(orphan.line)} belongs to no occurrence`);

    const operators = new Map(
      frame.heads
        .filter(({ name }) => name === 'guideline_operator')
        .map(({ args }) => [referent(frame, args[1] ?? ''), args[2] ?? '']),
    );
    /** @type {Map<string, string[]>} */
    const byBox = new Map();
    for (const event of view.events) {
      if (event.side !== 'head' || parents.has(event.ref)) continue;
      if (!SHARED_OPERATORS.has(operators.get(event.context) ?? '')) continue;
      byBox.set(event.context, [...(byBox.get(event.context) ?? []), event.ref]);
    }
    const shared = new Map([...byBox].filter(([, refs]) => refs.length >= 2));
    for (const [box, refs] of shared) {
      const keys = refs.map((ref) => `${frameKey(frame)}@${ref}`);
      const members = projected.filter(({ key }) => keys.includes(key));
      const concepts = [
        ...new Set(members.flatMap(({ actor, target, sources }) => [actor, target, ...sources]).filter((n) => n !== null && isConcept(n))),
      ].sort();
      onSentence('shared', keys, /** @type {string[]} */ (concepts));
      void box;
    }
    for (const occurrence of projected) {
      const event = view.events.find(({ ref }) => ref === occurrence.event);
      const second = event === undefined ? undefined : view.nouns.get(event.args.get(2) ?? '');
      const sharedHere = event !== undefined && shared.has(event.context);
      const ends = [...occurrence.sources, ...(occurrence.target !== null && isConcept(occurrence.target) ? [occurrence.target] : [])];
      /** @type {Occurrence['bucket']} */
      const bucket =
        occurrence.actor?.endsWith('-example') === true && second?.endsWith('-example') === true
          ? 'example'
          : sharedHere
            ? 'shared'
            : occurrence.sources.length > 0 &&
                occurrence.target !== null &&
                isConcept(occurrence.target) &&
                occurrence.sources.some((source) => source !== occurrence.target)
              ? 'line'
              : ends.length > 0
                ? 'loop'
                : 'statement';
      occurrences.push({ ...occurrence, bucket });
      record.occurrences.push(occurrence.key);
      if (bucket === 'example') {
        examples.push({ occurrence: occurrence.key, sentence: sentenceKey, items: [occurrence.actor ?? '', second ?? ''] });
      } else if (bucket === 'statement') onSentence('statement', [occurrence.key], named);
    }
  }

  // Lines and loops merge only identical complete readings (g2 `Line identity`).
  /** @type {Map<string, { id: string, source: string, target: string, reading: string, kind: DocumentKind, superseded: boolean, guarded: boolean, occurrences: string[] }>} */
  const lines = new Map();
  /** @type {Map<string, { id: string, concept: string, reading: string, kind: DocumentKind, superseded: boolean, guarded: boolean, occurrences: string[] }>} */
  const loops = new Map();
  for (const occurrence of occurrences) {
    const identity = {
      reading: occurrence.reading,
      kind: occurrence.kind,
      condition: coverage.get(`${occurrence.document}:${String(occurrence.sentence)}`)?.text ?? '',
      payload: occurrence.payload.map(({ name, args }) => [name, ...args]),
      guards: occurrence.guards,
      superseded: occurrence.superseded,
    };
    const flags = { superseded: occurrence.superseded !== null, guarded: occurrence.guards.supersession !== null };
    if (occurrence.bucket === 'line') {
      for (const source of occurrence.sources) {
        if (source === occurrence.target) continue;
        const target = /** @type {string} */ (occurrence.target);
        const key = keyOf({ source, target, ...identity });
        const line = lines.get(key) ?? { id: `line:${String(lines.size + 1)}`, source, target, reading: occurrence.reading, kind: occurrence.kind, ...flags, occurrences: [] };
        line.occurrences.push(occurrence.key);
        lines.set(key, line);
      }
    } else if (occurrence.bucket === 'loop') {
      const ends = [...new Set([...occurrence.sources, ...(occurrence.target !== null && isConcept(occurrence.target) ? [occurrence.target] : [])])];
      for (const concept of ends) {
        const key = keyOf({ concept, ...identity });
        const loop = loops.get(key) ?? { id: `loop:${String(loops.size + 1)}`, concept, reading: occurrence.reading, kind: occurrence.kind, ...flags, occurrences: [] };
        loop.occurrences.push(occurrence.key);
        loops.set(key, loop);
      }
    }
  }

  // Boundaries: the exclusion records' conditions, deduplicated by clause body up to renaming.
  /** @type {Map<string, { id: string, text: string, sources: { document: string, sentence: number }[], concepts: string[] }>} */
  const conditions = new Map();
  for (const site of parseClauseSites(files)) {
    if (site.predicate !== 'guideline_exclusion' || site.sentence === null) continue;
    const { head, body } = readClause(site.text);
    const canonical = canonicalClause(head, body);
    const key = keyOf({ body: canonical.body });
    const condition = conditions.get(key) ?? { id: '', text: '', sources: [], concepts: [] };
    condition.sources.push({ document: site.document, sentence: site.sentence });
    /** @param {import('./frames.mjs').Item[]} items */
    const nouns = (items) => {
      for (const item of items) {
        if ('naf' in item) nouns(item.naf);
        else if (item.literal.name === 'guideline_entity') {
          const noun = atomText(item.literal.args[2] ?? '');
          if (isConcept(noun) && !condition.concepts.includes(noun)) condition.concepts.push(noun);
        }
      }
    };
    nouns(canonical.body);
    conditions.set(key, condition);
  }
  const byDocument = (/** @type {{ document: string, sentence: number }} */ a, /** @type {{ document: string, sentence: number }} */ b) =>
    a.document < b.document ? -1 : a.document > b.document ? 1 : a.sentence - b.sentence;
  const boundaryConditions = [...conditions.values()]
    .map((condition) => {
      const sources = [...condition.sources].sort(byDocument);
      const first = /** @type {{ document: string, sentence: number }} */ (sources[0]);
      const id = `${first.document}:${String(first.sentence)}`;
      return { id, text: texts.get(id)?.text ?? '', sources, concepts: [...condition.concepts].sort() };
    })
    .sort((a, b) => byDocument(/** @type {{ document: string, sentence: number }} */ (a.sources[0]), /** @type {{ document: string, sentence: number }} */ (b.sources[0])));

  const concepts = new Set([
    ...[...lines.values()].flatMap(({ source, target }) => [source, target]),
    ...[...loops.values()].map(({ concept }) => concept),
    ...statements.flatMap(({ concepts: named }) => named),
    ...boundaryConditions.flatMap(({ concepts: named }) => named),
    'recommendation',
  ]);
  const documents = [...new Set([...texts.values()].map(({ document }) => document))].sort();
  return {
    schemaVersion: NETWORK_SCHEMA_VERSION,
    envelope,
    documents: documents.map((id) => ({ id, kind: kindOf(id) })),
    coverage: [...coverage.values()].sort(byDocument),
    occurrences,
    lines: [...lines.values()],
    loops: [...loops.values()],
    statements,
    examples,
    concepts: [...concepts].sort().map((id) => ({ id, label: readable(id) })),
    boundaries: {
      concept: 'recommendation',
      reading: 'recommendations do not apply',
      conditions: boundaryConditions.map(({ id, text, sources }) => ({ id, text, sources })),
      lines: boundaryConditions.flatMap(({ id, concepts: named }) => named.map((source) => ({ condition: id, source }))),
    },
  };
};

const sha256 = (/** @type {string | Uint8Array} */ value) => createHash('sha256').update(value).digest('hex');

/**
 * The asset as `kb:build` writes it and `kb:asset-check` re-derives it: the envelope digests the
 * bag input, the producer (this file + g1's frame reader) and the declared tables.
 *
 * @param {Map<string, Uint8Array>} files @param {string} input the build's input digest
 */
export const networkAsset = (files, input) => {
  const read = (/** @type {string} */ name) => readFileSync(new URL(name, import.meta.url));
  const envelope = {
    input,
    producer: sha256(Buffer.concat([read('./network.mjs'), read('./frames.mjs')])),
    tables: sha256(read('./network-tables.mjs')),
  };
  const model = deriveClinicalNetwork(files, envelope, TABLES);
  return {
    path: NETWORK_PATH,
    bytes: Buffer.from(`${JSON.stringify(model)}\n`, 'utf8'),
    stats: { sentences: model.coverage.length, lines: model.lines.length, loops: model.loops.length },
  };
};
