import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

type ImageMetadata = {
  width: number;
  height: number;
  thumbhash: string;
};

// PNG: 89 50 4E 47
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
// JPEG: FF D8 FF
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
// GIF87a / GIF89a: 47 49 46 38
const GIF_MAGIC = Buffer.from([0x47, 0x49, 0x46, 0x38]);

const MAGIC_BY_MIME: Record<string, Buffer> = {
  "image/png": PNG_MAGIC,
  "image/jpeg": JPEG_MAGIC,
  "image/jpg": JPEG_MAGIC,
  "image/gif": GIF_MAGIC
};

const SUPPORTED_MIMES = new Set(Object.keys(MAGIC_BY_MIME));

/**
 * Validates an image buffer via magic bytes, extracts dimensions, and generates a thumbhash.
 * Returns null for non-image MIME types. Throws if MIME claims image but magic bytes disagree.
 */
export async function fileImageMetadataExtract(
  payload: Buffer,
  mimeType: string
): Promise<ImageMetadata | null> {
  if (!SUPPORTED_MIMES.has(mimeType)) {
    return null;
  }

  const expectedMagic = MAGIC_BY_MIME[mimeType]!;
  if (payload.length < expectedMagic.length || !payload.subarray(0, expectedMagic.length).equals(expectedMagic)) {
    throw new Error(`File magic bytes do not match declared MIME type ${mimeType}`);
  }

  const metadata = await sharp(payload, { limitInputPixels: 100_000_000 }).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error("Could not determine image dimensions");
  }

  // Resize to fit within 100x100 for thumbhash (maintaining aspect ratio)
  const scale = Math.min(100 / width, 100 / height, 1);
  const thumbWidth = Math.max(1, Math.round(width * scale));
  const thumbHeight = Math.max(1, Math.round(height * scale));

  const { data } = await sharp(payload, { limitInputPixels: 100_000_000 })
    .resize(thumbWidth, thumbHeight, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hash = rgbaToThumbHash(thumbWidth, thumbHeight, data);
  const thumbhash = Buffer.from(hash).toString("base64");

  return { width, height, thumbhash };
}
