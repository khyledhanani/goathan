import { useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CapSheetContent } from "@/components/sheets/CapSheetContent";
import { hapticMedium } from "@/lib/haptics";
import type { ProofItem } from "@/components/home/types";

// Wraps CapSheetContent + binds api.challenges.toggle (one toggle = call/revoke;
// the backend revokes points once a majority of the group has capped).
export function CapSheet({
  post,
  requiredCalls,
  onClose,
}: {
  post: ProofItem | null;
  requiredCalls: number;
  onClose: () => void;
}) {
  const toggle = useMutation(api.challenges.toggle);
  const last = useRef<ProofItem | null>(post);
  if (post) last.current = post;
  const shown = post ?? last.current;

  const act = async () => {
    if (!shown) return;
    hapticMedium();
    try {
      await toggle({ completionId: shown.completionId });
    } catch {}
    onClose();
  };

  return (
    <BottomSheet visible={post != null} onClose={onClose}>
      {shown && (
        <CapSheetContent
          post={shown}
          requiredCalls={requiredCalls}
          onConfirm={act}
          onRevoke={act}
          onClose={onClose}
        />
      )}
    </BottomSheet>
  );
}
