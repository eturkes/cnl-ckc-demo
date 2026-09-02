import base from './vite.config.js';

// Separate outDir so the probe entry never disturbs the shipped `dist` that
// `pnpm smoke` and the R33 chunk scan read.
export default {
  ...base,
  build: { ...base.build, outDir: 'dist-probe', rollupOptions: { input: { probe: 'probe.html' } } },
};
