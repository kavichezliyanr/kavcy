import type { ChatCitation, DocumentChunk, VaultDocument, VaultMemory } from '../types';

const CHUNK_SIZE = 550;
const CHUNK_OVERLAP = 90;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'what', 'about',
  'your', 'into', 'are', 'was', 'were', 'will', 'would', 'could', 'should', 'can',
  'you', 'please', 'tell', 'show', 'give', 'how', 'when', 'where', 'why', 'who',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function buildVaultDocument(title: string, text: string, mimeType = 'text/plain'): VaultDocument {
  const docId = crypto.randomUUID();
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const chunks: DocumentChunk[] = [];

  if (normalized.length <= CHUNK_SIZE) {
    chunks.push({
      id: crypto.randomUUID(),
      docId,
      docTitle: title,
      index: 0,
      text: normalized,
    });
  } else {
    let start = 0;
    let index = 0;
    while (start < normalized.length && index < 80) {
      const end = Math.min(normalized.length, start + CHUNK_SIZE);
      const slice = normalized.slice(start, end).trim();
      if (slice.length > 0) {
        chunks.push({
          id: crypto.randomUUID(),
          docId,
          docTitle: title,
          index,
          text: slice,
        });
        index++;
      }
      if (end >= normalized.length) break;
      start = end - CHUNK_OVERLAP;
    }
  }

  return {
    id: docId,
    title,
    mimeType,
    sizeBytes: new TextEncoder().encode(normalized).length,
    chunkCount: chunks.length,
    chunks,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
}

export interface RagResult {
  contextBlocks: Array<{
    sourceType: 'document' | 'memory';
    title: string;
    category: string;
    content: string;
  }>;
  citations: ChatCitation[];
}

export function retrieveRagContext(
  query: string,
  documents: VaultDocument[],
  memories: VaultMemory[],
  topK = 5,
  minScore = 0
): RagResult {
  const queryTokens = tokenize(query);
  const queryLower = query.toLowerCase().trim();

  type Candidate = {
    sourceType: 'document' | 'memory';
    title: string;
    category: string;
    content: string;
    score: number;
  };

  const candidates: Candidate[] = [];

  for (const doc of documents) {
    if (doc.enabled === false) continue;
    for (const chunk of doc.chunks) {
      candidates.push({
        sourceType: 'document',
        title: `${doc.title} (Chunk #${chunk.index + 1})`,
        category: 'document',
        content: chunk.text,
        score: 0,
      });
    }
  }

  for (const mem of memories) {
    candidates.push({
      sourceType: 'memory',
      title: mem.title,
      category: mem.category,
      content: `${mem.content}${mem.tags?.length ? ` [tags: ${mem.tags.join(', ')}]` : ''}`,
      score: 0,
    });
  }

  if (candidates.length === 0) {
    return { contextBlocks: [], citations: [] };
  }

  const df = new Map<string, number>();
  for (const token of new Set(queryTokens)) {
    let count = 0;
    for (const c of candidates) {
      if (`${c.title} ${c.content}`.toLowerCase().includes(token)) count++;
    }
    df.set(token, count);
  }

  const totalDocs = candidates.length;
  for (const c of candidates) {
    const titleLower = c.title.toLowerCase();
    const contentLower = c.content.toLowerCase();
    let score = 0;

    if (queryLower.length > 4 && contentLower.includes(queryLower)) {
      score += 8;
    }

    for (const token of queryTokens) {
      const freq = df.get(token) || 0;
      const idf = Math.log(1 + totalDocs / (1 + freq));
      if (titleLower.includes(token)) score += 3.0 * idf;
      if (contentLower.includes(token)) score += 1.5 * idf;
    }
    c.score = score;
  }

  const ranked = candidates
    .filter((c) => c.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const wantsSummary =
    ranked.length === 0 &&
    /(summar|overview|what.*doc|what.*file|my note|everything)/i.test(queryLower);

  const selected = wantsSummary ? candidates.slice(0, Math.min(topK, candidates.length)) : ranked;

  return {
    contextBlocks: selected.map(({ sourceType, title, category, content }) => ({
      sourceType,
      title,
      category,
      content,
    })),
    citations: selected.map((item) => ({
      sourceType: item.sourceType,
      title: item.title,
      excerpt: item.content.slice(0, 120) + (item.content.length > 120 ? '…' : ''),
    })),
  };
}
