export interface VaultMemory {
  id: string;
  title: string;
  category: 'preference' | 'note' | 'document' | 'fact';
  tags: string[];
  content: string;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  docId: string;
  docTitle: string;
  index: number;
  text: string;
}

export interface VaultDocument {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  chunks: DocumentChunk[];
  enabled: boolean;
  createdAt: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tone?: 'balanced' | 'concise' | 'analytical' | 'creative';
  enabled: boolean;
  builtIn?: boolean;
}

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
}

export interface ChatCitation {
  sourceType: 'document' | 'memory';
  title: string;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  starred?: boolean;
  citations?: ChatCitation[];
  activeSkillNames?: string[];
  providerMode?: 'tee' | 'tee-direct' | 'sandbox';
}

export interface Conversation {
  id: string;
  title: string;
  tag?: 'General' | 'Work' | 'Personal' | 'Finance' | 'Research';
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface AuditEvent {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface InferenceConfig {
  mode: 'sandbox' | 'tee';
  directBrowserTee: boolean;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  customPersona: string;
}

export interface VaultSettings {
  theme: 'dark' | 'light';
  fontSize: 'compact' | 'default' | 'comfortable';
  autoLockMinutes: number;
  ragTopK: number;
  ragMinScore: number;
}

export interface VaultPayload {
  version: number;
  updatedAt: string;
  memories: VaultMemory[];
  documents: VaultDocument[];
  skills: AgentSkill[];
  templates: PromptTemplate[];
  scratchpad: string;
  conversations: Conversation[];
  activeConversationId: string;
  auditLog: AuditEvent[];
  settings: VaultSettings;
  messages?: ChatMessage[];
  inference: InferenceConfig;
}

export interface EncryptedVaultEnvelope {
  version: number;
  vaultId: string;
  algorithm: 'ML-KEM-768+AES-256-GCM';
  kdf: 'PBKDF2-SHA512';
  iterations: number;
  salt: string;
  kemPublicKey: string;
  wrappedKemSecretKey: {
    iv: string;
    ciphertext: string;
  };
  kemCiphertext: string;
  encryptedData: {
    iv: string;
    ciphertext: string;
  };
  updatedAt: string;
}

export interface AttestationStatus {
  mode: 'tee' | 'sandbox';
  enclaveType: string;
  verified: boolean;
  provider: string;
  timestamp: string;
  details: string;
}
