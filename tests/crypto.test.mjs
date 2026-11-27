import test from 'node:test';
import assert from 'node:assert/strict';
import { ml_kem768 } from '@noble/post-quantum/ml-kem';

test('ML-KEM-768 + AES-256-GCM post-quantum vault roundtrip & tamper detection', async () => {
  const { publicKey, secretKey } = ml_kem768.keygen();
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
  const decapsulated = ml_kem768.decapsulate(cipherText, secretKey);

  assert.deepEqual(sharedSecret, decapsulated, 'ML-KEM-768 shared secrets must match');
  assert.equal(sharedSecret.length, 32, 'Shared secret must be 256 bits');

  const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({ secret: 'My private tax & health notes' });
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(payload))
  );

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encrypted);
  assert.equal(new TextDecoder().decode(decrypted), payload);

  const tampered = new Uint8Array(encrypted);
  tampered[0] ^= 0x01;
  await assert.rejects(
    () => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, tampered),
    'Tampered ciphertext must be rejected'
  );
});
