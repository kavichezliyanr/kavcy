import unittest
from kavcy import KavcyVault, split_secret, combine_shares, chunk_document, search_rag


class TestKavcyPythonSDK(unittest.TestCase):
    def test_vault_encrypt_decrypt_and_tamper(self):
        vault = KavcyVault("py-vault", "my-strong-passphrase", iterations=10_000)
        env = vault.encrypt({"notes": ["Private tax memo"], "count": 1})
        self.assertEqual(KavcyVault.decrypt(env, "my-strong-passphrase")["count"], 1)

        with self.assertRaises(Exception):
            KavcyVault.decrypt(env, "wrong-passphrase")

    def test_shamir_recovery_shards(self):
        secret = "kavcy-post-quantum-recovery-2026"
        shards = split_secret(secret, total_shares=5, threshold=3)
        self.assertEqual(len(shards), 5)
        self.assertEqual(combine_shares([shards[1], shards[3], shards[4]]), secret)

    def test_local_rag(self):
        chunks = chunk_document("policy.md", "Zero-knowledge encryption keeps data private in RAM.")
        hits = search_rag("private encryption", chunks, top_k=2)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["title"], "policy.md")


if __name__ == "__main__":
    unittest.main()
