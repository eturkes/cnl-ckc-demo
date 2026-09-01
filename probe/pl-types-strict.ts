import type { PrologTermDto, QueryResponseDto } from './pl-types';

export function firstCompoundArg(term: PrologTermDto): PrologTermDto | null {
  return term.type === 'compound' ? (term.args[0] ?? null) : null;
}

export function responseCount(response: QueryResponseDto): number {
  return response.ok ? response.solutions.length : 0;
}

export type OptionalTail = Readonly<{ tail?: PrologTermDto }>;

// @ts-expect-error exactOptionalPropertyTypes rejects an explicit undefined sentinel.
export const rejectedUndefinedTail: OptionalTail = { tail: undefined };

export function rejectedUncheckedIndex(
  term: Extract<PrologTermDto, { type: 'compound' }>,
): PrologTermDto {
  // @ts-expect-error noUncheckedIndexedAccess requires validation or a fallback.
  return term.args[0];
}
