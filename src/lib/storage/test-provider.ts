import { createHash, randomUUID } from "node:crypto";

import type {
  MultipartPart,
  ObjectMeta,
  PutObjectInput,
  SignedDownload,
  SignedUpload,
  StorageProvider,
} from "@/lib/storage/provider";

type StoredObject = {
  body: Uint8Array;
  contentType: string;
  etag: string;
};

type MultipartSession = {
  key: string;
  contentType: string;
  parts: Map<number, { body: Uint8Array; etag: string }>;
};

type PartToken = {
  uploadId: string;
  partNumber: number;
  expiresAt: number;
};

/**
 * In-memory storage for unit/e2e. Not for production.
 * Signed URLs point at a local API shim: /api/test-storage/{token}
 */
const globalStore = globalThis as typeof globalThis & {
  __shhhTestStorage?: Map<string, StoredObject>;
  __shhhTestUploadTokens?: Map<string, { key: string; contentType: string; expiresAt: number }>;
  __shhhTestDownloadTokens?: Map<string, { key: string; expiresAt: number; filename?: string }>;
  __shhhTestMultipart?: Map<string, MultipartSession>;
  __shhhTestPartTokens?: Map<string, PartToken>;
  __shhhTestPartFailuresRemaining?: number;
};

function store() {
  if (!globalStore.__shhhTestStorage) {
    globalStore.__shhhTestStorage = new Map();
  }
  return globalStore.__shhhTestStorage;
}

function uploadTokens() {
  if (!globalStore.__shhhTestUploadTokens) {
    globalStore.__shhhTestUploadTokens = new Map();
  }
  return globalStore.__shhhTestUploadTokens;
}

function downloadTokens() {
  if (!globalStore.__shhhTestDownloadTokens) {
    globalStore.__shhhTestDownloadTokens = new Map();
  }
  return globalStore.__shhhTestDownloadTokens;
}

function multipartSessions() {
  if (!globalStore.__shhhTestMultipart) {
    globalStore.__shhhTestMultipart = new Map();
  }
  return globalStore.__shhhTestMultipart;
}

function partTokens() {
  if (!globalStore.__shhhTestPartTokens) {
    globalStore.__shhhTestPartTokens = new Map();
  }
  return globalStore.__shhhTestPartTokens;
}

export function resetTestStorage() {
  store().clear();
  uploadTokens().clear();
  downloadTokens().clear();
  multipartSessions().clear();
  partTokens().clear();
  globalStore.__shhhTestPartFailuresRemaining = 0;
}

export function failNextTestPartUploads(count: number) {
  globalStore.__shhhTestPartFailuresRemaining = Math.max(0, count);
}

export function consumeTestPartFailure() {
  const remaining = globalStore.__shhhTestPartFailuresRemaining ?? 0;
  if (remaining < 1) return false;
  globalStore.__shhhTestPartFailuresRemaining = remaining - 1;
  return true;
}

export function getTestStoredObject(key: string) {
  return store().get(key) ?? null;
}

