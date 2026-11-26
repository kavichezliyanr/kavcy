# Changelog

All notable changes to **Kavcy** are documented in this file.
Kavcy follows [Semantic Versioning](https://semver.org/) via automated GitHub Actions releases.

## [v1.0.0] - 2026-11-25
### Added
- **Post-Quantum Zero-Knowledge Vault:** Client-side NIST FIPS 203 `ML-KEM-768` key encapsulation + `AES-256-GCM` authenticated encryption + `PBKDF2-SHA512` (310,000 iterations).
- **Realtime Zero-Egress Network Meter & Air-Gap Kill Switch:** Live `fetch()` interceptor tracking external vs. localhost bytes with a physical air-gap blocker.
- **Hardware Compatibility Validator & Model Kill Switch:** Detects machine RAM/CPU/GPU, blocks incompatible local models from downloading, and provides a 1-click **Disable & Unload Model** button to free 100% of CPU & RAM.
- **Drag-and-Drop Client-Side RAG:** Chunking, TF-IDF retrieval, citations, Top-K & relevance sliders, and per-document active/paused toggles in browser RAM.
- **Multi-Conversation Workspace & Skills Engine:** Separate encrypted threads (pin, rename, fork, tag, export `.md`), slash commands (`/rag`, `/clear`, `/export`, `/unload`, `/lock`), prompt templates, encrypted scratchpad, and custom agent skills.
- **Cross-Platform Delivery:** Responsive desktop/iPad/mobile PWA, GitHub Pages landing page with real walkthrough screenshots, and automated macOS (`.dmg`) & Windows (`.exe`) GitHub Releases.
