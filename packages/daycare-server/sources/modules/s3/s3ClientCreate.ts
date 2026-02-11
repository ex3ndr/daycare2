import { S3Client } from "@aws-sdk/client-s3";

type S3ClientCreateInput = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
};

export type DaycareS3Client = S3Client;

export function s3ClientCreate(input: S3ClientCreateInput): DaycareS3Client {
  return new S3Client({
    endpoint: input.endpoint,
    forcePathStyle: input.forcePathStyle,
    region: "us-east-1",
    credentials: {
      accessKeyId: input.accessKey,
      secretAccessKey: input.secretKey
    }
  });
}
