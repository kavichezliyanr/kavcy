"""Kavcy Python SDK — Zero-Knowledge Vaults, Shamir M-of-N Recovery, and Local RAG."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
from typing import Any, Dict, List

# GF(2^8) tables for Shamir's Secret Sharing (AES polynomial 0x11b, generator 3)
_EXP = [0] * 512
_LOG = [0] * 256
_x = 1
for _i in range(255):
    _EXP[_i] = _x
    _LOG[_x] = _i
    _x2 = (_x << 1) ^ (0x11B if _x & 0x80 else 0)
    _x = _x2 ^ _x
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i - 255]


def _gf_mul(a: int, b: int) -> int:
    return 0 if (a == 0 or b == 0) else _EXP[_LOG[a] + _LOG[b]]


def _gf_div(a: int, b: int) -> int:
    if b == 0:
        raise ZeroDivisionError("GF(2^8) division by zero")
    return 0 if a == 0 else _EXP[(_LOG[a] - _LOG[b] + 255) % 255]


def split_secret(secret: str, total_shares: int = 5, threshold: int = 3) -> List[str]:
    """Split a UTF-8 secret into N Shamir shards requiring any M shards to recover."""
    if threshold < 2 or total_shares < threshold or total_shares > 255:
        raise ValueError("threshold must be >= 2 and <= total_shares <= 255")
    data = secret.encode("utf-8")
    buffers = [bytearray(len(data)) for _ in range(total_shares)]

    for idx, byte_val in enumerate(data):
        coeffs = [byte_val] + list(os.urandom(threshold - 1))
        for s in range(total_shares):
            x = s + 1
            y = 0
            for c in reversed(coeffs):
                y = _gf_mul(y, x) ^ c
            buffers[s][idx] = y

    return [
        f"kavcy-shard-v1:{threshold}:{s + 1}:{buffers[s].hex()}"
        for s in range(total_shares)
    ]


def combine_shares(shards: List[str]) -> str:
    """Reconstruct the original UTF-8 secret from any M Kavcy Shamir shards."""
    parsed = []
    for line in shards:
        parts = line.strip().split(":")
        if len(parts) != 4 or parts[0] != "kavcy-shard-v1":
            raise ValueError("Invalid Kavcy shard format")
        parsed.append((int(parts[1]), int(parts[2]), bytes.fromhex(parts[3])))

    threshold = parsed[0][0]
    if len(parsed) < threshold:
        raise ValueError(f"Need at least {threshold} shards")

    used = parsed[:threshold]
    out = bytearray(len(used[0][2]))
    for byte_idx in range(len(out)):
        acc = 0
        for i in range(threshold):
            basis = 1
            for j in range(threshold):
                if i != j:
                    basis = _gf_mul(basis, _gf_div(used[j][1], used[j][1] ^ used[i][1]))
            acc ^= _gf_mul(used[i][2][byte_idx], basis)
        out[byte_idx] = acc

    return out.decode("utf-8")


def _xor_keystream(key: bytes, nonce: bytes, data: bytes) -> bytes:
    out = bytearray(len(data))
    counter = 0
    pos = 0
    while pos < len(data):
        block = hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        take = min(len(block), len(data) - pos)
        for i in range(take):
            out[pos + i] = data[pos + i] ^ block[i]
        pos += take
        counter += 1
    return bytes(out)


class KavcyVault:
    """Zero-knowledge vault using PBKDF2-SHA512 + AES-256-GCM (when cryptography installed) or EtM-SHA256."""

    def __init__(self, vault_id: str, passphrase: str, iterations: int = 310_000):
        self.vault_id = vault_id
        self.passphrase = passphrase
        self.iterations = iterations

    def encrypt(self, payload: Any) -> Dict[str, Any]:
        salt = os.urandom(16)
        nonce = os.urandom(12)
        key = hashlib.pbkdf2_hmac("sha512", self.passphrase.encode("utf-8"), salt, self.iterations, dklen=32)
        raw = json.dumps(payload).encode("utf-8")

        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore

            ct = AESGCM(key).encrypt(nonce, raw, None)
            algo = "AES-256-GCM"
            tag = ""
        except ImportError:
            ct = _xor_keystream(key, nonce, raw)
            tag = base64.b64encode(hmac.new(key, nonce + ct, hashlib.sha256).digest()).decode("ascii")
            algo = "SHA256-CTR-HMAC"

        return {
            "version": 2,
            "vaultId": self.vault_id,
            "algorithm": algo,
            "kdf": "PBKDF2-SHA512",
            "iterations": self.iterations,
            "salt": base64.b64encode(salt).decode("ascii"),
            "iv": base64.b64encode(nonce).decode("ascii"),
            "ciphertext": base64.b64encode(ct).decode("ascii"),
            "tag": tag,
        }

    @staticmethod
    def decrypt(envelope: Dict[str, Any], passphrase: str) -> Any:
        salt = base64.b64decode(envelope["salt"])
        nonce = base64.b64decode(envelope["iv"])
        ct = base64.b64decode(envelope["ciphertext"])
        key = hashlib.pbkdf2_hmac("sha512", passphrase.encode("utf-8"), salt, int(envelope["iterations"]), dklen=32)

        if envelope["algorithm"] == "AES-256-GCM":
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore

            raw = AESGCM(key).decrypt(nonce, ct, None)
        else:
            expected = base64.b64encode(hmac.new(key, nonce + ct, hashlib.sha256).digest()).decode("ascii")
            if not hmac.compare_digest(expected, envelope.get("tag", "")):
                raise ValueError("Tampered ciphertext or wrong passphrase")
            raw = _xor_keystream(key, nonce, ct)

        return json.loads(raw.decode("utf-8"))


def chunk_document(title: str, text: str, chunk_size: int = 550, overlap: int = 90) -> List[Dict[str, Any]]:
    clean = text.replace("\r\n", "\n").strip()
    chunks = []
    start = 0
    idx = 0
    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        chunks.append({"title": title, "index": idx, "text": clean[start:end].strip()})
        if end >= len(clean):
            break
        start = end - overlap
        idx += 1
    return chunks


def search_rag(query: str, chunks: List[Dict[str, Any]], top_k: int = 4) -> List[Dict[str, Any]]:
    tokens = [w for w in re.sub(r"[^a-z0-9\s]", " ", query.lower()).split() if len(w) > 2]
    scored = []
    for c in chunks:
        hay = f"{c['title']} {c['text']}".lower()
        score = sum(1 for t in tokens if t in hay)
        if score > 0:
            scored.append({**c, "score": score})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
