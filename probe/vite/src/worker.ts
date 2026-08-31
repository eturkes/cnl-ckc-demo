import loadImageDefaultModule from 'swipl-wasm/dist/loadImageDefault';
import imageUrl from '../kb.pvm?url';

const loadImageDefault = typeof loadImageDefaultModule === 'function'
  ? loadImageDefaultModule
  : (loadImageDefaultModule as unknown as { default: typeof loadImageDefaultModule }).default;

self.onmessage = async ({ data }) => {
  if (data.type !== 'init') return;
  const response = await fetch(imageUrl);
  const image = new Uint8Array(await response.arrayBuffer());
  const module = await loadImageDefault(image)({ arguments: ['-q'] });
  const answer = module.prolog.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).').once() as { N: number };
  self.postMessage({ documents: answer.N, imageUrl });
};
