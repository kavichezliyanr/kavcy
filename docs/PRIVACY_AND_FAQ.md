# Privacy & Frequently Asked Questions

### 1. Does GitHub Pages or any sync host see my conversations or files?
**No.** On GitHub Pages, Kavcy runs 100% inside your browser with zero backend servers. When self-hosting the optional sync server, only opaque `ML-KEM-768 + AES-256-GCM` ciphertext is stored.

### 2. What happens if I forget my Master Passphrase?
Because Kavcy is strictly zero-knowledge, **there is no password reset or recovery backdoor**. Store your passphrase in a password manager and export periodic `.kavcy.json` encrypted backups.

### 3. Why does macOS or Windows show an "Unidentified Developer" warning on the open-source installer?
Open-source builds published via GitHub Actions are not yet signed with paid Apple Developer (\$99/yr) or Windows EV code-signing certificates.
- **macOS:** Right-click `Kavcy.app` → **Open** (or allow in *System Settings → Privacy & Security*).
- **Windows:** Click **More info → Run anyway** in SmartScreen, or build directly from source using `npm run build`.

### 4. How do I use a full 70B AI model while keeping privacy?
Open **Inference & Security**, select a Confidential Computing TEE provider (**Tinfoil**, **Venice.ai**, or **Phala**), paste your API key (encrypted inside your own vault), and enable **Direct-to-TEE Browser Mode** so prompts go straight from your browser to the hardware-attested GPU enclave.

### 5. Can I use Kavcy offline on an airplane or iPad?
**Yes.** Kavcy is a responsive PWA with local encrypted caching. Flip the **Strict Air-Gap Kill Switch** in **Network & Hardware** to guarantee `0 B` external traffic while working with your notes, documents, and client-side RAG.
