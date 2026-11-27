import { useState } from 'react';
import { Play, ShieldCheck, BarChart3, Check, X } from 'lucide-react';
import type { VaultDocument, VaultMemory } from '../types';

interface PendingToolCall {
  tool: string;
  description: string;
  payload: Record<string, unknown>;
  execute: () => string;
}

export function WorkflowsAndTools({
  documents,
  memories,
  onRunPrompt,
  onToast,
}: {
  documents: VaultDocument[];
  memories: VaultMemory[];
  onRunPrompt: (prompt: string) => void;
  onToast: (msg: string) => void;
}) {
  const [pendingTool, setPendingTool] = useState<PendingToolCall | null>(null);
  const [toolOutput, setToolOutput] = useState('');
  const [csvInput, setCsvInput] = useState('Category,Amount\nHousing,1800\nFood,620\nCloud,45\nSavings,1200');

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

  function requestToolApproval(call: PendingToolCall) {
    setPendingTool(call);
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
                  const res = pendingTool.execute();
                  setToolOutput(res);
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
                  requestToolApproval({
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
            {toolOutput && (
              <pre className="code-block" style={{ marginTop: 12, maxHeight: 150 }}>{toolOutput}</pre>
            )}
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
      </div>
    </div>
  );
}
