export interface Candidate {
  text: string;
  start: number;
  end: number;
}

export const MAX_CANDIDATES = 16;
export const MAX_CANDIDATE_LENGTH = 80;
export const STOPWORDS: ReadonlySet<string> = new Set(
  `a an the and or but if then than that this these those with for from to of in on
at by as per via about into over under after before during since until while because so is are
was were be been being am has have had having do does did will would should shall could can may
might must i me my we our us you your he him his she her they them their it its who whom whose
which what when where why how also now just only very some any more most less much many patient
patients take takes taking took taken start starts started starting want wants wanted ask asks
asked asking consider considers considered considering think thinking need needs needed
receive receives received receiving`.split(/\s+/u),
);

// Definitions → character-index partition, then token-index partition; no production imports.
export function extractCandidates(description: string): {
  candidates: Candidate[];
  overflow: number;
} {
  const segments: [number, number][] = [];
  let segmentStart = 0;
  for (let index = 0; index < description.length; index++) {
    const character = description.charAt(index);
    const decimal =
      character === '.' &&
      /[0-9]/u.test(description.charAt(index - 1)) &&
      /[0-9]/u.test(description.charAt(index + 1));
    if (',;:()[]{}"!?\n\r  '.includes(character) || (character === '.' && !decimal)) {
      segments.push([segmentStart, index]);
      segmentStart = index + 1;
    }
  }
  segments.push([segmentStart, description.length]);

  const all: Candidate[] = [];
  let overflow = 0;
  for (const [start, end] of segments) {
    const runs: Candidate[][] = [[]];
    for (const match of description.slice(start, end).matchAll(/\S+/gu)) {
      const text = match[0];
      if (STOPWORDS.has(text.toLowerCase().replace(/^['’]+|['’]+$/gu, ''))) {
        runs.push([]);
      } else {
        runs[runs.length - 1]?.push({
          text,
          start: start + match.index,
          end: start + match.index + text.length,
        });
      }
    }
    for (const run of runs) {
      if (!run.some((token) => /[\p{L}\p{N}]/u.test(token.text))) continue;
      let partial: Candidate | undefined;
      const flush = () => {
        if (partial !== undefined && /[\p{L}\p{N}]/u.test(partial.text)) all.push(partial);
        partial = undefined;
      };
      for (const token of run) {
        if (token.text.length > 80) {
          flush();
          overflow++;
          continue;
        }
        if (partial !== undefined && token.end - partial.start > 80) flush();
        const from = partial?.start ?? token.start;
        partial = { text: description.slice(from, token.end), start: from, end: token.end };
      }
      flush();
    }
  }
  const distinct = all.filter(
    (candidate, index) =>
      all.findIndex((other) => other.text.toLowerCase() === candidate.text.toLowerCase()) === index,
  );
  return {
    candidates: distinct.slice(0, 16),
    overflow: overflow + Math.max(0, distinct.length - 16),
  };
}
