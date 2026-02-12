import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fileImageMetadataExtract } from "./fileImageMetadataExtract.js";

async function createTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } }
  })
    .png()
    .toBuffer();
}

async function createTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 255, b: 0 } }
  })
    .jpeg()
    .toBuffer();
}

async function createTestGif(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } }
  })
    .gif()
    .toBuffer();
}

describe("fileImageMetadataExtract", () => {
  it("extracts metadata from a valid PNG", async () => {
    const png = await createTestPng(200, 100);
    const result = await fileImageMetadataExtract(png, "image/png");

    expect(result).not.toBeNull();
    expect(result!.width).toBe(200);
    expect(result!.height).toBe(100);
    expect(result!.thumbhash).toBeTruthy();
    // thumbhash is base64-encoded
    expect(() => Buffer.from(result!.thumbhash, "base64")).not.toThrow();
  });

  it("extracts metadata from a valid JPEG", async () => {
    const jpeg = await createTestJpeg(150, 300);
    const result = await fileImageMetadataExtract(jpeg, "image/jpeg");

    expect(result).not.toBeNull();
    expect(result!.width).toBe(150);
    expect(result!.height).toBe(300);
    expect(result!.thumbhash).toBeTruthy();
  });

  it("extracts metadata from a valid GIF", async () => {
    const gif = await createTestGif(50, 50);
    const result = await fileImageMetadataExtract(gif, "image/gif");

    expect(result).not.toBeNull();
    expect(result!.width).toBe(50);
    expect(result!.height).toBe(50);
    expect(result!.thumbhash).toBeTruthy();
  });

  it("returns null for non-image MIME types", async () => {
    const textPayload = Buffer.from("hello world");
    const result = await fileImageMetadataExtract(textPayload, "text/plain");
    expect(result).toBeNull();
  });

  it("returns null for unsupported image MIME types", async () => {
    const payload = Buffer.from("some binary data");
    const result = await fileImageMetadataExtract(payload, "image/webp");
    expect(result).toBeNull();
  });

  it("throws when MIME says PNG but magic bytes are JPEG", async () => {
    const jpeg = await createTestJpeg(100, 100);
    await expect(fileImageMetadataExtract(jpeg, "image/png")).rejects.toThrow(
      "File magic bytes do not match declared MIME type image/png"
    );
  });

  it("throws when MIME says JPEG but magic bytes are PNG", async () => {
    const png = await createTestPng(100, 100);
    await expect(fileImageMetadataExtract(png, "image/jpeg")).rejects.toThrow(
      "File magic bytes do not match declared MIME type image/jpeg"
    );
  });

  it("throws when MIME says GIF but payload is random bytes", async () => {
    const randomPayload = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    await expect(fileImageMetadataExtract(randomPayload, "image/gif")).rejects.toThrow(
      "File magic bytes do not match declared MIME type image/gif"
    );
  });

  it("handles small images (1x1)", async () => {
    const png = await createTestPng(1, 1);
    const result = await fileImageMetadataExtract(png, "image/png");

    expect(result).not.toBeNull();
    expect(result!.width).toBe(1);
    expect(result!.height).toBe(1);
    expect(result!.thumbhash).toBeTruthy();
  });

  it("handles images already within 100x100", async () => {
    const png = await createTestPng(80, 60);
    const result = await fileImageMetadataExtract(png, "image/png");

    expect(result).not.toBeNull();
    expect(result!.width).toBe(80);
    expect(result!.height).toBe(60);
    expect(result!.thumbhash).toBeTruthy();
  });
});
