import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const contrastSource = readFileSync(new URL('../tools/contrast.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
const pairs = [...contrastSource.matchAll(/fg: '([^']+)',\s+bg: '([^']+)'/gu)].map(
  ([, foreground, background]) => [foreground, background],
);
const panel = readFileSync(new URL('../src/intake/IntakePanel.svelte', import.meta.url), 'utf8');
const declarations = (selector: RegExp): Record<string, string> => {
  const body = selector.exec(panel)?.[1];
  if (body === undefined) throw new Error(`missing reviewed selector: ${String(selector)}`);
  const values: Record<string, string> = {};
  for (const [, property, value] of body.matchAll(/([\w-]+):\s*([^;]+);/gu)) {
    if (property === undefined || value === undefined) throw new Error('missing CSS capture');
    values[property] = value;
  }
  return values;
};
const colourToken = (value: string | undefined): string => {
  const name = /var\((--[\w-]+)\)/u.exec(value ?? '')?.[1];
  if (name === undefined) throw new Error(`expected colour token: ${String(value)}`);
  return name;
};
const resultStyle = declarations(/\.result\.filled\s*\{([^}]+)\}/u);
const buttonStyle = {
  ...declarations(/\n\s*button\s*\{([^}]+)\}/u),
  ...declarations(/\.reveal\s*\{([^}]+)\}/u),
};
const border = colourToken(buttonStyle['border-color'] ?? buttonStyle.border);
const panelBackground = colourToken(resultStyle.background);
const buttonBackground =
  buttonStyle.background === 'transparent' ? panelBackground : colourToken(buttonStyle.background);
const focus = colourToken(declarations(/button:focus-visible\s*\{([^}]+)\}/u).outline);

const lightLuminance = (token: string): number => {
  const hex = new RegExp(`${token}: #([a-f0-9]{6});`, 'u').exec(css)?.[1];
  if (hex === undefined) throw new Error(`missing light token: ${token}`);
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
};

describe('U5 intake sunken result panel', () => {
  it.each([
    [border, buttonBackground],
    [focus, panelBackground],
  ])('declares %s against %s on the reveal button', (foreground, background) => {
    expect(pairs).toContainEqual(['--border', '--surface']);
    expect(pairs).toContainEqual([foreground, background]);
  });

  it('keeps the reveal button border at the declared non-text 3:1 minimum', () => {
    const [high, low] = [lightLuminance(border), lightLuminance(buttonBackground)].sort(
      (a, b) => b - a,
    );
    expect((high! + 0.05) / (low! + 0.05)).toBeGreaterThanOrEqual(3);
  });
});
