<div align="center">

<img src="./public/favicon.svg" alt="Kavcy Logo" width="72" height="72" />

# Kavcy

**Post-Quantum Zero-Knowledge Personal AI Vault**

[![Latest Release](https://img.shields.io/github/v/release/kavichezliyanr/kavcy?style=flat-square&color=d4a359)](https://github.com/kavichezliyanr/kavcy/releases/latest)
[![Deploy Pages](https://github.com/kavichezliyanr/kavcy/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/kavichezliyanr/kavcy/actions/workflows/deploy-pages.yml)
[![Desktop Release](https://github.com/kavichezliyanr/kavcy/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/kavichezliyanr/kavcy/actions/workflows/release-desktop.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-34d399.svg?style=flat-square)](./LICENSE)
[![Crypto: ML-KEM-768](https://img.shields.io/badge/Post--Quantum-ML--KEM--768%20%2B%20AES--256--GCM-16161a?style=flat-square)](./docs/ARCHITECTURE.md)

[Live Landing Page](https://kavichezliyanr.github.io/kavcy/) · [Launch Web App](https://kavichezliyanr.github.io/kavcy/app.html) · [Download Desktop (.dmg / .exe)](https://github.com/kavichezliyanr/kavcy/releases/latest) · [Architecture](./docs/ARCHITECTURE.md) · [Privacy FAQ](./docs/PRIVACY_AND_FAQ.md)

</div>

---

## Downloads

| Platform | Package | Direct Download |
| :--- | :--- | :--- |
| **Web / iPad / Mobile (PWA)** | Zero-install browser workspace | [Launch Kavcy Web App →](https://kavichezliyanr.github.io/kavcy/app.html) |
| **macOS (Apple Silicon)** | Native `.dmg` installer | [Download `Kavcy-1.0.0-arm64.dmg`](https://github.com/kavichezliyanr/kavcy/releases/download/v1.0.0/Kavcy-1.0.0-arm64.dmg) |
| **Windows (Installer)** | NSIS `Setup.exe` | [Download `Kavcy.Setup.1.0.0.exe`](https://github.com/kavichezliyanr/kavcy/releases/download/v1.0.0/Kavcy.Setup.1.0.0.exe) |
| **Windows (Portable)** | Standalone `.exe` | [Download `Kavcy.1.0.0.exe`](https://github.com/kavichezliyanr/kavcy/releases/download/v1.0.0/Kavcy.1.0.0.exe) |

> Always find the latest semantic version on the [GitHub Releases](https://github.com/kavichezliyanr/kavcy/releases/latest) page.

---

## Why Choose Kavcy?

Most cloud chatbots log your prompts and train on your private files. Most local AI tools require Docker, terminal commands, or freeze 8 GB laptops with oversized models. **Kavcy** delivers verifiable post-quantum cryptography with consumer-grade simplicity:

| Capability | Cloud AI Chatbots | Local-Only Tinker Apps | **Kavcy** |
| :--- | :--- | :--- | :--- |
| **Post-Quantum E2EE Vault (`ML-KEM-768`)** | No | Rarely | **Yes (Client-Side Default)** |
| **Realtime Zero-Egress Network Meter** | No | No | **Yes + Air-Gap Kill Switch** |
| **Hardware RAM Guard (Blocks Crashes)** | N/A | Manual | **Automatic Validator** |
| **1-Click Model Unload (Free 100% CPU/RAM)** | N/A | CLI Only | **1-Click Kill Switch** |
| **Client-Side Drag & Drop RAG** | Uploaded plaintext | Often Docker | **100% In-Browser RAM** |
| **Desktop + iPad + Mobile PWA** | Yes | Desktop only | **Responsive Everywhere** |

---

## Visual Walkthrough

<table>
  <tr>
    <td width="50%">
      <strong>1. Post-Quantum Vault Gate</strong><br/>
      <img src="./public/screenshots/step1-gate.png" alt="Kavcy Vault Gate" />
    </td>
    <td width="50%">
      <strong>2. Personal Agent, Skills &amp; Drag-Drop RAG</strong><br/>
      <img src="./public/screenshots/step2-agent.png" alt="Kavcy Personal Agent" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>3. Realtime 0 B Network Meter &amp; RAM Guard</strong><br/>
      <img src="./public/screenshots/step3-network-hardware.png" alt="Kavcy Network Meter and Hardware Guard" />
    </td>
    <td width="50%">
      <strong>4. Built-In Get Started Docs &amp; Checklist</strong><br/>
      <img src="./public/screenshots/step4-get-started.png" alt="Kavcy Get Started Documentation" />
    </td>
  </tr>
</table>

---

## Key Features
- **Post-Quantum Cryptography:** NIST FIPS 203 `ML-KEM-768` + `AES-256-GCM` + `PBKDF2-SHA512` (310,000 rounds), live 1-bit tamper simulator, and 1-click key rotation.
- **Realtime Zero-Egress Proof:** Live `fetch()` byte meter (`External: 0 B`) + **Strict Air-Gap Kill Switch**.
- **Hardware Guard & Model Kill Switch:** Validates your machine's RAM/disk before local model downloads and unloads models in 1 click to free **100% of CPU & RAM**.
- **Drag-and-Drop Client-Side RAG:** Chunking, TF-IDF citations, Top-K & relevance sliders, and per-document active/paused toggles.
- **Workspace Ergonomics:** Multi-conversation threads (pin, rename, fork, tag, export `.md`), slash commands (`/rag`, `/clear`, `/export`, `/unload`, `/lock`), prompt templates, encrypted scratchpad, `⌘K` Command Palette, Obsidian Dark & Paper Light themes.
- **Direct-to-TEE Cloud Option:** Optionally connect Tinfoil, Venice.ai, or Phala directly from your browser with zero proxy hop.

---

## Local Development

```bash
git clone https://github.com/kavichezliyanr/kavcy.git
cd kavcy
npm install
npm run dev
```
- Web App: `http://localhost:5173/`
- Landing Page: `http://localhost:5173/landing.html`

### Run Verification Tests & Production Build
```bash
npm run test:crypto
npm run build
```

---

## Documentation
- [Technical Architecture & Cryptographic Spec](./docs/ARCHITECTURE.md)
- [Privacy & Frequently Asked Questions](./docs/PRIVACY_AND_FAQ.md)
- [Security & Threat Model](./SECURITY.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [MIT License](./LICENSE)
