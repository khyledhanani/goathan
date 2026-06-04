import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

/**
 * Batch-resolves R2 signed URLs for completions that have R2 proofs.
 * Returns a map from completionId → signed URL string.
 */
export function useSignedProofUrls(
  completionIds: Id<"completions">[],
): Record<string, string> {
  const convex = useConvex();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const inflight = useRef(false);

  const resolve = useCallback(async () => {
    if (completionIds.length === 0 || inflight.current) return;
    inflight.current = true;
    try {
      const result = await convex.action(api.r2.generateProofReadUrls, {
        completionIds,
      });
      const map: Record<string, string> = {};
      for (const { completionId, url } of result.urls) {
        map[completionId] = url;
      }
      setUrls((prev) => ({ ...prev, ...map }));
    } catch {
      // Silently fail — images just won't show
    } finally {
      inflight.current = false;
    }
  }, [completionIds.join(","), convex]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  return urls;
}
