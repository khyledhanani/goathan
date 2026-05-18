export type UploadBody = { body: Blob; contentType: string };

export async function normalizeProofMedia(file: File): Promise<UploadBody> {
  if (!file.type.startsWith("image/")) {
    return { body: file, contentType: file.type };
  }
  if (typeof createImageBitmap !== "function") {
    return { body: file, contentType: file.type };
  }
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { body: file, contentType: file.type };
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return { body: file, contentType: file.type };
    return { body: blob, contentType: "image/jpeg" };
  } catch {
    return { body: file, contentType: file.type };
  }
}
