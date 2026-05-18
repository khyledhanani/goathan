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
    // EXIF unavailable or unparseable — fine, proceed without
  }
  return meta;
}

export async function normalizeProofMedia(file: File): Promise<UploadBody> {
  if (!file.type.startsWith("image/")) {
    return { body: file, contentType: file.type };
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
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { body: file, contentType: file.type, meta };
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return { body: file, contentType: file.type, meta };
    return { body: blob, contentType: "image/jpeg", meta };
  } catch {
    return { body: file, contentType: file.type, meta };
  }
}
