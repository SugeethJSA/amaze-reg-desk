import { api } from "./api";

export interface QueuedScan {
  localScanId: string;
  encryptedPayload: string;
  payloadHash: string;
  station: "entry" | "food" | "kit" | "custom";
  ruleId?: string;
  scannedAt: string;
  offlineCreated: boolean;
  deviceId: string;
}

const KEY = "reg-desk-offline-scans";
const DEVICE_KEY = "reg-desk-device-id";

export function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

export function listQueuedScans(): QueuedScan[] {
  return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedScan[];
}

export function enqueueScan(scan: QueuedScan) {
  const scans = listQueuedScans();
  scans.push(scan);
  localStorage.setItem(KEY, JSON.stringify(scans));
}

export async function flushScans() {
  const scans = listQueuedScans();
  if (scans.length === 0) {
    return [];
  }
  const response = await api<{ results: Array<{ localScanId: string; status: string; reason: string }> }>("/scans/sync", {
    method: "POST",
    body: JSON.stringify({ scans })
  });
  const completed = new Set(response.results.map((result) => result.localScanId));
  localStorage.setItem(KEY, JSON.stringify(scans.filter((scan) => !completed.has(scan.localScanId))));
  return response.results;
}
