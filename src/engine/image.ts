// The worker's asset fetch, kept out of `worker.ts` so Node tests reach it without a DOM `Worker`.

/**
 * The body's byte count as the response declares it, or `undefined`.
 *
 * Only an identity `Content-Length` counts: under `Content-Encoding` it measures the encoded
 * transfer, not the image, and a size the response never stated is never shown.
 */
export const declaredBytes = (headers: Headers): number | undefined => {
  const encoding = headers.get('content-encoding');
  if (encoding !== null && encoding.trim().toLowerCase() !== 'identity') return undefined;
  const length = headers.get('content-length')?.trim() ?? '';
  if (!/^\d+$/u.test(length)) return undefined;
  const bytes = Number(length);
  return Number.isSafeInteger(bytes) ? bytes : undefined;
};

/**
 * `fetch` resolves on 404 and 500, so the status check is what makes this fail closed.
 * `onSize` hears the declared size once the headers pass that check.
 */
export const fetchAsset = async (
  url: string,
  onSize?: (bytes: number | undefined) => void,
): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${String(response.status)}`);
  onSize?.(declaredBytes(response.headers));
  return new Uint8Array(await response.arrayBuffer());
};
