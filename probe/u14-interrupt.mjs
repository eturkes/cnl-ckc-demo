// U14 (P2.5): reproduces build.mjs's write sequence but dies between the asset
// writes and the manifest write -- a deterministic stand-in for killing a real
// build in that window. Uses a 336-file corpus so the surviving assets provably
// differ from the digests the on-disk manifest still claims.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyBag } from '../tools/kb/bag.mjs';
import { catalogJson, catalogRecords } from '../tools/kb/catalog.mjs';
import { buildImage, buildQlf } from '../tools/kb/produce.mjs';
import { GENERATED_DIR, payloadSource } from '../tools/kb/paths.mjs';

const { files } = verifyBag(readFileSync('kb/cnl-ckc-kb-g952cc950a0c6.tar.gz'));
const { names } = payloadSource(files);
const shortSource = names
  .slice(0, -1)
  .map((n) => `\n% file:${n}\n${Buffer.from(files.get(n)).toString('utf8')}`)
  .join('\n');

const { image } = await buildImage(shortSource);
const qlf = await buildQlf(shortSource);
const catalog = catalogRecords(files);

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(join(GENERATED_DIR, 'kb.pvm'), image);
writeFileSync(join(GENERATED_DIR, 'kb.qlf'), qlf);
writeFileSync(join(GENERATED_DIR, 'question-catalog.json'), Buffer.from(catalogJson(catalog.records), 'utf8'));
process.stderr.write(`interrupted after ${image.byteLength} B pvm + ${qlf.byteLength} B qlf, before the manifest write\n`);
process.exit(137); // as if SIGKILL landed in the window
