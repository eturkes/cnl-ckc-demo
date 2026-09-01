import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';

let nextId = 0;
const waitFor = (worker, predicate) =>
  new Promise((resolve, reject) => {
    const onMessage = (message) => {
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
  });
const spawn = async () => {
  const start = performance.now();
  const worker = new Worker(new URL('./hard-worker.mjs', import.meta.url), { type: 'module' });
  const ready = await waitFor(worker, ({ kind }) => kind === 'ready');
  return { worker, ready, bootMs: performance.now() - start };
};
const request = async (worker, kind) => {
  const id = `q${nextId++}`;
  const response = waitFor(worker, (message) => message.id === id);
  worker.postMessage({ id, kind });
  return response;
};

const first = await spawn();
const primed = await request(first.worker, 'prime');
const burning = request(first.worker, 'burn');
await burning;
await new Promise((resolve) => setTimeout(resolve, 25));
const terminateStart = performance.now();
const exitCode = await first.worker.terminate();
const terminateMs = performance.now() - terminateStart;
const second = await spawn();
console.log(`initial_boot_ms=${first.bootMs.toFixed(3)}`);
console.log(`initial_documents=${first.ready.documents}`);
console.log(`primed_documents=${primed.documents}`);
console.log(`primed_overlay=${primed.overlay}`);
console.log(`terminate_exit_code=${exitCode}`);
console.log(`terminate_ms=${terminateMs.toFixed(3)}`);
console.log(`recreate_ms=${second.bootMs.toFixed(3)}`);
console.log(`recreated_documents=${second.ready.documents}`);
console.log(`recreated_overlay=${second.ready.overlay}`);
await second.worker.terminate();
