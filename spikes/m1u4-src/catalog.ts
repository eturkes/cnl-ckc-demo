export const QUESTION_IDS = [
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
  'category-b-recommendations',
  'evidence-type-3-recommendation',
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

type Projection =
  | {
      readonly kind: 'bindings';
      readonly variables: readonly {
        readonly name: 'A' | 'C';
        readonly value: 'guideline-id';
      }[];
    }
  | { readonly kind: 'boolean'; readonly variables: readonly [] };

export interface QuestionRecord {
  readonly id: QuestionId;
  readonly source: 'bag-export' | 'repo-authored';
  readonly goal: string;
  readonly projection: Projection;
  readonly display: { readonly label: string; readonly question: string };
}

const defineCatalog = <
  const T extends { readonly [K in QuestionId]: QuestionRecord & { readonly id: K } },
>(
  catalog: T,
): T => catalog;

export const QUESTION_CATALOG = defineCatalog({
  // prettier-ignore
  'category-a-recommendations': { id: 'category-a-recommendations', source: 'bag-export', goal: "','(guideline_entity(actual,A,recommendation,countable),','(guideline_cardinality(actual,A,na,eq,1),','(guideline_entity(actual,B,'category-A-recommendation',countable),','(guideline_cardinality(actual,B,na,eq,1),','(guideline_event(actual,C,be),','(guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)))))))", projection: { kind: 'bindings', variables: [{ name: 'A', value: 'guideline-id' }] }, display: { label: 'Category A recommendations', question: 'Which recommendation is a category-A recommendation?' } },
  // prettier-ignore
  'dosage-reduction-content': { id: 'dosage-reduction-content', source: 'bag-export', goal: "','(guideline_entity(actual,A,'dosage-reduction',countable),','(guideline_cardinality(actual,A,na,eq,1),','(guideline_event(actual,B,have),','(guideline_arg(actual,B,1,A),guideline_arg(actual,B,2,C)))))", projection: { kind: 'bindings', variables: [{ name: 'C', value: 'guideline-id' }] }, display: { label: 'Dosage-reduction content', question: 'What does a dosage-reduction have?' } },
  // prettier-ignore
  'evidence-type-1-recommendation': { id: 'evidence-type-1-recommendation', source: 'bag-export', goal: "','(guideline_entity(actual,A,recommendation,countable),','(guideline_cardinality(actual,A,na,eq,1),','(guideline_entity(actual,B,'evidence-type-1-recommendation',countable),','(guideline_cardinality(actual,B,na,eq,1),','(guideline_event(actual,C,be),','(guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)))))))", projection: { kind: 'bindings', variables: [{ name: 'A', value: 'guideline-id' }] }, display: { label: 'Evidence type 1 recommendation', question: 'Which recommendation is an evidence-type-1 recommendation?' } },
  // prettier-ignore
  'recommendation-exists': { id: 'recommendation-exists', source: 'bag-export', goal: "','(guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1))", projection: { kind: 'boolean', variables: [] }, display: { label: 'Recommendation existence', question: 'Is there a recommendation?' } },
  // prettier-ignore
  'category-b-recommendations': { id: 'category-b-recommendations', source: 'repo-authored', goal: "','(guideline_entity(actual,A,recommendation,countable),','(guideline_cardinality(actual,A,na,eq,1),','(guideline_entity(actual,B,'category-B-recommendation',countable),','(guideline_cardinality(actual,B,na,eq,1),','(guideline_event(actual,C,be),','(guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)))))))", projection: { kind: 'bindings', variables: [{ name: 'A', value: 'guideline-id' }] }, display: { label: 'Category B recommendations', question: 'Which recommendation is a category-B recommendation?' } },
  // prettier-ignore
  'evidence-type-3-recommendation': { id: 'evidence-type-3-recommendation', source: 'repo-authored', goal: "','(guideline_entity(actual,A,recommendation,countable),','(guideline_cardinality(actual,A,na,eq,1),','(guideline_entity(actual,B,'evidence-type-3-recommendation',countable),','(guideline_cardinality(actual,B,na,eq,1),','(guideline_event(actual,C,be),','(guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)))))))", projection: { kind: 'bindings', variables: [{ name: 'A', value: 'guideline-id' }] }, display: { label: 'Evidence type 3 recommendation', question: 'Which recommendation is an evidence-type-3 recommendation?' } },
});
