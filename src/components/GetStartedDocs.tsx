import { CheckCircle2, ShieldCheck, Upload, Activity, Power, Sparkles, Terminal, ArrowRight } from 'lucide-react';

interface GetStartedProps {
  externalBytes: number;
  docsCount: number;
  backupExported: boolean;
  onNavigate: (tab: 'chat' | 'knowledge' | 'skills' | 'hardware' | 'inspector' | 'settings') => void;
}

export function GetStartedDocs({
  externalBytes,
  docsCount,
  backupExported,
  onNavigate,
}: GetStartedProps) {
  const checklist = [
    { done: true, label: 'ML-KEM-768 + AES-256-GCM Post-Quantum Vault unlocked in RAM' },
    { done: externalBytes === 0, label: 'Zero-Egress Network Meter verified (0 B external traffic)' },
    { done: docsCount > 0, label: 'Drop at least 1 document into Client-Side RAG' },
    { done: backupExported, label: 'Export an encrypted .kavcy.json portable backup' },
  ];

  return (
    <div className="content-pane">
      <div className="pane-inner">
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>Get Started with Kavcy</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 640 }}>
                Your step-by-step guide to running a zero-knowledge, post-quantum encrypted personal AI workspace with
                verifiable zero outbound network traffic.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('chat')}>
              Open Personal Agent <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 18 }}>
          <div className="card">
            <h3>
              <ShieldCheck size={16} /> Live Privacy Readiness Checklist
            </h3>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 11px',
                    borderRadius: 8,
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    fontSize: '0.84rem',
                  }}
                >
                  <CheckCircle2 size={15} color={item.done ? 'var(--verified)' : 'var(--text-muted)'} />
                  <span style={{ color: item.done ? 'var(--text)' : 'var(--text-secondary)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>
              <Terminal size={16} /> Chat Slash Commands &amp; Shortcuts
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0 }}>
              Type any slash command directly inside the Personal Agent composer:
            </p>
            <div className="code-block" style={{ maxHeight: 200 }}>
              {[
                '/rag     — Show active RAG document & chunk count',
                '/clear   — Clear messages in the current conversation',
                '/export  — Export current conversation to Markdown (.md)',
                '/unload  — Unload & disable model (free 100% CPU & RAM)',
                '/lock    — Immediately wipe keys from RAM & lock vault',
                '/help    — Display available slash commands',
                '',
                'Shortcuts:  ⌘K / Ctrl+K (Command Palette)  ·  ? (Shortcuts)',
              ].join('\n')}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <h3>
              <Upload size={16} /> Step 1 — Private Drag-and-Drop RAG
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Drag any <code>.txt</code>, <code>.md</code>, <code>.csv</code>, <code>.json</code>, or source code file
              directly onto the Personal Agent chat. Kavcy splits it into overlapping chunks in browser RAM, retrieves
              relevant passages with TF-IDF citations, and encrypts everything with <strong>ML-KEM-768 + AES-256-GCM</strong>.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('knowledge')}>
              Go to Docs &amp; Memory
            </button>
          </div>

          <div className="card">
            <h3>
              <Sparkles size={16} /> Step 2 — Toggle &amp; Author Skills
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Enable built-in skills (Document RAG Analyst, Executive Writer, Private Finance, Code Architect) right
              above the chat bar, or create reusable custom skills with tone controls.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('skills')}>
              Manage Agent Skills
            </button>
          </div>

          <div className="card">
            <h3>
              <Activity size={16} /> Step 3 — Verify 0 B External Egress
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Watch the live <strong>External: 0 B</strong> meter in the top bar. Toggle the{' '}
              <strong>Strict Air-Gap Kill Switch</strong> inside Network &amp; Hardware to physically block any
              non-localhost request.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('hardware')}>
              Open Network &amp; Hardware
            </button>
          </div>

          <div className="card">
            <h3>
              <Power size={16} /> Step 4 — Validate Hardware &amp; Unload Models
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Kavcy automatically checks your machine RAM and blocks models that would freeze your laptop. Whenever you
              finish chatting, click <strong>Disable &amp; Unload Model</strong> to reclaim 100% of CPU and RAM.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('inspector')}>
              Inspect Ciphertext &amp; Tamper Proof
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
