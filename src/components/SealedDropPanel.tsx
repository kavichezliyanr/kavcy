import { useState } from 'react';
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { Copy, Lock, Unlock } from 'lucide-react';
import { fromBase64, toBase64, type UnlockedVaultSession } from '../crypto/pqVault';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function SealedDropPanel({
  session,
  onToast,
}: {
  session: UnlockedVaultSession;
  onToast: (msg: string) => void;
}) {
  const myPubKeyB64 = toBase64(session.kemPublicKey);
  const [recipientPub, setRecipientPub] = useState(myPubKeyB64);
  const [plainNote, setPlainNote] = useState('');
  const [sealedDrop, setSealedDrop] = useState('');
  const [incomingDrop, setIncomingDrop] = useState('');
  const [unsealedText, setUnsealedText] = useState('');

  async function handleSeal() {
    if (!plainNote.trim() || !recipientPub.trim()) return;
    try {
      const pubBytes = fromBase64(recipientPub.trim());
      const { cipherText, sharedSecret } = ml_kem768.encapsulate(pubBytes);
      const aesKey = await crypto.subtle.importKey('raw', sharedSecret as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(plainNote)));
      const drop = JSON.stringify({
        type: 'kavcy-sealed-drop-v1',
        alg: 'ML-KEM-768+AES-256-GCM',
        kemCiphertext: toBase64(cipherText),
        iv: toBase64(iv),
        ciphertext: toBase64(ct),
      });
      setSealedDrop(drop);
      onToast('Sealed drop encrypted to recipient ML-KEM-768 public key.');
    } catch {
      onToast('Invalid recipient ML-KEM-768 public key.');
    }
  }

  async function handleUnseal() {
    if (!incomingDrop.trim()) return;
    try {
      const parsed = JSON.parse(incomingDrop.trim());
      const sharedSecret = ml_kem768.decapsulate(fromBase64(parsed.kemCiphertext), session.kemSecretKey);
      const aesKey = await crypto.subtle.importKey('raw', sharedSecret as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(parsed.iv) as BufferSource }, aesKey, fromBase64(parsed.ciphertext) as BufferSource);
      setUnsealedText(dec.decode(plain));
      onToast('Unsealed post-quantum drop using your ML-KEM-768 secret key.');
    } catch {
      setUnsealedText('Decryption failed: drop was not sealed for your ML-KEM-768 key or was tampered with.');
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Post-Quantum Sealed Drops (ML-KEM-768 P2P Sharing)</h3>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            void navigator.clipboard.writeText(myPubKeyB64);
            onToast('Copied your ML-KEM-768 Public Key.');
          }}
        >
          <Copy size={13} /> Copy My ML-KEM-768 Public Key
        </button>
      </div>
      <div className="grid-2">
        <div>
          <div className="field">
            <label>Recipient ML-KEM-768 Public Key (defaults to yours for self-test)</label>
            <input className="input" value={recipientPub} onChange={(e) => setRecipientPub(e.target.value)} />
          </div>
          <div className="field">
            <label>Secret Note to Seal</label>
            <textarea className="textarea" rows={2} value={plainNote} onChange={(e) => setPlainNote(e.target.value)} placeholder="Sensitive message only the recipient can unseal..." />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => void handleSeal()}>
            <Lock size={13} /> Seal with ML-KEM-768
          </button>
          {sealedDrop && (
            <pre className="code-block" style={{ maxHeight: 110, marginTop: 8 }}>{sealedDrop}</pre>
          )}
        </div>

        <div>
          <div className="field">
            <label>Paste Incoming Sealed Drop JSON</label>
            <textarea className="textarea" rows={4} value={incomingDrop} onChange={(e) => setIncomingDrop(e.target.value)} placeholder='{"type":"kavcy-sealed-drop-v1",...}' />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => void handleUnseal()}>
            <Unlock size={13} /> Unseal with My Secret Key
          </button>
          {unsealedText && (
            <div className="spec-line" style={{ marginTop: 8, marginBottom: 0 }}>
              Unsealed: <strong>{unsealedText}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
