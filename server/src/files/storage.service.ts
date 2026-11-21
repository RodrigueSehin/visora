// S3-compatible object storage (AWS S3, R2, MinIO, SeaweedFS; s3rver in local dev/tests).
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { config } from '../config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger('Storage');
  readonly client: S3Client;
  readonly bucket: string;

  constructor() {
    const c = config();
    this.bucket = c.S3_BUCKET;
    this.client = new S3Client({
      region: c.S3_REGION,
      endpoint: c.S3_ENDPOINT,
      forcePathStyle: c.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: c.S3_ACCESS_KEY, secretAccessKey: c.S3_SECRET_KEY },
      // Recent SDKs add CRC checksums via aws-chunked encoding on streamed uploads by default;
      // many S3-compatible stores (MinIO versions, R2, emulators) store that encoding verbatim.
      // We verify integrity ourselves with SHA-256 instead.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /** Development convenience: create the bucket if it does not exist. In production it must pre-exist. */
  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      if (config().NODE_ENV === 'production') throw new Error(`Bucket S3 « ${this.bucket} » inaccessible.`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.log.log(`Bucket ${this.bucket} créé`);
    }
  }

  async putFile(key: string, path: string, size: number, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: contentType }),
    );
  }

  async get(key: string, range?: string): Promise<{ body: Readable; size?: number; contentType?: string }> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }));
    return { body: r.Body as Readable, size: r.ContentLength, contentType: r.ContentType };
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
