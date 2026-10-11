// Source labels for a chat answer (`.agent/contracts/chat-c4.md` D3).
//
// The model CLAIMS a source per segment; the page shows the claim only once this conversation's
// own record backs it. A `kb` claim needs calls whose goals ran, a `web` claim needs URLs a search
// returned. What this checks is citation, not entailment: it proves the cited query ran or the
// cited page was found, and the card beside the sentence lets the reader compare the two.

export type ClaimedSource = 'kb' | 'web' | 'model';

export interface AnswerSegment {
  text: string;
  source: ClaimedSource;
  queries: string[];
  urls: string[];
}

export type SegmentLabel = ClaimedSource | 'unverified';

export interface ResolvedSegment extends AnswerSegment {
  label: SegmentLabel;
}

/** Calls whose goals ran in this conversation, and URLs this turn's searches returned. */
export interface Ledger {
  ran: ReadonlySet<string>;
  urls: ReadonlySet<string>;
}

/**
 * One conversation's own record: calls whose goals ran, for the whole conversation, and the URLs
 * the CURRENT turn's searches returned — a web tag opens the turn's own search (user ruling).
 */
export class ChatRecord implements Ledger {
  readonly ran = new Set<string>();
  readonly urls = new Set<string>();

  startTurn(): void {
    this.urls.clear();
  }
}

const SOURCES: ReadonlySet<string> = new Set(['kb', 'web', 'model']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;

/** The `outputSchema` forbids additional properties, so an object must hold exactly `keys`. */
const exactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};

const segment = (value: unknown): AnswerSegment | undefined => {
  if (!isRecord(value) || !exactly(value, ['text', 'source', 'queries', 'urls'])) return undefined;
  const { text, source } = value;
  const queries = strings(value.queries);
  const urls = strings(value.urls);
  if (typeof text !== 'string' || typeof source !== 'string' || !SOURCES.has(source)) {
    return undefined;
  }
  if (queries === undefined || urls === undefined) return undefined;
  return { text, source: source as ClaimedSource, queries, urls };
};

/** The bridge's `outputSchema` shape, or `undefined` for anything else. */
export function parseAnswer(text: string): AnswerSegment[] | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || !exactly(value, ['segments']) || !Array.isArray(value.segments)) {
    return undefined;
  }
  const segments = value.segments.map(segment);
  return segments.some((entry) => entry === undefined) ? undefined : (segments as AnswerSegment[]);
}

const backed = (cited: readonly string[], record: ReadonlySet<string>): boolean =>
  cited.length > 0 && cited.every((item) => record.has(item));

/** Label each segment; a claim the record does not back is shown `unverified`, never upgraded. */
export function resolveSegments(
  segments: readonly AnswerSegment[],
  ledger: Ledger,
): ResolvedSegment[] {
  return segments.map((entry) => {
    const label: SegmentLabel =
      entry.source === 'model'
        ? 'model'
        : entry.source === 'kb'
          ? backed(entry.queries, ledger.ran)
            ? 'kb'
            : 'unverified'
          : backed(entry.urls, ledger.urls)
            ? 'web'
            : 'unverified';
    return { ...entry, label };
  });
}
