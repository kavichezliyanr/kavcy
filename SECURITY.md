# Kavcy Security & Threat Model

## What Kavcy Protects Against
1. **Host / Sync Server Access:** All vault records (conversations, RAG documents, memories, skills, scratchpad, and API keys) are encrypted client-side with **ML-KEM-768 + AES-256-GCM** before leaving your device.
2. **Quantum "Harvest Now, Decrypt Later" Threats:** Every vault save encapsulates a fresh 256-bit AES key using NIST FIPS 203 **ML-KEM-768**.
3. **Ciphertext Tampering:** AES-256-GCM authentication tags reject any 1-bit modification immediately (verifiable live inside **ZK Inspector**).
4. **Silent Network Egress:** The **Realtime Network Meter** tracks every `fetch()` call and provides a **Strict Air-Gap Kill Switch** that physically blocks all non-localhost traffic.
5. **Proxy Exposure:** Enabling **Direct-to-TEE Browser Mode** routes Confidential Computing requests straight from your browser to the attested GPU enclave.

## What You Must Protect
- **Your Master Passphrase:** Because Kavcy is zero-knowledge, there is no password reset. Export an encrypted `.kavcy.json` backup anytime.
- **Unlocked RAM:** Use the configurable **Auto-Lock Timer** or type `/lock` when stepping away.
