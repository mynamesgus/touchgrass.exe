const crypto = require("crypto");

// AES-256-GCM parameters
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv,
    encrypted,
    authTag
  };
}

module.exports = { encryptBuffer };
