// Candidate phrases cut from the user's OWN description (`.agent/contracts/m5u16.md` K1).
//
// The judgment names what a description asserts that the KB has no vocabulary for, and a
// judgment model can only answer about text it is handed. Candidates are therefore verbatim
// slices of the description, found by a frozen stopword chunker, so a gap term shown to the user
// is always something the user typed. The browser re-runs this to check the proxy's answer.

export interface Candidate {
  text: string;
  start: number;
  end: number;
}

export const MAX_CANDIDATES = 16;
export const MAX_CANDIDATE_LENGTH = 80;

// Negators stay OUT of this list, so "denies sleep apnea" keeps its polarity in one chunk.
export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    'a an the and or but if then than that this these those with for from to of in on at by as ' +
    'per via about into over under after before during since until while because so is are ' +
    'was were be been being am has have had having do does did will would should shall could ' +
    'can may might must i me my we our us you your he him his she her they them their it its ' +
    'who whom whose which what when where why how also now just only very some any more most ' +
    'less much many patient patients take takes taking took taken start starts started starting ' +
    'want wants wanted ask asks asked asking consider considers considered considering think ' +
    'thinking need needs needed receive receives received receiving'
  ).split(' '),
);

const HARD = new Set([',', ';', ':', '(', ')', '[', ']', '{', '}', '"', '!', '?']);
const LINE_BREAK = /[\n\r\u2028\u2029]/u;
const SPACE = /\s/u;
const DIGIT = /[0-9]/u;
const SIGNAL = /[\p{L}\p{N}]/u;
const EDGE_QUOTES = /^['\u2019]+|['\u2019]+$/gu;

interface Token {
  start: number;
  end: number;
}

/** `.` ends a segment unless it sits between two ASCII digits, as in `2.5 mg`. */
const isBoundary = (text: string, at: number): boolean => {
  const char = text.charAt(at);
  if (HARD.has(char) || LINE_BREAK.test(char)) return true;
  return char === '.' && !(DIGIT.test(text.charAt(at - 1)) && DIGIT.test(text.charAt(at + 1)));
};

const segments = (text: string): Token[][] => {
  const result: Token[][] = [];
  let tokens: Token[] = [];
  let start = -1;
  const closeToken = (end: number): void => {
    if (start >= 0) tokens.push({ start, end });
    start = -1;
  };
  for (let at = 0; at < text.length; at += 1) {
    if (isBoundary(text, at)) {
      closeToken(at);
      result.push(tokens);
      tokens = [];
    } else if (SPACE.test(text.charAt(at))) {
      closeToken(at);
    } else if (start < 0) {
      start = at;
    }
  }
  closeToken(text.length);
  result.push(tokens);
  return result;
};

const isStopword = (text: string, token: Token): boolean =>
  STOPWORDS.has(text.slice(token.start, token.end).toLowerCase().replace(EDGE_QUOTES, ''));

export const extractCandidates = (
  description: string,
): { candidates: Candidate[]; overflow: number } => {
  const chunks: Candidate[] = [];
  let overlong = 0;
  const emit = (run: readonly Token[]): void => {
    const first = run[0];
    const last = run.at(-1);
    if (first === undefined || last === undefined) return;
    const text = description.slice(first.start, last.end);
    if (SIGNAL.test(text)) chunks.push({ text, start: first.start, end: last.end });
  };
  for (const segment of segments(description)) {
    let run: Token[] = [];
    const flush = (): void => {
      const first = run[0];
      const last = run.at(-1);
      // A chunk without a letter or digit goes before any length handling, so it never counts.
      if (
        first === undefined ||
        last === undefined ||
        !SIGNAL.test(description.slice(first.start, last.end))
      ) {
        run = [];
        return;
      }
      // A chunk over the length cap is cut greedily into consecutive token runs that fit.
      let piece: Token[] = [];
      for (const token of run) {
        if (token.end - token.start > MAX_CANDIDATE_LENGTH) {
          emit(piece);
          piece = [];
          overlong += 1;
          continue;
        }
        const head = piece[0];
        if (head !== undefined && token.end - head.start > MAX_CANDIDATE_LENGTH) {
          emit(piece);
          piece = [];
        }
        piece.push(token);
      }
      emit(piece);
      run = [];
    };
    for (const token of segment) {
      if (isStopword(description, token)) flush();
      else run.push(token);
    }
    flush();
  }
  const seen = new Set<string>();
  const distinct = chunks.filter(({ text }) => {
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    candidates: distinct.slice(0, MAX_CANDIDATES),
    overflow: Math.max(0, distinct.length - MAX_CANDIDATES) + overlong,
  };
};
