import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { DaycareS3Client } from "@/modules/s3/s3ClientCreate.js";

type S3ObjectDeleteInput = {
  client: DaycareS3Client;
  bucket: string;
  key: string;
};

export async function s3ObjectDelete(input: S3ObjectDeleteInput): Promise<void> {
  await input.client.send(new DeleteObjectCommand({
    Bucket: input.bucket,
    Key: input.key
  }));
}
