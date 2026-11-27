export interface EncryptedVaultEnvelope {
  version: number;
  vaultId: string;
  algorithm: 'ML-KEM-768+AES-256-GCM';
  kdf: 'PBKDF2-SHA512';
  iterations: number;
  salt: string;
  kemPublicKey: string;
  wrappedKemSecretKey: { iv: string; ciphertext: string };
  kemCiphertext: string;
  encryptedData: { iv: string; ciphertext: string };
  updatedAt: string;
}

export class KavcyVault {
  static create(vaultId: string, passphrase: string, iterations?: number): Promise<KavcyVault>;
  encrypt<T>(payload: T): Promise<EncryptedVaultEnvelope>;
  static decrypt<T = unknown>(envelope: EncryptedVaultEnvelope, passphrase: string): Promise<T>;
}

export function splitSecret(secret: string, totalShares?: number, threshold?: number): string[];
export function combineShares(shards: string[]): string;
export function chunkDocument(title: string, text: string, chunkSize?: number, overlap?: number): Array<{ title: string; index: number; text: string }>;
export function searchRag(query: string, chunks: Array<{ title: string; index: number; text: string }>, topK?: number): Array<{ title: string; index: number; text: string; score: number }>;
