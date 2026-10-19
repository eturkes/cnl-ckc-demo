// ACE/vocabulary oracle for ann-u2; no clinical producer or renderer imports.

export interface Action {
  polarity: 'positive' | 'negative';
  verb: string;
  object: string;
  modifiers: { preposition: string; value: string }[];
  qualifiers: string[];
}

export interface Clause {
  sentence: number;
  original: string;
  condition?: string;
  subject: string;
  mode: 'should' | 'can' | 'fact';
  form?: 'recommended';
  actions: Action[];
}

export interface Sentence {
  document: string;
  vocabulary: Set<string>;
  clause: Clause;
}

const textAt = (files: Map<string, Uint8Array>, path: string): string => {
  const bytes = files.get(path);
  if (bytes === undefined) throw new Error(`oracle: missing ${path}`);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

export const vocabularyPath = (files: Map<string, Uint8Array>, document: string): string => {
  const matches = [...files.keys()].filter((path) => path.endsWith(`/ace/${document}.ace`));
  if (matches.length !== 1) throw new Error(`oracle: ${document} has no unique ACE source`);
  return `${(matches[0] ?? '').split('/ace/')[0] ?? ''}/vocabulary.tsv`;
};

export const vocabularyFor = (files: Map<string, Uint8Array>, document: string): Set<string> =>
  new Set(
    textAt(files, vocabularyPath(files, document))
      .split('\n')
      .flatMap((line) => {
        const [kind, word] = line.split('\t');
        return kind === 'qualifier' && word !== undefined ? [word] : [];
      }),
  );

const actionFromAce = (source: string, vocabulary: ReadonlySet<string>): Action => {
  let words = source.split(' ');
  let polarity: Action['polarity'] = 'positive';
  if (words[0] === 'not') {
    polarity = 'negative';
    words = words.slice(1);
  }
  const qualifiers: string[] = [];
  while (words[0] !== undefined && vocabulary.has(words[0])) {
    qualifiers.push(words.shift() as string);
  }
  const verb = words.shift();
  if (verb === undefined) throw new Error(`oracle: no verb in ${source}`);
  if (verb === 'is' && words[0] === 'not') {
    polarity = 'negative';
    words.shift();
  }
  const complement = words.join(' ');
  // Quantity bounds open no `at` phrase; hyphenated tokens stay in their noun phrase.
  const boundaries = [
    ...complement.matchAll(
      /(?:^| )(above|after|against|at(?! (?:least|most)\b)|before|during|for|from|in|of|to|with|within) /gu,
    ),
  ];
  const object = complement.slice(0, boundaries[0]?.index ?? complement.length).trimEnd();
  const modifiers = boundaries.map((match, index) => ({
    preposition: match[1] ?? '',
    value: complement
      .slice(match.index + match[0].length, boundaries[index + 1]?.index ?? complement.length)
      .trimEnd(),
  }));
  return { polarity, verb, object, modifiers, qualifiers };
};

export const clauseFromAce = (
  original: string,
  sentence: number,
  vocabulary: ReadonlySet<string>,
): Clause => {
  if (!original.endsWith('.')) throw new Error(`oracle: sentence ${String(sentence)} has no stop`);
  let main = original.slice(0, -1);
  let condition: string | undefined;
  if (main.startsWith('If ')) {
    const boundary = main.indexOf(' then ');
    if (boundary < 0) throw new Error(`oracle: no consequent in ${original}`);
    condition = main.slice(3, boundary);
    main = main.slice(boundary + 6);
  }
  const recommended = main.startsWith('it is recommended that ');
  if (recommended) main = main.slice('it is recommended that '.length);
  const match = /^(.*?) (should|can|does|is|increases) (.+)$/u.exec(main);
  if (match === null) throw new Error(`oracle: unrecognized consequent ${main}`);
  const [, subject = '', auxiliary = '', rest = ''] = match;
  const mode =
    auxiliary === 'should' || auxiliary === 'can' ? auxiliary : recommended ? 'should' : 'fact';
  const pieces = rest.split(` and ${auxiliary} `);
  const actions = pieces.map((piece) =>
    actionFromAce(mode === 'fact' ? `${auxiliary} ${piece}` : piece, vocabulary),
  );
  return {
    sentence,
    original,
    ...(condition === undefined ? {} : { condition }),
    subject,
    mode,
    ...(recommended ? { form: 'recommended' as const } : {}),
    actions,
  };
};

export const corpusSentences = (
  files: Map<string, Uint8Array>,
  documents: readonly string[],
): Sentence[] =>
  documents.flatMap((document) => {
    const vocabulary = vocabularyFor(files, document);
    const prefix = vocabularyPath(files, document).slice(0, -'vocabulary.tsv'.length);
    return textAt(files, `${prefix}ace/${document}.ace`)
      .trimEnd()
      .split('\n')
      .slice(1)
      .map((original, index) => ({
        document,
        vocabulary,
        clause: clauseFromAce(original, index + 2, vocabulary),
      }));
  });

export type RebuildableClause = Omit<Clause, 'actions'> & {
  actions: (Omit<Action, 'qualifiers'> & { qualifiers?: readonly string[] })[];
};

export const rebuildClause = (clause: RebuildableClause): string => {
  const phrases = clause.actions.map(({ polarity, verb, object, modifiers, qualifiers = [] }) => {
    const negative = polarity === 'negative';
    return [
      ...(verb === 'is'
        ? [verb, ...(negative ? ['not'] : [])]
        : [...(negative ? ['not'] : []), ...qualifiers, verb]),
      ...(object === '' ? [] : [object]),
      ...modifiers.map(({ preposition, value }) => `${preposition} ${value}`),
    ].join(' ');
  });
  const main =
    clause.form === 'recommended'
      ? `it is recommended that ${clause.subject} does ${phrases.join(' and does ')}`
      : clause.mode === 'fact'
        ? `${clause.subject} ${phrases.join(' and ')}`
        : `${clause.subject} ${clause.mode} ${phrases.join(` and ${clause.mode} `)}`;
  return `${clause.condition === undefined ? '' : `If ${clause.condition} then `}${main}.`;
};

export const groupedClauses = (sentences: readonly Sentence[]): Map<string, Clause[]> => {
  const documents = new Map<string, Clause[]>();
  for (const { document, clause } of sentences) {
    const groups = documents.get(document) ?? [];
    const key = ({ subject, mode, actions }: Clause) => JSON.stringify([subject, mode, actions]);
    if (!groups.some((group) => key(group) === key(clause))) groups.push(clause);
    documents.set(document, groups);
  }
  return documents;
};
