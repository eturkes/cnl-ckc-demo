// The chat bridge's wire, read in the browser (`.agent/contracts/chat-c3.md` `Seam`,
// `chat-c4.md` D1). One NDJSON line = one event, discriminated by `type`; a line that is not one
// well-formed event is refused rather than half-read, so the client can report the stream as
// broken instead of rendering a guess.

export type ChatErrorReason = 'auth' | 'busy' | 'expired' | 'codex' | 'timeout' | 'interrupted';

export interface SearchResult {
  url: string;
  title: string;
  domain: string;
  snippet: string;
}

export type ChatEvent =
  | { type: 'conversation'; id: string }
  | { type: 'commentary'; text: string }
  | { type: 'query'; call: string; goal: string }
  /** `opened` = the page URL an `openPage`/`findInPage` action read, when it names one. */
  | { type: 'search'; query: string; opened: string | undefined; results: SearchResult[] }
  | { type: 'answer'; text: string }
  | { type: 'error'; reason: ChatErrorReason; message: string }
  | { type: 'done' };

/** Call ids the bridge mints: `q1`, `q2`, … per conversation. */
export const CALL_ID = /^q[1-9]\d*$/u;

const REASONS: ReadonlySet<string> = new Set([
  'auth',
  'busy',
  'expired',
  'codex',
  'timeout',
  'interrupted',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const result = (value: unknown): SearchResult | undefined => {
  if (!isRecord(value)) return undefined;
  const { url, title, domain, snippet } = value;
  return isText(url) && isText(title) && isText(domain) && isText(snippet)
    ? { url, title, domain, snippet }
    : undefined;
};

const opened = (action: unknown): string | undefined => {
  if (!isRecord(action)) return undefined;
  const { type, url } = action;
  return (type === 'openPage' || type === 'findInPage') && isText(url) && url !== ''
    ? url
    : undefined;
};

export function parseEvent(line: string): ChatEvent | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  switch (value.type) {
    case 'conversation':
      return isText(value.id) && value.id !== ''
        ? { type: 'conversation', id: value.id }
        : undefined;
    case 'commentary':
    case 'answer':
      return isText(value.text) ? { type: value.type, text: value.text } : undefined;
    case 'query':
      return isText(value.call) && CALL_ID.test(value.call) && isText(value.goal)
        ? { type: 'query', call: value.call, goal: value.goal }
        : undefined;
    case 'search': {
      if (!isText(value.query) || !Array.isArray(value.results)) return undefined;
      const results = value.results.map(result);
      if (results.some((entry) => entry === undefined)) return undefined;
      return {
        type: 'search',
        query: value.query,
        opened: opened(value.action),
        results: results as SearchResult[],
      };
    }
    case 'error':
      return isText(value.reason) && REASONS.has(value.reason) && isText(value.message)
        ? { type: 'error', reason: value.reason as ChatErrorReason, message: value.message }
        : undefined;
    case 'done':
      return { type: 'done' };
    default:
      return undefined;
  }
}
