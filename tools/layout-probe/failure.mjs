/** @param {string} rule @param {string} detail */
export const predicateFailure = (rule, detail) => new Error(`LAYOUT_PREDICATE:${rule}:${detail}`);

const RULES = new Set(['R1', 'R2', 'R3', 'R3PX', 'R4', 'R5', 'R6']);
/** @param {unknown} cause @returns {{rule:string,detail:string}|null} */
export const failedPredicate = (cause) => {
  let text = cause instanceof Error ? cause.message : String(cause);
  for (const prefix of ['page.evaluate:', 'Error:'])
    if (text.startsWith(prefix)) text = text.slice(prefix.length).trimStart();
  const marker = 'LAYOUT_PREDICATE:';
  if (!text.startsWith(marker)) return null;
  const body = text.slice(marker.length);
  const separator = body.indexOf(':');
  const rule = body.slice(0, separator);
  return separator >= 0 && RULES.has(rule) ? { rule, detail: body.slice(separator + 1) } : null;
};