export function resolveTestUploadToken(token: string) {
  const entry = uploadTokens().get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

export function resolveTestDownloadToken(token: string) {
  const entry = downloadTokens().get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

export function resolveTestPartToken(token: string) {
  const entry = partTokens().get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

export function writeTestObject(key: string, body: Uint8Array, contentType: string) {
  const etag = createHash("md5").update(body).digest("hex");
  store().set(key, { body, contentType, etag });
}

export function writeTestPart(uploadId: string, partNumber: number, body: Uint8Array) {
  const session = multipartSessions().get(uploadId);
  if (!session) {
    throw new Error("No such upload.");
  }
  const etag = `"${createHash("md5").update(body).digest("hex")}"`;
  session.parts.set(partNumber, { body, etag });
  return etag;
}

export function createTestStorageProvider(baseUrl = "http://localhost:3000"): StorageProvider {
  return {
    name: "test",

    async createSignedUploadUrl(input): Promise<SignedUpload> {
      const token = randomUUID();
      const expiresIn = input.expiresInSeconds ?? 900;
      const expiresAtMs = Date.now() + expiresIn * 1000;
      uploadTokens().set(token, {
        key: input.key,
        contentType: input.contentType,
        expiresAt: expiresAtMs,
      });
      return {
        url: `${baseUrl}/api/test-storage/upload/${token}`,
        method: "PUT",
        headers: {
          "Content-Type": input.contentType,
          "Content-Length": String(input.contentLength),
        },
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    },

    async createSignedDownloadUrl(input): Promise<SignedDownload> {
      const token = randomUUID();
      const expiresIn = input.expiresInSeconds ?? 600;
      const expiresAtMs = Date.now() + expiresIn * 1000;
      downloadTokens().set(token, {
        key: input.key,
        expiresAt: expiresAtMs,
        filename: input.downloadFilename,
      });
      return {
        url: `${baseUrl}/api/test-storage/download/${token}`,
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    },

    async headObject(key: string): Promise<ObjectMeta | null> {
      const obj = store().get(key);
      if (!obj) return null;
      return {
        key,
        size: obj.body.byteLength,
        contentType: obj.contentType,
        etag: obj.etag,
      };
    },

    async deleteObject(key: string): Promise<void> {
      store().delete(key);
    },

    async putObject(input: PutObjectInput): Promise<void> {
      const body =
        input.body instanceof Uint8Array ? input.body : new Uint8Array(input.body);
      writeTestObject(input.key, body, input.contentType);
    },

    async getObjectBytes(key: string): Promise<Uint8Array | null> {
      return store().get(key)?.body ?? null;
    },

    async getObjectRange(key, start, endInclusive) {
      const obj = store().get(key);
      if (!obj) return null;
      return obj.body.slice(start, endInclusive + 1);
    },

    async createMultipartUpload(input) {
      const uploadId = randomUUID();
      multipartSessions().set(uploadId, {
        key: input.key,
        contentType: input.contentType,
        parts: new Map(),
      });
      return { uploadId };
    },

    async createSignedPartUploadUrl(input): Promise<SignedUpload> {
      const session = multipartSessions().get(input.uploadId);
      if (!session || session.key !== input.key) {
        throw new Error("No such upload.");
      }
      const token = randomUUID();
      const expiresIn = input.expiresInSeconds ?? 900;
      const expiresAtMs = Date.now() + expiresIn * 1000;
      partTokens().set(token, {
        uploadId: input.uploadId,
        partNumber: input.partNumber,
        expiresAt: expiresAtMs,
      });
      return {
        url: `${baseUrl}/api/test-storage/part/${token}`,
        method: "PUT",
        headers: {
          "Content-Type": input.contentType,
        },
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    },

    async listMultipartParts(input): Promise<MultipartPart[]> {
      const session = multipartSessions().get(input.uploadId);
      if (!session || session.key !== input.key) {
        throw Object.assign(new Error("NoSuchUpload"), { name: "NoSuchUpload" });
      }
      return [...session.parts.entries()]
        .map(([partNumber, part]) => ({
          partNumber,
          etag: part.etag,
          sizeBytes: part.body.byteLength,
        }))
        .sort((a, b) => a.partNumber - b.partNumber);
    },

    async completeMultipartUpload(input) {
      const session = multipartSessions().get(input.uploadId);
      if (!session || session.key !== input.key) {
        throw Object.assign(new Error("NoSuchUpload"), { name: "NoSuchUpload" });
      }
      const ordered = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (const expected of ordered) {
        const part = session.parts.get(expected.partNumber);
        if (!part || part.etag !== expected.etag) {
          throw new Error("InvalidPart");
        }
        chunks.push(part.body);
        total += part.body.byteLength;
      }
      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      writeTestObject(input.key, body, session.contentType);
      multipartSessions().delete(input.uploadId);
    },

    async abortMultipartUpload(input) {
      const session = multipartSessions().get(input.uploadId);
      if (session && session.key === input.key) {
        multipartSessions().delete(input.uploadId);
      }
    },
  };
}
