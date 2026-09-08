/**
 * Storage provider interface — business logic never imports R2 SDK directly.
 */

export type MediaObjectVariant = "original" | "preview" | "thumbnail";

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  contentLength: number;
};

export type SignedUpload = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type SignedDownload = {
  url: string;
  expiresAt: string;
};

export type ObjectMeta = {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
};

export type MultipartPart = {
  partNumber: number;
  etag: string;
  sizeBytes?: number;
};

export type StorageProvider = {
  readonly name: string;
  createSignedUploadUrl(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds?: number;
  }): Promise<SignedUpload>;
  createSignedDownloadUrl(input: {
    key: string;
    expiresInSeconds?: number;
    downloadFilename?: string;
  }): Promise<SignedDownload>;
  headObject(key: string): Promise<ObjectMeta | null>;
  deleteObject(key: string): Promise<void>;
  /** Server-side put (R2 proxy upload path, smoke tests, orphan cleanup helpers). */
  putObject(input: PutObjectInput): Promise<void>;
  getObjectBytes?(key: string): Promise<Uint8Array | null>;
  /** Required: container sniffing depends on it, and a missing one would skip the check. */
  getObjectRange(key: string, start: number, endInclusive: number): Promise<Uint8Array | null>;
  createMultipartUpload(input: { key: string; contentType: string }): Promise<{ uploadId: string }>;
  createSignedPartUploadUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<SignedUpload>;
  listMultipartParts(input: { key: string; uploadId: string }): Promise<MultipartPart[]>;
  completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<void>;
  abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void>;
};
