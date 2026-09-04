// The controller's public surface is a contract, not an accident: `.agent/contracts/m1u6.md`
// fixes it so a diff-blind suite compiles against it. TypeScript cannot fail a build
// on an EXTRA export, so the shape is asserted from the AST instead.

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// `typescript` is CJS `export =`, and this project sets `verbatimModuleSyntax` with no
// `esModuleInterop`, so a default import resolves to an untyped value.
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCE = fileURLToPath(new URL('../src/demo/DemoController.svelte.ts', import.meta.url));

const DECLARED_EXPORTS = [
  'DEMO_BUDGET',
  'DemoController',
  'DemoEngine',
  'DemoState',
  'createDemoEngine',
  'solutionsOf',
];

const DECLARED_MEMBERS = [
  'cancel',
  'constructor',
  'contract',
  'dispose',
  'provenance',
  'retry',
  'run',
  'select',
  'selectSolution',
  'selected',
  'solutionIndex',
  'state',
];

const parsed = (): { exports: string[]; members: string[] } => {
  const source = ts.createSourceFile(
    SOURCE,
    readFileSync(SOURCE, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exports = new Set<string>();
  let controller: ts.ClassDeclaration | undefined;
  for (const statement of source.statements) {
    // `modifiers` lives on `HasModifiers`, not on every `Statement`.
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isVariableStatement(statement)) {
      for (const { name } of statement.declarationList.declarations) {
        if (ts.isIdentifier(name)) exports.add(name.text);
      }
    } else if (
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isFunctionDeclaration(statement)
    ) {
      if (statement.name === undefined) continue;
      exports.add(statement.name.text);
      if (ts.isClassDeclaration(statement) && statement.name.text === 'DemoController')
        controller = statement;
    }
  }
  if (controller === undefined) throw new Error('DemoController is not an exported class');
  const members = new Set<string>();
  for (const member of controller.members) {
    // `#`-prefixed members parse as PrivateIdentifier, so they never enter the set.
    if (ts.isConstructorDeclaration(member)) members.add('constructor');
    else if (member.name !== undefined && ts.isIdentifier(member.name))
      members.add(member.name.text);
  }
  return { exports: [...exports].sort(), members: [...members].sort() };
};

describe('fixed public API', () => {
  it('exports exactly what the contract declares', () => {
    expect(parsed().exports).toEqual(DECLARED_EXPORTS);
  });

  it('exposes exactly the declared controller members', () => {
    expect(parsed().members).toEqual(DECLARED_MEMBERS);
  });
});
