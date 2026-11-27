import { ml_kem768 } from '@noble/post-quantum/ml-kem';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_ITERATIONS = 310_000;

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(str) {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

async function deriveMasterKey(passphrase, salt, iterations = DEFAULT_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-512' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function aesEncrypt(key, bytes) {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(cipher)) };
}

async function aesDecrypt(key, ivB64, ctB64) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, key, fromBase64(ctB64));
  return new Uint8Array(plain);
}

export class KavcyVault {
  constructor(session) {
    this.session = session;
  }

  static async create(vaultId, passphrase, iterations = DEFAULT_ITERATIONS) {
    const salt = randomBytes(16);
    const masterKey = await deriveMasterKey(passphrase, salt, iterations);
    const { publicKey, secretKey } = ml_kem768.keygen();
    const wrappedKemSecretKey = await aesEncrypt(masterKey, secretKey);
    return new KavcyVault({ vaultId, salt, iterations, masterKey, publicKey, secretKey, wrappedKemSecretKey });
  }

  async encrypt(payload) {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(this.session.publicKey);
    const dataKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const encryptedData = await aesEncrypt(dataKey, encoder.encode(JSON.stringify(payload)));
    return {
      version: 2,
      vaultId: this.session.vaultId,
      algorithm: 'ML-KEM-768+AES-256-GCM',
      kdf: 'PBKDF2-SHA512',
      iterations: this.session.iterations,
      salt: toBase64(this.session.salt),
      kemPublicKey: toBase64(this.session.publicKey),
      wrappedKemSecretKey: this.session.wrappedKemSecretKey,
      kemCiphertext: toBase64(cipherText),
      encryptedData,
      updatedAt: new Date().toISOString(),
    };
  }

  static async decrypt(envelope, passphrase) {
    const salt = fromBase64(envelope.salt);
    const masterKey = await deriveMasterKey(passphrase, salt, envelope.iterations || DEFAULT_ITERATIONS);
    const secretKey = await aesDecrypt(masterKey, envelope.wrappedKemSecretKey.iv, envelope.wrappedKemSecretKey.ciphertext);
    const sharedSecret = ml_kem768.decapsulate(fromBase64(envelope.kemCiphertext), secretKey);
    const dataKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await aesDecrypt(dataKey, envelope.encryptedData.iv, envelope.encryptedData.ciphertext);
    return JSON.parse(decoder.decode(plain));
  }
}

// GF(2^8) Shamir's Secret Sharing
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    const x2 = (x << 1) ^ (x & 0x80 ? 0x11b : 0);
    x = x2 ^ x;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const gfDiv = (a, b) => (a === 0 ? 0 : EXP[(LOG[a] - LOG[b] + 255) % 255]);

export function splitSecret(secret, totalShares = 5, threshold = 3) {
  const bytes = encoder.encode(secret);
  const shares = Array.from({ length: totalShares }, () => new Uint8Array(bytes.length));
  const coeffs = new Uint8Array(threshold);
  for (let i = 0; i < bytes.length; i++) {
    coeffs[0] = bytes[i];
    coeffs.set(randomBytes(threshold - 1), 1);
    for (let s = 0; s < totalShares; s++) {
      let y = 0;
      for (let c = threshold - 1; c >= 0; c--) y = gfMul(y, s + 1) ^ coeffs[c];
      shares[s][i] = y;
    }
  }
  return shares.map((buf, idx) => `kavcy-shard-v1:${threshold}:${idx + 1}:${Buffer.from(buf).toString('hex')}`);
}

export function combineShares(shards) {
  const parsed = shards.map((line) => {
    const [, t, x, hex] = line.trim().split(':');
    return { threshold: Number(t), x: Number(x), y: new Uint8Array(Buffer.from(hex, 'hex')) };
  });
  const used = parsed.slice(0, parsed[0].threshold);
  const out = new Uint8Array(used[0].y.length);
  for (let b = 0; b < out.length; b++) {
    let acc = 0;
    for (let i = 0; i < used.length; i++) {
      let basis = 1;
      for (let j = 0; j < used.length; j++) {
        if (i !== j) basis = gfMul(basis, gfDiv(used[j].x, used[j].x ^ used[i].x));
      }
      acc ^= gfMul(used[i].y[b], basis);
    }
    out[b] = acc;
  }
  return decoder.decode(out);
}

// Client-Side RAG helpers
export function chunkDocument(title, text, chunkSize = 550, overlap = 90) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  const chunks = [];
  for (let start = 0, idx = 0; start < clean.length; idx++) {
    const end = Math.min(clean.length, start + chunkSize);
    chunks.push({ title, index: idx, text: clean.slice(start, end).trim() });
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

export function searchRag(query, chunks, topK = 4) {
  const tokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  return chunks
    .map((c) => {
      const hay = `${c.title} ${c.text}`.toLowerCase();
      const score = tokens.reduce((sum, t) => sum + (hay.includes(t) ? 1 : 0), 0);
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
