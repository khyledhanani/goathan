import exifr from "exifr";

export type ProofMeta = {
  captureTimeMs?: number;
  software?: string;
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  width?: number;
  height?: number;
  latitude?: number;
  longitude?: number;
};

export type UploadBody = {
  body: Blob;
  contentType: string;
  meta?: ProofMeta;
};

const MAX_UPLOAD_BYTES = 700 * 1024;
const JPEG_ATTEMPTS = [
  { maxEdge: 1280, quality: 0.78 },
  { maxEdge: 1024, quality: 0.72 },
  { maxEdge: 900, quality: 0.68 },
];

const EXIF_PICK = [
  "DateTimeOriginal",
  "DateTimeDigitized",
  "CreateDate",
  "Software",
  "Make",
  "Model",
  "LensModel",
  "ExifImageWidth",
  "ExifImageHeight",
  "PixelXDimension",
  "PixelYDimension",
  "GPSLatitude",
  "GPSLongitude",
  "latitude",
  "longitude",
];

async function extractMeta(file: File): Promise<ProofMeta> {
  const meta: ProofMeta = {};
  try {
    const parsed = await exifr.parse(file, {
      tiff: true,
      ifd0: { pick: EXIF_PICK },
      exif: { pick: EXIF_PICK },
      gps: true,
      reviveValues: true,
      translateValues: true,
    });
    if (parsed) {
      const captureDate =
        parsed.DateTimeOriginal ||
        parsed.DateTimeDigitized ||
        parsed.CreateDate;
      if (captureDate instanceof Date) {
        meta.captureTimeMs = captureDate.getTime();
      } else if (typeof captureDate === "string") {
        const ts = Date.parse(captureDate);
        if (!Number.isNaN(ts)) meta.captureTimeMs = ts;
      } else if (typeof captureDate === "number") {
        meta.captureTimeMs = captureDate;
      }
      if (typeof parsed.Software === "string") meta.software = parsed.Software.trim();
      if (typeof parsed.Make === "string") meta.cameraMake = parsed.Make.trim();
      if (typeof parsed.Model === "string") meta.cameraModel = parsed.Model.trim();
      if (typeof parsed.LensModel === "string") meta.lensModel = parsed.LensModel.trim();
      const w =
        parsed.ExifImageWidth ?? parsed.PixelXDimension ?? parsed.ImageWidth;
      const h =
        parsed.ExifImageHeight ?? parsed.PixelYDimension ?? parsed.ImageHeight;
      if (typeof w === "number") meta.width = w;
      if (typeof h === "number") meta.height = h;
      if (typeof parsed.latitude === "number") meta.latitude = parsed.latitude;
      if (typeof parsed.longitude === "number") meta.longitude = parsed.longitude;
    }
  } catch {
    /* */
  }
  return meta;
}

export async function normalizeProofMedia(file: File): Promise<UploadBody> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image proof uploads are supported right now.");
  }

  const meta = await extractMeta(file);

  if (typeof createImageBitmap !== "function") {
    return { body: file, contentType: file.type, meta };
  }
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    if (meta.width === undefined) meta.width = bitmap.width;
    if (meta.height === undefined) meta.height = bitmap.height;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { body: file, contentType: file.type, meta };
    }

    let blob: Blob | null = null;
    for (const attempt of JPEG_ATTEMPTS) {
      const scale = Math.min(1, attempt.maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", attempt.quality),
      );
      if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    }
    bitmap.close();
    if (!blob) return { body: file, contentType: file.type, meta };
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error("Image is still too large after compression. Try a screenshot or smaller photo.");
    }
    return { body: blob, contentType: "image/jpeg", meta };
  } catch (err) {
    if (err instanceof Error) throw err;
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("Image is too large. Try a screenshot or smaller photo.");
    }
    return { body: file, contentType: file.type, meta };
  }
}
