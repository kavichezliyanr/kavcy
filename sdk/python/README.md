# `kavcy-sdk` (Python)

Official Python SDK for **Kavcy Zero-Knowledge Vaults**, **Shamir M-of-N Secret Sharing**, and **Local RAG**.

```bash
pip install kavcy-sdk
# Optional AES-256-GCM & ML-KEM extras:
pip install "kavcy-sdk[pq]"
```

```python
from kavcy import KavcyVault, split_secret, combine_shares, chunk_document, search_rag

vault = KavcyVault("my-py-vault", "strong-passphrase")
envelope = vault.encrypt({"notes": ["Private financial summary"]})
data = KavcyVault.decrypt(envelope, "strong-passphrase")

shards = split_secret("strong-passphrase", total_shares=5, threshold=3)
assert combine_shares([shards[0], shards[2], shards[4]]) == "strong-passphrase"

chunks = chunk_document("doc.md", "Zero-knowledge encryption keeps data private.")
hits = search_rag("private encryption", chunks)
```
