import { useRef, useState } from 'react';
import { Radio, Send, CheckCircle2 } from 'lucide-react';
import type { EncryptedVaultEnvelope } from '../types';

/**
 * Serverless Peer-to-Peer WebRTC DataChannel Sync (Manual SDP Offer/Answer).
 * Zero signaling server required: transfers opaque ML-KEM-768 ciphertext directly
 * between two devices (e.g., Mac <-> iPad/Windows).
 */
export function P2PSyncPanel({
  envelope,
  onReceiveEnvelope,
  onToast,
}: {
  envelope: EncryptedVaultEnvelope | null;
  onReceiveEnvelope: (env: EncryptedVaultEnvelope) => void;
  onToast: (msg: string) => void;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [localSdp, setLocalSdp] = useState('');
  const [remoteSdp, setRemoteSdp] = useState('');
  const [connected, setConnected] = useState(false);

  function cleanup() {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    setConnected(false);
  }

  function wireChannel(dc: RTCDataChannel) {
    dcRef.current = dc;
    dc.onopen = () => {
      setConnected(true);
      onToast('P2P WebRTC encrypted data channel connected!');
    };
    dc.onclose = () => setConnected(false);
    dc.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as EncryptedVaultEnvelope;
        if (parsed?.kemCiphertext && parsed?.encryptedData?.ciphertext) {
          onReceiveEnvelope(parsed);
          onToast(`Received encrypted P2P vault "${parsed.vaultId}"!`);
        }
      } catch {
        onToast('Received invalid P2P payload.');
      }
    };
  }

  async function handleCreateOffer() {
    cleanup();
    const pc = new RTCPeerConnection({ iceServers: [] });
    pcRef.current = pc;
    const dc = pc.createDataChannel('kavcy-pq-sync');
    wireChannel(dc);

    pc.onicecandidate = () => {
      if (pc.iceGatheringState === 'complete' && pc.localDescription) {
        setLocalSdp(btoa(JSON.stringify(pc.localDescription)));
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    setTimeout(() => {
      if (pc.localDescription) setLocalSdp(btoa(JSON.stringify(pc.localDescription)));
    }, 500);
  }

  async function handleAcceptOffer() {
    if (!remoteSdp.trim()) return;
    cleanup();
    try {
      const offer = JSON.parse(atob(remoteSdp.trim())) as RTCSessionDescriptionInit;
      const pc = new RTCPeerConnection({ iceServers: [] });
      pcRef.current = pc;
      pc.ondatachannel = (ev) => wireChannel(ev.channel);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      setTimeout(() => {
        if (pc.localDescription) setLocalSdp(btoa(JSON.stringify(pc.localDescription)));
      }, 500);
      onToast('Generated P2P Answer SDP — paste it back on Device A.');
    } catch {
      onToast('Invalid Offer SDP.');
    }
  }

  async function handleApplyAnswer() {
    if (!pcRef.current || !remoteSdp.trim()) return;
    try {
      const answer = JSON.parse(atob(remoteSdp.trim())) as RTCSessionDescriptionInit;
      await pcRef.current.setRemoteDescription(answer);
      onToast('Applied Answer SDP — establishing direct P2P link...');
    } catch {
      onToast('Invalid Answer SDP.');
    }
  }

  function handleSendCiphertext() {
    if (!dcRef.current || dcRef.current.readyState !== 'open' || !envelope) return;
    dcRef.current.send(JSON.stringify(envelope));
    onToast('Sent ML-KEM-768 encrypted vault envelope over direct P2P!');
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>
          <Radio size={16} /> Serverless P2P WebRTC Vault Sync (Zero Signaling Server)
        </h3>
        {connected && (
          <span className="status-tag verified">
            <CheckCircle2 size={12} /> Peer Connected
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
        Pair two devices on your local network directly via WebRTC DataChannel using manual SDP exchange—transfers only
        opaque <code>ML-KEM-768 + AES-256-GCM</code> ciphertext.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => void handleCreateOffer()}>
          1. Create Device A Offer
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => void handleAcceptOffer()}>
          2. Accept Offer (Device B)
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => void handleApplyAnswer()}>
          3. Apply Answer (Device A)
        </button>
        <button className="btn btn-primary btn-sm" disabled={!connected || !envelope} onClick={handleSendCiphertext}>
          <Send size={13} /> Push Encrypted Vault P2P
        </button>
      </div>
      <div className="grid-2">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Your Local SDP (Copy to other device)</label>
          <textarea className="textarea" rows={2} readOnly value={localSdp} placeholder="Click Create Offer or Accept Offer..." />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Paste Remote Device SDP</label>
          <textarea className="textarea" rows={2} value={remoteSdp} onChange={(e) => setRemoteSdp(e.target.value)} placeholder="Paste Offer or Answer SDP here..." />
        </div>
      </div>
    </div>
  );
}
