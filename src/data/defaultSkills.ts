import type { AgentSkill } from '../types';

export const DEFAULT_SKILLS: AgentSkill[] = [
  {
    id: 'skill-rag-analyst',
    name: 'Document RAG Analyst',
    description: 'Grounds answers strictly in your dropped documents and cites chunk sources.',
    instructions:
      'Prioritize facts from the user’s retrieved encrypted document chunks and memories. Cite the source document title when answering, and clearly state if a detail is missing from the files.',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'skill-executive-writer',
    name: 'Executive Writer',
    description: 'Drafts crisp emails, memos, and action items in a clear, structured tone.',
    instructions:
      'Write concisely with clear headings, bullet points, and actionable takeaways. Avoid fluff.',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'skill-finance-tax',
    name: 'Private Finance & Tax',
    description: 'Organizes budgets, receipts, and financial notes privately.',
    instructions:
      'Help analyze personal expenses, budgets, and financial documents carefully. Present numbers in clean bullet tables and remind the user to verify official tax filings.',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'skill-code-architect',
    name: 'Code & System Architect',
    description: 'Reviews code snippets, suggests architecture, and debugs technical issues.',
    instructions:
      'Provide clean, secure, production-ready code examples and explain trade-offs clearly.',
    enabled: false,
    builtIn: true,
  },
];
