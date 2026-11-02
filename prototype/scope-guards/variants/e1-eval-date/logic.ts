import type { PlTerm } from '../../../../src/engine/terms.js';
import type { ProofStep } from '../../../../src/engine/protocol.js';

export const DOC = 'cdc2022-opioid-rec12-imp08';
export const BUDGET = { stackBytes: 16777216, depth: 256, inferences: 1000000, wallClockMs: 5000, answerCap: 20 };
export const CLAUSES = `clause(guideline_operator(actual,C,should),Body), C = '$guideline_id'(context,'${DOC}',S,_,_)`;
export const RECORDS = `guideline_supersession('${DOC}',S,source(Citation,Url),Effective)`;
export const atom = (v: string) => `'${v.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

// Restrict serialization to the schema terms this fixed prototype reads; unknown arms fail closed.
export function render(t: PlTerm, ground = false): string {
  switch (t.kind) {
    case 'atom': return atom(t.value);
    case 'integer': return String(t.value);
    case 'variable': return ground ? `'$evaluation_hypothetical'(${t.id})` : `V${t.id}`;
    case 'compound': return `${atom(t.functor)}(${t.args.map(a => render(a, ground)).join(',')})`;
    case 'list': return `[${t.items.map(a => render(a, ground)).join(',')}]`;
    default: throw new Error(`Unsupported prototype term: ${t.kind}`);
  }
}
const conjuncts = (t: PlTerm): PlTerm[] => t.kind === 'compound' && t.functor === ','
  ? t.args.flatMap(conjuncts) : t.kind === 'compound' && t.functor === ':' ? conjuncts(t.args[1]) : [t];

export function goalFor(context: PlTerm, body: PlTerm, date: string) {
  const premises: PlTerm[] = [];
  for (const t of conjuncts(body)) {
    if (t.kind !== 'compound') throw new Error('Unexpected antecedent');
    if (t.functor === 'guideline_evaluation_date') break;
    if (t.functor === '\\+') continue; // NAF remains a search, never a premise.
    if (!t.functor.startsWith('guideline_') || t.functor === 'guideline_satisfies') throw new Error('Unexpected premise');
    premises.push(t);
  }
  const as = premises.map(t => render(t, true));
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new Error('Choose a valid date.');
    as.push(`guideline_evaluation_date(${Number(date.replaceAll('-', ''))})`);
  }
  return `derive(guideline_operator(actual,${render(context, true)},should),4,[${as.join(',')}],Proof,proved)`;
}

function origin(t: PlTerm): { document: string; sentence: number } | undefined {
  if (t.kind !== 'compound') return;
  if (t.functor === '$guideline_id' && t.args[1]?.kind === 'atom' && t.args[2]?.kind === 'integer')
    return { document: t.args[1].value, sentence: Number(t.args[2].value) };
  for (const a of t.args) { const found = origin(a); if (found) return found; }
}
export function proofSteps(t: PlTerm): ProofStep[] {
  if (t.kind !== 'list') throw new Error('Expected proof list');
  return t.items.map(n => {
    if (n.kind !== 'compound') throw new Error('Expected proof node');
    const h = n.args[0];
    if (n.functor === 'assumption' && h.kind === 'compound') return { kind: 'assumption', head: render(h), predicate: `${h.functor}/${h.args.length}` };
    if (n.functor === 'naf') return { kind: 'negation', goal: render(h) };
    if (n.functor === 'builtin') return { kind: 'comparison', goal: render(h) };
    if (n.functor === 'node' && h.kind === 'compound' && h.args[0].kind === 'integer' && n.args[1].kind === 'compound') {
      const head = n.args[1];
      return { kind: 'clause', line: Number(h.args[0].value), head: render(head), predicate: `${head.functor}/${head.args.length}`, ...origin(head), children: proofSteps(n.args[2]) };
    }
    throw new Error('Unrecognized proof node');
  });
}
