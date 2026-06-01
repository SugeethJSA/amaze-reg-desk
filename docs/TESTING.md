# Testing Guide

Testing ensures the reliability of the registration imports, the encryption engine, and the complex offline syncing logic.

## Running Tests

From the repository root:
```bash
npm run test
```
This triggers `vitest` across all workspaces.

## Backend Test Coverage

- **QR Encryption (`server/src/services/qr.test.ts`)**:
  Ensures that AES-GCM correctly encrypts and decrypts payloads. It tests failure states when attempting to decrypt with wrong secrets or tampered auth tags.
- **Dynamic Fields**:
  Tests that the `metadata` JSONB column can gracefully accept varied inputs.
- **Rule Engine**:
  Tests evaluate multiple concurrent scan events against `allow_multiple = false` rules to ensure race conditions don't allow duplicate check-ins.

## Frontend Test Coverage

- **Scanner Queue (`client/src/lib/sync.test.ts`)**:
  Mock tests for the `navigator.onLine` API, verifying that scans are pushed to a persistent local store (IndexedDB) and automatically flushed upon reconnection.
- **Form Builder Rendering**:
  Validates that custom fields dynamically render the correct HTML input types based on their configurations.
