import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system/next";
import type { ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// ── Types ──────────────────────────────────────────────────────────────

export interface ProofMeta {
  width?: number;
  height?: number;
  captureTimeMs?: number;
  cameraMake?: string;
  cameraModel?: string;
}

export interface UploadResult {
  ok: true;
  completionId: Id<"completions">;
}

export interface UploadError {
  ok: false;
  error: string;
}

export type UploadOutcome = UploadResult | UploadError;

type ProgressCallback = (phase: "picking" | "compressing" | "uploading" | "verifying") => void;

// ── Constants ──────────────────────────────────────────────────────────

const MAX_BYTES = 1_250_000; // 1.25 MB — R2 limit

const COMPRESS_ATTEMPTS = [
  { width: 1280, quality: 0.78 },
  { width: 1024, quality: 0.72 },
  { width: 900, quality: 0.68 },
  { width: 720, quality: 0.6 },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────

async function getFileSize(uri: string): Promise<number> {
  try {
    const file = new File(uri);
    return file.size ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Upload a local file to a remote URL via XMLHttpRequest.
 * React Native's fetch() can't reliably create blobs from local file URIs,
 * but XHR handles file:// URIs natively.
 */
function xhrUpload(
  url: string,
  fileUri: string,
  contentType: string,
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.onload = () =>
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.send({ uri: fileUri, type: contentType, name: "proof.jpg" } as any);
  });
}

// ── Pick image ─────────────────────────────────────────────────────────

export async function pickProofImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    exif: true,
    allowsEditing: false,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

export async function takeProofPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    exif: true,
    allowsEditing: false,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

// ── Compress ───────────────────────────────────────────────────────────

async function compressImage(
  uri: string,
): Promise<{ uri: string; width: number; height: number; sizeBytes: number }> {
  for (const { width, quality } of COMPRESS_ATTEMPTS) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
      );

      const size = await getFileSize(result.uri);
      console.log(`[UploadLib] Compress attempt w=${width} q=${quality}: ${size} bytes`);
      if (size <= MAX_BYTES) {
        return { uri: result.uri, width: result.width, height: result.height, sizeBytes: size };
      }
    } catch (e) {
      console.warn("[UploadLib] Compress attempt failed:", e);
    }
  }

  // Last resort — aggressively compress
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 640 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
  );
  const size = await getFileSize(result.uri);
  return { uri: result.uri, width: result.width, height: result.height, sizeBytes: size };
}

// ── Extract metadata from picker result ────────────────────────────────

function extractMeta(asset: ImagePicker.ImagePickerAsset): ProofMeta {
  const meta: ProofMeta = {};

  if (asset.width) meta.width = asset.width;
  if (asset.height) meta.height = asset.height;

  const exif = asset.exif;
  if (exif) {
    if (exif.DateTimeOriginal) {
      try {
        meta.captureTimeMs = new Date(exif.DateTimeOriginal).getTime();
      } catch {}
    }
    if (exif.Make) meta.cameraMake = String(exif.Make);
    if (exif.Model) meta.cameraModel = String(exif.Model);
  }

  return meta;
}

// ── Full upload flow ───────────────────────────────────────────────────

// ── Basket upload (shared proof across multiple tasks) ──────────────────

export interface BasketProof {
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  proofMeta: ProofMeta;
}

export type BasketUploadOutcome =
  | { ok: true; proof: BasketProof }
  | { ok: false; error: string };

/**
 * Compress + upload a proof image to R2 WITHOUT binding it to a completion,
 * then return the r2 key/meta to hand to api.completions.submitProofBasket.
 * Powers the center camera quick-add flow (one photo → many tasks).
 */
export async function uploadBasketProof(
  convex: ConvexReactClient,
  asset: ImagePicker.ImagePickerAsset,
  onProgress?: ProgressCallback,
): Promise<BasketUploadOutcome> {
  try {
    onProgress?.("compressing");
    const compressed = await compressImage(asset.uri);
    const contentType = "image/jpeg";
    const sizeBytes = compressed.sizeBytes;
    if (sizeBytes > MAX_BYTES) {
      return { ok: false, error: "Image too large even after compression" };
    }

    onProgress?.("uploading");
    const uploadTarget = await convex.action(api.r2.generateBasketProofUploadUrl, {
      contentType,
      sizeBytes,
    });
    if (!uploadTarget.ok) return { ok: false, error: uploadTarget.error };

    const putRes = await xhrUpload(uploadTarget.uploadUrl, compressed.uri, contentType);
    if (!putRes.ok) {
      return { ok: false, error: `Upload failed (${putRes.status}), try again` };
    }

    const proofMeta = extractMeta(asset);
    proofMeta.width = compressed.width;
    proofMeta.height = compressed.height;

    return {
      ok: true,
      proof: { r2Key: uploadTarget.key, contentType, sizeBytes, proofMeta },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed. Try again.";
    return { ok: false, error: msg };
  }
}

export async function uploadProof(
  convex: ConvexReactClient,
  completionId: Id<"completions">,
  asset: ImagePicker.ImagePickerAsset,
  onProgress?: ProgressCallback,
): Promise<UploadOutcome> {
  try {
    // 1. Compress
    onProgress?.("compressing");
    console.log("[UploadLib] Compressing image:", asset.uri?.slice(0, 60));
    const compressed = await compressImage(asset.uri);
    console.log("[UploadLib] Compressed:", {
      width: compressed.width,
      height: compressed.height,
      sizeBytes: compressed.sizeBytes,
    });

    const contentType = "image/jpeg";
    const sizeBytes = compressed.sizeBytes;

    if (sizeBytes > MAX_BYTES) {
      console.warn("[UploadLib] Image too large after compression:", sizeBytes);
      return { ok: false, error: "Image too large even after compression" };
    }

    // 2. Get signed upload URL
    onProgress?.("uploading");
    console.log("[UploadLib] Requesting signed URL for:", completionId);
    const uploadTarget = await convex.action(api.r2.generateProofUploadUrl, {
      completionId,
      contentType,
      sizeBytes,
    });

    if (!uploadTarget.ok) {
      console.error("[UploadLib] Signed URL failed:", uploadTarget.error);
      return { ok: false, error: uploadTarget.error };
    }
    console.log("[UploadLib] Got signed URL, key:", uploadTarget.key);

    // 3. PUT to R2 via XHR (fetch can't handle local file blobs in RN)
    console.log("[UploadLib] Uploading via XHR:", compressed.uri.slice(0, 60));
    const putRes = await xhrUpload(uploadTarget.uploadUrl, compressed.uri, contentType);

    if (!putRes.ok) {
      console.error("[UploadLib] R2 PUT failed:", putRes.status);
      return { ok: false, error: `Upload failed (${putRes.status}), try again` };
    }
    console.log("[UploadLib] R2 PUT success");

    // 4. Attach proof to completion
    onProgress?.("verifying");
    const proofMeta = extractMeta(asset);
    proofMeta.width = compressed.width;
    proofMeta.height = compressed.height;

    console.log("[UploadLib] Attaching proof:", { completionId, r2Key: uploadTarget.key });
    const attachResult = await convex.mutation(api.completions.attachR2Proof, {
      completionId,
      r2Key: uploadTarget.key,
      contentType,
      sizeBytes,
      proofMeta,
    });

    if (!attachResult.ok) {
      console.error("[UploadLib] Attach failed:", attachResult.error);
      return { ok: false, error: attachResult.error };
    }

    console.log("[UploadLib] Proof attached successfully");
    return { ok: true, completionId };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Upload failed. Try again.";
    console.error("[UploadLib] Exception:", msg, e);
    return { ok: false, error: msg };
  }
}
