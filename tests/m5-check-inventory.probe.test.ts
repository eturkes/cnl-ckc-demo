// Gate-retention experiment: real Vitest discovery must include each declared check.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { expect, it } from 'vitest';

import { ROOT } from './m5-probe-support.js';

interface Assertion {
  fullName: string;
  status: string;
}
interface Report {
  testResults: { assertionResults: Assertion[] }[];
}
const required = ['chk.oracle:', 'chk.exported:', 'chk.overlay:', 'chk.gate:'];
const assertions = (report: Report): Assertion[] =>
  report.testResults.flatMap(({ assertionResults }) => assertionResults);
const inventory = (report: Report): void => {
  for (const prefix of required) {
    const matches = assertions(report).filter(({ fullName }) => fullName.startsWith(prefix));
    if (matches.length !== 1 || !['passed', 'failed'].includes(matches[0]?.status ?? '')) {
      throw new Error(`required check not executed exactly once: ${prefix}`);
    }
  }
};
const deleteRegistration = (source: string, prefix: string): string => {
  const tree = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true);
  const target = tree.statements.find((statement) => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression))
      return false;
    const call = statement.expression;
    const name = call.arguments[0];
    return (
      ts.isIdentifier(call.expression) &&
      call.expression.text === 'it' &&
      name !== undefined &&
      ts.isStringLiteral(name) &&
      name.text.startsWith(prefix)
    );
  });
  if (target === undefined) throw new Error(`no registration ${prefix}`);
  return source.slice(0, target.getFullStart()) + source.slice(target.end);
};

it('chk.retention: deleting any required live check fails an independent inventory', () => {
  const directory = mkdtempSync(join(ROOT, '.scratch/m5-retention-'));
  const paths = ['legacy', 'binding'].map((label) =>
    join(ROOT, `tests/m5-retention-${process.pid}-${label}.test.ts`),
  );
  for (const path of paths)
    if (existsSync(path)) throw new Error(`temporary path occupied: ${path}`);
  const sources = ['m5-legacy-oracle.probe.test.ts', 'm5-binding.probe.test.ts'].map((name) =>
    readFileSync(join(ROOT, 'tests', name), 'utf8'),
  );
  const run = (): { report: Report; status: number | null } => {
    const json = join(directory, 'results.json');
    rmSync(json, { force: true });
    const child = spawnSync(
      process.execPath,
      [
        join(ROOT, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--project',
        'node',
        ...paths,
        '--reporter=json',
        `--outputFile=${json}`,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (child.error !== undefined) throw child.error;
    if (!existsSync(json))
      throw new Error(`runner emitted no JSON: ${child.status}; ${child.stderr}`);
    return { report: JSON.parse(readFileSync(json, 'utf8')) as Report, status: child.status };
  };
  try {
    paths.forEach((path, index) => writeFileSync(path, sources[index] as string));
    const baseline = run();
    inventory(baseline.report);
    const controls = [];
    for (const prefix of required) {
      paths.forEach((path, index) => {
        const source = sources[index] as string;
        writeFileSync(path, source.includes(prefix) ? deleteRegistration(source, prefix) : source);
      });
      const mutant = run();
      expect(() => inventory(mutant.report), `${prefix}:source deletion`).toThrow(
        'required check not executed exactly once',
      );
      expect(
        assertions(mutant.report).filter(({ fullName }) => fullName.startsWith(prefix)),
      ).toHaveLength(0);
      controls.push({
        removed: prefix,
        observedTests: assertions(mutant.report).length,
        inventoryRed: true,
      });
    }
    console.log(
      JSON.stringify({
        baselineTests: assertions(baseline.report).length,
        baselineRunnerStatus: baseline.status,
        baselineFailed: assertions(baseline.report).filter(({ status }) => status === 'failed')
          .length,
        controls,
        contract: 'gate passes only if Vitest rc=0 AND independent exact inventory succeeds',
      }),
    );
  } finally {
    paths.forEach((path) => rmSync(path, { force: true }));
    rmSync(directory, { recursive: true, force: true });
  }
}, 120_000);
