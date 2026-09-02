import { readFileSync } from 'node:fs';

import ts from 'typescript';

const file = new URL('../src/demo/DemoController.svelte.ts', import.meta.url);
const source = ts.createSourceFile(
  file.pathname,
  readFileSync(file, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const expectedExports = new Set([
  'DEMO_BUDGET',
  'DemoEngine',
  'createDemoEngine',
  'DemoState',
  'DemoController',
]);
const expectedMembers = new Set([
  'constructor',
  'state',
  'selected',
  'solutionIndex',
  'select',
  'run',
  'cancel',
  'retry',
  'selectSolution',
  'dispose',
]);

const exports = new Set();
let controller;
for (const statement of source.statements) {
  if (!statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) continue;
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) exports.add(declaration.name.text);
    }
  } else if (statement.name !== undefined && ts.isIdentifier(statement.name)) {
    exports.add(statement.name.text);
    if (ts.isClassDeclaration(statement) && statement.name.text === 'DemoController')
      controller = statement;
  }
}
if (controller === undefined) throw new Error('DemoController export missing');

const members = new Set();
for (const member of controller.members) {
  if (ts.isConstructorDeclaration(member)) {
    members.add('constructor');
  } else if (member.name !== undefined && ts.isIdentifier(member.name)) {
    members.add(member.name.text);
  }
}

const difference = (actual, expected) => [...actual].filter((name) => !expected.has(name)).sort();
const extras = {
  exports: difference(exports, expectedExports),
  members: difference(members, expectedMembers),
};
const missing = {
  exports: difference(expectedExports, exports),
  members: difference(expectedMembers, members),
};

if (
  extras.exports.length ||
  extras.members.length ||
  missing.exports.length ||
  missing.members.length
) {
  console.error(JSON.stringify({ extras, missing }, null, 2));
  process.exitCode = 1;
} else {
  console.log('fixed public API exact');
}
