import { describe, expect, it } from "vitest";
import { decryptQrPayload, encryptQrPayload, hashPayload } from "./crypto.js";

describe("QR crypto", () => {
  it("encrypts payloads without exposing plain attendee data", () => {
    const result = encryptQrPayload({ attendeeId: "attendee-1", email: "person@example.com" });
    expect(result.encryptedPayload).not.toContain("person@example.com");
    expect(result.payloadHash).toEqual(hashPayload(result.encryptedPayload));
    expect(decryptQrPayload(result.encryptedPayload)).toMatchObject({ attendeeId: "attendee-1" });
  });
});
