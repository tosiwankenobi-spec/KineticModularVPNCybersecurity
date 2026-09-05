"""Symmetric encryption helpers for storing user-supplied secrets (e.g. BYOK API keys) at rest."""
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    secret = os.environ.get("API_KEY_ENCRYPTION_SECRET")
    if not secret:
        raise RuntimeError(
            "API_KEY_ENCRYPTION_SECRET is not configured; cannot encrypt/decrypt stored API keys."
        )
    # Derive a valid 32-byte urlsafe-base64 Fernet key from the configured secret,
    # so the env var can be any sufficiently long passphrase rather than a pre-formatted Fernet key.
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(derived_key)


def encrypt_api_key(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_api_key(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Unable to decrypt stored API key") from e
