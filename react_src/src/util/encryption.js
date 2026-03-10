import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const _ITERATIONS = 10_000;
const _SALT_LEN = 16;
const _NONCE_LEN = 12;
const _KEY_LEN = 32;

const _deriveKey = (passphrase, salt) =>
  pbkdf2(sha256, passphrase, salt, { c: _ITERATIONS, dkLen: _KEY_LEN });

const aesDecrypt = (ciphertext, passphrase) => {
  const raw = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const salt = raw.slice(0, _SALT_LEN);
  const nonce = raw.slice(_SALT_LEN, _SALT_LEN + _NONCE_LEN);
  const data = raw.slice(_SALT_LEN + _NONCE_LEN);
  const key = _deriveKey(new TextEncoder().encode(passphrase), salt);
  const plaintext = gcm(key, nonce).decrypt(data);
  return new TextDecoder().decode(plaintext);
};

export { aesDecrypt };
