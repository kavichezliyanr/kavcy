import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import type { EncryptedVaultEnvelope, VaultPayload } from '../types';

const KDF_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

async function deriveMasterKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-512',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function aesEncrypt(key: CryptoKey, plaintext: Uint8Array): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

async function aesDecrypt(key: CryptoKey, ivBase64: string, ciphertextBase64: string): Promise<Uint8Array> {
  const iv = fromBase64(ivBase64);
  const ciphertext = fromBase64(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  return new Uint8Array(decrypted);
}

async function importRawAesKey(rawKeyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKeyBytes as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface UnlockedVaultSession {
  vaultId: string;
  salt: Uint8Array;
  masterKey: CryptoKey;
  kemPublicKey: Uint8Array;
  kemSecretKey: Uint8Array;
  wrappedKemSecretKey: { iv: string; ciphertext: string };
}

export function generateRecoveryPhrase(): string {
  const words = [
    'amber', 'anchor', 'atlas', 'beacon', 'cedar', 'cipher', 'cobalt', 'delta',
    'ember', 'flint', 'granite', 'harbor', 'ivory', 'jasper', 'kepler', 'lattice',
    'marble', 'nexus', 'obsidian', 'prism', 'quartz', 'ridge', 'solstice', 'timber',
    'umbra', 'vector', 'warden', 'zenith', 'aurora', 'bastion', 'canyon', 'drift',
  ];
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => words[b % words.length]).join('-');
}

export function evaluatePassphraseStrength(pass: string): { score: number; label: string } {
  if (!pass) return { score: 0, label: 'Empty' };
  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 14) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Post-Quantum Ready'];
  return { score, label: labels[score] };
}

export async function createVaultSession(
  vaultId: string,
  passphrase: string
): Promise<UnlockedVaultSession> {
  const salt = randomBytes(16);
  const masterKey = await deriveMasterKey(passphrase, salt);
  const { publicKey, secretKey } = ml_kem768.keygen();
  const wrappedKemSecretKey = await aesEncrypt(masterKey, secretKey);

  return {
    vaultId,
    salt,
    masterKey,
    kemPublicKey: publicKey,
    kemSecretKey: secretKey,
    wrappedKemSecretKey,
  };
}

/**
 * Generates a brand-new ML-KEM-768 post-quantum keypair and wraps it with the
 * existing passphrase-derived master key (zero-downtime key rotation).
 */
export async function rotateKemKeypair(session: UnlockedVaultSession): Promise<UnlockedVaultSession> {
  const { publicKey, secretKey } = ml_kem768.keygen();
  const wrappedKemSecretKey = await aesEncrypt(session.masterKey, secretKey);
  return {
    ...session,
    kemPublicKey: publicKey,
    kemSecretKey: secretKey,
    wrappedKemSecretKey,
  };
}

export async function encryptVault(
  session: UnlockedVaultSession,
  payload: VaultPayload
): Promise<EncryptedVaultEnvelope> {
  const { cipherText: kemCiphertext, sharedSecret } = ml_kem768.encapsulate(session.kemPublicKey);
  const dataKey = await importRawAesKey(sharedSecret);
  const plaintextBytes = encoder.encode(JSON.stringify(payload));
  const encryptedData = await aesEncrypt(dataKey, plaintextBytes);

  return {
    version: 2,
    vaultId: session.vaultId,
    algorithm: 'ML-KEM-768+AES-256-GCM',
    kdf: 'PBKDF2-SHA512',
    iterations: KDF_ITERATIONS,
    salt: toBase64(session.salt),
    kemPublicKey: toBase64(session.kemPublicKey),
    wrappedKemSecretKey: session.wrappedKemSecretKey,
    kemCiphertext: toBase64(kemCiphertext),
    encryptedData,
    updatedAt: new Date().toISOString(),
  };
}

export async function unlockVault(
  envelope: EncryptedVaultEnvelope,
  passphrase: string
): Promise<{ session: UnlockedVaultSession; payload: VaultPayload }> {
  const salt = fromBase64(envelope.salt);
  const masterKey = await deriveMasterKey(passphrase, salt);

  let kemSecretKey: Uint8Array;
  try {
    kemSecretKey = await aesDecrypt(
      masterKey,
      envelope.wrappedKemSecretKey.iv,
      envelope.wrappedKemSecretKey.ciphertext
    );
  } catch {
    throw new Error('WRONG_PASSPHRASE');
  }

  try {
    const kemPublicKey = fromBase64(envelope.kemPublicKey);
    const kemCiphertext = fromBase64(envelope.kemCiphertext);
    const sharedSecret = ml_kem768.decapsulate(kemCiphertext, kemSecretKey);
    const dataKey = await importRawAesKey(sharedSecret);
    const plaintextBytes = await aesDecrypt(
      dataKey,
      envelope.encryptedData.iv,
      envelope.encryptedData.ciphertext
    );
    const payload = JSON.parse(decoder.decode(plaintextBytes)) as VaultPayload;

    return {
      session: {
        vaultId: envelope.vaultId,
        salt,
        masterKey,
        kemPublicKey,
        kemSecretKey,
        wrappedKemSecretKey: envelope.wrappedKemSecretKey,
      },
      payload,
    };
  } catch {
    throw new Error('CORRUPTED_CIPHERTEXT');
  }
}

/**
 * Live tamper-resistance test: flips 1 bit in the stored AES-256-GCM ciphertext
 * and proves authenticated decryption rejects it immediately.
 */
export async function runLiveTamperTest(
  session: UnlockedVaultSession,
  envelope: EncryptedVaultEnvelope
): Promise<{ rejected: boolean; message: string }> {
  const kemCiphertext = fromBase64(envelope.kemCiphertext);
  const sharedSecret = ml_kem768.decapsulate(kemCiphertext, session.kemSecretKey);
  const dataKey = await importRawAesKey(sharedSecret);

  const rawCipher = fromBase64(envelope.encryptedData.ciphertext);
  const tampered = new Uint8Array(rawCipher);
  tampered[0] ^= 0x01;

  try {
    await aesDecrypt(dataKey, envelope.encryptedData.iv, toBase64(tampered));
    return { rejected: false, message: 'Unexpected: tampered ciphertext decrypted.' };
  } catch {
    return {
      rejected: true,
      message: 'Verified: 1-bit ciphertext modification was immediately rejected by AES-256-GCM authentication tag.',
    };
  }
}

export async function getKeyFingerprint(publicKey: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', publicKey as BufferSource);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
  return hex.toUpperCase();
}
