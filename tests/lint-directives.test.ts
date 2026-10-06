// The repo's lint config refuses an inline `eslint-disable` that states no reason
// (`@eslint-community/eslint-comments/require-description`). Linted through the real config, so a
// rule dropped from `eslint.config.js` reddens this suite, not just the tree it guards.

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { ROOT } from './clinical-test-support.js';

const RULE = '@eslint-community/eslint-comments/require-description';
// A config file outside the TypeScript project, so the probe needs no type information.
const PROBE = 'zz-directive-probe.js';

const findings = async (code: string): Promise<string[]> => {
  const [result] = await new ESLint({ cwd: ROOT }).lintText(code, { filePath: PROBE });
  return (result?.messages ?? []).map(({ ruleId }) => String(ruleId));
};

describe('lint directive reasons', () => {
  it('refuses a bare inline disable and accepts the same disable with its reason', async () => {
    expect(await findings('// eslint-disable-next-line no-console\nconsole.log(1);\n')).toContain(
      RULE,
    );
    expect(
      await findings(
        '// eslint-disable-next-line no-console -- the probe writes on purpose\nconsole.log(1);\n',
      ),
    ).not.toContain(RULE);
  }, 60_000);
});
