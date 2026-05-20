"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are evaluating a fitness/habit accountability photo for an app called Receipts.
Members upload a proof image and you decide whether it plausibly shows them completing the claimed task.

You are a soft signal, not a judge. Be charitable but not gullible. Common red flags:
stock-image look, screenshot of a screenshot, generic landscape with no relevant subject,
the same photo reused across tasks, large time gap between when the photo was captured
and when the task was claimed, unexpected editing software for a "candid" photo,
icons / logos / vector graphics (not a real photo at all).

Voice for "reasoning": casual, one sentence, all lowercase, no trailing period,
concise (~15 words max). Speak like a friend texting, not a clinical report.
Examples (lowercase, no period):
  "looks like a real gym selfie with weights in frame"
  "this is just a sky, no way to tell if it's morning sunlight"
  "screenshot of the food log with the protein total visible"
  "image was captured 6 days before today so this is probably reused"
  "this is an icon/logo not a real workout photo"

OUTPUT RULES — must follow exactly:
- Reply with raw JSON only.
- No prose preamble. No "Here is the JSON". No markdown code fences.
- The very first character of your reply must be the opening brace.
- Shape:
{"match":boolean,"confidence":number,"reasoning":string,"flags":string[]}`;

type ProofMeta = {
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

function buildUserPrompt(ctx: {
  taskName: string;
  taskDescription: string | null;
  proofType: string;
  claimedAtMs: number;
  proofMeta: ProofMeta | null;
}): string {
  const lines: string[] = [];
  lines.push(`Task: ${ctx.taskName}`);
  if (ctx.taskDescription) lines.push(`Description: ${ctx.taskDescription}`);
  lines.push(`Proof type expected: ${ctx.proofType}`);
  lines.push("");
  lines.push("Context:");
  lines.push(`- Claimed at: ${new Date(ctx.claimedAtMs).toISOString()}`);
  if (ctx.proofMeta) {
    const m = ctx.proofMeta;
    if (m.captureTimeMs !== undefined) {
      const deltaMs = ctx.claimedAtMs - m.captureTimeMs;
      const deltaHrs = Math.round(Math.abs(deltaMs) / 3_600_000);
      const direction = deltaMs >= 0 ? "before claim" : "after claim";
      lines.push(
        `- Photo captured at: ${new Date(m.captureTimeMs).toISOString()} (~${deltaHrs}h ${direction})`,
      );
    } else {
      lines.push("- Photo capture time: not available (no EXIF timestamp)");
    }
    if (m.software) lines.push(`- Software: ${m.software}`);
    if (m.cameraMake || m.cameraModel) {
      lines.push(
        `- Camera: ${[m.cameraMake, m.cameraModel].filter(Boolean).join(" ")}`,
      );
    }
    if (m.lensModel) lines.push(`- Lens: ${m.lensModel}`);
    if (m.width && m.height) {
      lines.push(`- Resolution: ${m.width}x${m.height}`);
    }
    if (m.latitude !== undefined && m.longitude !== undefined) {
      lines.push(
        `- GPS: ${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}`,
      );
    }
  } else {
    lines.push(
      "- Photo metadata: not extracted (camera/screenshot heuristics unavailable)",
    );
  }
  lines.push("");
  lines.push("Image attached.");
  return lines.join("\n");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    match: { type: "boolean" },
    confidence: { type: "number" },
    reasoning: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
  },
  required: ["match", "confidence", "reasoning"],
};

type GeminiResp = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function clip01(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeReasoning(s: unknown): string {
  if (typeof s !== "string") return "";
  let t = s.trim().replace(/\s+/g, " ");
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/[.!?]+\s*$/, "");
  if (t.length > 0) t = t[0].toLowerCase() + t.slice(1);
  if (t.length > 200) t = t.slice(0, 199) + "…";
  return t;
}

const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function parsePermissive(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* */
    }
  }
  throw new Error("no json object in response");
}

function sanitizeFlags(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, 32))
    .filter((x) => x.length > 0)
    .slice(0, 4);
}

export const checkProof = internalAction({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    if (process.env.AI_VERIFY_ENABLED !== "true") return;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.aiVerify.recordError, {
        completionId,
        error: "GEMINI_API_KEY not configured",
      });
      return;
    }

    const claim = await ctx.runMutation(internal.aiVerify.claim, {
      completionId,
    });
    if (!claim.ok) return;

    try {
      const c = await ctx.runQuery(internal.aiVerify.getContext, {
        completionId,
      });
      if (!c) {
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "context not found",
        });
        return;
      }
      const proofUrl =
        c.proofUrl ??
        (c.proofR2Key
          ? await ctx.runAction(internal.r2.generateInternalProofReadUrl, {
              key: c.proofR2Key,
            })
          : null);

      if (!proofUrl) {
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "proof url missing",
        });
        return;
      }
      if (c.revokedAt) {
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "revoked before verification",
        });
        return;
      }
      if (c.frequency === "WEEKLY") {
        await ctx.runMutation(internal.aiVerify.complete, {
          completionId,
          status: "SKIPPED",
          reasoning: "weekly task — verification skipped",
          provider: "gemini",
          model: MODEL,
        });
        return;
      }

      const fullCompletion = await ctx.runQuery(
        internal.aiVerify.getCompletion,
        { completionId },
      );
      if (!fullCompletion) {
        await ctx.runMutation(internal.aiVerify.recordError, {
          completionId,
          error: "completion not found in second lookup",
        });
        return;
      }

      const t0 = Date.now();

      const imgResp = await fetch(proofUrl);
      if (!imgResp.ok) {
        throw new Error(`image fetch ${imgResp.status}`);
      }
      const imgBuf = await imgResp.arrayBuffer();
      const base64 = arrayBufferToBase64(imgBuf);
      const rawMime = (imgResp.headers.get("content-type") ?? "image/jpeg")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!SUPPORTED_MIME.has(rawMime)) {
        const reason = rawMime.includes("svg")
          ? "this is a vector graphic, not a real photo of the task"
          : rawMime.includes("gif")
            ? "this is an animated gif, not a still photo of the task"
            : `this image format (${rawMime}) isn't a typical photo`;
        await ctx.runMutation(internal.aiVerify.complete, {
          completionId,
          status: "FAILED",
          confidence: 0.1,
          reasoning: reason,
          flags: ["unsupported_format"],
          provider: "gemini",
          model: MODEL,
        });
        return;
      }
      const mimeType = rawMime === "image/jpg" ? "image/jpeg" : rawMime;

      const userPrompt = buildUserPrompt({
        taskName: c.taskName,
        taskDescription: c.taskDescription,
        proofType: c.proofType,
        claimedAtMs: fullCompletion.claimedAt,
        proofMeta: fullCompletion.proofMeta ?? null,
      });

      const body = {
        contents: [
          {
            role: "user",
            parts: [
              { text: SYSTEM_PROMPT + "\n\n" + userPrompt },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 400,
          temperature: 0.2,
        },
      };

      const apiResp = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!apiResp.ok) {
        const text = await apiResp.text();
        throw new Error(
          `gemini ${apiResp.status}: ${text.slice(0, 200)}`,
        );
      }
      const json = (await apiResp.json()) as GeminiResp;
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("empty gemini response");

      let parsed: {
        match?: boolean;
        confidence?: number;
        reasoning?: string;
        flags?: string[];
      };
      try {
        parsed = parsePermissive(text) as typeof parsed;
      } catch {
        throw new Error(`gemini bad json: ${text.slice(0, 160)}`);
      }

      const match = parsed.match === true;
      const confidence = clip01(parsed.confidence);
      const reasoning = normalizeReasoning(parsed.reasoning);
      const flags = sanitizeFlags(parsed.flags);

      let status: "PASSED" | "INCONCLUSIVE" | "FAILED";
      if (confidence >= 0.7 && match) status = "PASSED";
      else if (confidence >= 0.7 && !match) status = "FAILED";
      else status = "INCONCLUSIVE";

      const inputTokens = json.usageMetadata?.promptTokenCount;
      const outputTokens = json.usageMetadata?.candidatesTokenCount;
      const cost =
        inputTokens !== undefined && outputTokens !== undefined
          ? (inputTokens / 1_000_000) * 0.1 +
            (outputTokens / 1_000_000) * 0.4
          : undefined;

      await ctx.runMutation(internal.aiVerify.complete, {
        completionId,
        status,
        confidence,
        reasoning,
        flags,
        provider: "gemini",
        model: MODEL,
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      await ctx.runMutation(internal.aiVerify.recordError, {
        completionId,
        error: String(err).slice(0, 200),
      });
    }
  },
});
