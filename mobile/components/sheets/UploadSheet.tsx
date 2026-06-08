import { useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CatBadge, Pts } from "@/components/ui/primitives";
import { SheetHeader, CaptureStep, DoneStep } from "@/components/sheets/SheetParts";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import { hapticSuccess } from "@/lib/haptics";
import { pickProofImage, takeProofPhoto, uploadProof } from "@/lib/upload";

export interface UploadTask {
  taskId: Id<"tasks">;
  name: string;
  category: string;
  points: number;
  groupName: string;
  completionId?: Id<"completions"> | null;
}

interface Props {
  task: UploadTask | null;
  onClose: () => void;
  onDone: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  picking: "Selecting…",
  compressing: "Compressing…",
  uploading: "Uploading…",
  verifying: "Verifying…",
};

// Per-task "Add Your Receipt": claim the task if needed, then upload the proof.
export function UploadSheet({ task, onClose, onDone }: Props) {
  const c = useThemeColors();
  const convex = useConvex();
  const claim = useMutation(api.completions.claim);
  const last = useRef<UploadTask | null>(task);
  if (task) last.current = task;
  const t = task ?? last.current;

  const [step, setStep] = useState<"capture" | "done">("capture");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setStep("capture");
    setBusy(false);
    setPhase(null);
    setErr(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const capture = async (source: "camera" | "library") => {
    if (!t) return;
    setErr(null);
    const asset = source === "camera" ? await takeProofPhoto() : await pickProofImage();
    if (!asset) return;

    setBusy(true);
    let completionId = t.completionId ?? null;
    if (!completionId) {
      setPhase("Claiming…");
      try {
        const r = await claim({ taskId: t.taskId });
        if (r.ok) completionId = r.completionId;
        else if (r.existingCompletionId) completionId = r.existingCompletionId;
        else {
          setErr(r.error ?? "Could not claim task");
          setBusy(false);
          setPhase(null);
          return;
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not claim task");
        setBusy(false);
        setPhase(null);
        return;
      }
    }

    if (!completionId) {
      setErr("Could not claim task");
      setBusy(false);
      setPhase(null);
      return;
    }
    const res = await uploadProof(convex, completionId, asset, (p) => setPhase(PHASE_LABEL[p] ?? null));
    setBusy(false);
    setPhase(null);
    if (res.ok) {
      hapticSuccess();
      setStep("done");
    } else {
      setErr(res.error);
    }
  };

  return (
    <BottomSheet visible={task != null} onClose={close}>
      <SheetHeader
        eyebrow={step === "done" ? "Verified" : "Upload proof"}
        title={step === "done" ? "Receipt logged" : (t?.name ?? "")}
        onClose={close}
      />
      {t && step === "capture" && (
        <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8 }}>
          <View style={s.metaRow}>
            <CatBadge cat={t.category} />
            <Text style={[s.dot, { color: c.mutedDim }]}> · </Text>
            <Pts value={t.points} size={12} />
          </View>
          <View style={{ marginTop: 18 }}>
            <CaptureStep
              label={t.category}
              ptsLabel={`Take photo · +${t.points}`}
              onPick={capture}
              busy={busy}
              phase={phase}
            />
          </View>
          {err && <Text style={[s.err, { color: c.cap }]}>{err}</Text>}
        </View>
      )}
      {t && step === "done" && (
        <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8 }}>
          <DoneStep
            title="Receipt logged"
            sub={`+${t.points} added to your week in ${t.groupName}.`}
            onClose={() => {
              reset();
              onDone();
            }}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center" },
  dot: { fontFamily: fonts.mono, fontSize: 11 },
  err: { fontFamily: fonts.mono, fontSize: 12, marginTop: 14, textAlign: "center" },
});
