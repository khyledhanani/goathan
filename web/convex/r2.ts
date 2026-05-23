"use node";

import { randomUUID } from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const MAX_PROOF_UPLOAD_BYTES = 1_250_000;
const UPLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const READ_URL_EXPIRES_SECONDS = 10 * 60;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function r2Endpoint(): string {
  const bucketUrl = process.env.R2_BUCKET_URL?.trim();
  if (bucketUrl) return bucketUrl.replace(/\/+$/, "");

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (accountId) return `https://${accountId}.r2.cloudflarestorage.com`;

  throw new Error("R2_BUCKET_URL or R2_ACCOUNT_ID is not configured");
}

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: r2Endpoint(),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function extensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

type GenerateProofUploadResult =
  | { ok: false; error: string }
  | {
      ok: true;
      uploadUrl: string;
      key: string;
      contentType: string;
      maxBytes: number;
    };

type GenerateProofReadUrlsResult = {
  urls: Array<{ completionId: Id<"completions">; url: string }>;
};

export const generateProofUploadUrl = action({
  args: {
    completionId: v.id("completions"),
    contentType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (
    ctx,
    { completionId, contentType, sizeBytes },
  ): Promise<GenerateProofUploadResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const normalizedContentType =
      contentType === "image/jpg" ? "image/jpeg" : contentType;
    if (!ALLOWED_IMAGE_TYPES.has(normalizedContentType)) {
      return {
        ok: false as const,
        error: "Only JPEG, PNG, and WebP images are supported right now",
      };
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_PROOF_UPLOAD_BYTES) {
      return {
        ok: false as const,
        error: "Image is too large. Try a smaller photo.",
      };
    }

    const context: { ok: false; error: string } | { ok: true } =
      await ctx.runQuery(
        internal.completions.getR2ProofUploadContext,
        { completionId: completionId as Id<"completions">, userId },
      );
    if (!context.ok) return context;

    const key = `proofs/${completionId}/${Date.now()}-${randomUUID()}.${extensionForContentType(
      normalizedContentType,
    )}`;
    const command = new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: key,
      ContentType: normalizedContentType,
      CacheControl: "public, max-age=31536000, immutable",
    });
    const uploadUrl = await getSignedUrl(r2Client(), command, {
      expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
    });

    return {
      ok: true as const,
      uploadUrl,
      key,
      contentType: normalizedContentType,
      maxBytes: MAX_PROOF_UPLOAD_BYTES,
    };
  },
});

export const generateBasketProofUploadUrl = action({
  args: {
    contentType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (
    ctx,
    { contentType, sizeBytes },
  ): Promise<GenerateProofUploadResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const normalizedContentType =
      contentType === "image/jpg" ? "image/jpeg" : contentType;
    if (!ALLOWED_IMAGE_TYPES.has(normalizedContentType)) {
      return {
        ok: false as const,
        error: "Only JPEG, PNG, and WebP images are supported right now",
      };
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_PROOF_UPLOAD_BYTES) {
      return {
        ok: false as const,
        error: "Image is too large. Try a smaller photo.",
      };
    }

    const key = `proofs/shared/${userId}/${Date.now()}-${randomUUID()}.${extensionForContentType(
      normalizedContentType,
    )}`;
    const command = new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: key,
      ContentType: normalizedContentType,
      CacheControl: "public, max-age=31536000, immutable",
    });
    const uploadUrl = await getSignedUrl(r2Client(), command, {
      expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
    });

    return {
      ok: true as const,
      uploadUrl,
      key,
      contentType: normalizedContentType,
      maxBytes: MAX_PROOF_UPLOAD_BYTES,
    };
  },
});

export const generateProofReadUrls = action({
  args: {
    completionIds: v.array(v.id("completions")),
  },
  handler: async (
    ctx,
    { completionIds },
  ): Promise<GenerateProofReadUrlsResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const contexts: Array<{
      completionId: Id<"completions">;
      key: string;
      contentType?: string;
    }> = await ctx.runQuery(internal.completions.getR2ProofReadContexts, {
      completionIds,
      userId,
    });
    const client = r2Client();
    const bucket = requiredEnv("R2_BUCKET_NAME");
    const urls = await Promise.all(
      contexts.map(async ({ completionId, key }) => ({
        completionId,
        url: await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: READ_URL_EXPIRES_SECONDS },
        ),
      })),
    );
    return { urls };
  },
});

export const generateInternalProofReadUrl = internalAction({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    if (!key.startsWith("proofs/")) throw new Error("Invalid proof key");
    return await getSignedUrl(
      r2Client(),
      new GetObjectCommand({
        Bucket: requiredEnv("R2_BUCKET_NAME"),
        Key: key,
      }),
      { expiresIn: READ_URL_EXPIRES_SECONDS },
    );
  },
});

export const deleteObject = internalAction({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    if (!key.startsWith("proofs/")) return;
    await r2Client().send(
      new DeleteObjectCommand({
        Bucket: requiredEnv("R2_BUCKET_NAME"),
        Key: key,
      }),
    );
  },
});
