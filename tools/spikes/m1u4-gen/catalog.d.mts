export interface Projection {
  variable: string;
  descriptor: string;
}

export interface CatalogRecord {
  id: string;
  goal: string;
  projection: Projection[];
}

export interface RepoSourceRecord {
  id: string;
  clauses: string[];
  projection: Projection[];
}

export interface CompiledCatalog {
  bag: string;
  files: Map<string, Uint8Array>;
  records: CatalogRecord[];
  repoSource: RepoSourceRecord[];
  querySha256: Record<string, string>;
}

export declare const ROOT: string;
export declare class CatalogError extends Error {}
export declare function compileCatalog(root?: string): CompiledCatalog;
export declare function compileCatalogFromFiles(
  files: Map<string, Uint8Array>,
  repoSource?: RepoSourceRecord[],
): Omit<CompiledCatalog, 'bag' | 'files'>;
export declare function emitCatalog(records: CatalogRecord[]): string;
export declare function parseQueryFile(
  source: string,
  filename: string,
): { record: CatalogRecord; sourceSha256: string };
