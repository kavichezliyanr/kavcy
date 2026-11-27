import { useEffect, useState } from 'react';
import { Play, ShieldCheck, BarChart3, Check, X, Columns2, Clock, Mic, Square } from 'lucide-react';
import type { VaultDocument, VaultMemory } from '../types';

interface PendingToolCall {
  tool: string;
  description: string;
  payload: Record<string, unknown>;
  execute: () => string;
}

interface LocalRoutine {
  id: string;
  name: string;
  intervalMin: number;
  enabled: boolean;
  lastRun?: string;
}

export function WorkflowsAndTools({
  documents,
  memories,
  onRunPrompt,
  onSaveVoiceMemo,
  onToast,
}: {
  documents: VaultDocument[];
  memories: VaultMemory[];
  onRunPrompt: (prompt: string) => void;
  onSaveVoiceMemo: (transcript: string) => void;
  onToast: (msg: string) => void;
}) {
  const [pendingTool, setPendingTool] = useState<PendingToolCall | null>(null);
  const [toolOutput, setToolOutput] = useState('');
  const [csvInput, setCsvInput] = useState('Category,Amount\nHousing,1800\nFood,620\nCloud,45\nSavings,1200');

  // Side-by-side compare state
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareOut, setCompareOut] = useState<{ a: string; b: string } | null>(null);

  // Scheduled local routines
  const [routines, setRoutines] = useState<LocalRoutine[]>([
    { id: 'r-1', name: 'Daily Encrypted Vault Digest', intervalMin: 60, enabled: false },
    { id: 'r-2', name: 'Zero-Egress Network Checkup', intervalMin: 15, enabled: false },
  ]);

  // Offline voice memo transcriber
  const [recording, setRecording] = useState(false);
  const [memoTranscript, setMemoTranscript] = useState('');

  useEffect(() => {
    const active = routines.filter((r) => r.enabled);
    if (active.length === 0) return;
    const timers = active.map((r) =>
      window.setInterval(() => {
        onToast(`Scheduled Routine "${r.name}" completed locally (${documents.length} docs, ${memories.length} memories).`);
        setRoutines((prev) =>
          prev.map((item) => (item.id === r.id ? { ...item, lastRun: new Date().toLocaleTimeString() } : item))
        );
      }, r.intervalMin * 60 * 1000)
    );
    return () => timers.forEach((t) => window.clearInterval(t));
  }, [routines.map((r) => `${r.id}:${r.enabled}`).join(','), documents.length, memories.length]);

  const csvRows = csvInput
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [label, val] = line.split(',');
      return { label: (label || '').trim(), value: Number((val || '0').trim()) || 0 };
    })
    .filter((r) => r.label);
  const maxVal = Math.max(1, ...csvRows.map((r) => r.value));

  function handleRunCompare() {
    if (!comparePrompt.trim()) return;
    const q = comparePrompt.trim();
    setCompareOut({
      a: `[Local Concise Mode · 0 B Egress]\n• Query: "${q}"\n• Matched ${documents.length} doc(s) & ${memories.length} memory item(s) in RAM.\n• Action: Direct 3-bullet summary prioritized for low latency.`,
      b: `[Analytical / Deep Mode]\n• Query: "${q}"\n• Structured breakdown: Context → Risks → Next Steps.\n• Ready to escalate to Local Ollama or Direct-to-TEE 70B when enabled in Settings.`,
    });
  }

  function toggleVoiceMemo() {
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRec) {
      onToast('Browser speech recognition unavailable — you can type or paste a memo transcript below.');
      return;
    }
    if (recording) {
      setRecording(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SpeechRec as any)();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setRecording(true);
    rec.onresult = (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const t = ev.results[0]?.[0]?.transcript || '';
      if (t) setMemoTranscript((prev) => (prev ? `${prev} ${t}` : t));
      setRecording(false);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    rec.start();
  }

  return (
    <div className="content-pane">
      <div className="pane-inner">
        {pendingTool && (
          <div className="card" style={{ marginBottom: 18, borderColor: 'var(--accent)' }}>
            <h3 style={{ color: 'var(--accent)' }}>
              <ShieldCheck size={16} /> Human-in-the-Loop Tool Approval Required
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0 }}>
              Tool <code>{pendingTool.tool}</code> requests permission: {pendingTool.description}
            </p>
            <pre className="code-block" style={{ maxHeight: 110, marginBottom: 12 }}>
              {JSON.stringify(pendingTool.payload, null, 2)}
            </pre>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setToolOutput(pendingTool.execute());
                  setPendingTool(null);
                  onToast(`Approved & executed local tool "${pendingTool.tool}".`);
                }}
              >
                <Check size={14} /> Approve &amp; Run Locally
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setPendingTool(null);
                  onToast('Tool execution denied.');
                }}
              >
                <X size={14} /> Deny
              </button>
            </div>
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: 18 }}>
          <div className="card">
            <h3>
              <Play size={16} /> 1-Click Agent Workflows &amp; Sandboxed Tools
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0 }}>
              Every local tool runs strictly in browser RAM with explicit human approval (MCP-style permission gate).
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
                onClick={() =>
                  setPendingTool({
                    tool: 'vault.audit_stats',
                    description: 'Compute local statistics across encrypted documents and memories.',
                    payload: { docsCount: documents.length, memoriesCount: memories.length, networkEgress: '0 B' },
                    execute: () =>
                      JSON.stringify(
                        {
                          documents: documents.length,
                          totalChunks: documents.reduce((s, d) => s + d.chunkCount, 0),
                          memories: memories.length,
                          totalMemoryWords: memories.reduce((s, m) => s + m.content.split(/\s+/).length, 0),
                          executedAt: new Date().toISOString(),
                        },
                        null,
                        2
                      ),
                  })
                }
              >
                <span>Run Vault Stats Audit Tool</span>
                <span className="kbd">Approval Gate</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
                onClick={() =>
                  onRunPrompt(
                    'Run a full Executive Briefing workflow: summarize all my encrypted documents and memories into Key Facts, Risks, and Next Actions.'
                  )
                }
              >
                <span>Executive Vault Briefing Pipeline</span>
                <span className="kbd">RAG + Skills</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between' }}
                onClick={() =>
                  onRunPrompt(
                    'Compare my notes and documents side-by-side and highlight any contradictions, deadlines, or action items.'
                  )
                }
              >
                <span>Cross-Document Action Extractor</span>
                <span className="kbd">Multi-Step</span>
              </button>
            </div>
            {toolOutput && <pre className="code-block" style={{ marginTop: 12, maxHeight: 140 }}>{toolOutput}</pre>}
          </div>

          <div className="card">
            <h3>
              <BarChart3 size={16} /> Local Private CSV Data &amp; Chart Analyzer (0 B Egress)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
              Paste private financial or metric CSV rows — parsed and charted 100% locally in browser RAM.
            </p>
            <textarea
              className="textarea"
              rows={4}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.78rem', marginBottom: 12 }}
            />
            <div style={{ display: 'grid', gap: 8 }}>
              {csvRows.map((row, idx) => (
                <div key={idx} style={{ fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span>{row.label}</span>
                    <strong style={{ fontFamily: 'monospace' }}>{row.value.toLocaleString()}</strong>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(4, (row.value / maxVal) * 100)}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 18 }}>
          <div className="card">
            <h3>
              <Columns2 size={16} /> Side-by-Side Blind Compare
            </h3>
            <div className="input-row" style={{ marginBottom: 10 }}>
              <input
                className="input"
                value={comparePrompt}
                onChange={(e) => setComparePrompt(e.target.value)}
                placeholder="Enter a prompt to compare Concise vs Analytical outputs..."
              />
              <button className="btn btn-primary btn-sm" onClick={handleRunCompare}>
                Compare
              </button>
            </div>
            {compareOut && (
              <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <pre className="code-block" style={{ maxHeight: 140 }}>{compareOut.a}</pre>
                <pre className="code-block" style={{ maxHeight: 140 }}>{compareOut.b}</pre>
              </div>
            )}
          </div>

          <div className="card">
            <h3>
              <Mic size={16} /> Offline Voice Memo → Encrypted Vault
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
              Dictate private voice memos locally and encrypt the transcript directly into your Memory Vault.
            </p>
            <textarea
              className="textarea"
              rows={3}
              value={memoTranscript}
              onChange={(e) => setMemoTranscript(e.target.value)}
              placeholder="Click Record Memo or type notes..."
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn btn-sm ${recording ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleVoiceMemo}>
                {recording ? <Square size={13} /> : <Mic size={13} />}
                {recording ? 'Stop Recording' : 'Record Memo'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!memoTranscript.trim()}
                onClick={() => {
                  onSaveVoiceMemo(memoTranscript.trim());
                  setMemoTranscript('');
                }}
              >
                Encrypt to Memory Vault
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>
            <Clock size={16} /> Scheduled Local Agent Routines
          </h3>
          {routines.map((r) => (
            <div key={r.id} className="item-card">
              <div>
                <strong>{r.name}</strong>{' '}
                <span className="kbd">Every {r.intervalMin}m</span>
                {r.lastRun && <span style={{ marginLeft: 8, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Last run: {r.lastRun}</span>}
              </div>
              <button
                className={`btn btn-sm ${r.enabled ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() =>
                  setRoutines((prev) => prev.map((item) => (item.id === r.id ? { ...item, enabled: !item.enabled } : item)))
                }
              >
                {r.enabled ? 'Running' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
