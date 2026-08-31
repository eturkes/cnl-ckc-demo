import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const packages = ['none', 'cytoscape-cola', 'cytoscape-cose-bilkent', 'cytoscape-dagre', 'cytoscape-elk', 'cytoscape-fcose'];
for (const name of packages) {
  const extension = name === 'none' ? '' : `import extension from '${name}'; cytoscape.use(extension);`;
  const result = await build({
    stdin: {
      contents: `import cytoscape from 'cytoscape'; ${extension} export default cytoscape;`,
      resolveDir: import.meta.dirname,
    },
    bundle: true,
    format: 'esm',
    minify: true,
    treeShaking: true,
    write: false,
  });
  const bytes = result.outputFiles[0].contents;
  console.log(JSON.stringify({ name, minBytes: bytes.length, gzipBytes: gzipSync(bytes).length }));
}
