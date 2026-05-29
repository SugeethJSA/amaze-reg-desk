import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { config } from "../config.js";

const KEY_VERSION = "v1";

function deriveKey(context = "qr-payload") {
  const secret = Buffer.from(config.QR_MASTER_SECRET);
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), context, 32));
}

export function hashPayload(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

export function encryptQrPayload(data: Record<string, unknown>) {
  const iv = randomBytes(12);
  const key = deriveKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = [
    KEY_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");

  return {
    encryptedPayload: payload,
    payloadHash: hashPayload(payload),
    keyVersion: KEY_VERSION
  };
}

export function exportQrDecryptKey() {
  return deriveKey().toString("base64");
}

export function decryptQrPayload(payload: string) {
  const [version, ivRaw, tagRaw, cipherRaw] = payload.split(".");
  if (version !== KEY_VERSION || !ivRaw || !tagRaw || !cipherRaw) {
    throw new Error("Unsupported QR payload format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherRaw, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
}
