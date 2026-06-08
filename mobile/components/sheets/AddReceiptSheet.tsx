import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Dimensions } from "react-native";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { TitleDot, CatBadge, Pts, AccentBtn } from "@/components/ui/primitives";
import { SheetHeader, CaptureStep, DoneStep } from "@/components/sheets/SheetParts";
import { useBasketSubmit } from "@/components/sheets/useBasketSubmit";
import { usePendingBaskets, type GroupRef } from "@/components/sheets/usePendingBaskets";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import { hapticSuccess } from "@/lib/haptics";

const { height: SCREEN_H } = Dimensions.get("window");

type Step = "pick" | "all" | "capture" | "done";

interface DoneSummary {
  count: number;
  totalPts: number;
  label: string; // task name (single) or "N receipts"
  where: string; // "in {group}" or "across your groups"
}

interface Props {
  visible: boolean;
  groups: GroupRef[];
  onClose: () => void;
  onDone: () => void;
}

// Quick-add: 3 recommended pending tasks (tap → photo), or "Show all pending"
// → an in-sheet multi-select step (NOT a second Modal — stacking native modals
// freezes iOS). One photo logs every selected task via submitProofBasket.
export function AddReceiptSheet({ visible, groups, onClose, onDone }: Props) {
  const c = useThemeColors();
  const { baskets, loaders, loading } = usePendingBaskets(groups, visible);
  const { submit, phase } = useBasketSubmit();

  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<Id<"tasks">[]>([]);
  const [origin, setOrigin] = useState<"pick" | "all">("pick");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<DoneSummary | null>(null);

  const allFlat = baskets.flatMap((b) =>
    b.tasks.map((t) => ({ ...t, groupName: b.groupName })),
  );
  const recs = [...allFlat].sort((a, b) => b.points - a.points).slice(0, 3);
  const selectedTasks = allFlat.filter((t) => selected.includes(t._id));
  const totalPts = selectedTasks.reduce((a, t) => a + t.points, 0);

  const reset = () => {
    setStep("pick");
    setSelected([]);
    setOrigin("pick");
    setErr(null);
    setSummary(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const toggle = (id: Id<"tasks">) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const capture = async (source: "camera" | "library") => {
    if (!selected.length) return;
    setErr(null);
    // snapshot summary before the task list refetches it away
    const snap: DoneSummary =
      selectedTasks.length === 1
        ? {
            count: 1,
            totalPts,
            label: selectedTasks[0].name,
            where: `in ${selectedTasks[0].groupName}`,
          }
        : {
            count: selectedTasks.length,
            totalPts,
            label: `${selectedTasks.length} receipts`,
            where: "across your groups",
          };
    setBusy(true);
    const res = await submit(selected, source);
    setBusy(false);
    if (res.cancelled) return;
    if (res.ok) {
      hapticSuccess();
      setSummary(snap);
      setStep("done");
    } else {
      setErr(res.error ?? "Could not log receipt");
    }
  };

  const title =
    step === "done"
      ? summary && summary.count === 1
        ? "Receipt logged"
        : "Logged"
      : step === "capture"
        ? origin === "pick" && selectedTasks[0]
          ? selectedTasks[0].name
          : "Add a photo"
        : step === "all"
          ? "Due today"
          : "Add a receipt";
  const eyebrow = step === "done" ? "Verified" : step === "all" ? "Pending receipts" : "Quick add";
  const onBack =
    step === "capture"
      ? () => setStep(origin)
      : step === "all"
        ? () => setStep("pick")
        : undefined;

  return (
    <BottomSheet visible={visible} onClose={close}>
      {loaders}
      <SheetHeader eyebrow={eyebrow} title={title} onBack={onBack} onClose={close} />

      {/* ── PICK ── */}
      {step === "pick" && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
          {loading && allFlat.length === 0 ? (
            <Text style={[s.dim, { color: c.mutedDim }]}>Loading…</Text>
          ) : allFlat.length ? (
            <View>
              <Text style={[s.label, { color: c.muted }]}>Recommended</Text>
              <View style={{ gap: 8 }}>
                {recs.map((t) => (
                  <AnimatedPressable
                    key={t._id}
                    scaleDown={0.98}
                    onPress={() => {
                      setSelected([t._id]);
                      setOrigin("pick");
                      setStep("capture");
                    }}
                    style={[s.recRow, { backgroundColor: c.surface, borderColor: c.line }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.recName, { color: c.inkStrong }]} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={[s.recMeta, { color: c.mutedDim }]} numberOfLines={1}>
                        {t.groupName} · {t.category}
                      </Text>
                    </View>
                    <Pts value={t.points} size={13} />
                    <Icon name="chevR" size={18} color={c.mutedDim} />
                  </AnimatedPressable>
                ))}
              </View>
              {allFlat.length > recs.length && (
                <AnimatedPressable
                  scaleDown={0.97}
                  onPress={() => {
                    setSelected([]);
                    setStep("all");
                  }}
                  style={[s.showAll, { borderColor: c.lineStrong }]}
                >
                  <Text style={[s.showAllText, { color: c.ink }]}>Show all pending</Text>
                </AnimatedPressable>
              )}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <TitleDot text="All caught up" size={28} />
              <Text style={[s.dim, { color: c.muted, marginTop: 10, fontSize: 16 }]}>
                Every task is done 🎯
              </Text>
              <View style={{ marginTop: 24, width: "100%" }}>
                <AccentBtn onPress={close}>Done</AccentBtn>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── ALL (multi-select) ── */}
      {step === "all" && (
        <>
          <ScrollView
            style={{ maxHeight: SCREEN_H * 0.5 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {baskets.length === 0 ? (
              <Text style={[s.dim, { color: c.muted }]}>Nothing pending — you're all caught up.</Text>
            ) : (
              baskets.map((g) => {
                const avail = g.tasks.reduce((a, t) => a + t.points, 0);
                return (
                  <View key={g.groupId} style={{ marginBottom: 22 }}>
                    <View style={s.groupHead}>
                      <Text style={[s.label, { color: c.muted, marginBottom: 0 }]}>{g.groupName}</Text>
                      <Text style={[s.groupAvail, { color: c.mutedDim }]}>+{avail} available</Text>
                    </View>
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {g.tasks.map((t) => {
                        const on = selected.includes(t._id);
                        return (
                          <AnimatedPressable
                            key={t._id}
                            scaleDown={0.98}
                            onPress={() => toggle(t._id)}
                            style={[
                              s.taskRow,
                              { backgroundColor: on ? c.accentBg : c.surface, borderColor: on ? c.accent : c.line },
                            ]}
                          >
                            <View
                              style={[
                                s.check,
                                { backgroundColor: on ? c.accent : "transparent", borderColor: on ? c.accent : c.lineStrong },
                              ]}
                            >
                              {on && <Icon name="check" size={16} color={c.onAccent} strokeWidth={2.4} />}
                            </View>
                            <Text style={[s.taskName, { color: c.inkStrong }]} numberOfLines={1}>
                              {t.name}
                            </Text>
                            <CatBadge cat={t.category} />
                            <Pts value={t.points} size={12} />
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={[s.footer, { backgroundColor: c.surface, borderTopColor: c.line }]}>
            <AccentBtn
              disabled={!selected.length}
              onPress={() => {
                setOrigin("all");
                setStep("capture");
              }}
            >
              {selected.length ? `Continue · ${selected.length} · +${totalPts}` : "Select receipts to log"}
            </AccentBtn>
          </View>
        </>
      )}

      {/* ── CAPTURE ── */}
      {step === "capture" && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
          <CaptureStep
            label={selectedTasks[0]?.category ?? "proof"}
            ptsLabel={`Take photo · +${totalPts}`}
            onPick={capture}
            busy={busy}
            phase={phase}
          />
          {err && <Text style={[s.err, { color: c.cap }]}>{err}</Text>}
        </View>
      )}

      {/* ── DONE ── */}
      {step === "done" && summary && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
          <DoneStep
            title={summary.label}
            sub={`+${summary.totalPts} logged ${summary.where}.`}
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
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 12 },
  recRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  recName: { fontFamily: fonts.serif, fontSize: 21 },
  recMeta: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 },
  showAll: {
    marginTop: 16,
    height: 50,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  showAllText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  groupAvail: { fontFamily: fonts.mono, fontSize: 11 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  taskName: { flex: 1, fontFamily: fonts.serif, fontSize: 21 },
  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 10, borderTopWidth: 1 },
  dim: { fontFamily: fonts.sans, fontSize: 15 },
  err: { fontFamily: fonts.mono, fontSize: 12, marginTop: 14, textAlign: "center" },
});
