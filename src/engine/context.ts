// The run context every engine call carries (`.agent/contracts/n1.md`): the page-wide evaluation
// date, the one premise the knowledge base leaves to the program that loads it
// (`guideline_evaluation_date/1`). The engine admits it once per request and the Prolog wrapper
// `clinical_run/2` states it for that request alone.

export interface RunContext {
  /** `YYYY-MM-DD`, a real Gregorian day, or `null`: no evaluation date. */
  readonly evaluationDate: string | null;
}

export const UNDATED: RunContext = Object.freeze({ evaluationDate: null });

export class RunContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunContextError';
  }
}

const ISO_DAY = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u;

/** Whether `text` names a real Gregorian day, year 0001–9999. */
const isDay = (text: string): boolean => {
  const at = ISO_DAY.exec(text);
  if (at === null) return false;
  const [year, month, day] = [Number(at[1]), Number(at[2]), Number(at[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day <= days;
};

/**
 * Admit a caller's run context: a frozen copy, so a later mutation of the caller's object cannot
 * reach a request already admitted. Anything but `{ evaluationDate: null | <real ISO day> }`
 * throws.
 */
export const admitRunContext = (value: unknown): RunContext => {
  if (typeof value !== 'object' || value === null) {
    throw new RunContextError('the run context must be an object');
  }
  const date: unknown = (value as { evaluationDate?: unknown }).evaluationDate;
  if (date === null) return UNDATED;
  if (typeof date !== 'string' || !isDay(date)) {
    const shown = typeof date === 'string' ? date : `a value of type ${typeof date}`;
    throw new RunContextError(`the evaluation date is not a real day: ${shown}`);
  }
  return Object.freeze({ evaluationDate: date });
};

/** The Prolog term `clinical_run/2` takes: `none` or `date(YYYYMMDD)`. */
export const contextTerm = (context: RunContext): string =>
  context.evaluationDate === null
    ? 'none'
    : `date(${String(Number(context.evaluationDate.replaceAll('-', '')))})`;

/** The context record a dated proof opens with: `evaluation_date(YYYYMMDD)`. */
export const contextRecord = (context: RunContext): string | null =>
  context.evaluationDate === null
    ? null
    : `evaluation_date(${String(Number(context.evaluationDate.replaceAll('-', '')))})`;
