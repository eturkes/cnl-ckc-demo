type Pain = 'acute' | 'subacute' | 'chronic' | 'unstated' | 'other';
interface Rule {
  id: string;
  trigger: { kind: 'condition'; condition: string } | { kind: 'section'; section: string };
  painSet: readonly ('acute' | 'subacute' | 'chronic')[];
}
interface Term {
  text: string;
  start: number;
  end: number;
  value: number;
}
interface Judgment {
  conditions: Readonly<Record<string, number>>;
  sections: Readonly<Record<string, number>>;
  /** By rule id: an unconditional rule's own question (mnt-d63). */
  rules: Readonly<Record<string, number>>;
  pain: { choice: Pain };
  terms: readonly Term[];
  overflow: number;
}
interface Match {
  ruleId: string;
  trigger: { kind: 'condition' | 'section'; id: string; value: number };
}
type Outcome =
  | { kind: 'refused' }
  | { kind: 'no-match'; pain: Pain; gaps: Term[]; overflow: number }
  | { kind: 'answered'; pain: Pain; matches: Match[]; gaps: Term[]; overflow: number };

export const NOUL_YES = 0.5;

// Evaluate predicates into ordered sets rather than consulting production selection helpers.
// mnt-d63: an unconditional rule needs its section AND its own question (`and`), or its own
// question alone (`rule`); the reported value is the one that decided it.
export function select(
  vocabulary: { rules: readonly Rule[] },
  judgment: Judgment,
  policy: 'and' | 'rule' = 'and',
): Outcome {
  const pain = judgment.pain.choice;
  if (pain === 'other') return { kind: 'refused' };
  const yes = new Set(
    [
      ...Object.entries(judgment.conditions).map(
        ([id, value]) => [`condition:${id}`, value] as const,
      ),
      ...Object.entries(judgment.sections).map(([id, value]) => [`section:${id}`, value] as const),
    ]
      .filter(([, value]) => value >= 0.5)
      .map(([id]) => id),
  );
  const matches = vocabulary.rules.flatMap((rule): Match[] => {
    const id = rule.trigger.kind === 'condition' ? rule.trigger.condition : rule.trigger.section;
    const compatible = rule.painSet.length === 0 || rule.painSet.some((type) => type === pain);
    if (!compatible) return [];
    if (rule.trigger.kind === 'condition') {
      if (!yes.has(`condition:${id}`)) return [];
      const value = judgment.conditions[id];
      if (value === undefined) throw new Error(`oracle: missing trigger ${id}`);
      return [{ ruleId: rule.id, trigger: { kind: 'condition', id, value } }];
    }
    const own = judgment.rules[rule.id];
    const section = judgment.sections[id];
    if (own === undefined || section === undefined) throw new Error(`oracle: missing ${rule.id}`);
    const sectionYes = yes.has(`section:${id}`);
    const ownYes = own >= 0.5;
    if (policy === 'and' ? !(sectionYes && ownYes) : !ownYes) return [];
    const value = policy === 'and' ? (own < section ? own : section) : own;
    return [{ ruleId: rule.id, trigger: { kind: 'section', id, value } }];
  });
  const gaps = judgment.terms.filter((term) => term.value >= 0.5);
  return matches.length === 0
    ? { kind: 'no-match', pain, gaps, overflow: judgment.overflow }
    : { kind: 'answered', pain, matches, gaps, overflow: judgment.overflow };
}
