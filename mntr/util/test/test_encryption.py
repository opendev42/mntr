import pytest

from mntr.util.encryption import (
    aes_decrypt,
    aes_decrypt_url_safe,
    aes_encrypt,
)


def test_encrypt_decrypt():
    original_text = "Hello, World!"
    key = "0" * 16

    encrypted_text = aes_encrypt(original_text, key)
    decrypted_text = aes_decrypt(encrypted_text, key)

    assert decrypted_text == original_text


def test_encrypt_with_different_keys():
    original_text = "Hello, World!"
    key1 = "0" * 16
    key2 = "1" * 16

    encrypted_text1 = aes_encrypt(original_text, key1)
    encrypted_text2 = aes_encrypt(original_text, key2)

    assert encrypted_text1 != encrypted_text2


def test_decrypt_with_wrong_key():
    original_text = "Hello, World!"
    correct_key = "0" * 16
    wrong_key = "1" * 16

    encrypted_text = aes_encrypt(original_text, correct_key)
    with pytest.raises(ValueError):
        aes_decrypt(encrypted_text, wrong_key)


def test_url_safe_roundtrip():
    original_text = '["cpu-usage", "memory", "disk-io"]'
    key = "test-passphrase"

    encrypted = aes_encrypt(original_text, key)
    url_safe = (
        encrypted.replace("+", "-").replace("/", "_").rstrip("=")
    )

    assert "+" not in url_safe
    assert "/" not in url_safe
    assert not url_safe.endswith("=")

    decrypted = aes_decrypt_url_safe(url_safe, key)
    assert decrypted == original_text


def test_url_safe_decrypt_standard_b64_also_works():
    original = "test message"
    key = "key123"
    encrypted = aes_encrypt(original, key)
    assert aes_decrypt_url_safe(encrypted, key) == original
