// The positive control every purpose-built check runs before it may report green.
//
// A check that cannot fail and a clean tree emit the same green. Each check therefore re-runs
// its OWN grader over a deliberately broken copy of its REAL input first, and refuses to
// report anything if that copy grades clean. Breaking the real input rather than grading a
// synthetic fixture is what also catches the check that silently stopped reading: an empty
// glob, a renamed region, a declared table that parsed to nothing.
//
// `expect` is what keeps the control honest. The refusal has to name what was broken, so a
// control that fires for an unrelated reason — a typo in the mutation, an ENOENT on a path the
// mutation invented — still fails the step instead of passing as proof.

/**
 * @param {string} check the gate step's name, as it appears in `pnpm gate`
 * @param {{mutation: string, expect: string[]}} broken what was broken, and substrings the
 *   refusal must contain
 * @param {() => string[]} grade the check's own grader over the broken input; a throw is a
 *   refusal and its message grades the same way
 * @returns {string} the mutation, for the step's success line
 */
export const requireFiring = (check, { mutation, expect }, grade) => {
  let reported;
  try {
    reported = grade().join('\n');
  } catch (cause) {
    reported = cause instanceof Error ? cause.message : String(cause);
  }
  const missing = expect.filter((text) => !reported.includes(text));
  if (missing.length > 0) {
    process.stderr.write(
      `${check}: control did not fire — ${mutation} reported ` +
        `${reported === '' ? 'nothing' : JSON.stringify(reported)}, missing ` +
        `${missing.map((text) => JSON.stringify(text)).join(', ')}\n`,
    );
    process.exit(1);
  }
  return mutation;
};
