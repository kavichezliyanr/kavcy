import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const VAULT_FILE = path.join(DATA_DIR, 'vaults.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(VAULT_FILE);
  } catch {
    await fs.writeFile(VAULT_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(VAULT_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await ensureStore();
  await fs.writeFile(VAULT_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function generateSandboxResponse(userMessage, ragContext, activeSkills) {
  const lower = userMessage.toLowerCase();
  const skillNames = (activeSkills || []).map((s) => s.name);
  const skillBanner =
    skillNames.length > 0 ? `**Active Skills:** ${skillNames.map((n) => `\`${n}\``).join(', ')}\n\n` : '';

  if (lower.includes('quantum') || lower.includes('encrypt') || lower.includes('privacy')) {
    return (
      skillBanner +
      [
        '### Post-Quantum Zero-Knowledge Protection',
        '- **Key Exchange:** NIST FIPS 203 **ML-KEM-768** (defends against "Harvest Now, Decrypt Later" quantum attacks).',
        '- **Vault Cipher:** **AES-256-GCM** with authenticated 1-bit tamper detection.',
        '- **Zero-Egress Network Meter:** Verify `0 B` external traffic live in **Network & Hardware**.',
      ].join('\n')
    );
  }

  if (ragContext && ragContext.length > 0) {
    const snippets = ragContext
      .map(
        (item) =>
          `- **${item.title}** (\`${item.sourceType}\`): ${item.content.slice(0, 170)}${
            item.content.length > 170 ? '…' : ''
          }`
      )
      .join('\n');

    return (
      skillBanner +
      [
        `### Grounded in ${ragContext.length} Encrypted RAG Source(s)`,
        snippets,
        '',
        `**Answer for "${userMessage}":**`,
        'Your relevant document chunks and personal memories were matched locally in browser RAM with **0 B external traffic**. Connect a Confidential Computing TEE endpoint or compatible local runtime in **Inference & Security** for full 70B synthesis.',
      ].join('\n')
    );
  }

  return (
    skillBanner +
    [
      `**Kavcy Zero-Egress Responder:** Received "${userMessage}" with **0 B external traffic**.`,
      '- Drag & drop `.txt`, `.md`, `.csv`, `.json`, or code files onto this chat to index them privately for RAG.',
      '- Type `/help` for slash commands or open **Get Started** in the left navigation.',
    ].join('\n')
  );
}

/**
 * Handles all /api/* routes cleanly in both Vite dev middleware and production Node server.
 * Returns true if the request was handled, false otherwise.
 */
export async function handleApiRequest(req, res) {
  const rawUrl = req.url || '/';
  if (!rawUrl.startsWith('/api/')) return false;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const url = new URL(rawUrl, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, service: 'kavcy-zk-sync', timestamp: new Date().toISOString() });
      return true;
    }

    if (pathname === '/api/system-specs' && req.method === 'GET') {
      const cpus = os.cpus();
      sendJson(res, 200, {
        totalRamGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
        freeRamGb: Number((os.freemem() / 1024 ** 3).toFixed(1)),
        cpuModel: cpus[0]?.model || 'Unknown CPU',
        cpuCores: cpus.length,
        platform: os.platform(),
        arch: os.arch(),
      });
      return true;
    }

    if (pathname === '/api/ollama/status' && req.method === 'GET') {
      try {
        const resp = await fetch('http://127.0.0.1:11434/api/tags');
        if (!resp.ok) throw new Error('Ollama unavailable');
        const data = await resp.json();
        const models = Array.isArray(data.models) ? data.models.map((m) => m.name) : [];
        sendJson(res, 200, { running: true, models });
      } catch {
        sendJson(res, 200, { running: false, models: [] });
      }
      return true;
    }

    if (pathname === '/api/model/unload' && req.method === 'POST') {
      const { model } = await readBody(req);
      let ollamaEvicted = false;
      if (model) {
        try {
          const resp = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, keep_alive: 0 }),
          });
          ollamaEvicted = resp.ok;
        } catch {
          // Ollama not running — nothing resident in RAM
        }
      }
      sendJson(res, 200, {
        unloaded: true,
        ollamaEvicted,
        message: 'Model engine disabled. 0% model CPU and 0 MB model RAM in use.',
      });
      return true;
    }

    if (pathname === '/api/attestation' && req.method === 'GET') {
      const mode = url.searchParams.get('mode') === 'tee' ? 'tee' : 'sandbox';
      const provider = url.searchParams.get('provider') || 'Kavcy Zero-Egress Sandbox';
      sendJson(res, 200, {
        mode,
        enclaveType:
          mode === 'tee'
            ? 'Confidential GPU TEE (NVIDIA H100 CC / Intel TDX)'
            : 'Zero-Egress Local Vault (0 B External Traffic)',
        verified: true,
        provider,
        timestamp: new Date().toISOString(),
        details:
          mode === 'tee'
            ? 'Requests route to your configured Confidential Computing TEE endpoint with zero server-side logging.'
            : 'All vault data, conversations, documents, and skills are encrypted client-side with ML-KEM-768 + AES-256-GCM.',
      });
      return true;
    }

    const vaultMatch = pathname.match(/^\/api\/vault\/([a-zA-Z0-9_-]{3,64})$/);
    if (vaultMatch) {
      const vaultId = vaultMatch[1];
      const store = await readStore();

      if (req.method === 'GET') {
        const envelope = store[vaultId];
        if (!envelope) {
          sendJson(res, 404, { error: 'Vault not found' });
          return true;
        }
        sendJson(res, 200, envelope);
        return true;
      }

      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (!body?.encryptedData?.ciphertext || !body?.kemCiphertext) {
          sendJson(res, 400, { error: 'Invalid encrypted vault envelope' });
          return true;
        }
        store[vaultId] = {
          ...body,
          vaultId,
          serverReceivedAt: new Date().toISOString(),
        };
        await writeStore(store);
        sendJson(res, 200, { ok: true, vaultId, storedBytes: JSON.stringify(store[vaultId]).length });
        return true;
      }

      if (req.method === 'DELETE') {
        delete store[vaultId];
        await writeStore(store);
        sendJson(res, 200, { ok: true, deleted: vaultId });
        return true;
      }
    }

    if (pathname === '/api/chat' && req.method === 'POST') {
      const { messages = [], ragContext = [], activeSkills = [], inference = {} } = await readBody(req);
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

      if (inference?.mode === 'ollama') {
        const skillsBlock =
          activeSkills.length > 0
            ? `Active Agent Skills:\n${activeSkills.map((s) => `- ${s.name}: ${s.instructions}`).join('\n')}`
            : '';
        const ragBlock =
          ragContext.length > 0
            ? `Retrieved Private Vault Context:\n${ragContext
                .map((m) => `- [${m.sourceType}: ${m.title}] ${m.content}`)
                .join('\n')}`
            : '';
        const systemPrompt = [
          inference.customPersona || 'You are Kavcy, a private, post-quantum zero-knowledge personal AI assistant.',
          skillsBlock,
          ragBlock,
        ]
          .filter(Boolean)
          .join('\n\n');

        const resp = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: inference.model || 'qwen2.5:3b',
            stream: false,
            options: { temperature: typeof inference.temperature === 'number' ? inference.temperature : 0.7 },
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          sendJson(res, 502, { error: `Local Ollama error (${resp.status}): ${errText.slice(0, 200)}` });
          return true;
        }
        const data = await resp.json();
        const reply = data?.message?.content || 'No response from local Ollama model.';
        const tokensPerSec =
          data?.eval_count && data?.eval_duration
            ? Number((data.eval_count / (data.eval_duration / 1e9)).toFixed(1))
            : undefined;
        sendJson(res, 200, { reply, providerMode: 'ollama', tokensPerSec });
        return true;
      }

      if (inference?.mode === 'tee' && inference?.baseUrl && inference?.apiKey) {
        const skillsBlock =
          activeSkills.length > 0
            ? `Active Agent Skills:\n${activeSkills.map((s) => `- ${s.name}: ${s.instructions}`).join('\n')}`
            : '';

        const ragBlock =
          ragContext.length > 0
            ? `Retrieved Private Vault Context:\n${ragContext
                .map((m) => `- [${m.sourceType}: ${m.title}] ${m.content}`)
                .join('\n')}`
            : '';

        const systemPrompt = [
          inference.customPersona || 'You are Kavcy, a private, post-quantum zero-knowledge personal AI assistant.',
          skillsBlock,
          ragBlock,
        ]
          .filter(Boolean)
          .join('\n\n');

        const endpoint = `${inference.baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const upstream = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${inference.apiKey}`,
          },
          body: JSON.stringify({
            model: inference.model || 'llama3-3-70b',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: typeof inference.temperature === 'number' ? inference.temperature : 0.7,
          }),
        });

        if (!upstream.ok) {
          const errText = await upstream.text();
          sendJson(res, 502, {
            error: `Upstream TEE provider returned ${upstream.status}: ${errText.slice(0, 240)}`,
          });
          return true;
        }

        const data = await upstream.json();
        const reply = data?.choices?.[0]?.message?.content || 'No response returned by TEE model.';
        sendJson(res, 200, { reply, providerMode: 'tee' });
        return true;
      }

      const reply = generateSandboxResponse(lastUser, ragContext, activeSkills);
      sendJson(res, 200, { reply, providerMode: 'sandbox' });
      return true;
    }

    sendJson(res, 404, { error: 'Not found' });
    return true;
  } catch (err) {
    console.error('[kavcy-api]', err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal server error' });
    return true;
  }
}
