import base64
import os

from Crypto.Cipher import AES
from Crypto.Hash import SHA256
from Crypto.Protocol.KDF import PBKDF2

_ITERATIONS = 10_000
_SALT_LEN = 16
_NONCE_LEN = 12
_KEY_LEN = 32
_TAG_LEN = 16


def _derive_key(passphrase: str, salt: bytes) -> bytes:
    return PBKDF2(
        passphrase.encode("utf-8"),
        salt,
        dkLen=_KEY_LEN,
        count=_ITERATIONS,
        hmac_hash_module=SHA256,
    )


def aes_encrypt(message: str, passphrase: str, **kwargs) -> str:
    salt = os.urandom(_SALT_LEN)
    nonce = os.urandom(_NONCE_LEN)
    key = _derive_key(passphrase, salt)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(message.encode("utf-8"))
    return base64.b64encode(salt + nonce + ciphertext + tag).decode("utf-8")


def aes_decrypt(message: str, passphrase: str, **kwargs) -> str:
    raw = base64.b64decode(message.encode("utf-8"))
    salt = raw[:_SALT_LEN]
    nonce = raw[_SALT_LEN:_SALT_LEN + _NONCE_LEN]
    tag = raw[-_TAG_LEN:]
    ciphertext = raw[_SALT_LEN + _NONCE_LEN:-_TAG_LEN]
    key = _derive_key(passphrase, salt)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    try:
        return cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8")
    except ValueError as e:
        raise ValueError("Decryption failed: invalid key or corrupted data") from e
