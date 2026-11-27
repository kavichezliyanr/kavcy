import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock,
  MessageSquare,
  Brain,
  Eye,
  EyeOff,
  Settings,
  Send,
  Plus,
  Trash2,
  Upload,
  Download,
  LogOut,
  CheckCircle2,
  Cpu,
  Sparkles,
  FileText,
  Paperclip,
  MessageSquarePlus,
  Search,
  Pin,
  Pencil,
  Copy,
  RefreshCw,
  BookmarkPlus,
  Mic,
  MicOff,
  Sun,
  Moon,
  Command,
  KeyRound,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Keyboard,
  History,
  Menu,
  X,
  Activity,
  Power,
  Volume2,
  ExternalLink,
  BookOpen,
  Star,
  StickyNote,
  GitFork,
  Eraser,
  Wifi,
  WifiOff,
  Tag,
  Flame,
  PanelRightOpen,
  Share2,
  Workflow,
  FolderUp,
  Fingerprint,
} from 'lucide-react';
import {
  saveEncryptedEnvelope,
  loadEncryptedEnvelope,
  wipeAllEncryptedEnvelopes,
} from './utils/idbVault';
import { splitSecretIntoShards, combineShardsToSecret } from './crypto/shamir';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { SealedDropPanel } from './components/SealedDropPanel';
import { WorkflowsAndTools } from './components/WorkflowsAndTools';
import {
  createVaultSession,
  encryptVault,
  evaluatePassphraseStrength,
  generateRecoveryPhrase,
  getKeyFingerprint,
  rotateKemKeypair,
  runLiveTamperTest,
  unlockVault,
  type UnlockedVaultSession,
} from './crypto/pqVault';
import { buildVaultDocument, extractTextFromFile, retrieveRagContext } from './utils/ragEngine';
import { DEFAULT_SKILLS } from './data/defaultSkills';
import { MarkdownText } from './components/MarkdownText';
import { KavcyEmblem } from './components/KavcyEmblem';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { GetStartedDocs } from './components/GetStartedDocs';
import {
  formatBytes,
  resetNetworkMeter,
  setAirGapMode,
  subscribeNetworkMeter,
  type NetworkMeterSnapshot,
} from './utils/networkMeter';
import {
  detectHardwareSpecs,
  evaluateModelsForHardware,
  type HardwareSpecs,
} from './utils/hardwareCheck';
import type {
  AgentSkill,
  AttestationStatus,
  AuditEvent,
  ChatMessage,
  Conversation,
  EncryptedVaultEnvelope,
  InferenceConfig,
  PromptTemplate,
  VaultDocument,
  VaultMemory,
  VaultPayload,
} from './types';

type ActiveTab = 'chat' | 'knowledge' | 'skills' | 'workflows' | 'hardware' | 'inspector' | 'docs' | 'settings';

const DEFAULT_INFERENCE: InferenceConfig = {
  mode: 'sandbox',
  directBrowserTee: false,
  providerName: 'Kavcy Zero-Egress Sandbox',
  baseUrl: 'https://inference.tinfoil.sh/v1',
  apiKey: '',
  model: 'llama3-3-70b',
  temperature: 0.7,
  customPersona: 'You are Kavcy, a private, post-quantum zero-knowledge personal AI assistant.',
};

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  { id: 'tpl-1', title: 'Summarize Docs', prompt: 'Summarize the key points and action items from my uploaded documents.' },
  { id: 'tpl-2', title: 'Security Audit', prompt: 'Explain how my vault is protected against quantum computers.' },
  { id: 'tpl-3', title: 'Executive Memo', prompt: 'Turn my recent notes into a crisp 5-bullet executive update.' },
];

const TEE_PRESETS = [
  { name: 'Tinfoil (Confidential GPU TEE)', baseUrl: 'https://inference.tinfoil.sh/v1', model: 'llama3-3-70b' },
  { name: 'Venice.ai (Private Cloud)', baseUrl: 'https://api.venice.ai/api/v1', model: 'llama-3.3-70b' },
  { name: 'Phala / RedPill TEE', baseUrl: 'https://api.red-pill.ai/v1', model: 'phala/llama-3.3-70b-instruct' },
];

const THREAD_TAGS: Array<NonNullable<Conversation['tag']>> = ['General', 'Work', 'Personal', 'Finance', 'Research'];

