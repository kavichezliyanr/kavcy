/**
 * Pure TypeScript Shamir's Secret Sharing over GF(2^8) (AES irreducible polynomial 0x11b).
 * Splits any UTF-8 recovery secret into N shards where any M shards reconstruct it,
 * and M-1 shards reveal zero information about the secret.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

// Precompute GF(2^8) log/exp tables with generator 3
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // Multiply by 3 in GF(2^8) mod 0x11b
    const x2 = (x << 1) ^ (x & 0x80 ? 0x11b : 0);
    x = x2 ^ x;
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(2^8)');
  if (a === 0) return 0;
  return EXP[(LOG[a] - LOG[b] + 255) % 255];
}

function evalPoly(coeffs: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coeffs[i];
  }
  return result;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) throw new Error('Invalid hex shard');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Splits a UTF-8 secret string into `totalShares` shards requiring `threshold` shards to recover.
 * Shard format: `kavcy-shard-v1:<threshold>:<x-index>:<hex-y-bytes>`
 */
export function splitSecretIntoShards(secret: string, totalShares = 5, threshold = 3): string[] {
  if (threshold < 2 || totalShares < threshold || totalShares > 255) {
    throw new Error('Threshold must be >= 2 and <= totalShares <= 255');
  }
  const secretBytes = new TextEncoder().encode(secret);
  const shareBuffers = Array.from({ length: totalShares }, () => new Uint8Array(secretBytes.length));
  const coeffs = new Uint8Array(threshold);

  for (let byteIdx = 0; byteIdx < secretBytes.length; byteIdx++) {
    coeffs[0] = secretBytes[byteIdx];
    const rand = new Uint8Array(threshold - 1);
    crypto.getRandomValues(rand);
    coeffs.set(rand, 1);

    for (let s = 0; s < totalShares; s++) {
      shareBuffers[s][byteIdx] = evalPoly(coeffs, s + 1);
    }
  }

  return shareBuffers.map((buf, idx) => `kavcy-shard-v1:${threshold}:${idx + 1}:${toHex(buf)}`);
}

/**
 * Reconstructs the original secret from any M valid shards using Lagrange interpolation at x = 0.
 */
export function combineShardsToSecret(shards: string[]): string {
  const parsed = shards
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(':');
      if (parts.length !== 4 || parts[0] !== 'kavcy-shard-v1') {
        throw new Error('Invalid Kavcy shard format');
      }
      return {
        threshold: Number(parts[1]),
        x: Number(parts[2]),
        y: fromHex(parts[3]),
      };
    });

  if (parsed.length < 2) throw new Error('Provide at least 2 shards to reconstruct');
  const threshold = parsed[0].threshold;
  if (parsed.length < threshold) {
    throw new Error(`Need at least ${threshold} shards (only ${parsed.length} provided)`);
  }

  const len = parsed[0].y.length;
  const used = parsed.slice(0, threshold);
  const out = new Uint8Array(len);

  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    let acc = 0;
    for (let i = 0; i < used.length; i++) {
      let basis = 1;
      for (let j = 0; j < used.length; j++) {
        if (i === j) continue;
        // Lagrange basis L_i(0) = prod(x_j / (x_j ^ x_i))
        basis = gfMul(basis, gfDiv(used[j].x, used[j].x ^ used[i].x));
      }
      acc ^= gfMul(used[i].y[byteIdx], basis);
    }
    out[byteIdx] = acc;
  }

  return new TextDecoder().decode(out);
}
