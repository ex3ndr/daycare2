# File Image Metadata (thumbhash, width, height)

Add image metadata (thumbhash, width, height) to file uploads and expose in message attachments.

When an image file is uploaded, the server validates it is PNG/JPG/GIF by reading magic bytes, extracts dimensions and generates a thumbhash, then persists this metadata on the FileAsset. The message serializer includes image metadata on attachments that reference a FileAsset. The web client uses thumbhash as a blur placeholder and real dimensions for layout.

- Files involved:
  - `packages/daycare-server/prisma/schema.prisma` (add image columns to FileAsset)
  - `packages/daycare-server/sources/apps/files/fileUploadCommit.ts` (validate image, extract metadata)
  - `packages/daycare-server/sources/apps/files/fileImageMetadataExtract.ts` (new: image validation + metadata extraction)
  - `packages/daycare-server/sources/apps/api/routes/files/fileRoutesRegister.ts` (return image metadata in upload response)
  - `packages/daycare-server/sources/apps/api/routes/messages/messageRoutesRegister.ts` (include image metadata in attachment serialization)
  - `packages/daycare-server/sources/apps/messages/messageSend.ts` (link fileId to attachment, pass image metadata)
  - `packages/daycare-web/app/daycare/types.ts` (add image fields to MessageAttachment)
  - `packages/daycare-web/app/sync/schema.ts` (add image fields to attachment type)
  - `packages/daycare-web/app/components/messages/Attachment.tsx` (use thumbhash + dimensions)
- Related patterns: `fileUploadCommit` for S3+DB transaction, `messageSerialize` for attachment shape, Prisma migrations
- Dependencies: `sharp` (image processing), `thumbhash` (npm package)

- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Task 1: Add image metadata columns to FileAsset

**Files:**
- Modify: `packages/daycare-server/prisma/schema.prisma`

- [x] Add nullable columns to FileAsset model: `imageWidth` (Int?), `imageHeight` (Int?), `imageThumbhash` (String?)
- [x] Create Prisma migration
- [x] Run `prisma generate` to update client types
- [x] Verify migration applies cleanly

## Task 2: Add image validation and metadata extraction

**Files:**
- Create: `packages/daycare-server/sources/apps/files/fileImageMetadataExtract.ts`
- Create: `packages/daycare-server/sources/apps/files/fileImageMetadataExtract.spec.ts`

- [x] Install `sharp` and `thumbhash` as server dependencies
- [x] Create `fileImageMetadataExtract(payload: Buffer, mimeType: string)` that: validates magic bytes match declared MIME type (PNG/JPG/GIF only), extracts width/height via sharp, generates thumbhash by resizing to <=100px and converting to RGBA, returns `{ width, height, thumbhash }` or null for non-image files
- [x] Write tests: valid PNG/JPG/GIF returns metadata, non-image file returns null, mismatched MIME vs magic bytes throws error
- [x] Run test suite

## Task 3: Integrate image metadata into file upload commit

**Files:**
- Modify: `packages/daycare-server/sources/apps/files/fileUploadCommit.ts`
- Modify: `packages/daycare-server/sources/apps/api/routes/files/fileRoutesRegister.ts`

- [x] In `fileUploadCommit`, after hash validation and before S3 upload, call `fileImageMetadataExtract` if mimeType starts with `"image/"`
- [x] If image validation fails (MIME says image but magic bytes disagree), throw 400 VALIDATION_ERROR
- [x] Persist `imageWidth`, `imageHeight`, `imageThumbhash` on the FileAsset record in the commit transaction
- [x] Update `fileRoutesRegister` upload response to include `imageWidth`, `imageHeight`, `imageThumbhash`
- [x] Write/update tests for `fileUploadCommit` with image payloads
- [x] Run test suite

## Task 4: Link fileId on MessageAttachment and include image metadata in serialization

**Files:**
- Modify: `packages/daycare-server/sources/apps/messages/messageSend.ts`
- Modify: `packages/daycare-server/sources/apps/api/routes/messages/messageRoutesRegister.ts`

- [x] In `messageSend`, when attachment URL matches `/api/org/{orgId}/files/{fileId}` pattern, extract fileId and set it on the MessageAttachment record
- [x] Update `messageSerialize` to include file relation (add file to Prisma include), and add `imageWidth`, `imageHeight`, `imageThumbhash` from the linked FileAsset to the attachment response (null when no file or not an image)
- [x] Update `messageSendBodySchema` if needed (no new client fields required — fileId is derived from URL)
- [x] Write/update tests
- [x] Run test suite

## Task 5: Update web client types and Attachment component

**Files:**
- Modify: `packages/daycare-web/app/daycare/types.ts`
- Modify: `packages/daycare-web/app/sync/schema.ts`
- Modify: `packages/daycare-web/app/components/messages/Attachment.tsx`
- Modify: `packages/daycare-web/app/daycare/api/apiClientCreate.ts` (FileAsset type)

- [x] Add `imageWidth`, `imageHeight`, `imageThumbhash` (all nullable) to MessageAttachment type, sync schema attachment shape, and FileAsset API type
- [x] In `Attachment.tsx`, use real dimensions for placeholder aspect ratio instead of hardcoded 16/9, and render thumbhash as CSS background (base64 data URL from thumbhash-to-dataURL) while image loads
- [x] Install `thumbhash` package in `daycare-web` for client-side decoding
- [x] Update any optimistic mutation code that creates attachment objects to include the new nullable fields
- [x] Run typecheck and test suite

## Verification

- [x] Manual test: upload a PNG, JPG, and GIF — verify thumbhash, width, height appear in message response
- [x] Manual test: upload a non-image file — verify no image metadata, no error
- [x] Manual test: upload a file with wrong MIME type (e.g. .exe renamed to .jpg) — verify 400 error
- [x] Run full test suite (`yarn test`)
- [x] Run typecheck (`yarn typecheck`)
