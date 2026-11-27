# Changelog

All notable changes to **Kavcy** are documented in this file.
Kavcy follows [Semantic Versioning](https://semver.org/) via automated GitHub Actions releases.

## [v1.1.0] - 2026-11-27
### Added
- **Encrypted IndexedDB Vault Engine:** Replaced 5 MB `localStorage` limit with gigabyte-scale IndexedDB ciphertext storage + automatic migration.
- **Shamir's Secret Sharing (3-of-5 Recovery Shards):** Pure GF(2⁸) secret splitting & reconstruction inside **ZK Inspector**.
- **Ephemeral Burn-After-Close Threads:** Volatile RAM-only conversations excluded from IndexedDB and sync storage.
- **Native Local Ollama Bridge & Live RAM Telemetry Sparkline:** Auto-detects local Ollama models, displays `tokens/sec`, and streams live host RAM usage.
- **Split-Pane Artifact Canvas:** Side-by-side editable Markdown/Code canvas for refining assistant drafts.
- **Official Multi-Language SDKs:** Added `@kavcy/sdk` (Node.js/TypeScript) in `sdk/node/` and `kavcy-sdk` (Python) in `sdk/python/` with automated CI testing and packaging (`release-sdks.yml`).

## [v1.0.0] - 2026-11-25
### Added
- **Post-Quantum Zero-Knowledge Vault:** Client-side NIST FIPS 203 `ML-KEM-768` key encapsulation + `AES-256-GCM` authenticated encryption + `PBKDF2-SHA512` (310,000 iterations).
- **Realtime Zero-Egress Network Meter & Air-Gap Kill Switch:** Live `fetch()` interceptor tracking external vs. localhost bytes with a physical air-gap blocker.
- **Hardware Compatibility Validator & Model Kill Switch:** Detects machine RAM/CPU/GPU, blocks incompatible local models from downloading, and provides a 1-click **Disable & Unload Model** button to free 100% of CPU & RAM.
- **Drag-and-Drop Client-Side RAG:** Chunking, TF-IDF retrieval, citations, Top-K & relevance sliders, and per-document active/paused toggles in browser RAM.
- **Multi-Conversation Workspace & Skills Engine:** Separate encrypted threads (pin, rename, fork, tag, export `.md`), slash commands (`/rag`, `/clear`, `/export`, `/unload`, `/lock`), prompt templates, encrypted scratchpad, and custom agent skills.
- **Cross-Platform Delivery:** Responsive desktop/iPad/mobile PWA, GitHub Pages landing page with real walkthrough screenshots, and automated macOS (`.dmg`) & Windows (`.exe`) GitHub Releases.
