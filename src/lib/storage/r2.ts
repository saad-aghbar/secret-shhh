import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  MultipartPart,
  ObjectMeta,
  PutObjectInput,
  SignedDownload,
  SignedUpload,
  StorageProvider,
} from "@/lib/storage/provider";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

const DEFAULT_UPLOAD_TTL = 15 * 60;
const DEFAULT_DOWNLOAD_TTL = 10 * 60;

export function createR2Client(config: R2Config) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    // Avoid signing x-amz-checksum-* that browsers won't send on XHR PUT.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function createR2StorageProvider(config: R2Config): StorageProvider {
  const client = createR2Client(config);
  const bucket = config.bucket;

  return {
    name: "r2",

    async createSignedUploadUrl(input): Promise<SignedUpload> {
      const expiresIn = input.expiresInSeconds ?? DEFAULT_UPLOAD_TTL;
      // Sign Content-Type only. Do not sign Content-Length: browsers treat it as a
      // forbidden XHR header and set it from the body; signing it causes brittle PUTs.
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ContentType: input.contentType,
      });
      const url = await getSignedUrl(client, command, { expiresIn });
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      return {
        url,
        method: "PUT",
        headers: {
          "Content-Type": input.contentType,
        },
        expiresAt,
      };
    },

    async createSignedDownloadUrl(input): Promise<SignedDownload> {
      const expiresIn = input.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL;
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ResponseContentDisposition: input.downloadFilename
          ? `attachment; filename="${sanitizeContentDispositionFilename(input.downloadFilename)}"`
          : undefined,
      });
      const url = await getSignedUrl(client, command, { expiresIn });
      return {
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    },

    async headObject(key: string): Promise<ObjectMeta | null> {
      try {
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        return {
          key,
          size: result.ContentLength ?? 0,
          contentType: result.ContentType,
          etag: result.ETag,
        };
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (name === "NotFound" || name === "NoSuchKey") {
          return null;
        }
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404) {
          return null;
        }
        throw error;
      }
    },

    async deleteObject(key: string): Promise<void> {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    },

    async putObject(input: PutObjectInput): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          ContentLength: input.contentLength,
        }),
      );
    },

    async getObjectBytes(key: string): Promise<Uint8Array | null> {
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        if (!result.Body) return null;
        const bytes = await result.Body.transformToByteArray();
        return bytes;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },

    async getObjectRange(key, start, endInclusive) {
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: `bytes=${start}-${endInclusive}`,
          }),
        );
        if (!result.Body) return null;
        return await result.Body.transformToByteArray();
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },

    async createMultipartUpload(input) {
      const result = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: input.key,
          ContentType: input.contentType,
        }),
      );
      if (!result.UploadId) {
        throw new Error("CreateMultipartUpload did not return UploadId.");
      }
      return { uploadId: result.UploadId };
    },

    async createSignedPartUploadUrl(input): Promise<SignedUpload> {
      const expiresIn = input.expiresInSeconds ?? DEFAULT_UPLOAD_TTL;
      // Sign Content-Type only, matching photo PUTs. Do not sign Content-Length.
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: input.key,
        UploadId: input.uploadId,
        PartNumber: input.partNumber,
        // SDK types omit ContentType; R2 still signs it so the browser PUT matches.
        ContentType: input.contentType,
      } as ConstructorParameters<typeof UploadPartCommand>[0]);
      const url = await getSignedUrl(client, command, { expiresIn });
      return {
        url,
        method: "PUT",
        headers: {
          "Content-Type": input.contentType,
        },
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    },

    async listMultipartParts(input): Promise<MultipartPart[]> {
      const parts: MultipartPart[] = [];
      let partNumberMarker: string | undefined;
      for (;;) {
        const result = await client.send(
          new ListPartsCommand({
            Bucket: bucket,
            Key: input.key,
            UploadId: input.uploadId,
            PartNumberMarker: partNumberMarker,
          }),
        );
        for (const part of result.Parts ?? []) {
          if (!part.PartNumber || !part.ETag) continue;
          parts.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
            sizeBytes: part.Size,
          });
        }
        if (!result.IsTruncated) break;
        partNumberMarker = result.NextPartNumberMarker;
        if (!partNumberMarker) break;
      }
      return parts.sort((a, b) => a.partNumber - b.partNumber);
    },

    async completeMultipartUpload(input) {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: input.key,
          UploadId: input.uploadId,
          MultipartUpload: {
            Parts: input.parts.map((part) => ({
              ETag: part.etag,
              PartNumber: part.partNumber,
            })),
          },
        }),
      );
    },

    async abortMultipartUpload(input) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: input.key,
          UploadId: input.uploadId,
        }),
      );
    },
  };
}

function sanitizeContentDispositionFilename(name: string) {
  return name.replace(/["\\\r\n]/g, "_").slice(0, 180);
}
