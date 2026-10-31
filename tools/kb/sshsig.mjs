// SSHSIG verification (OpenSSH `PROTOCOL.sshsig`), for the release tag's signature: pure Node, so
// the intake and the gate need no `ssh-keygen` on the host.

import { createHash, createPublicKey, verify } from 'node:crypto';

/** @param {string} message @returns {never} */
const refuse = (message) => {
  throw new Error(message);
};

const MAGIC = Buffer.from('SSHSIG');
const BEGIN = '-----BEGIN SSH SIGNATURE-----';
const END = '-----END SSH SIGNATURE-----';
const HASHES = new Set(['sha256', 'sha512']);

/** One SSH wire `string` from `bytes` at `cursor.at`, advancing it. */
const sshString = (/** @type {Buffer} */ bytes, /** @type {{ at: number }} */ cursor) => {
  if (cursor.at + 4 > bytes.length) refuse('the signature blob ends inside a length');
  const start = cursor.at + 4;
  cursor.at = start + bytes.readUInt32BE(cursor.at);
  if (cursor.at > bytes.length) refuse('the signature blob ends inside a field');
  return bytes.subarray(start, cursor.at);
};

/** @param {Buffer} value */
const wire = (value) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(value.length);
  return Buffer.concat([length, value]);
};

/** @param {Buffer} blob */
export const fingerprint = (blob) =>
  `SHA256:${createHash('sha256').update(blob).digest('base64').replace(/=+$/u, '')}`;

/**
 * The key a public-key blob holds and the one signature algorithm SSHSIG signs with it: OpenSSH
 * signs RSA with `rsa-sha2-512` alone there.
 * @param {Buffer} blob
 */
const publicKey = (blob) => {
  const cursor = { at: 0 };
  const type = sshString(blob, cursor).toString();
  if (type === 'ssh-ed25519') {
    const x = sshString(blob, cursor).toString('base64url');
    return {
      key: createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }),
      algorithm: 'ssh-ed25519',
      digest: null,
    };
  }
  if (type === 'ssh-rsa') {
    const e = sshString(blob, cursor).toString('base64url');
    const n = sshString(blob, cursor).toString('base64url');
    return {
      key: createPublicKey({ key: { kty: 'RSA', e, n }, format: 'jwk' }),
      algorithm: 'rsa-sha2-512',
      digest: 'sha512',
    };
  }
  return refuse(`key type ${type} is not supported`);
};

/**
 * Pinned signers in `allowed_signers` form, one `<principal> <key type> <base64 key>` per line;
 * blank lines and `#` comments are skipped.
 * @param {string} text
 * @returns {{ principal: string, blob: Buffer }[]}
 */
export const parseSigners = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const [principal, type, key, ...rest] = line.split(/\s+/u);
      const blob = Buffer.from(key ?? '', 'base64');
      if (rest.length > 0 || blob.length === 0 || sshString(blob, { at: 0 }).toString() !== type) {
        refuse(`signer line ${JSON.stringify(line)} is not <principal> <key type> <key>`);
      }
      return { principal: String(principal), blob };
    });

/**
 * Verify an armored SSH signature over `message` under `namespace`; returns the signer's
 * principal, or throws naming what failed.
 * @param {Uint8Array} message @param {string} armored
 * @param {{ principal: string, blob: Buffer }[]} signers @param {string} namespace
 */
export const verifySshSignature = (message, armored, signers, namespace) => {
  const lines = armored.trim().split('\n');
  if (lines.length < 3 || lines[0] !== BEGIN || lines.at(-1) !== END) {
    refuse('the signature is not an armored SSH signature');
  }
  const blob = Buffer.from(lines.slice(1, -1).join(''), 'base64');
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) refuse('the signature blob lacks the SSHSIG magic');
  const cursor = { at: MAGIC.length + 4 };
  if (blob.length < cursor.at || blob.readUInt32BE(MAGIC.length) !== 1) refuse('the signature is not SSHSIG version 1');
  const signerKey = sshString(blob, cursor);
  const signedNamespace = sshString(blob, cursor);
  const reserved = sshString(blob, cursor);
  const hash = sshString(blob, cursor);
  const signature = sshString(blob, cursor);
  if (cursor.at !== blob.length) refuse('the signature blob carries trailing bytes');
  const signer = signers.find(({ blob: pinned }) => pinned.equals(signerKey));
  if (signer === undefined) refuse(`signed by ${fingerprint(signerKey)}, which no pinned signer holds`);
  if (signedNamespace.toString() !== namespace) {
    refuse(`signed in namespace ${JSON.stringify(signedNamespace.toString())}, not ${JSON.stringify(namespace)}`);
  }
  if (!HASHES.has(hash.toString())) refuse(`hash algorithm ${hash.toString()} is not sha256 or sha512`);
  const inner = { at: 0 };
  const algorithm = sshString(signature, inner).toString();
  const raw = sshString(signature, inner);
  const { key, algorithm: expected, digest } = publicKey(signerKey);
  if (algorithm !== expected) refuse(`signature algorithm ${algorithm} is not ${expected}`);
  const signed = Buffer.concat([
    MAGIC,
    wire(signedNamespace),
    wire(reserved),
    wire(hash),
    wire(createHash(hash.toString()).update(message).digest()),
  ]);
  if (!verify(digest, signed, key, raw)) refuse(`the signature does not verify against ${signer.principal}`);
  return signer.principal;
};
