// ann-u1 oracle: parse exported pl/ heads only; no producer/parser/marks implementation.
import type { Comparison, Grade, SentenceMarks, TimeMark } from '../../src/questions/marks.js';

export interface RawHead {
  functor: string;
  args: string[];
}
export interface RawClause extends RawHead {
  line: string;
  head: string;
  body: string;
  sentence: number;
  index: number;
}
export interface OracleMarks {
  document: string;
  grades: Grade[];
  sentences: SentenceMarks[];
}

export const splitArguments = (text: string): string[] => {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '\\' || (char === "'" && text[index + 1] === "'")) index += 1;
      else if (char === "'") quoted = false;
    } else if (char === "'") quoted = true;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quoted || depth !== 0) throw new Error('unbalanced oracle term');
  result.push(text.slice(start).trim());
  return result;
};
export const parseHead = (text: string): RawHead => {
  const open = text.indexOf('(');
  if (open <= 0 || !text.endsWith(')')) throw new Error(`unsupported oracle head ${text}`);
  return { functor: text.slice(0, open), args: splitArguments(text.slice(open + 1, -1)) };
};
export const atomText = (value: string | undefined): string => {
  if (value === undefined) throw new Error('missing oracle scalar');
  if (value.startsWith("'") && value.endsWith("'"))
    return value
      .slice(1, -1)
      .replace(/''/gu, "'")
      .replace(/\\(['\\])/gu, '$1');
  if (!/^[a-z][A-Za-z0-9_]*$/u.test(value)) throw new Error(`not an oracle atom: ${value}`);
  return value;
};
export const compiledText = (files: Map<string, Uint8Array>, document: string): string => {
  const entries = [...files].filter(([path]) => path.endsWith(`/pl/${document}.pl`));
  if (entries.length !== 1) throw new Error(`${document}: expected one exported pl/ file`);
  return Buffer.from(entries[0]?.[1] ?? []).toString('utf8');
};
export const rawClauses = (text: string): RawClause[] => {
  let sentence = 0;
  return text.split('\n').flatMap((line, index): RawClause[] => {
    const marker = /^% S(\d+):/u.exec(line);
    if (marker !== null) sentence = Number(marker[1]);
    if (!line.startsWith('guideline_')) return [];
    const boundary = line.indexOf(' :- ');
    const head = boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary);
    return [
      {
        ...parseHead(head),
        head,
        line,
        body: boundary < 0 ? 'true' : line.slice(boundary + 4, -1),
        sentence,
        index,
      },
    ];
  });
};
const need = <T>(value: T | undefined, why: string): T => {
  if (value === undefined) throw new Error(`oracle unresolved ${why}`);
  return value;
};
export const oracleMarks = (files: Map<string, Uint8Array>, document: string): OracleMarks => {
  const clauses = rawClauses(compiledText(files, document));
  const noun = (heads: RawClause[], reference: string | undefined): string => {
    const entity =
      heads.find((head) => head.functor === 'guideline_entity' && head.args[1] === reference) ??
      heads.find((head) => head.functor === 'guideline_property' && head.args[1] === reference);
    return atomText(need(entity, `noun ${String(reference)}`).args[2]);
  };
  const preamble = clauses.filter(({ sentence }) => sentence === 1);
  const grades = preamble
    .filter(({ functor }) => functor === 'guideline_grade')
    .map(({ args }): Grade => ({
      dimension: atomText(args[2]) as Grade['dimension'],
      value: atomText(args[3]),
      label: noun(preamble, args[4]),
    }));
  const sentences = [
    ...new Set(clauses.filter(({ sentence }) => sentence > 1).map(({ sentence }) => sentence)),
  ].map((sentence): SentenceMarks => {
    const heads = clauses.filter((head) => head.sentence === sentence);
    const qualifiers = heads
      .filter(({ functor }) => functor === 'guideline_qualifier')
      .map(({ args }) => ({ kind: atomText(args[2]), word: atomText(args[3]) }));
    const preferences = heads
      .filter(({ functor }) => functor === 'guideline_preference')
      .map(({ args }) => ({
        preferred: noun(heads, args[2]),
        alternative: args[3] === 'none' ? null : noun(heads, args[3]),
      }));
    const times = heads.flatMap(({ functor, args }): TimeMark[] => {
      if (functor === 'guideline_order')
        return [
          {
            kind: 'order',
            relation: atomText(args[2]) as 'before' | 'after',
            anchor: noun(heads, args[3]),
          },
        ];
      if (functor !== 'guideline_interval') return [];
      const cardinality = need(
        heads.find((head) => head.functor === 'guideline_cardinality' && head.args[1] === args[3]),
        `quantity ${String(args[3])}`,
      );
      const count = Number(cardinality.args[4]);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('bad oracle quantity');
      return [
        {
          kind: 'interval',
          role: atomText(args[2]) as 'after' | 'before' | 'within',
          comparison: atomText(cardinality.args[3]) as Comparison,
          count,
          unit: atomText(args[4]),
          anchor: noun(heads, args[5]),
        },
      ];
    });
    return { sentence, qualifiers, preferences, times };
  });
  return { document, grades, sentences };
};

export const renderHead = ({ functor, args }: RawHead): string => `${functor}(${args.join(',')})`;
export const withHead = (clause: RawClause, args: string[]): string =>
  `${renderHead({ ...clause, args })}${clause.body === 'true' ? '' : ` :- ${clause.body}`}.`;
