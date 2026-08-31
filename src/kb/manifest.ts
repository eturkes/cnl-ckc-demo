// Shape of `kb/generated/kb-manifest.json`, written by `pnpm kb:build` and read
// by both `pnpm kb:asset-check` and the application. Every number in a manifest
// is observed during the run that wrote it; none is a copied constant.

/** Runtime artifact kinds. `pvm` is the shipping payload, `qlf` the fallback. */
export type KbAssetKind = 'pvm' | 'qlf';

export interface KbAsset {
  kind: KbAssetKind;
  /** Path relative to the generated directory. */
  path: string;
  bytes: number;
  sha256: string;
}

export interface KbManifest {
  /** Manifest schema version. A bump invalidates every cached artifact. */
  manifestVersion: number;
  source: {
    /** Vendored bag filename; the knowledge base enters by export, never by path. */
    bag: string;
    /** Digest of the tarball, as verified against its committed sidecar. */
    sha256: string;
    bagitVersion: string;
    payloadFiles: number;
    tagFiles: number;
  };
  input: {
    /** Payload files fed to the engine, in the order the producer fixed. */
    files: number;
    bytes: number;
    /** Digest of the exact concatenated source string the engine consulted. */
    sha256: string;
  };
  toolchain: {
    swiplWasm: string;
    /** SWI-Prolog version reported by the engine at build time. */
    prolog: string;
  };
  assets: KbAsset[];
  /** Values read back out of a live engine during the build, never assumed. */
  contract: {
    schemaVersion: number;
    documents: number;
  };
}
