export async function hashPayload(payload: string) {
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hasEncryptedQrShape(payload: string) {
  const parts = payload.split(".");
  return parts.length === 4 && parts[0] === "v1";
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function decryptQrPayload(payload: string, keyBase64?: string) {
  if (!keyBase64) {
    throw new Error("This volunteer session does not have a QR decrypt key.");
  }

  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported QR payload.");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(keyBase64),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const cipherBytes = base64UrlToBytes(ciphertext);
  const tagBytes = base64UrlToBytes(tag);
  const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
  combined.set(cipherBytes);
  combined.set(tagBytes, cipherBytes.length);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(iv), tagLength: 128 }, cryptoKey, combined);
  return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
}
