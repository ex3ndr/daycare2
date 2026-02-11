import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { DaycareS3Client } from "@/modules/s3/s3ClientCreate.js";

type S3ObjectPutInput = {
  client: DaycareS3Client;
  bucket: string;
  key: string;
  contentType: string;
  payload: Buffer;
};

export async function s3ObjectPut(input: S3ObjectPutInput): Promise<void> {
  await input.client.send(new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    Body: input.payload,
    ContentType: input.contentType
  }));
}
