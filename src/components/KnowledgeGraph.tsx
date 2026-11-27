import { useMemo, useState } from 'react';
import type { VaultDocument, VaultMemory } from '../types';

interface GraphNode {
  id: string;
  label: string;
  kind: 'doc' | 'memory' | 'tag';
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

export function KnowledgeGraph({
  documents,
  memories,
}: {
  documents: VaultDocument[];
  memories: VaultMemory[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const outNodes: GraphNode[] = [];
    const outEdges: GraphEdge[] = [];
    const tagSet = new Set<string>();

    const cx = 280;
    const cy = 140;

    documents.slice(0, 8).forEach((d, idx) => {
      const angle = (idx / Math.max(1, Math.min(8, documents.length))) * Math.PI * 2 - Math.PI / 2;
      outNodes.push({
        id: `doc-${d.id}`,
        label: d.title.slice(0, 18),
        kind: 'doc',
        x: cx + Math.cos(angle) * 105,
        y: cy + Math.sin(angle) * 85,
      });
    });

    memories.slice(0, 8).forEach((m, idx) => {
      const angle = (idx / Math.max(1, Math.min(8, memories.length))) * Math.PI * 2;
      outNodes.push({
        id: `mem-${m.id}`,
        label: m.title.slice(0, 18),
        kind: 'memory',
        x: cx + Math.cos(angle) * 185,
        y: cy + Math.sin(angle) * 105,
      });
      (m.tags || []).forEach((t) => {
        tagSet.add(t);
        outEdges.push({ from: `mem-${m.id}`, to: `tag-${t}` });
      });
    });

    const tags = Array.from(tagSet).slice(0, 8);
    tags.forEach((t, idx) => {
      const angle = (idx / Math.max(1, tags.length)) * Math.PI * 2 + 0.4;
      outNodes.push({
        id: `tag-${t}`,
        label: `#${t}`,
        kind: 'tag',
        x: cx + Math.cos(angle) * 52,
        y: cy + Math.sin(angle) * 42,
      });
    });

    // Link docs to center or shared keywords in memories
    documents.slice(0, 8).forEach((d) => {
      const docWords = d.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      memories.slice(0, 8).forEach((m) => {
        const text = `${m.title} ${m.content}`.toLowerCase();
        if (docWords.some((w) => text.includes(w))) {
          outEdges.push({ from: `doc-${d.id}`, to: `mem-${m.id}` });
        }
      });
    });

    return { nodes: outNodes, edges: outEdges };
  }, [documents, memories]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const selected = selectedId ? nodeMap.get(selectedId) : null;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Personal Knowledge Graph (Rendered in RAM)</h3>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {nodes.length} nodes · {edges.length} links
        </span>
      </div>
      <svg
        viewBox="0 0 560 280"
        width="100%"
        height="240"
        style={{ background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}
      >
        {edges.map((e, i) => {
          const a = nodeMap.get(e.from);
          const b = nodeMap.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(212, 163, 89, 0.35)"
              strokeWidth="1.2"
            />
          );
        })}
        {nodes.map((n) => {
          const fill = n.kind === 'doc' ? '#34d399' : n.kind === 'memory' ? '#d4a359' : '#a1a1aa';
          return (
            <g
              key={n.id}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedId(n.id)}
            >
              <circle cx={n.x} cy={n.y} r={n.kind === 'tag' ? 6 : 8} fill={fill} fillOpacity="0.88" />
              <text
                x={n.x}
                y={n.y + 18}
                textAnchor="middle"
                fill="currentColor"
                fontSize="10"
                style={{ opacity: 0.85 }}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      {selected && (
        <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Selected <strong>{selected.kind.toUpperCase()}</strong>: {selected.label}
        </div>
      )}
    </div>
  );
}
