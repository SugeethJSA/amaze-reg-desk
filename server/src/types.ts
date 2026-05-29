export type StationType = "entry" | "food" | "kit" | "custom";

export type ScanStatus = "accepted" | "duplicate" | "denied" | "conflict" | "pending";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "volunteer";
}

export interface ScanSyncInput {
  localScanId: string;
  encryptedPayload: string;
  payloadHash: string;
  station: StationType;
  ruleId?: string;
  scannedAt: string;
  offlineCreated: boolean;
  deviceId: string;
}
