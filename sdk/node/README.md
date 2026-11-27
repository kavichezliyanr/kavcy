# `@kavcy/sdk` (Node.js & TypeScript)

Integrate Kavcy's **Post-Quantum ML-KEM-768 + AES-256-GCM Zero-Knowledge Vault**, **Shamir M-of-N Secret Sharing**, and **Client-Side RAG** directly into any Node.js or TypeScript application.

```bash
npm install @kavcy/sdk
```

```js
import { KavcyVault, splitSecret, combineShares, chunkDocument, searchRag } from '@kavcy/sdk';

const vault = await KavcyVault.create('my-app-vault', 'strong-passphrase');
const envelope = await vault.encrypt({ secret: 'Private user memory' });
const plain = await KavcyVault.decrypt(envelope, 'strong-passphrase');

// Split recovery phrase into 3-of-5 Shamir shards
const shards = splitSecret('strong-passphrase', 5, 3);
const recovered = combineShares([shards[0], shards[2], shards[4]]);

// Local client-side RAG
const chunks = chunkDocument('notes.md', 'Post-quantum ML-KEM-768 protects stored vaults.');
const matches = searchRag('quantum vaults', chunks);
```
