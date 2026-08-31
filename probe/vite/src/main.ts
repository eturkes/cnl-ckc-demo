const result = document.querySelector<HTMLOutputElement>('#result')!;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = ({ data }) => { result.value = JSON.stringify(data); };
worker.onerror = ({ message }) => { result.value = `error:${message}`; };
worker.postMessage({ type: 'init' });
