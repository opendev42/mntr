import CryptoJS from "crypto-js";

const aesDecrypt = (ciphertext, passphrase) => {

  passphrase = passphrase.length < 16 ? passphrase + "0".repeat(16 - passphrase.length) : passphrase;
  passphrase = passphrase.length > 16 ? passphrase.slice(0, 16) : passphrase;

  const key = CryptoJS.enc.Utf8.parse(passphrase);
  const bytes = CryptoJS.AES.decrypt(ciphertext, key, {
    mode: CryptoJS.mode.ECB,
  });
  return bytes.toString(CryptoJS.enc.Utf8);
};

export { aesDecrypt };
