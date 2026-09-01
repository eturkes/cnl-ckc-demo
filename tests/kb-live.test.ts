// Live contract for the generated runtime payload. Boots the real artifacts that
// `pnpm kb:build` produced; reads no fixture and no recorded answer.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GENERATED_DIR, loadManifest } from '../tools/kb/paths.mjs';
import { verifyImage, verifyQlf } from '../tools/kb/produce.mjs';

/** The corpus size and schema the milestone contract fixes. */
const DOCUMENTS = 337;
const SCHEMA_VERSION = 1;
const BOOT_TIMEOUT = 120_000;

const manifest = loadManifest();
const asset = (name: string): Uint8Array => readFileSync(join(GENERATED_DIR, name));

describe('generated runtime payload', () => {
  it('has been built', () => {
    expect(manifest, 'run pnpm kb:build first').toBeDefined();
    for (const entry of manifest?.assets ?? []) {
      expect(existsSync(join(GENERATED_DIR, entry.path)), `${entry.path} missing`).toBe(true);
    }
  });

  it('records only values it observed', () => {
    expect(manifest?.contract).toEqual({ schemaVersion: SCHEMA_VERSION, documents: DOCUMENTS });
    expect(manifest?.input.files).toBe(DOCUMENTS);
    expect(manifest?.assets.map((entry) => entry.kind).sort()).toEqual(['catalog', 'pvm', 'qlf']);
    expect(manifest?.source.bagitVersion).toBe('1.0');
  });

  it(
    'loads the saved state into a live engine',
    async () => {
      const contract = await verifyImage(asset('kb.pvm'));
      expect(contract.schemaVersion).toBe(SCHEMA_VERSION);
      expect(contract.documents).toBe(DOCUMENTS);
      expect(contract.prolog).toBe(manifest?.toolchain.prolog);
    },
    BOOT_TIMEOUT,
  );

  it(
    'loads the forced QLF fallback into a live engine',
    async () => {
      const contract = await verifyQlf(asset('kb.qlf'));
      expect(contract.schemaVersion).toBe(SCHEMA_VERSION);
      expect(contract.documents).toBe(DOCUMENTS);
    },
    BOOT_TIMEOUT,
  );

  it(
    'refuses a truncated saved state instead of booting a partial engine',
    async () => {
      const truncated = asset('kb.pvm').slice(0, 4096);
      await expect(verifyImage(truncated)).rejects.toThrow();
    },
    BOOT_TIMEOUT,
  );
});
