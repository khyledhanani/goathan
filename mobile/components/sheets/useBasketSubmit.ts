import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { pickProofImage, takeProofPhoto, uploadBasketProof } from "@/lib/upload";

export interface BasketSubmitResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  count: number;
}

const PHASE_LABEL: Record<string, string> = {
  picking: "Selecting…",
  compressing: "Compressing…",
  uploading: "Uploading…",
  verifying: "Saving…",
};

// Compress + upload one photo to R2, then log it against many tasks at once
// (api.completions.submitProofBasket). Powers the center-camera quick add.
export function useBasketSubmit() {
  const convex = useConvex();
  const [phase, setPhase] = useState<string | null>(null);

  const submit = async (
    taskIds: Id<"tasks">[],
    source: "camera" | "library",
  ): Promise<BasketSubmitResult> => {
    if (!taskIds.length) return { ok: false, error: "Pick at least one task", count: 0 };

    const asset = source === "camera" ? await takeProofPhoto() : await pickProofImage();
    if (!asset) return { ok: false, cancelled: true, count: 0 };

    setPhase("Compressing…");
    const up = await uploadBasketProof(convex, asset, (p) => setPhase(PHASE_LABEL[p] ?? null));
    if (!up.ok) {
      setPhase(null);
      return { ok: false, error: up.error, count: 0 };
    }

    setPhase("Saving…");
    try {
      const res = await convex.mutation(api.completions.submitProofBasket, {
        taskIds,
        r2Key: up.proof.r2Key,
        contentType: up.proof.contentType,
        sizeBytes: up.proof.sizeBytes,
        proofMeta: up.proof.proofMeta,
      });
      setPhase(null);
      if (!res.ok) return { ok: false, error: res.error, count: 0 };
      return { ok: true, count: res.completionIds?.length ?? taskIds.length };
    } catch (e) {
      setPhase(null);
      return { ok: false, error: e instanceof Error ? e.message : "Could not save", count: 0 };
    }
  };

  return { submit, phase };
}