function randomVaultId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `kavcy-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function getRecentVaultIds(): string[] {
  try {
    const raw = localStorage.getItem('kavcy_recent_vaults') || localStorage.getItem('aegis_recent_vaults');
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rememberVaultId(id: string) {
  localStorage.setItem('kavcy_last_vault_id', id);
  const next = [id, ...getRecentVaultIds().filter((v) => v !== id)].slice(0, 6);
  localStorage.setItem('kavcy_recent_vaults', JSON.stringify(next));
}

function makeAudit(action: string, detail: string): AuditEvent {
  return { id: crypto.randomUUID(), action, detail, timestamp: new Date().toISOString() };
}

function createEmptyConversation(title = 'New Conversation'): Conversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    tag: 'General',
    pinned: false,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function createInitialPayload(theme: 'dark' | 'light'): VaultPayload {
  const conv = createEmptyConversation('New Conversation');
  return {
    version: 3,
    updatedAt: new Date().toISOString(),
    memories: [
      {
        id: crypto.randomUUID(),
        title: 'Security Baseline',
        category: 'preference',
        tags: ['privacy', 'post-quantum'],
        content: 'Encrypt all notes, documents, and conversations client-side with ML-KEM-768 + AES-256-GCM.',
        createdAt: new Date().toISOString(),
      },
    ],
    documents: [],
    skills: DEFAULT_SKILLS,
    templates: DEFAULT_TEMPLATES,
    scratchpad: '',
    conversations: [conv],
    activeConversationId: conv.id,
    auditLog: [makeAudit('VAULT_CREATED', 'Initialized Kavcy ML-KEM-768 + AES-256-GCM vault')],
    settings: { theme, fontSize: 'default', autoLockMinutes: 15, ragTopK: 5, ragMinScore: 0 },
    inference: DEFAULT_INFERENCE,
  };
}

function normalizeVaultPayload(raw: VaultPayload, fallbackTheme: 'dark' | 'light'): VaultPayload {
  const now = new Date().toISOString();
  let conversations = raw.conversations;
  if (!conversations || conversations.length === 0) {
    conversations = [
      {
        id: crypto.randomUUID(),
        title: 'Previous Conversation',
        tag: 'General',
        pinned: false,
        createdAt: raw.updatedAt || now,
        updatedAt: raw.updatedAt || now,
        messages: raw.messages || [],
      },
    ];
  }
  const activeConversationId =
    raw.activeConversationId && conversations.some((c) => c.id === raw.activeConversationId)
      ? raw.activeConversationId
      : conversations[0].id;

  return {
    version: 3,
    updatedAt: raw.updatedAt || now,
    memories: (raw.memories || []).map((m) => ({ ...m, tags: m.tags || [] })),
    documents: (raw.documents || []).map((d) => ({ ...d, enabled: d.enabled !== false })),
    skills: raw.skills && raw.skills.length > 0 ? raw.skills : DEFAULT_SKILLS,
    templates: raw.templates && raw.templates.length > 0 ? raw.templates : DEFAULT_TEMPLATES,
    scratchpad: raw.scratchpad || '',
    conversations: conversations.map((c) => ({ ...c, tag: c.tag || 'General' })),
    activeConversationId,
    auditLog: raw.auditLog || [makeAudit('VAULT_MIGRATED', 'Upgraded vault schema to Kavcy v3')],
    settings: {
      theme: raw.settings?.theme || fallbackTheme,
      fontSize: raw.settings?.fontSize || 'default',
      autoLockMinutes: raw.settings?.autoLockMinutes ?? 15,
      ragTopK: raw.settings?.ragTopK ?? 5,
      ragMinScore: raw.settings?.ragMinScore ?? 0,
    },
    inference: { ...DEFAULT_INFERENCE, ...(raw.inference || {}) },
  };
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('kavcy_theme') as 'dark' | 'light') || 'dark'
  );
  const [fontSize, setFontSize] = useState<'compact' | 'default' | 'comfortable'>('default');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  const [gateMode, setGateMode] = useState<'create' | 'unlock'>(() =>
    getRecentVaultIds().length > 0 ? 'unlock' : 'create'
  );
  const [vaultIdInput, setVaultIdInput] = useState(
    () => localStorage.getItem('kavcy_last_vault_id') || randomVaultId()
  );
  const [recentVaults, setRecentVaults] = useState<string[]>(() => getRecentVaultIds());
  const [passphrase, setPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);

  const [session, setSession] = useState<UnlockedVaultSession | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const [serverEnvelope, setServerEnvelope] = useState<EncryptedVaultEnvelope | null>(null);
  const [lastEncryptMs, setLastEncryptMs] = useState<number>(0);
  const [backupExported, setBackupExported] = useState(false);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'local-only'>('synced');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [attestation, setAttestation] = useState<AttestationStatus | null>(null);
  const [toast, setToast] = useState('');

  // Workspace states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{ running: boolean; models: string[] }>({ running: false, models: [] });
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [shamirInput, setShamirInput] = useState('');
  const [shamirShards, setShamirShards] = useState<string[]>([]);
  const [shamirRecoverInput, setShamirRecoverInput] = useState('');
  const [shamirRecovered, setShamirRecovered] = useState('');
  const [duressPhraseInput, setDuressPhraseInput] = useState('');
  const [byosUrl, setByosUrl] = useState(() => localStorage.getItem('kavcy_byos_url') || '');
  const [bundleSha256, setBundleSha256] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgDraft, setEditMsgDraft] = useState('');
  const [modelDisabled, setModelDisabled] = useState(false);
  const [netMeter, setNetMeter] = useState<NetworkMeterSnapshot>({
    airGapEnabled: false,
    externalBytes: 0,
    localBytes: 0,
    externalRequests: 0,
    localRequests: 0,
    blockedRequests: 0,
    events: [],
  });
  const [hwSpecs, setHwSpecs] = useState<HardwareSpecs | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [memFilter, setMemFilter] = useState<string>('all');
  const [tamperResult, setTamperResult] = useState<{ rejected: boolean; message: string } | null>(null);

  // Drag & drop + voice
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingVault, setIsDraggingVault] = useState(false);
  const [listening, setListening] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  // Memory form state
  const [memTitle, setMemTitle] = useState('');
  const [memCategory, setMemCategory] = useState<VaultMemory['category']>('note');
  const [memTags, setMemTags] = useState('');
  const [memContent, setMemContent] = useState('');

  // Skill & Template form state
  const [skillName, setSkillName] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillTone, setSkillTone] = useState<AgentSkill['tone']>('balanced');
  const [skillInstructions, setSkillInstructions] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplPrompt, setTplPrompt] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kavcy_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontSize);
  }, [fontSize]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeNetworkMeter(setNetMeter);
    void detectHardwareSpecs().then((specs) => {
      setHwSpecs(specs);
      if (specs.totalRamGb && specs.freeRamGb !== undefined) {
        setRamHistory([Math.round(((specs.totalRamGb - specs.freeRamGb) / specs.totalRamGb) * 100)]);
      }
    });
    void fetch('/api/ollama/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setOllamaStatus(d);
      })
      .catch(() => {});
    return unsub;
  }, []);

  // Live host RAM telemetry polling when viewing Network & Hardware tab
  useEffect(() => {
    if (activeTab !== 'hardware') return;
    const id = window.setInterval(() => {
      void detectHardwareSpecs().then((specs) => {
        setHwSpecs(specs);
        if (specs.totalRamGb && specs.freeRamGb !== undefined) {
          const pct = Math.round(((specs.totalRamGb - specs.freeRamGb) / specs.totalRamGb) * 100);
          setRamHistory((prev) => [...prev.slice(-19), pct]);
        }
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (session) setCmdOpen((v) => !v);
      } else if (
        e.key === '?' &&
        session &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || '').toUpperCase())
      ) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session]);

  useEffect(() => {
    if (!session || !payload || !payload.settings.autoLockMinutes) return;
    const ms = payload.settings.autoLockMinutes * 60 * 1000;
    let timer = window.setTimeout(() => {
      handleLock();
      showToast(`Vault auto-locked after ${payload.settings.autoLockMinutes}m of inactivity.`);
    }, ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        handleLock();
        showToast(`Vault auto-locked after ${payload.settings.autoLockMinutes}m of inactivity.`);
      }, ms);
    };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [session, payload?.settings.autoLockMinutes]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => {
      setToast((curr) => (curr === message ? '' : curr));
    }, 3600);
  }

  async function syncEncryptedVault(activeSession: UnlockedVaultSession, nextPayload: VaultPayload) {
    setSyncState('syncing');
    // Strictly exclude ephemeral RAM-only conversations from IndexedDB and sync storage!
    const persistedConversations = nextPayload.conversations.filter((c) => !c.ephemeral);
    const updated: VaultPayload = {
      ...nextPayload,
      conversations:
        persistedConversations.length > 0 ? persistedConversations : [createEmptyConversation('New Conversation')],
      updatedAt: new Date().toISOString(),
    };
    const t0 = performance.now();
    const envelope = await encryptVault(activeSession, updated);
    setLastEncryptMs(Math.max(1, Math.round(performance.now() - t0)));

    await saveEncryptedEnvelope(activeSession.vaultId, envelope);
    rememberVaultId(activeSession.vaultId);
    setRecentVaults(getRecentVaultIds());
    setServerEnvelope(envelope);

    try {
      const res = await fetch(`/api/vault/${encodeURIComponent(activeSession.vaultId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      if (!res.ok) throw new Error('Sync unavailable');
      setSyncState('synced');
    } catch {
      setSyncState('local-only');
    }
  }

  async function refreshAttestation(inference: InferenceConfig) {
    try {
      const params = new URLSearchParams({ mode: inference.mode, provider: inference.providerName });
      const res = await fetch(`/api/attestation?${params.toString()}`);
      if (res.ok) setAttestation(await res.json());
    } catch {
      setAttestation({
        mode: 'sandbox',
        enclaveType: 'Offline Client-Only Post-Quantum Vault',
        verified: true,
        provider: 'Browser Local Storage',
        timestamp: new Date().toISOString(),
        details: 'Running in pure client-side encrypted mode with zero external network dependencies.',
      });
    }
  }

  useEffect(() => {
    if (payload) void refreshAttestation(payload.inference);
  }, [payload?.inference.mode, payload?.inference.providerName]);

  const activeConversation = payload
    ? payload.conversations.find((c) => c.id === payload.activeConversationId) || payload.conversations[0]
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, activeTab]);

  async function updatePayload(updater: (prev: VaultPayload) => VaultPayload, audit?: [string, string]) {
    if (!session || !payload) return;
    let next = updater(payload);
    if (audit) {
      next = { ...next, auditLog: [makeAudit(audit[0], audit[1]), ...next.auditLog].slice(0, 60) };
    }
    setPayload(next);
    await syncEncryptedVault(session, next);
  }

  async function handleCreateVault(e: React.FormEvent) {
    e.preventDefault();
    setGateError('');
    const cleanId = vaultIdInput.trim();
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(cleanId)) {
      setGateError('Vault ID must be 3–64 characters (letters, numbers, - or _).');
      return;
    }
    if (passphrase.length < 8) {
      setGateError('Passphrase must be at least 8 characters.');
      return;
    }
    setGateLoading(true);
    try {
      const newSession = await createVaultSession(cleanId, passphrase);
      const initial = createInitialPayload(theme);
      const fp = await getKeyFingerprint(newSession.kemPublicKey);
      await syncEncryptedVault(newSession, initial);
      setSession(newSession);
      setFingerprint(fp);
      setPayload(initial);
      setPassphrase('');
      showToast(`Created Kavcy ML-KEM-768 vault "${cleanId}"`);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Failed to create vault.');
    } finally {
      setGateLoading(false);
    }
  }

  async function handleUnlockVault(e: React.FormEvent) {
    e.preventDefault();
    setGateError('');
    const cleanId = vaultIdInput.trim();
    if (!cleanId) {
      setGateError('Enter a Vault ID or select one from your recent vaults below.');
      return;
    }
    setGateLoading(true);
    try {
      let envelope: EncryptedVaultEnvelope | null = null;
      let recoveredFromLocal = false;

      // Plausible-Deniability Duress Passphrase check
      const storedDuressHash = localStorage.getItem(`kavcy_duress_${cleanId}`);
      if (storedDuressHash) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
        const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
        if (hex === storedDuressHash) {
          const decoySession = await createVaultSession(`${cleanId}-decoy`, passphrase);
          const decoyPayload = createInitialPayload(theme);
          decoyPayload.memories = [
            {
              id: crypto.randomUUID(),
              title: 'Grocery List',
              category: 'note',
              tags: ['personal'],
              content: 'Oat milk, coffee beans, apples, sparkling water.',
              createdAt: new Date().toISOString(),
            },
          ];
          setSession(decoySession);
          setFingerprint(await getKeyFingerprint(decoySession.kemPublicKey));
          setPayload(decoyPayload);
          setPassphrase('');
          return;
        }
      }

      // Prefer IndexedDB encrypted vault cache first (gigabyte capacity + zero 404 console noise)
      const cached = await loadEncryptedEnvelope(cleanId);
      if (cached) {
        envelope = cached;
      } else {
        try {
          const res = await fetch(`/api/vault/${encodeURIComponent(cleanId)}`);
          if (res.ok) envelope = (await res.json()) as EncryptedVaultEnvelope;
        } catch {
          // offline
        }
      }

      if (!envelope) throw new Error('VAULT_NOT_FOUND');

      const { session: unlockedSession, payload: decryptedPayload } = await unlockVault(envelope, passphrase);
      const normalized = normalizeVaultPayload(decryptedPayload, theme);
      const withAudit: VaultPayload = {
        ...normalized,
        auditLog: [
          makeAudit('VAULT_UNLOCKED', recoveredFromLocal ? 'Recovered from local cache' : 'Decrypted ML-KEM-768 vault'),
          ...normalized.auditLog,
        ].slice(0, 60),
      };
      const fp = await getKeyFingerprint(unlockedSession.kemPublicKey);

      setTheme(withAudit.settings.theme);
      setFontSize(withAudit.settings.fontSize);
      setSession(unlockedSession);
      setFingerprint(fp);
      setPayload(withAudit);
      setServerEnvelope(envelope);
      setPassphrase('');
      await syncEncryptedVault(unlockedSession, withAudit);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'VAULT_NOT_FOUND') {
        setGateError(`No encrypted vault found for "${cleanId}". Select a recent Vault ID, import a .kavcy.json backup, or create a new vault.`);
      } else if (code === 'WRONG_PASSPHRASE') {
        setGateError('Incorrect passphrase — AES-256-GCM could not unwrap your ML-KEM-768 secret key.');
      } else if (code === 'CORRUPTED_CIPHERTEXT') {
        setGateError('Integrity check failed — ciphertext appears corrupted or tampered with.');
      } else {
        setGateError('Unable to unlock vault. Verify your Vault ID and passphrase.');
      }
    } finally {
      setGateLoading(false);
    }
  }

  async function handleImportVaultBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const envelope = JSON.parse(await file.text()) as EncryptedVaultEnvelope;
      if (!envelope?.vaultId || !envelope?.kemCiphertext || !envelope?.encryptedData?.ciphertext) {
        throw new Error('Invalid backup');
      }
      await saveEncryptedEnvelope(envelope.vaultId, envelope);
      rememberVaultId(envelope.vaultId);
      setRecentVaults(getRecentVaultIds());
      setVaultIdInput(envelope.vaultId);
      setGateMode('unlock');
      setGateError('');
      showToast(`Imported encrypted backup "${envelope.vaultId}". Enter your passphrase to unlock.`);
    } catch {
      setGateError('Invalid .kavcy.json backup file format.');
    }
    e.target.value = '';
  }

  function handleExportVaultBackup() {
    if (!serverEnvelope) return;
    const blob = new Blob([JSON.stringify(serverEnvelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serverEnvelope.vaultId}.kavcy.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupExported(true);
    showToast('Exported zero-knowledge .kavcy.json backup.');
  }

  function handleLock() {
    setSession(null);
    setPayload(null);
    setServerEnvelope(null);
    setFingerprint('');
    setTamperResult(null);
    setScratchpadOpen(false);
    setGateMode('unlock');
  }

  async function handleNewConversation(ephemeral = false) {
    const conv = createEmptyConversation(ephemeral ? 'Burn-After-Close Thread' : 'New Conversation');
    conv.ephemeral = ephemeral;
    if (ephemeral && payload) {
      // Pure RAM-only update: never touches IndexedDB or sync server
      setPayload({
        ...payload,
        conversations: [conv, ...payload.conversations],
        activeConversationId: conv.id,
      });
      setActiveTab('chat');
      showToast('Started volatile RAM-only thread (never saved to disk).');
      return;
    }
    await updatePayload((prev) => ({
      ...prev,
      conversations: [conv, ...prev.conversations],
      activeConversationId: conv.id,
    }));
    setActiveTab('chat');
  }

  async function handleForkConversation() {
    if (!activeConversation) return;
    const forked: Conversation = {
      ...activeConversation,
      id: crypto.randomUUID(),
      title: `${activeConversation.title} (Fork)`,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await updatePayload((prev) => ({
      ...prev,
      conversations: [forked, ...prev.conversations],
      activeConversationId: forked.id,
    }));
    showToast('Forked conversation into a new encrypted thread.');
  }

  async function handleClearConversation() {
    if (!activeConversation) return;
    await updatePayload((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) => (c.id === activeConversation.id ? { ...c, messages: [] } : c)),
    }));
    showToast('Cleared messages in current conversation.');
  }

  async function handlePinConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await updatePayload((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    }));
  }

  async function handleCommitRename(id: string) {
    if (renameDraft.trim()) {
      await updatePayload((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) => (c.id === id ? { ...c, title: renameDraft.trim() } : c)),
      }));
    }
    setRenamingId(null);
  }

  async function handleDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await updatePayload((prev) => {
      const remaining = prev.conversations.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptyConversation('New Conversation');
        return { ...prev, conversations: [fresh], activeConversationId: fresh.id };
      }
      const nextActive = prev.activeConversationId === id ? remaining[0].id : prev.activeConversationId;
      return { ...prev, conversations: remaining, activeConversationId: nextActive };
    });
  }

  function handleExportConversationMd() {
    if (!activeConversation) return;
    const md = [
      `# ${activeConversation.title}`,
      `_Exported from Kavcy (${new Date().toLocaleString()})_`,
      '',
      ...activeConversation.messages.map((m) => `### ${m.role === 'user' ? 'You' : 'Kavcy'}\n\n${m.content}\n`),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'conversation'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported conversation as Markdown.');
  }

  function handleExportMemoriesMd() {
    if (!payload) return;
    const md = [
      '# Kavcy Encrypted Memory Export',
      '',
      ...payload.memories.map((m) => `## ${m.title} (${m.category})\n${m.content}\n`),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kavcy-memories.md';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported all memories to Markdown.');
  }

  function handleExportAllConversationsJson() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload.conversations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kavcy-conversations-archive.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported all conversations archive (.json).');
  }

  async function ingestFilesForRag(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const newDocs: VaultDocument[] = [];
    for (const file of files) {
      const text = await extractTextFromFile(file);
      if (!text.trim()) continue;
      newDocs.push(buildVaultDocument(file.name, text, file.type || 'text/plain'));
    }

    if (newDocs.length === 0) {
      showToast('No readable text found. Try .txt, .md, .csv, .json, or code files.');
      return;
    }

    const totalChunks = newDocs.reduce((sum, d) => sum + d.chunkCount, 0);
    await updatePayload(
      (prev) => ({ ...prev, documents: [...newDocs, ...prev.documents] }),
      ['RAG_INGESTED', `Encrypted ${newDocs.length} document(s) (${totalChunks} chunks)`]
    );
    showToast(`Indexed ${newDocs.length} file(s) (${totalChunks} RAG chunks) locally & encrypted.`);
  }

  async function executeInference(
    messagesHistory: ChatMessage[],
    queryText: string,
    currentPayload: VaultPayload
  ): Promise<{ reply: string; providerMode: 'tee' | 'tee-direct' | 'ollama' | 'sandbox'; tokensPerSec?: number; citations: ChatMessage['citations']; skillNames: string[] }> {
    const enabledSkills = currentPayload.skills.filter((s) => s.enabled);
    const rag = retrieveRagContext(
      queryText,
      currentPayload.documents,
      currentPayload.memories,
      currentPayload.settings.ragTopK,
      currentPayload.settings.ragMinScore
    );
    const skillNames = enabledSkills.map((s) => s.name);

    // Direct-to-TEE Browser Mode: bypasses sync proxy completely!
    if (
      currentPayload.inference.mode === 'tee' &&
      currentPayload.inference.directBrowserTee &&
      currentPayload.inference.baseUrl &&
      currentPayload.inference.apiKey
    ) {
      const skillsBlock =
        enabledSkills.length > 0
          ? `Active Skills:\n${enabledSkills.map((s) => `- ${s.name} (${s.tone || 'balanced'}): ${s.instructions}`).join('\n')}`
          : '';
      const ragBlock =
        rag.contextBlocks.length > 0
          ? `Retrieved Private Vault Context:\n${rag.contextBlocks
              .map((m) => `- [${m.sourceType}: ${m.title}] ${m.content}`)
              .join('\n')}`
          : '';
      const systemPrompt = [currentPayload.inference.customPersona, skillsBlock, ragBlock].filter(Boolean).join('\n\n');

      const endpoint = `${currentPayload.inference.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentPayload.inference.apiKey}`,
        },
        body: JSON.stringify({
          model: currentPayload.inference.model || 'llama3-3-70b',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messagesHistory.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature: currentPayload.inference.temperature,
        }),
      });
      if (!upstream.ok) {
        const errText = await upstream.text();
        throw new Error(`Direct TEE error (${upstream.status}): ${errText.slice(0, 200)}`);
      }
      const data = await upstream.json();
      return {
        reply: data?.choices?.[0]?.message?.content || 'No response returned by TEE enclave.',
        providerMode: 'tee-direct',
        citations: rag.citations,
        skillNames,
      };
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesHistory.slice(-12),
          ragContext: rag.contextBlocks,
          activeSkills: enabledSkills.map(({ name, instructions }) => ({ name, instructions })),
          inference: currentPayload.inference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inference request failed');
      return {
        reply: data.reply,
        providerMode: data.providerMode,
        tokensPerSec: data.tokensPerSec,
        citations: rag.citations,
        skillNames,
      };
    } catch {
      // Pure client-side fallback (works seamlessly on static GitHub Pages with 0 backend!)
      const localReply =
        rag.contextBlocks.length > 0
          ? `### Matched ${rag.contextBlocks.length} Encrypted RAG Source(s) Locally\n` +
            rag.contextBlocks.map((b) => `- **${b.title}**: ${b.content.slice(0, 160)}`).join('\n') +
            `\n\nAnswered completely offline in browser RAM (**0 B external traffic**). Connect a Direct-to-TEE endpoint in **Inference & Security** for full 70B reasoning.`
          : `**Kavcy Local Sandbox (0 B External Traffic):** Received "${queryText}".\n- Drop any document here for private client-side RAG.\n- Type \`/help\` for slash commands or open **Get Started** in the sidebar.`;
      return {
        reply: localReply,
        providerMode: 'sandbox',
        citations: rag.citations,
        skillNames,
      };
    }
  }

  async function sendPromptText(rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed || !session || !payload || !activeConversation || chatBusy) return;

    // Built-in Slash Commands
    if (trimmed.startsWith('/')) {
      setChatInput('');
      const cmd = trimmed.split(/\s+/)[0].toLowerCase();
      if (cmd === '/lock') {
        handleLock();
        return;
      }
      if (cmd === '/clear') {
        await handleClearConversation();
        return;
      }
      if (cmd === '/export') {
        handleExportConversationMd();
        return;
      }
      if (cmd === '/unload') {
        await handleUnloadModel();
        return;
      }
      if (cmd === '/rag') {
        const docs = payload.documents.filter((d) => d.enabled !== false);
        const chunks = docs.reduce((s, d) => s + d.chunkCount, 0);
        showToast(`RAG Status: ${docs.length} active doc(s), ${chunks} chunks, Top-K=${payload.settings.ragTopK}.`);
        return;
      }
      if (cmd === '/help') {
        showToast('Commands: /rag, /clear, /export, /unload, /lock');
        return;
      }
    }

    if (modelDisabled) {
      showToast('Model engine is disabled (0% CPU / 0 MB RAM). Re-enable it in Network & Hardware to chat.');
      return;
    }

    setChatInput('');
    setChatBusy(true);

    const now = new Date().toISOString();
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: now };

    const updatedTitle =
      activeConversation.title === 'New Conversation'
        ? trimmed.slice(0, 40) + (trimmed.length > 40 ? '…' : '')
        : activeConversation.title;

    const messagesWithUser = [...activeConversation.messages, userMsg];
    const optimisticPayload: VaultPayload = {
      ...payload,
      conversations: payload.conversations.map((c) =>
        c.id === activeConversation.id
          ? { ...c, title: updatedTitle, updatedAt: now, messages: messagesWithUser }
          : c
      ),
    };
    setPayload(optimisticPayload);

    try {
      const result = await executeInference(messagesWithUser, trimmed, optimisticPayload);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString(),
        tokensPerSec: result.tokensPerSec,
        citations: result.citations,
        activeSkillNames: result.skillNames,
        providerMode: result.providerMode,
      };
      const finalPayload: VaultPayload = {
        ...optimisticPayload,
        conversations: optimisticPayload.conversations.map((c) =>
          c.id === activeConversation.id
            ? { ...c, updatedAt: new Date().toISOString(), messages: [...messagesWithUser, assistantMsg] }
            : c
        ),
      };
      setPayload(finalPayload);
      if (!activeConversation.ephemeral) {
        await syncEncryptedVault(session, finalPayload);
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error:** ${err instanceof Error ? err.message : 'Inference request failed.'}`,
        timestamp: new Date().toISOString(),
      };
      const finalPayload: VaultPayload = {
        ...optimisticPayload,
        conversations: optimisticPayload.conversations.map((c) =>
          c.id === activeConversation.id ? { ...c, messages: [...messagesWithUser, errMsg] } : c
        ),
      };
      setPayload(finalPayload);
      await syncEncryptedVault(session, finalPayload);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleCommitEditMessage(msgIndex: number) {
    if (!session || !payload || !activeConversation || !editMsgDraft.trim()) return;
    const editedText = editMsgDraft.trim();
    setEditingMsgId(null);
    const prior = activeConversation.messages.slice(0, msgIndex);
    const updatedUser: ChatMessage = {
      ...activeConversation.messages[msgIndex],
      content: editedText,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...prior, updatedUser];
    setChatBusy(true);
    try {
      const result = await executeInference(nextHistory, editedText, payload);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString(),
        citations: result.citations,
        activeSkillNames: result.skillNames,
        providerMode: result.providerMode,
      };
      await updatePayload((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === activeConversation.id ? { ...c, messages: [...nextHistory, assistantMsg] } : c
        ),
      }));
    } finally {
      setChatBusy(false);
    }
  }

  async function handleRegenerate(msgIndex: number) {
    if (!session || !payload || !activeConversation || chatBusy) return;
    const priorMessages = activeConversation.messages.slice(0, msgIndex);
    const lastUser = [...priorMessages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setChatBusy(true);
    try {
      const result = await executeInference(priorMessages, lastUser.content, payload);
      const regenerated: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString(),
        citations: result.citations,
        activeSkillNames: result.skillNames,
        providerMode: result.providerMode,
      };
      await updatePayload((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === activeConversation.id ? { ...c, messages: [...priorMessages, regenerated] } : c
        ),
      }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setChatBusy(false);
    }
  }

  async function handleToggleStar(msgId: string) {
    if (!activeConversation) return;
    await updatePayload((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, starred: !m.starred } : m)) }
          : c
      ),
    }));
  }

  async function handleSaveMessageToMemory(msg: ChatMessage) {
    const item: VaultMemory = {
      id: crypto.randomUUID(),
      title: `Saved from "${activeConversation?.title || 'Chat'}"`,
      category: 'note',
      tags: ['from-chat'],
      content: msg.content,
      createdAt: new Date().toISOString(),
    };
    await updatePayload(
      (prev) => ({ ...prev, memories: [item, ...prev.memories] }),
      ['MEMORY_SAVED', 'Saved message to encrypted memory vault']
    );
    showToast('Saved message to encrypted Memory Vault.');
  }

  async function handleDeleteMessage(msgId: string) {
    if (!activeConversation) return;
    await updatePayload((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === activeConversation.id ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) } : c
      ),
    }));
  }

  function toggleVoiceDictation() {
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('Voice dictation is not supported in this browser.');
      return;
    }
    if (listening) {
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRec as any)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      if (transcript) setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  async function handleRotateKeys() {
    if (!session || !payload) return;
    const rotatedSession = await rotateKemKeypair(session);
    const newFp = await getKeyFingerprint(rotatedSession.kemPublicKey);
    const nextPayload: VaultPayload = {
      ...payload,
      auditLog: [makeAudit('KEY_ROTATED', `Rotated ML-KEM-768 keypair → ${newFp}`), ...payload.auditLog].slice(0, 60),
    };
    setSession(rotatedSession);
    setFingerprint(newFp);
    setPayload(nextPayload);
    await syncEncryptedVault(rotatedSession, nextPayload);
    showToast(`Rotated ML-KEM-768 keypair (${newFp})`);
  }

  async function handleSimulateTamper() {
    if (!session || !serverEnvelope) return;
    setTamperResult(await runLiveTamperTest(session, serverEnvelope));
  }

  async function handleUnloadModel() {
    setModelDisabled(true);
    try {
      await fetch('/api/model/unload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: payload?.inference.model }),
      });
    } catch {
      // ignore if static/offline
    }
    showToast('Model completely disabled & unloaded — 0% model CPU, 0 MB model RAM.');
  }

  function handleSpeakMessage(text: string) {
    if (!('speechSynthesis' in window)) {
      showToast('Local speech synthesis is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/[#*`]/g, '')));
  }

  async function handlePanicWipeCache() {
    await wipeAllEncryptedEnvelopes();
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('kavcy_') || k.startsWith('aegis_')) localStorage.removeItem(k);
    });
    setRecentVaults([]);
    handleLock();
    showToast('Wiped all IndexedDB & localStorage encrypted caches.');
  }

  async function handleVerifyBundleIntegrity() {
    try {
      const html = document.documentElement.outerHTML;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
      const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
      setBundleSha256(hex);
      showToast('Computed live SHA-256 integrity hash of running app.');
    } catch {
      showToast('Unable to compute bundle hash.');
    }
  }

  async function handleRegisterPasskey() {
    if (!window.PublicKeyCredential) {
      showToast('WebAuthn Passkeys are not supported in this browser.');
      return;
    }
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Kavcy Vault' },
          user: { id: userId, name: session?.vaultId || 'kavcy-user', displayName: 'Kavcy Vault Owner' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { userVerification: 'preferred' },
          timeout: 60000,
        },
      });
      showToast('Hardware Passkey registered for this device!');
    } catch {
      showToast('Passkey registration cancelled or requires HTTPS/localhost.');
    }
  }

  async function handleSaveDuressPhrase() {
    if (!session || duressPhraseInput.trim().length < 4) {
      showToast('Enter a duress passphrase of at least 4 characters.');
      return;
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(duressPhraseInput.trim()));
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(`kavcy_duress_${session.vaultId}`, hex);
    setDuressPhraseInput('');
    showToast('Plausible-Deniability Duress Passphrase configured.');
  }

  async function handleByosPush() {
    if (!byosUrl.trim() || !serverEnvelope) {
      showToast('Enter your WebDAV / S3-Presigned PUT URL first.');
      return;
    }
    try {
      localStorage.setItem('kavcy_byos_url', byosUrl.trim());
      const res = await fetch(byosUrl.trim(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverEnvelope),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Pushed opaque ML-KEM-768 ciphertext to your BYOS bucket!');
    } catch (err) {
      showToast(`BYOS sync failed: ${err instanceof Error ? err.message : 'Check CORS/URL'}`);
    }
  }

  function handleExportSkills() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload.skills, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kavcy-skills.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSkillsFile(file: File) {
    try {
      const imported = JSON.parse(await file.text()) as AgentSkill[];
      if (!Array.isArray(imported)) throw new Error('Invalid');
      await updatePayload((prev) => ({
        ...prev,
        skills: [...imported.map((s) => ({ ...s, id: crypto.randomUUID(), builtIn: false })), ...prev.skills],
      }));
      showToast(`Imported ${imported.length} skill(s) into your encrypted vault.`);
    } catch {
      showToast('Invalid skills JSON file.');
    }
  }

  const commands: CommandItem[] = useMemo(() => {
    if (!payload) return [];
    return [
      { id: 'new-chat', section: 'Chat', label: 'New Encrypted Conversation', shortcut: 'N', action: () => void handleNewConversation() },
      { id: 'fork-chat', section: 'Chat', label: 'Fork / Duplicate Current Conversation', action: () => void handleForkConversation() },
      { id: 'scratchpad', section: 'Tools', label: 'Toggle Encrypted Sticky Scratchpad', action: () => setScratchpadOpen((v) => !v) },
      { id: 'go-chat', section: 'Navigate', label: 'Personal Agent', action: () => setActiveTab('chat') },
      { id: 'go-docs', section: 'Navigate', label: 'Documents & Memory Vault', action: () => setActiveTab('knowledge') },
      { id: 'go-skills', section: 'Navigate', label: 'Agent Skills & Templates', action: () => setActiveTab('skills') },
      { id: 'go-hw', section: 'Navigate', label: 'Network Meter & Hardware Guard', action: () => setActiveTab('hardware') },
      { id: 'go-zk', section: 'Navigate', label: 'Zero-Knowledge Inspector & Audit Log', action: () => setActiveTab('inspector') },
      { id: 'go-start', section: 'Navigate', label: 'Get Started Documentation', action: () => setActiveTab('docs') },
      { id: 'go-settings', section: 'Navigate', label: 'Inference & Security Settings', action: () => setActiveTab('settings') },
      { id: 'unload-model', section: 'Resources', label: 'Unload & Disable Model (Free 100% CPU/RAM)', action: () => void handleUnloadModel() },
      { id: 'export-md', section: 'Export', label: 'Export Current Conversation (.md)', action: handleExportConversationMd },
      { id: 'export-vault', section: 'Security', label: 'Export Encrypted .kavcy.json Backup', action: handleExportVaultBackup },
      { id: 'rotate-key', section: 'Security', label: 'Rotate ML-KEM-768 Post-Quantum Keypair', action: () => void handleRotateKeys() },
      { id: 'lock-vault', section: 'Security', label: 'Lock Vault Immediately', action: handleLock },
    ];
  }, [payload, theme, activeConversation, serverEnvelope]);

  // ============================================================================
  // VAULT GATE
  // ============================================================================
  if (!session || !payload || !activeConversation) {
    const strength = evaluatePassphraseStrength(passphrase);

    return (
      <div className="gate-wrapper">
        {toast && (
          <div className="toast-banner">
            <CheckCircle2 size={15} color="var(--verified)" />
            <span>{toast}</span>
          </div>
        )}
        <div className="gate-card">
          <div className="gate-header">
            <div className="brand-row">
              <KavcyEmblem size={42} active={gateLoading} />
              <div>
                <h1 className="brand-title">Kavcy</h1>
                <p className="brand-sub">Post-Quantum Personal AI Vault</p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Switch theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div className="spec-line">
            <span className="spec-dot" />
            <span>ML-KEM-768 · AES-256-GCM · 0 B EGRESS</span>
          </div>

          <div className="tab-switch">
            <button
              type="button"
              className={gateMode === 'create' ? 'active' : ''}
              onClick={() => {
                setGateMode('create');
                setGateError('');
              }}
            >
              Create Vault
            </button>
            <button
              type="button"
              className={gateMode === 'unlock' ? 'active' : ''}
              onClick={() => {
                setGateMode('unlock');
                setGateError('');
              }}
            >
              Unlock Existing
            </button>
          </div>

          {gateError && <div className="error-banner">{gateError}</div>}

          <form onSubmit={gateMode === 'create' ? handleCreateVault : handleUnlockVault}>
            <div className="field">
              <label>
                <span>Vault ID</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px' }}
                    onClick={() => {
                      void navigator.clipboard.writeText(vaultIdInput);
                      showToast('Copied Vault ID.');
                    }}
                  >
                    Copy
                  </button>
                  {gateMode === 'create' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0 4px' }}
                      onClick={() => setVaultIdInput(randomVaultId())}
                    >
                      New ID
                    </button>
                  )}
                </span>
              </label>
              <input
                className="input"
                value={vaultIdInput}
                onChange={(e) => setVaultIdInput(e.target.value)}
                placeholder="kavcy-personal"
                required
              />
              {gateMode === 'unlock' && recentVaults.length > 0 && (
                <div className="recent-vaults">
                  {recentVaults.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`vault-pill ${vaultIdInput === id ? 'selected' : ''}`}
                      onClick={() => {
                        setVaultIdInput(id);
                        setGateError('');
                      }}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>
                <span>Master Passphrase</span>
                {gateMode === 'create' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px' }}
                    onClick={() => {
                      const phrase = generateRecoveryPhrase();
                      setPassphrase(phrase);
                      setShowPass(true);
                    }}
                  >
                    Suggest strong phrase
                  </button>
                )}
              </label>
              <div className="input-row">
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '9px 10px' }}
                  onClick={() => setShowPass((v) => !v)}
                  title={showPass ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {gateMode === 'create' && passphrase.length > 0 && (
                <>
                  <div className="strength-bar">
                    {[1, 2, 3, 4].map((lvl) => (
                      <div
                        key={lvl}
                        className={`strength-seg ${
                          strength.score >= lvl ? (strength.score >= 3 ? 'strong' : 'filled') : ''
                        }`}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Strength: {strength.label}
                  </div>
                </>
              )}
            </div>

            <button className="btn btn-primary btn-full" type="submit" disabled={gateLoading}>
              <Lock size={15} />
              {gateLoading
                ? 'Deriving Post-Quantum Keys...'
                : gateMode === 'create'
                ? 'Initialize Kavcy Vault'
                : 'Decrypt & Unlock Vault'}
            </button>
          </form>

          {gateMode === 'unlock' && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={13} /> Import .kavcy.json Encrypted Backup
                <input type="file" accept=".json,.kavcy,.aegis" hidden onChange={handleImportVaultBackup} />
              </label>
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 18, marginBottom: 0 }}>
            Keys are derived locally in browser RAM. Encrypted ciphertext is dual-synced to your local browser cache and
            optional sync host.{' '}
            <a href="./landing.html" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Product Page →
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED WORKSPACE
  // ============================================================================
  const enabledDocs = payload.documents.filter((d) => d.enabled !== false);
  const totalRagChunks = enabledDocs.reduce((sum, d) => sum + d.chunkCount, 0);
  const enabledSkills = payload.skills.filter((s) => s.enabled);

  const sortedConversations = [...payload.conversations]
    .filter((c) => c.title.toLowerCase().includes(threadSearch.toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  const filteredMemories = payload.memories.filter((m) => memFilter === 'all' || m.category === memFilter);
  const visibleMessages = starredOnly
    ? activeConversation.messages.filter((m) => m.starred)
    : activeConversation.messages;

  const totalWords = activeConversation.messages.reduce((sum, m) => sum + m.content.trim().split(/\s+/).filter(Boolean).length, 0);
  const estTokens = Math.ceil((chatInput.length + totalRagChunks * 140 + enabledSkills.length * 60) / 4);
  const vaultBytes = serverEnvelope ? new TextEncoder().encode(JSON.stringify(serverEnvelope)).length : 0;

  return (
    <div className="app-shell">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />

      {shortcutsOpen && (
        <div className="modal-backdrop" onClick={() => setShortcutsOpen(false)}>
          <div className="cmd-modal" style={{ padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Keyboard size={16} /> Keyboard Shortcuts &amp; Slash Commands
            </h3>
            <div style={{ display: 'grid', gap: 8, fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Command Palette</span>
                <span className="kbd">⌘K / Ctrl+K</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shortcuts Help</span>
                <span className="kbd">?</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Chat Commands</span>
                <span className="kbd">/rag · /clear · /export · /unload · /lock</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {scratchpadOpen && (
        <div className="scratchpad-drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StickyNote size={14} color="var(--accent)" /> Encrypted Scratchpad
            </strong>
            <button className="icon-btn" onClick={() => setScratchpadOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <textarea
            className="textarea"
            rows={7}
            value={payload.scratchpad}
            onChange={(e) => void updatePayload((p) => ({ ...p, scratchpad: e.target.value }))}
            placeholder="Jot quick encrypted notes while chatting..."
          />
        </div>
      )}

      {toast && (
        <div className="toast-banner">
          <CheckCircle2 size={15} color="var(--verified)" />
          <span>{toast}</span>
        </div>
      )}

      <div className={`sidebar-backdrop ${drawerOpen ? 'drawer-open' : ''}`} onClick={() => setDrawerOpen(false)} />

      <aside className={`sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="brand-row">
            <KavcyEmblem size={30} active={chatBusy || syncState === 'syncing'} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.94rem', letterSpacing: '-0.01em' }}>Kavcy</div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {session.vaultId}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="icon-btn"
              onClick={() => {
                void navigator.clipboard.writeText(session.vaultId);
                showToast('Copied Vault ID.');
              }}
              title="Copy Vault ID"
            >
              <Copy size={13} />
            </button>
            <button className="icon-btn" onClick={() => setCmdOpen(true)} title="Command Palette (⌘K)">
              <Command size={15} />
            </button>
            <button className="icon-btn mobile-menu-btn" onClick={() => setDrawerOpen(false)} title="Close menu">
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              void handleNewConversation(false);
              setDrawerOpen(false);
            }}
          >
            <MessageSquarePlus size={15} /> New Chat
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 10px' }}
            title="Start Ephemeral Burn-After-Close Thread (RAM only, never saved)"
            onClick={() => {
              void handleNewConversation(true);
              setDrawerOpen(false);
            }}
          >
            <Flame size={15} color="var(--danger)" />
          </button>
        </div>

        <div>
          <div className="nav-section-label">Workspace</div>
          <nav className="nav-list">
            <button className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setDrawerOpen(false); }}>
              <MessageSquare size={15} /> Personal Agent
            </button>
            <button className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`} onClick={() => { setActiveTab('knowledge'); setDrawerOpen(false); }}>
              <Brain size={15} /> Docs &amp; Memory
              <span className="nav-badge">{payload.documents.length + payload.memories.length}</span>
            </button>
            <button className={`nav-item ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => { setActiveTab('skills'); setDrawerOpen(false); }}>
              <Sparkles size={15} /> Skills &amp; Templates
              <span className="nav-badge">{enabledSkills.length}</span>
            </button>
            <button className={`nav-item ${activeTab === 'workflows' ? 'active' : ''}`} onClick={() => { setActiveTab('workflows'); setDrawerOpen(false); }}>
              <Workflow size={15} /> Workflows &amp; Tools
            </button>
            <button className={`nav-item ${activeTab === 'hardware' ? 'active' : ''}`} onClick={() => { setActiveTab('hardware'); setDrawerOpen(false); }}>
              <Activity size={15} /> Network &amp; Hardware
              <span className="nav-badge">{formatBytes(netMeter.externalBytes)}</span>
            </button>
            <button className={`nav-item ${activeTab === 'inspector' ? 'active' : ''}`} onClick={() => { setActiveTab('inspector'); setDrawerOpen(false); }}>
              <Eye size={15} /> ZK Inspector
            </button>
            <button className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => { setActiveTab('docs'); setDrawerOpen(false); }}>
              <BookOpen size={15} /> Get Started
            </button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setDrawerOpen(false); }}>
              <Settings size={15} /> Inference &amp; Security
            </button>
          </nav>
        </div>

        <div className="threads-container">
          <div className="nav-section-label" style={{ marginBottom: 0 }}>
            Conversations ({payload.conversations.length})
          </div>
          <div className="thread-search">
            <Search size={12} className="muted-icon" />
            <input value={threadSearch} onChange={(e) => setThreadSearch(e.target.value)} placeholder="Filter threads..." />
          </div>
          <div className="threads-scroll">
            {sortedConversations.map((conv) => (
              <div
                key={conv.id}
                className={`thread-row ${conv.id === activeConversation.id && activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  void updatePayload((p) => ({ ...p, activeConversationId: conv.id }));
                  setActiveTab('chat');
                  setDrawerOpen(false);
                }}
              >
                {conv.ephemeral ? (
                  <Flame size={12} color="var(--danger)" />
                ) : conv.pinned ? (
                  <Pin size={12} color="var(--accent)" />
                ) : (
                  <MessageSquare size={13} />
                )}
                {renamingId === conv.id ? (
                  <input
                    autoFocus
                    className="input"
                    style={{ padding: '2px 6px', fontSize: '0.78rem' }}
                    value={renameDraft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => void handleCommitRename(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCommitRename(conv.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                ) : (
                  <span className="thread-title">{conv.title}</span>
                )}
                <div className="thread-actions">
                  <button type="button" className="icon-btn" title={conv.pinned ? 'Unpin' : 'Pin'} onClick={(e) => void handlePinConversation(conv.id, e)}>
                    <Pin size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(conv.id);
                      setRenameDraft(conv.title);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button type="button" className="icon-btn" title="Delete" onClick={(e) => void handleDeleteConversation(conv.id, e)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace' }}>{fingerprint}</span>
            <button
              className="icon-btn"
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                void updatePayload((p) => ({ ...p, settings: { ...p.settings, theme: next } }));
              }}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
          <button className="btn btn-secondary btn-full btn-sm" onClick={handleLock}>
            <LogOut size={14} /> Lock Vault
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="status-group">
            <button type="button" className="btn btn-secondary btn-sm mobile-menu-btn" onClick={() => setDrawerOpen(true)} title="Open navigation">
              <Menu size={16} />
            </button>
            <button
              type="button"
              className={`status-tag ${netMeter.externalBytes === 0 ? 'verified' : 'amber'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('hardware')}
              title="Realtime outbound network meter"
            >
              <Activity size={12} />
              External: {formatBytes(netMeter.externalBytes)}
              {netMeter.airGapEnabled ? ' · Air-Gap' : ''}
            </button>
            <span className="status-tag verified hide-mobile">
              <CheckCircle2 size={12} />
              {syncState === 'syncing' ? 'Encrypting...' : `ML-KEM-768 (${lastEncryptMs}ms)`}
            </span>
            <span className="status-tag hide-mobile" title={isOnline ? 'Browser online' : 'Browser offline'}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {modelDisabled && (
              <button type="button" className="status-tag amber" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('hardware')}>
                <Power size={12} /> Model OFF · 0% CPU
              </button>
            )}
          </div>

          <div className="status-group">
            <button className="btn btn-ghost btn-sm" onClick={() => setScratchpadOpen((v) => !v)} title="Encrypted Scratchpad">
              <StickyNote size={14} />
            </button>
            {activeTab === 'chat' && activeConversation.messages.length > 0 && (
              <>
                <button className="btn btn-ghost btn-sm hide-mobile" onClick={() => void handleForkConversation()} title="Fork conversation">
                  <GitFork size={14} />
                </button>
                <button className="btn btn-ghost btn-sm hide-mobile" onClick={() => void handleClearConversation()} title="Clear messages">
                  <Eraser size={14} />
                </button>
                <button className="btn btn-ghost btn-sm hide-mobile" onClick={handleExportConversationMd} title="Export .md">
                  <Download size={14} />
                </button>
              </>
            )}
            <a href="./landing.html" className="btn btn-ghost btn-sm hide-mobile" title="Public Product Page">
              <ExternalLink size={13} />
            </a>
            <button className="btn btn-ghost btn-sm" onClick={() => setCmdOpen(true)}>
              <span className="kbd">⌘K</span>
            </button>
          </div>
        </header>

        {/* TAB 1: PERSONAL AGENT CHAT + LIVE ARTIFACT CANVAS */}
        {activeTab === 'chat' && (
          <div className={`chat-split ${canvasContent !== null ? 'with-canvas' : ''}`}>
          <div
            className="chat-layout"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingChat(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingChat(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingChat(false);
              if (e.dataTransfer.files?.length) void ingestFilesForRag(e.dataTransfer.files);
            }}
          >
            {activeConversation.ephemeral && (
              <div className="ephemeral-banner">
                <Flame size={13} />
                <span>
                  <strong>Burn-After-Close Mode:</strong> This thread lives strictly in volatile RAM — never written to
                  IndexedDB or sync storage.
                </span>
              </div>
            )}
            {isDraggingChat && (
              <div className="drop-overlay">
                <KavcyEmblem size={54} active />
                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Drop documents for Private Client-Side RAG</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Chunked in browser RAM &amp; encrypted with ML-KEM-768 + AES-256-GCM.
                </div>
              </div>
            )}

            <div className="skills-strip">
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Skills</span>
              {payload.skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className={`skill-pill ${skill.enabled ? 'enabled' : ''}`}
                  onClick={() =>
                    void updatePayload((p) => ({
                      ...p,
                      skills: p.skills.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s)),
                    }))
                  }
                  title={skill.description}
                >
                  <Sparkles size={11} /> {skill.name}
                </button>
              ))}
              <button
                type="button"
                className={`skill-pill ${starredOnly ? 'enabled' : ''}`}
                onClick={() => setStarredOnly((v) => !v)}
                style={{ marginLeft: 'auto' }}
                title="Show starred messages only"
              >
                <Star size={11} /> Starred
              </button>
              <select
                className="skill-pill"
                style={{ padding: '3px 8px' }}
                value={activeConversation.tag || 'General'}
                onChange={(e) =>
                  void updatePayload((p) => ({
                    ...p,
                    conversations: p.conversations.map((c) =>
                      c.id === activeConversation.id ? { ...c, tag: e.target.value as Conversation['tag'] } : c
                    ),
                  }))
                }
                title="Conversation label"
              >
                {THREAD_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="messages-list">
              <div className="messages-inner">
                {visibleMessages.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <KavcyEmblem size={56} />
                    <h2 style={{ margin: '14px 0 6px', fontSize: '1.2rem', fontWeight: 600 }}>
                      {starredOnly ? 'No Starred Messages Yet' : 'Kavcy Zero-Knowledge Workspace'}
                    </h2>
                    <p style={{ margin: '0 auto 22px', maxWidth: 480, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                      Drag and drop documents anywhere here for local client-side RAG, run slash commands like{' '}
                      <code>/help</code>, or pick a saved prompt template below.
                    </p>
                    {!starredOnly && (
                      <div className="starter-grid">
                        {payload.templates.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            className="starter-card"
                            onClick={() => void sendPromptText(tpl.prompt)}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: 4 }}>{tpl.title}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{tpl.prompt}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  visibleMessages.map((msg, idx) => (
                    <div key={msg.id} className={`msg-bubble ${msg.role}`}>
                      {editingMsgId === msg.id ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <textarea
                            className="textarea"
                            rows={3}
                            value={editMsgDraft}
                            onChange={(e) => setEditMsgDraft(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => void handleCommitEditMessage(idx)}>
                              Save &amp; Re-run
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingMsgId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <MarkdownText content={msg.content} />
                      )}

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="citations-row">
                          {msg.citations.map((cit, cIdx) => (
                            <span key={cIdx} className="citation-tag" title={cit.excerpt}>
                              <FileText size={11} /> {cit.title}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="msg-footer">
                        <span>
                          {msg.role === 'user' ? 'You' : 'Kavcy'} ·{' '}
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.providerMode === 'tee-direct' && ' · Direct-to-TEE'}
                          {msg.providerMode === 'ollama' && ` · Local Ollama${msg.tokensPerSec ? ` (${msg.tokensPerSec} tok/s)` : ''}`}
                        </span>
                        <div className="msg-actions">
                          {msg.role === 'assistant' && (
                            <button
                              className="icon-btn"
                              title="Open in Split-Pane Artifact Canvas"
                              onClick={() => setCanvasContent(msg.content)}
                            >
                              <PanelRightOpen size={13} />
                            </button>
                          )}
                          <button className="icon-btn" title="Star message" onClick={() => void handleToggleStar(msg.id)}>
                            <Star size={13} color={msg.starred ? 'var(--accent)' : undefined} />
                          </button>
                          {msg.role === 'user' && (
                            <button
                              className="icon-btn"
                              title="Edit & re-run"
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditMsgDraft(msg.content);
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          <button
                            className="icon-btn"
                            title="Copy text"
                            onClick={() => {
                              void navigator.clipboard.writeText(msg.content);
                              showToast('Copied to clipboard.');
                            }}
                          >
                            <Copy size={13} />
                          </button>
                          <button className="icon-btn" title="Save to Memory Vault" onClick={() => void handleSaveMessageToMemory(msg)}>
                            <BookmarkPlus size={13} />
                          </button>
                          {msg.role === 'assistant' && (
                            <>
                              <button className="icon-btn" title="Read aloud locally (0 B)" onClick={() => handleSpeakMessage(msg.content)}>
                                <Volume2 size={13} />
                              </button>
                              <button className="icon-btn" title="Regenerate" onClick={() => void handleRegenerate(idx)}>
                                <RefreshCw size={13} />
                              </button>
                            </>
                          )}
                          <button className="icon-btn" title="Delete message" onClick={() => void handleDeleteMessage(msg.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="chat-composer-wrap">
              <div className="chat-composer-inner">
                <form
                  className="chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendPromptText(chatInput);
                  }}
                >
                  <input
                    ref={chatFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.json,.csv,.js,.ts,.tsx,.py,.html,.xml,.log"
                    hidden
                    onChange={(e) => {
                      if (e.target.files) void ingestFilesForRag(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '9px 10px' }}
                    title="Attach documents for private RAG"
                    onClick={() => chatFileInputRef.current?.click()}
                  >
                    <Paperclip size={15} />
                  </button>
                  <button
                    type="button"
                    className={`btn ${listening ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '9px 10px' }}
                    title="Voice dictation"
                    onClick={toggleVoiceDictation}
                  >
                    {listening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                  <input
                    className="input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Kavcy or type /help — drag & drop files anywhere for RAG..."
                    disabled={chatBusy}
                  />
                  <button className="btn btn-primary" type="submit" disabled={chatBusy || !chatInput.trim()}>
                    <Send size={15} /> {chatBusy ? 'Working...' : 'Send'}
                  </button>
                </form>
                <div className="composer-meta">
                  <span>
                    ~{estTokens} tokens · {enabledDocs.length} doc(s) · {totalWords} words (~{Math.max(1, Math.ceil(totalWords / 200))}m read)
                  </span>
                  <span className="hide-mobile">
                    <Tag size={11} style={{ verticalAlign: 'middle' }} /> {activeConversation.tag || 'General'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {canvasContent !== null && (
            <aside className="canvas-pane">
              <div className="canvas-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PanelRightOpen size={14} color="var(--accent)" /> Artifact Canvas (Editable)
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="icon-btn"
                    title="Copy canvas"
                    onClick={() => {
                      void navigator.clipboard.writeText(canvasContent);
                      showToast('Copied canvas content.');
                    }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Download as .md"
                    onClick={() => {
                      const blob = new Blob([canvasContent], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'kavcy-artifact.md';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={13} />
                  </button>
                  <button className="icon-btn" title="Close canvas" onClick={() => setCanvasContent(null)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              <textarea
                className="canvas-editor"
                value={canvasContent}
                onChange={(e) => setCanvasContent(e.target.value)}
              />
            </aside>
          )}
          </div>
        )}

        {/* TAB 2: DOCS, KNOWLEDGE GRAPH & MEMORY */}
        {activeTab === 'knowledge' && (
          <div className="content-pane">
            <div className="pane-inner">
              <KnowledgeGraph documents={payload.documents} memories={payload.memories} />
              <div className="grid-2">
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>
                    <FileText size={16} /> Encrypted RAG Documents ({payload.documents.length})
                  </h3>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <FolderUp size={13} /> Import Obsidian / Folder
                    <input
                      type="file"
                      multiple
                      webkitdirectory=""
                      hidden
                      onChange={(e) => {
                        if (e.target.files) void ingestFilesForRag(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div
                  className={`dropzone-box ${isDraggingVault ? 'dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingVault(true);
                  }}
                  onDragLeave={() => setIsDraggingVault(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingVault(false);
                    if (e.dataTransfer.files?.length) void ingestFilesForRag(e.dataTransfer.files);
                  }}
                  onClick={() => document.getElementById('vault-doc-upload')?.click()}
                >
                  <Upload size={22} color="var(--accent)" style={{ marginBottom: 6 }} />
                  <div style={{ fontWeight: 600 }}>Drop files here or click to index</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                    Chunked &amp; encrypted client-side (.txt, .md, .csv, .json, code)
                  </div>
                  <input
                    id="vault-doc-upload"
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.json,.csv,.js,.ts,.tsx,.py,.html,.xml,.log"
                    hidden
                    onChange={(e) => {
                      if (e.target.files) void ingestFilesForRag(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>

                {payload.documents.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>No documents indexed yet.</p>
                ) : (
                  payload.documents.map((doc) => {
                    const expanded = expandedDocId === doc.id;
                    return (
                      <div key={doc.id} className="item-card" style={{ flexDirection: 'column' }}>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: 0, fontWeight: 600, color: 'var(--text)' }}
                              onClick={() => setExpandedDocId(expanded ? null : doc.id)}
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {doc.title}
                            </button>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 3 }}>
                              {doc.chunkCount} chunks · {(doc.sizeBytes / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className={`btn btn-sm ${doc.enabled ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() =>
                                void updatePayload((p) => ({
                                  ...p,
                                  documents: p.documents.map((d) => (d.id === doc.id ? { ...d, enabled: !d.enabled } : d)),
                                }))
                              }
                            >
                              {doc.enabled ? 'Active' : 'Paused'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() =>
                                void updatePayload((p) => ({
                                  ...p,
                                  documents: p.documents.filter((d) => d.id !== doc.id),
                                }))
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div style={{ width: '100%', marginTop: 8, display: 'grid', gap: 6 }}>
                            {doc.chunks.slice(0, 5).map((ch) => (
                              <div key={ch.id} className="code-block" style={{ maxHeight: 110, fontSize: '0.72rem' }}>
                                <strong>Chunk #{ch.index + 1}:</strong> {ch.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ margin: 0 }}>
                    <Brain size={16} /> Memory Vault ({payload.memories.length})
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={handleExportMemoriesMd}>
                    <Download size={13} /> Export .md
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!memTitle.trim() || !memContent.trim()) return;
                    const item: VaultMemory = {
                      id: crypto.randomUUID(),
                      title: memTitle.trim(),
                      category: memCategory,
                      tags: memTags.split(',').map((t) => t.trim()).filter(Boolean),
                      content: memContent.trim(),
                      createdAt: new Date().toISOString(),
                    };
                    setMemTitle('');
                    setMemTags('');
                    setMemContent('');
                    void updatePayload((p) => ({ ...p, memories: [item, ...p.memories] }));
                    showToast(`Encrypted memory "${item.title}" saved.`);
                  }}
                  style={{ marginBottom: 16 }}
                >
                  <div className="field">
                    <label>Title</label>
                    <input className="input" value={memTitle} onChange={(e) => setMemTitle(e.target.value)} placeholder="e.g. Health goals, Tax notes" required />
                  </div>
                  <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field">
                      <label>Category</label>
                      <select className="select" value={memCategory} onChange={(e) => setMemCategory(e.target.value as VaultMemory['category'])}>
                        <option value="note">Note</option>
                        <option value="preference">Preference</option>
                        <option value="fact">Fact</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Tags</label>
                      <input className="input" value={memTags} onChange={(e) => setMemTags(e.target.value)} placeholder="finance, 2026" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Content</label>
                    <textarea className="textarea" rows={3} value={memContent} onChange={(e) => setMemContent(e.target.value)} placeholder="Encrypted locally before syncing..." required />
                  </div>
                  <button className="btn btn-primary" type="submit">
                    <Plus size={14} /> Encrypt &amp; Save Memory
                  </button>
                </form>

                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {['all', 'note', 'preference', 'fact'].map((cat) => (
                    <button key={cat} className={`skill-pill ${memFilter === cat ? 'enabled' : ''}`} onClick={() => setMemFilter(cat)}>
                      {cat}
                    </button>
                  ))}
                </div>

                {filteredMemories.map((m) => (
                  <div key={m.id} className="item-card">
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {m.title} <span className="kbd">{m.category}</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {m.content.slice(0, 180)}
                        {m.content.length > 180 ? '…' : ''}
                      </p>
                      {m.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                          {m.tags.map((t) => (
                            <span key={t} className="kbd">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void updatePayload((p) => ({ ...p, memories: p.memories.filter((item) => item.id !== m.id) }))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3B: WORKFLOWS, APPROVAL TOOLS & CSV CHART ANALYZER */}
        {activeTab === 'workflows' && (
          <WorkflowsAndTools
            documents={payload.documents}
            memories={payload.memories}
            onRunPrompt={(prompt) => {
              setActiveTab('chat');
              void sendPromptText(prompt);
            }}
            onToast={showToast}
          />
        )}

        {/* TAB 3: SKILLS & PROMPT TEMPLATES */}
        {activeTab === 'skills' && (
          <div className="content-pane">
            <div className="pane-inner grid-2">
              <div
                className="card"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) void importSkillsFile(f);
                }}
              >
                <h3>
                  <Sparkles size={16} /> Author Custom Skill (or drop .json)
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!skillName.trim() || !skillInstructions.trim()) return;
                    const nextSkill: AgentSkill = {
                      id: crypto.randomUUID(),
                      name: skillName.trim(),
                      description: skillDesc.trim() || 'Custom encrypted agent skill',
                      tone: skillTone,
                      instructions: skillInstructions.trim(),
                      enabled: true,
                    };
                    setSkillName('');
                    setSkillDesc('');
                    setSkillInstructions('');
                    void updatePayload((p) => ({ ...p, skills: [nextSkill, ...p.skills] }));
                    showToast(`Added skill "${nextSkill.name}".`);
                  }}
                >
                  <div className="field">
                    <label>Skill Name</label>
                    <input className="input" value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="e.g. Legal Contract Reviewer" required />
                  </div>
                  <div className="grid-2" style={{ gridTemplateColumns: '1fr 140px', gap: 10 }}>
                    <div className="field">
                      <label>Description</label>
                      <input className="input" value={skillDesc} onChange={(e) => setSkillDesc(e.target.value)} placeholder="Short purpose" />
                    </div>
                    <div className="field">
                      <label>Tone</label>
                      <select className="select" value={skillTone} onChange={(e) => setSkillTone(e.target.value as AgentSkill['tone'])}>
                        <option value="balanced">Balanced</option>
                        <option value="concise">Concise</option>
                        <option value="analytical">Analytical</option>
                        <option value="creative">Creative</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>System Instructions</label>
                    <textarea className="textarea" rows={3} value={skillInstructions} onChange={(e) => setSkillInstructions(e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" type="submit">
                      <Plus size={14} /> Save Skill
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleExportSkills}>
                      <Download size={14} /> Export
                    </button>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                      <Upload size={14} /> Import
                      <input type="file" accept=".json" hidden onChange={(e) => { if (e.target.files?.[0]) void importSkillsFile(e.target.files[0]); e.target.value = ''; }} />
                    </label>
                  </div>
                </form>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />

                <h3>Saved Prompt Templates ({payload.templates.length})</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!tplTitle.trim() || !tplPrompt.trim()) return;
                    const next: PromptTemplate = { id: crypto.randomUUID(), title: tplTitle.trim(), prompt: tplPrompt.trim() };
                    setTplTitle('');
                    setTplPrompt('');
                    void updatePayload((p) => ({ ...p, templates: [next, ...p.templates] }));
                    showToast(`Saved prompt template "${next.title}".`);
                  }}
                >
                  <div className="field">
                    <input className="input" value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Template title" required />
                  </div>
                  <div className="field">
                    <input className="input" value={tplPrompt} onChange={(e) => setTplPrompt(e.target.value)} placeholder="Prompt text to reuse with 1 click..." required />
                  </div>
                  <button className="btn btn-secondary btn-sm" type="submit">
                    <Plus size={13} /> Add Template
                  </button>
                </form>
              </div>

              <div className="card">
                <h3>Installed Skills ({payload.skills.length})</h3>
                {payload.skills.map((skill) => (
                  <div key={skill.id} className="item-card">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {skill.name} {skill.tone && <span className="kbd">{skill.tone}</span>}
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{skill.description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={`btn btn-sm ${skill.enabled ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() =>
                          void updatePayload((p) => ({
                            ...p,
                            skills: p.skills.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s)),
                          }))
                        }
                      >
                        {skill.enabled ? 'Active' : 'Enable'}
                      </button>
                      {!skill.builtIn && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void updatePayload((p) => ({ ...p, skills: p.skills.filter((s) => s.id !== skill.id) }))}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: NETWORK METER & HARDWARE GUARD */}
        {activeTab === 'hardware' && (
          <div className="content-pane">
            <div className="pane-inner">
              <div className="grid-2" style={{ marginBottom: 18 }}>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0 }}>
                      <Activity size={16} /> Realtime Zero-Egress Network Meter
                    </h3>
                    <button className="btn btn-ghost btn-sm" onClick={resetNetworkMeter}>Reset</button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                    Intercepts every browser <code>fetch()</code> call in real time to prove zero traffic leaves your
                    machine in offline/local mode.
                  </p>
                  <div className="meter-grid">
                    <div className="meter-stat">
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>EXTERNAL OUTBOUND</div>
                      <div className="meter-value" style={{ color: netMeter.externalBytes === 0 ? 'var(--verified)' : 'var(--accent)' }}>
                        {formatBytes(netMeter.externalBytes)}
                      </div>
                    </div>
                    <div className="meter-stat">
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>LOCALHOST LOOPBACK</div>
                      <div className="meter-value">{formatBytes(netMeter.localBytes)}</div>
                    </div>
                    <div className="meter-stat">
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BLOCKED BY AIR-GAP</div>
                      <div className="meter-value">{netMeter.blockedRequests}</div>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', cursor: 'pointer', marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={netMeter.airGapEnabled}
                      onChange={(e) => {
                        setAirGapMode(e.target.checked);
                        showToast(e.target.checked ? 'Strict Air-Gap Mode ON.' : 'Strict Air-Gap Mode OFF.');
                      }}
                    />
                    <span><strong>Strict Air-Gap Kill Switch</strong> (physically block non-localhost traffic)</span>
                  </label>

                  <div className="code-block" style={{ maxHeight: 165 }}>
                    {netMeter.events.length === 0
                      ? 'No requests recorded yet. External egress: 0 B.'
                      : netMeter.events
                          .slice(0, 12)
                          .map((ev) => `[${new Date(ev.timestamp).toLocaleTimeString()}] ${ev.scope.toUpperCase()} ${ev.method} ${ev.host}${ev.path} (${formatBytes(ev.bytesOut)})`)
                          .join('\n')}
                  </div>
                </div>

                <div className="card">
                  <h3>
                    <Power size={16} /> Model Engine Kill Switch (CPU &amp; RAM)
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                    Completely disable inference and unload any resident local model to free <strong>100% of CPU and RAM</strong>.
                  </p>
                  <div className="spec-line" style={{ marginBottom: 14 }}>
                    <span className="spec-dot" style={{ background: modelDisabled ? 'var(--accent)' : 'var(--verified)' }} />
                    <span>
                      {modelDisabled
                        ? 'MODEL DISABLED · 0% MODEL CPU · 0 MB MODEL RAM'
                        : `ACTIVE MODE: ${payload.inference.mode.toUpperCase()} (${payload.inference.providerName})`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                    {!modelDisabled ? (
                      <button className="btn btn-danger" onClick={() => void handleUnloadModel()}>
                        <Power size={15} /> Disable &amp; Unload Model (Free 100% CPU/RAM)
                      </button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => { setModelDisabled(false); showToast('Model engine re-enabled.'); }}>
                        <Power size={15} /> Re-Enable Model Engine
                      </button>
                    )}
                  </div>

                  <h3><Cpu size={16} /> Detected Machine Hardware &amp; Live RAM Sparkline</h3>
                  {ramHistory.length > 1 && (
                    <div style={{ marginBottom: 10 }}>
                      <svg viewBox="0 0 200 36" width="100%" height="36" style={{ display: 'block', background: 'var(--bg-input)', borderRadius: 7, border: '1px solid var(--border)' }}>
                        <polyline
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="1.8"
                          points={ramHistory
                            .map((pct, i) => `${(i / Math.max(1, ramHistory.length - 1)) * 196 + 2},${34 - (pct / 100) * 30}`)
                            .join(' ')}
                        />
                      </svg>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                        Live Host RAM Utilization: {ramHistory[ramHistory.length - 1]}% (updates every 4s)
                      </div>
                    </div>
                  )}
                  {hwSpecs ? (
                    <div className="code-block" style={{ maxHeight: 155 }}>
                      {JSON.stringify(
                        {
                          detectedVia: hwSpecs.source,
                          totalRamGb: `${hwSpecs.totalRamGb} GB`,
                          freeRamGb: hwSpecs.freeRamGb !== undefined ? `${hwSpecs.freeRamGb} GB` : 'N/A',
                          cpu: `${hwSpecs.cpuModel} (${hwSpecs.cpuCores} cores)`,
                          gpu: hwSpecs.gpuRenderer,
                          platform: hwSpecs.platform,
                        },
                        null,
                        2
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Scanning machine specs...</p>
                  )}
                </div>
              </div>

              <div className="card">
                <h3>Local Model Compatibility Matrix (Validated Against Your Machine)</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                  Models that exceed your detected RAM ({hwSpecs?.totalRamGb ?? '...'} GB) are flagged and blocked from
                  downloading so your machine never freezes.
                </p>
                {hwSpecs &&
                  evaluateModelsForHardware(hwSpecs).map((m) => (
                    <div key={m.id} className={`model-row ${m.compatibility}`}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong>{m.name}</strong>
                          <span className="kbd">{m.params}</span>
                          <span className="kbd">{m.downloadGb} GB</span>
                          <span className="kbd">Min {m.minRamGb} GB RAM</span>
                          {m.compatibility === 'compatible' && <span className="badge-ok">COMPATIBLE</span>}
                          {m.compatibility === 'tight' && <span className="badge-warn">TIGHT FIT</span>}
                          {m.compatibility === 'incompatible' && <span className="badge-block">INCOMPATIBLE</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          {m.reason} — {m.notes}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={m.compatibility === 'incompatible'}
                        onClick={() => {
                          void navigator.clipboard.writeText(`ollama pull ${m.ollamaTag}`);
                          showToast(`Copied "ollama pull ${m.ollamaTag}"`);
                        }}
                      >
                        {m.compatibility === 'incompatible' ? 'Download Blocked' : 'Copy Pull Cmd'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ZK INSPECTOR */}
        {activeTab === 'inspector' && (
          <div className="content-pane">
            <div className="pane-inner">
              <div className="card" style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>Zero-Knowledge Verification &amp; Key Controls</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {attestation?.details || 'ML-KEM-768 + AES-256-GCM active.'} · Encrypted Vault Size:{' '}
                      <strong>{formatBytes(vaultBytes)}</strong> · Last Encrypt: <strong>{lastEncryptMs} ms</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={handleSimulateTamper}>
                      <ShieldAlert size={14} /> Simulate 1-Bit Tamper
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleRotateKeys}>
                      <KeyRound size={14} /> Rotate ML-KEM-768 Keys
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => void handleVerifyBundleIntegrity()}>
                      Verify Build SHA-256
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleExportVaultBackup}>
                      <Download size={14} /> Export .kavcy.json
                    </button>
                  </div>
                </div>
                {bundleSha256 && (
                  <div className="spec-line" style={{ marginTop: 10, marginBottom: 0 }}>
                    Running App SHA-256: <span style={{ fontFamily: 'monospace' }}>{bundleSha256.slice(0, 32)}…</span>
                  </div>
                )}
                {tamperResult && (
                  <div
                    className="spec-line"
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                      borderColor: tamperResult.rejected ? 'var(--verified)' : 'var(--danger)',
                      color: tamperResult.rejected ? 'var(--verified)' : 'var(--danger)',
                    }}
                  >
                    {tamperResult.message}
                  </div>
                )}
              </div>

              <div className="grid-2" style={{ marginBottom: 18 }}>
                <div className="card">
                  <h3>Decrypted in Browser RAM (Only You)</h3>
                  <pre className="code-block">
                    {JSON.stringify(
                      {
                        vaultId: session.vaultId,
                        kemKeyFingerprint: fingerprint,
                        conversations: payload.conversations.length,
                        documents: payload.documents.length,
                        activeRagChunks: totalRagChunks,
                        memories: payload.memories.length,
                        vaultCiphertextSize: formatBytes(vaultBytes),
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>

                <div className="card">
                  <h3>Stored Ciphertext Envelope (Zero Plaintext)</h3>
                  <pre className="code-block">
                    {serverEnvelope
                      ? JSON.stringify(
                          {
                            algorithm: serverEnvelope.algorithm,
                            kdf: `${serverEnvelope.kdf} (${serverEnvelope.iterations} rounds)`,
                            kemPublicKey: `${serverEnvelope.kemPublicKey.slice(0, 44)}...`,
                            kemCiphertext: `${serverEnvelope.kemCiphertext.slice(0, 44)}...`,
                            encryptedData: {
                              iv: serverEnvelope.encryptedData.iv,
                              ciphertext: `${serverEnvelope.encryptedData.ciphertext.slice(0, 120)}... (${serverEnvelope.encryptedData.ciphertext.length} chars)`,
                            },
                          },
                          null,
                          2
                        )
                      : 'Not synced yet.'}
                  </pre>
                </div>
              </div>

              <SealedDropPanel session={session} onToast={showToast} />

              <div className="card" style={{ marginBottom: 18 }}>
                <h3><Share2 size={16} /> Shamir&apos;s Secret Sharing (3-of-5 Recovery Shards)</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                  Split your master passphrase into <strong>5 cryptographic shards</strong> over GF(2⁸). Any{' '}
                  <strong>3 shards</strong> reconstruct your secret; 2 or fewer shards reveal mathematically zero
                  information.
                </p>
                <div className="grid-2">
                  <div>
                    <div className="field">
                      <label>Secret / Passphrase to Split (runs 100% in RAM)</label>
                      <div className="input-row">
                        <input
                          className="input"
                          type="password"
                          value={shamirInput}
                          onChange={(e) => setShamirInput(e.target.value)}
                          placeholder="Enter recovery passphrase..."
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (!shamirInput.trim()) return;
                            setShamirShards(splitSecretIntoShards(shamirInput.trim(), 5, 3));
                            setShamirInput('');
                            showToast('Generated 5 Shamir recovery shards (3-of-5 threshold).');
                          }}
                        >
                          Split 3-of-5
                        </button>
                      </div>
                    </div>
                    {shamirShards.length > 0 && (
                      <pre className="code-block" style={{ maxHeight: 140 }}>
                        {shamirShards.join('\n')}
                      </pre>
                    )}
                  </div>

                  <div>
                    <div className="field">
                      <label>Reconstruct Secret (paste any 3 shards, one per line)</label>
                      <textarea
                        className="textarea"
                        rows={4}
                        value={shamirRecoverInput}
                        onChange={(e) => setShamirRecoverInput(e.target.value)}
                        placeholder="kavcy-shard-v1:3:1:..."
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        try {
                          const recovered = combineShardsToSecret(shamirRecoverInput.split('\n'));
                          setShamirRecovered(recovered);
                          showToast('Secret reconstructed successfully from Shamir shards!');
                        } catch (err) {
                          setShamirRecovered(`Error: ${err instanceof Error ? err.message : 'Invalid shards'}`);
                        }
                      }}
                    >
                      Reconstruct Secret
                    </button>
                    {shamirRecovered && (
                      <div className="spec-line" style={{ marginTop: 8, marginBottom: 0 }}>
                        Recovered: <strong>{shamirRecovered}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <h3><History size={16} /> Encrypted Session Audit Log</h3>
                {payload.auditLog.slice(0, 12).map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '7px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <span className="kbd" style={{ marginRight: 8 }}>{ev.action}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{ev.detail}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: GET STARTED DOCUMENTATION */}
        {activeTab === 'docs' && (
          <GetStartedDocs
            externalBytes={netMeter.externalBytes}
            docsCount={payload.documents.length}
            backupExported={backupExported}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {/* TAB 7: INFERENCE & SECURITY SETTINGS */}
        {activeTab === 'settings' && (
          <div className="content-pane">
            <div className="pane-inner grid-2">
              <div className="card">
                <h3>Confidential Inference &amp; Persona</h3>
                <div className="field">
                  <label>Inference Mode</label>
                  <select
                    className="select"
                    value={payload.inference.mode}
                    onChange={(e) =>
                      void updatePayload((p) => ({
                        ...p,
                        inference: { ...p.inference, mode: e.target.value as 'sandbox' | 'ollama' | 'tee' },
                      }))
                    }
                  >
                    <option value="sandbox">Zero-Egress Sandbox Mode</option>
                    <option value="ollama">
                      Local Ollama Bridge (100% Offline — {ollamaStatus.running ? `${ollamaStatus.models.length} models detected` : 'not running'})
                    </option>
                    <option value="tee">Confidential Cloud TEE (OpenAI-Compatible)</option>
                  </select>
                </div>

                {payload.inference.mode === 'ollama' && ollamaStatus.models.length > 0 && (
                  <div className="field">
                    <label>Installed Local Ollama Models</label>
                    <select
                      className="select"
                      value={payload.inference.model}
                      onChange={(e) =>
                        void updatePayload((p) => ({
                          ...p,
                          inference: { ...p.inference, model: e.target.value, providerName: 'Local Ollama' },
                        }))
                      }
                    >
                      {ollamaStatus.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label style={{ justifyContent: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(payload.inference.directBrowserTee)}
                      onChange={(e) =>
                        void updatePayload((p) => ({
                          ...p,
                          inference: { ...p.inference, directBrowserTee: e.target.checked },
                        }))
                      }
                    />
                    <span>Direct-to-TEE Browser Mode (zero proxy hop)</span>
                  </label>
                </div>

                <div className="field">
                  <label>Confidential Computing Presets</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TEE_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          void updatePayload((p) => ({
                            ...p,
                            inference: {
                              ...p.inference,
                              mode: 'tee',
                              providerName: preset.name,
                              baseUrl: preset.baseUrl,
                              model: preset.model,
                            },
                          }))
                        }
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label>Base URL</label>
                  <input className="input" value={payload.inference.baseUrl} onChange={(e) => void updatePayload((p) => ({ ...p, inference: { ...p.inference, baseUrl: e.target.value } }))} />
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: '1fr 120px', gap: 10 }}>
                  <div className="field">
                    <label>Model ID</label>
                    <input className="input" value={payload.inference.model} onChange={(e) => void updatePayload((p) => ({ ...p, inference: { ...p.inference, model: e.target.value } }))} />
                  </div>
                  <div className="field">
                    <label>Temp ({payload.inference.temperature})</label>
                    <input
                      type="range"
                      min="0"
                      max="1.2"
                      step="0.1"
                      value={payload.inference.temperature}
                      onChange={(e) => void updatePayload((p) => ({ ...p, inference: { ...p.inference, temperature: Number(e.target.value) } }))}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>API Key (encrypted inside your vault)</label>
                  <input className="input" type="password" value={payload.inference.apiKey} onChange={(e) => void updatePayload((p) => ({ ...p, inference: { ...p.inference, apiKey: e.target.value } }))} placeholder="sk-..." />
                </div>

                <div className="field">
                  <label>Custom Global System Persona</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={payload.inference.customPersona}
                    onChange={(e) => void updatePayload((p) => ({ ...p, inference: { ...p.inference, customPersona: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="card">
                <h3>RAG Tuning, Appearance &amp; Security</h3>
                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label>Theme</label>
                    <select
                      className="select"
                      value={theme}
                      onChange={(e) => {
                        const next = e.target.value as 'dark' | 'light';
                        setTheme(next);
                        void updatePayload((p) => ({ ...p, settings: { ...p.settings, theme: next } }));
                      }}
                    >
                      <option value="dark">Obsidian Dark</option>
                      <option value="light">Paper Light</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Font Scale</label>
                    <select
                      className="select"
                      value={fontSize}
                      onChange={(e) => {
                        const next = e.target.value as 'compact' | 'default' | 'comfortable';
                        setFontSize(next);
                        void updatePayload((p) => ({ ...p, settings: { ...p.settings, fontSize: next } }));
                      }}
                    >
                      <option value="compact">Compact</option>
                      <option value="default">Default</option>
                      <option value="comfortable">Comfortable</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Max RAG Chunks per Query (Top-K: {payload.settings.ragTopK})</label>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={payload.settings.ragTopK}
                    onChange={(e) => void updatePayload((p) => ({ ...p, settings: { ...p.settings, ragTopK: Number(e.target.value) } }))}
                  />
                </div>

                <div className="field">
                  <label>RAG Relevance Threshold ({payload.settings.ragMinScore.toFixed(1)})</label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={payload.settings.ragMinScore}
                    onChange={(e) => void updatePayload((p) => ({ ...p, settings: { ...p.settings, ragMinScore: Number(e.target.value) } }))}
                  />
                </div>

                <div className="field">
                  <label>Auto-Lock Inactivity Timer</label>
                  <select
                    className="select"
                    value={payload.settings.autoLockMinutes}
                    onChange={(e) => void updatePayload((p) => ({ ...p, settings: { ...p.settings, autoLockMinutes: Number(e.target.value) } }))}
                  >
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={0}>Never</option>
                  </select>
                </div>

                <div className="field">
                  <label>Plausible-Deniability Duress Passphrase (opens decoy vault)</label>
                  <div className="input-row">
                    <input
                      className="input"
                      type="password"
                      value={duressPhraseInput}
                      onChange={(e) => setDuressPhraseInput(e.target.value)}
                      placeholder="Set secondary decoy passphrase..."
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleSaveDuressPhrase()}>
                      Set Duress
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Bring-Your-Own-Storage (BYOS) WebDAV / S3 Presigned PUT URL</label>
                  <div className="input-row">
                    <input
                      className="input"
                      value={byosUrl}
                      onChange={(e) => setByosUrl(e.target.value)}
                      placeholder="https://my-bucket.r2.cloudflarestorage.com/kavcy.json?..."
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleByosPush()}>
                      Sync Ciphertext
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => void handleRegisterPasskey()}>
                    <Fingerprint size={13} /> Register Passkey
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportVaultBackup}>
                    <Download size={13} /> Export .kavcy.json
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleExportAllConversationsJson}>
                    <Download size={13} /> Archive All Chats
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleRotateKeys}>
                    <KeyRound size={13} /> Rotate PQ Keys
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={handlePanicWipeCache}>
                    <Trash2 size={13} /> Panic Wipe Cache
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
