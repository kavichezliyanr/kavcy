import test from 'node:test';
import assert from 'node:assert/strict';
import { KavcyVault, splitSecret, combineShares, chunkDocument, searchRag } from './index.mjs';

test('@kavcy/sdk ML-KEM-768 vault encrypt/decrypt roundtrip', async () => {
  const vault = await KavcyVault.create('sdk-test', 'post-quantum-pass-2026', 10000);
  const envelope = await vault.encrypt({ note: 'Top secret quarterly plan', tags: ['finance'] });
  assert.equal(envelope.algorithm, 'ML-KEM-768+AES-256-GCM');
  const decrypted = await KavcyVault.decrypt(envelope, 'post-quantum-pass-2026');
  assert.deepEqual(decrypted, { note: 'Top secret quarterly plan', tags: ['finance'] });
});

test('@kavcy/sdk Shamir 3-of-5 recovery shards', () => {
  const secret = 'amber-lattice-obsidian-quartz-warden-zenith';
  const shards = splitSecret(secret, 5, 3);
  assert.equal(shards.length, 5);
  assert.equal(combineShares([shards[0], shards[2], shards[4]]), secret);
});

test('@kavcy/sdk Client-Side RAG chunking and retrieval', () => {
  const chunks = chunkDocument('roadmap.md', 'Kavcy uses NIST ML-KEM-768 post-quantum encryption and AES-256-GCM.');
  const hits = searchRag('quantum encryption', chunks, 2);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, 'roadmap.md');
});
