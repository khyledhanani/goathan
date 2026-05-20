"use client";

import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type ProofRef = {
  completionId: Id<"completions"> | string;
  proofUrl: string | null;
  hasR2Proof?: boolean;
};

type SignedUrlMap = Record<string, string>;

export function useSignedProofUrls(refs: ProofRef[]): SignedUrlMap {
  const generateProofReadUrls = useAction(api.r2.generateProofReadUrls);
  const [urls, setUrls] = useState<SignedUrlMap>({});

  const ids = useMemo(() => {
    const seen = new Set<string>();
    const out: Id<"completions">[] = [];
    for (const ref of refs) {
      if (!ref.hasR2Proof || ref.proofUrl) continue;
      const id = String(ref.completionId);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(ref.completionId as Id<"completions">);
    }
    return out;
  }, [refs]);

  const idsKey = ids.join("|");

  useEffect(() => {
    let cancelled = false;
    const completionIds = idsKey
      ? (idsKey.split("|") as Id<"completions">[])
      : [];
    if (completionIds.length === 0) {
      setUrls({});
      return;
    }
    void generateProofReadUrls({ completionIds })
      .then((result) => {
        if (cancelled) return;
        const next: SignedUrlMap = {};
        for (const item of result.urls) {
          next[String(item.completionId)] = item.url;
        }
        setUrls(next);
      })
      .catch(() => {
        if (!cancelled) setUrls({});
      });
    return () => {
      cancelled = true;
    };
  }, [generateProofReadUrls, idsKey]);

  return urls;
}

export function resolveProofUrl<T extends ProofRef>(
  item: T,
  signedUrls: SignedUrlMap,
): T {
  if (item.proofUrl || !item.hasR2Proof) return item;
  return {
    ...item,
    proofUrl: signedUrls[String(item.completionId)] ?? null,
  };
}
