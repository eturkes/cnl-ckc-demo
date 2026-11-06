// Clinical concept network (ITERATE i1): the 58 clinical rules → concept nodes + rule edges.
// Node = a clinical concept: the patient's situation a rule's condition anchors on, or the thing
// an action acts on. Edge = one action of one rule: anchor —modal verb→ object, the rest of the
// condition carried whole on the edge (never flattened into one edge per concept).
// Prototype shortcut: the anchor + clause split read the clinical layer's condition TEXT, not the
// KB's DRS; the rules below are the whole heuristic and each edge keeps its rule key to audit it.

const term = (np) =>
  np
    .replace(/^(?:a|an|the|every|any)\s+/iu, '')
    .replace(/\s+(?:cautiously)$/u, '')
    .trim();
export const readable = (s) => s.replaceAll('-', ' ');

/** Clauses joined by a noun-phrase-opening `and`; a coordinated verb phrase stays with its clause. */
const clauses = (condition) => condition.split(/ and (?=(?:a|an|the|there|every)\b)/u);
const VACUOUS = /^there is a clinician$/u;
const NEGATED = /\b(?:not|no)\b/u;

/**
 * The patient's situation, in order of preference: what the patient has; what the rule is for;
 * what the patient receives or continues; what an opioid is co-prescribed with.
 * A negated clause never anchors: an undetected warning is no situation the patient is in.
 */
const ANCHORS = [
  /\bpatient (?:that )?has an? ([\w-]+)/u,
  /\bfor an? ([\w-]+-pain|opioid-use-disorder)\b/u,
  /\bpatient (?:that )?(?:receives|continues) an? ([\w-]+)/u,
  /\bprescribes an? [\w-]+ with an? ([\w-]+)/u,
];

const anchorOf = (rule) => {
  const parts = rule.condition === undefined ? [] : clauses(rule.condition);
  for (const re of ANCHORS) {
    for (const clause of parts) {
      if (NEGATED.test(clause)) continue;
      const hit = re.exec(clause)?.[1];
      if (hit !== undefined) return hit;
    }
  }
  // No condition (or none anchoring): an action modifier naming the situation, else the patient.
  for (const action of rule.actions) {
    for (const { preposition, value } of action.modifiers) {
      const hit = /^(?:for|after|before|during|of) (?:an?|the) ([\w-]+(?:-pain|-initiation|-escalation|-therapy))$/u.exec(
        `${preposition} ${value}`,
      )?.[1];
      if (hit !== undefined) return hit;
    }
  }
  return 'patient';
};

/** The condition minus clauses the anchor node already states (`a patient has an X`) or vacuous ones. */
const rest = (rule, anchor) =>
  (rule.condition === undefined ? [] : clauses(rule.condition))
    .filter((c) => !VACUOUS.test(c) && !new RegExp(`^an? patient has an? ${anchor}$`, 'u').test(c))
    .map(readable);

const verbPhrase = (rule, action) => {
  const modal = rule.mode === 'fact' ? '' : rule.mode === 'can' ? 'can ' : `${rule.mode} `;
  const not = action.polarity === 'negative' ? (rule.mode === 'fact' ? 'does not ' : 'not ') : '';
  const adverb = /\s(cautiously)$/u.exec(action.object)?.[1];
  return `${modal}${not}${action.verb}${adverb === undefined ? '' : ` ${adverb}`}`;
};

export const clinicalNetwork = (rules, docs) => {
  const nodes = new Map();
  const node = (label, role, key) => {
    const id = label.toLowerCase();
    const n = nodes.get(id) ?? { id, label: readable(label), roles: [], rules: [] };
    if (!n.roles.includes(role)) n.roles.push(role);
    if (!n.rules.includes(key)) n.rules.push(key);
    nodes.set(id, n);
    return id;
  };
  const edges = [];
  for (const rule of rules) {
    const key = `${rule.document}:${rule.sentence}`;
    const rec = docs.get(rule.document)?.rec ?? null;
    const copula = rule.mode === 'fact';
    // A copula or capability sentence keeps its subject: `nonopioid therapy is preferred for …`.
    const subjectStated = copula || rule.mode === 'can';
    const source = subjectStated ? term(rule.subject) : anchorOf(rule);
    const when = subjectStated
      ? (rule.condition === undefined ? [] : clauses(rule.condition).filter((c) => !VACUOUS.test(c)).map(readable))
      : rest(rule, source);
    rule.actions.forEach((action, i) => {
      let target = term(action.object.split(' instead-of ')[0] ?? '');
      let verb = verbPhrase(rule, action);
      // `X is preferred for subacute pain`: the pain stays the patient's situation, never acted on.
      let targetRole = 'acted-on';
      const detail = [];
      const instead = action.object.split(' instead-of ')[1];
      if (instead !== undefined) detail.push(`instead of ${readable(term(instead))}`);
      const modifiers = [];
      for (const m of action.modifiers) {
        const adverb = /\s(cautiously)$/u.exec(m.value)?.[1];
        if (adverb !== undefined) verb = `${verb} ${adverb}`;
        const value = adverb === undefined ? m.value : m.value.slice(0, -adverb.length - 1);
        const prev = modifiers.at(-1);
        if (m.preposition === 'of' && prev !== undefined) prev.value = `${prev.value} of ${value}`;
        else if (term(value) !== source) modifiers.push({ preposition: m.preposition, value });
      }
      // `assess the patient for X` / `work with the patient`: the clinical target is X / the patient.
      if (target === 'patient' && modifiers[0] !== undefined && modifiers[0].preposition === 'for') {
        verb = `${verb} the patient for`;
        target = term(modifiers.shift().value);
      } else if (target === '') {
        const withWhom = modifiers.findIndex((m) => m.preposition === 'with');
        target = withWhom === -1 ? 'patient' : term(modifiers.splice(withWhom, 1)[0].value);
        if (withWhom !== -1) verb = `${verb} with`;
      } else if (/^(?:risk|benefit)$/u.test(target) && modifiers[0]?.preposition === 'for') {
        // `a risk for an overdose`: the clinical target is the harm; `risk for` reads on the edge.
        verb = `${verb} ${target} for`;
        target = term(modifiers.shift().value);
      } else if (copula && action.object === 'preferred' && modifiers[0] !== undefined) {
        verb = `${verb} preferred for`;
        target = term(modifiers.shift().value);
        targetRole = 'situation';
      }
      for (const m of modifiers) detail.push(`${m.preposition} ${readable(m.value)}`);
      edges.push({
        id: `${key}#${String(i)}`,
        rule: key,
        rec,
        source: node(source, subjectStated ? 'subject' : 'situation', key),
        target: node(target, targetRole, key),
        verb,
        detail: detail.map(readable).join(', '),
        // A clause the target node already states (`a patient has a subacute pain`) leaves the edge.
        when: when.filter((c) => c !== `a patient has ${/^[aeiou]/u.test(target) ? 'an' : 'a'} ${readable(target)}`),
        modal: rule.mode,
        negative: action.polarity === 'negative',
      });
    });
  }
  return { nodes: [...nodes.values()], edges };
};
