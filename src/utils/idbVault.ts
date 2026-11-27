import type { EncryptedVaultEnvelope } from '../types';

const DB_NAME = 'kavcy_pq_vault_db';
const STORE_NAME = 'envelopes';
const DB_VERSION = 1;

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'vaultId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Saves an encrypted vault envelope into IndexedDB (gigabyte capacity vs 5 MB localStorage).
 * Falls back gracefully to localStorage if IndexedDB is unavailable.
 */
export async function saveEncryptedEnvelope(vaultId: string, envelope: EncryptedVaultEnvelope): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ...envelope, vaultId });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    try {
      localStorage.setItem(`kavcy_vault_cache_${vaultId}`, JSON.stringify(envelope));
    } catch {
      // ignore quota
    }
  }
}

/**
 * Loads an encrypted vault envelope from IndexedDB, migrating legacy localStorage caches automatically.
 */
export async function loadEncryptedEnvelope(vaultId: string): Promise<EncryptedVaultEnvelope | null> {
  try {
    const db = await openVaultDb();
    const record = await new Promise<EncryptedVaultEnvelope | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(vaultId);
      req.onsuccess = () => resolve((req.result as EncryptedVaultEnvelope) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (record) return record;
  } catch {
    // fall back to localStorage
  }

  try {
    const legacy =
      localStorage.getItem(`kavcy_vault_cache_${vaultId}`) ||
      localStorage.getItem(`aegis_vault_cache_${vaultId}`);
    if (legacy) {
      const parsed = JSON.parse(legacy) as EncryptedVaultEnvelope;
      void saveEncryptedEnvelope(vaultId, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function wipeAllEncryptedEnvelopes(): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
