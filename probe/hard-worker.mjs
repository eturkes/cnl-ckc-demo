import { parentPort } from 'node:worker_threads';
import { boot, once } from './lib.mjs';

const { engine } = await boot();
const state = () => ({
  documents: once(engine, 'findall(X,guideline_document(X,_,_),L),length(L,N)').N,
  overlay: once(engine, 'guideline_document(probe_overlay,_,_)').success === true,
});
parentPort.postMessage({ kind: 'ready', ...state() });
parentPort.on('message', ({ id, kind }) => {
  if (kind === 'prime') {
    once(
      engine,
      'dynamic(guideline_document/3),assertz(guideline_document(probe_overlay,probe_source,probe_rights))',
    );
    parentPort.postMessage({ id, kind: 'primed', ...state() });
    return;
  }
  if (kind === 'burn') {
    parentPort.postMessage({ id, kind: 'burning' });
    engine.prolog.query('repeat,fail.').once();
  }
});
