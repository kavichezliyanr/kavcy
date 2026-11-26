# Kavcy

**Post-Quantum Zero-Knowledge Personal AI Vault.**

Kavcy keeps your conversations, drag-and-drop RAG documents, personal memories, and custom agent skills inside a client-side encrypted vault powered by **NIST FIPS 203 ML-KEM-768** and **AES-256-GCM**—with a realtime **0 B External Egress Network Meter**, automatic **Hardware Compatibility Guard**, and a 1-click **Model Kill Switch** that frees 100% of CPU and RAM.

---

## Why Choose Kavcy?
| Capability | Cloud AI Chatbots | Local-Only Tinker Apps | **Kavcy** |
| :--- | :--- | :--- | :--- |
| **Post-Quantum E2EE Vault (ML-KEM-768)** | No | Rarely | **Yes (Client-Side)** |
| **Realtime Zero-Egress Network Meter** | No | No | **Yes + Air-Gap Switch** |
| **Hardware RAM Guard (Blocks Crashes)** | N/A | Manual | **Automatic** |
| **1-Click Model Unload (Free 100% CPU/RAM)** | N/A | Terminal only | **1-Click Kill Switch** |
| **Client-Side Drag & Drop RAG** | Uploaded plaintext | Often Docker | **100% In-Browser RAM** |
| **Mobile & iPad Ready (PWA)** | Yes | Desktop only | **Yes (Slide-over UI)** |

---

## Quick Start
```bash
npm install
npm run dev
```
- Web App: `http://localhost:5173`
- Public Landing Page: `http://localhost:5173/landing.html`
- Built-in **Get Started** documentation is available directly in the left-side navigation once unlocked.

### Cryptographic Verification
```bash
npm run test:crypto
```

### Automated GitHub Pipelines
- **GitHub Pages Landing Page + Web App:** `.github/workflows/deploy-pages.yml` automatically builds and deploys on every push to `main`.
- **macOS (`.dmg`) & Windows (`.exe`) Releases:** `.github/workflows/release-desktop.yml` automatically builds and attaches signed-ready installers to GitHub Releases whenever you push a tag (`git tag v1.0.0 && git push --tags`).

---

## Security & Open Source
See [SECURITY.md](./SECURITY.md) for the full cryptographic threat model.
