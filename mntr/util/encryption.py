import base64

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad


def aes_encrypt(
    message: str, passphrase: str, encoding="utf8", padding: int = 16
) -> str:
    passphrase = (passphrase + "0" * (16 - len(passphrase)))[:16]

    cipher = AES.new(passphrase.encode(encoding), AES.MODE_ECB)
    return base64.b64encode(cipher.encrypt(pad(message.encode(), padding))).decode()


def aes_decrypt(
    message: str, passphrase: str, encoding: str = "utf8", padding: int = 16
) -> str:
    passphrase = (passphrase + "0" * (16 - len(passphrase)))[:16]

    cipher = AES.new(passphrase.encode(encoding), AES.MODE_ECB)
    return unpad(
        cipher.decrypt(base64.b64decode(message.encode())),
        padding,
    ).decode(encoding)
