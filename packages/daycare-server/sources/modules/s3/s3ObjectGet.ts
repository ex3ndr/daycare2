import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DaycareS3Client } from "@/modules/s3/s3ClientCreate.js";

type S3ObjectGetInput = {
  client: DaycareS3Client;
  bucket: string;
  key: string;
  expiresInSeconds?: number;
};

export async function s3ObjectGet(input: S3ObjectGetInput): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: input.bucket,
    Key: input.key
  });

  return await getSignedUrl(input.client, command, {
    expiresIn: input.expiresInSeconds ?? 3600
  });
}
