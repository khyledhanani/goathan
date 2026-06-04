import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { hapticSuccess } from "@/lib/haptics";

const VERIFY_WINDOW_MS = 15 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────

interface SlateTask {
  _id: Id<"tasks">;
  name: string;
  description?: string;
  category: string;
  points: number;
  frequency: string;
  proof: string;
  claimedThisPeriod: boolean;
  completionId: Id<"completions"> | null;
  claimedAt: number | null;
  verifiedAt: number | null;
  revokedAt: number | null;
  proofUrl: string | null;
  hasR2Proof: boolean;
  aiVerification: {
    status: string;
    confidence: number | null;
    reasoning: string | null;
    flags: string[];
  } | null;
}

type TaskMode = "untouched" | "claimed" | "verified" | "expired";

function getMode(task: SlateTask): TaskMode {
  if (!task.claimedThisPeriod || !task.completionId) return "untouched";
  if (task.verifiedAt) return "verified";
  if (task.claimedAt && Date.now() - task.claimedAt > VERIFY_WINDOW_MS) return "expired";
  return "claimed";
}

interface Props {
  slate: SlateTask[];
  stats: {
    todayPoints: number;
    todayDone: number;
    totalDailyTasks: number;
    isPerfectToday: boolean;
  };
  isAdmin: boolean;
  onUploadProof: (completionId: Id<"completions">, taskName: string) => void;
  onError?: (message: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────

export function TodaySlate({ slate, stats, isAdmin, onUploadProof, onError }: Props) {
  const colors = useThemeColors();
  const s = styles(colors);
  const claim = useMutation(api.completions.claim);
  const unclaim = useMutation(api.completions.unclaim);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const handleClaim = async (taskId: Id<"tasks">, taskName: string) => {
    setLoadingId(taskId);
    try {
      console.log("[Claim] Starting claim for task:", taskName, "id:", taskId);
      const result = await claim({ taskId });
      console.log("[Claim] Result:", JSON.stringify(result));
      if (result.ok && result.completionId) {
        console.log("[Claim] Success — completionId:", result.completionId);
        hapticSuccess();
        onUploadProof(result.completionId, taskName);
      } else if (!result.ok) {
        // If already claimed but not verified, go straight to upload
        if (result.existingCompletionId && !result.existingVerifiedAt) {
          console.log("[Claim] Already claimed, not verified — opening upload for:", result.existingCompletionId);
          onUploadProof(result.existingCompletionId as Id<"completions">, taskName);
        } else if (result.existingCompletionId && result.existingVerifiedAt) {
          console.log("[Claim] Already claimed and verified");
          onError?.("Already verified this period");
        } else {
          console.warn("[Claim] Backend returned error:", result.error);
          onError?.(result.error ?? "Claim failed");
        }
      }
    } catch (e) {
      const msg = errorMessage(e);
      console.error("[Claim] Exception:", msg);
      onError?.(msg);
    }
    setLoadingId(null);
  };

  const handleUnclaim = async (completionId: Id<"completions">) => {
    setLoadingId(completionId);
    try {
      console.log("[Unclaim] Starting unclaim for:", completionId);
      const result = await unclaim({ completionId });
      console.log("[Unclaim] Result:", JSON.stringify(result));
      if (result && !result.ok) {
        console.warn("[Unclaim] Backend returned error:", result.error);
        onError?.(result.error ?? "Unclaim failed");
      }
    } catch (e) {
      const msg = errorMessage(e);
      console.error("[Unclaim] Exception:", msg);
      onError?.(msg);
    }
    setLoadingId(null);
  };

  if (slate.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>
          No tasks yet. An admin needs to add some.
        </Text>
      </View>
    );
  }

  // Debug: log slate state on each render
  useEffect(() => {
    console.log("[TodaySlate] Render with", slate.length, "tasks:");
    for (const t of slate) {
      console.log(`  [${t.name}] claimed=${t.claimedThisPeriod} completionId=${t.completionId} verified=${t.verifiedAt} claimed_at=${t.claimedAt} mode=${getMode(t)}`);
    }
  }, [slate]);

  return (
    <View style={s.container}>
      {slate.map((task, i) => {
        const mode = getMode(task);
        const loading = loadingId != null && (loadingId === task._id || loadingId === task.completionId);
        const remainMs = task.claimedAt
          ? VERIFY_WINDOW_MS - (now - task.claimedAt)
          : 0;
        const remainMin = Math.max(0, Math.ceil(remainMs / 60_000));

        return (
          <View
            key={task._id}
            style={[
              s.row,
              i < slate.length - 1 && s.rowBorder,
              mode === "verified" && s.rowVerified,
            ]}
          >
            {/* Left: status indicator */}
            <View style={s.rowLeft}>
              {mode === "verified" ? (
                <View style={[s.check, { backgroundColor: colors.accent }]}>
                  <Text style={s.checkMark}>✓</Text>
                </View>
              ) : mode === "claimed" ? (
                <View style={[s.check, { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent }]}>
                  <Text style={[s.checkMark, { color: colors.accent, fontSize: 10 }]}>…</Text>
                </View>
              ) : mode === "expired" ? (
                <View style={[s.check, { backgroundColor: colors.capSoft }]}>
                  <Text style={[s.checkMark, { color: colors.cap }]}>✕</Text>
                </View>
              ) : (
                <View style={[s.check, { backgroundColor: colors.paper3 }]} />
              )}
            </View>

            {/* Middle: task info */}
            <View style={s.rowMid}>
              <View style={s.taskNameRow}>
                <Text
                  style={[
                    s.taskName,
                    mode === "verified" && { color: colors.accent },
                    mode === "expired" && { color: colors.cap },
                  ]}
                >
                  {task.name}
                </Text>
                <Text style={s.taskPoints}>+{task.points}</Text>
              </View>

              {mode === "untouched" && (
                <Text style={s.taskMeta}>
                  {task.category.toLowerCase()} · {task.frequency.toLowerCase()} · {task.proof.toLowerCase()}
                </Text>
              )}
              {mode === "claimed" && (
                <Text style={[s.taskMeta, { color: colors.accent }]}>
                  {remainMin}m left to verify
                </Text>
              )}
              {mode === "verified" && (
                <View style={s.verifiedRow}>
                  <Text style={[s.taskMeta, { color: colors.accent }]}>Verified</Text>
                  {task.aiVerification && task.aiVerification.status !== "SKIPPED" && (
                    <Text style={s.aiBadge}>
                      AI {task.aiVerification.status === "PASSED" ? "✓" : task.aiVerification.status === "FAILED" ? "✕" : "?"}
                    </Text>
                  )}
                </View>
              )}
              {mode === "expired" && (
                <Text style={[s.taskMeta, { color: colors.cap }]}>Claim expired</Text>
              )}
            </View>

            {/* Right: action button */}
            <View style={s.rowRight}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : mode === "untouched" ? (
                <AnimatedPressable
                  scaleDown={0.92}
                  haptic="medium"
                  style={s.claimBtn}
                  onPress={() => handleClaim(task._id, task.name)}
                >
                  <Text style={s.claimBtnText}>Claim</Text>
                </AnimatedPressable>
              ) : mode === "claimed" ? (
                <AnimatedPressable
                  scaleDown={0.92}
                  haptic="medium"
                  style={[s.claimBtn, { backgroundColor: colors.accent }]}
                  onPress={() => onUploadProof(task.completionId!, task.name)}
                >
                  <Text style={[s.claimBtnText, { color: colors.paper }]}>Upload</Text>
                </AnimatedPressable>
              ) : mode === "expired" ? (
                <AnimatedPressable
                  scaleDown={0.92}
                  haptic="medium"
                  style={[s.claimBtn, { backgroundColor: colors.capSoft }]}
                  onPress={() => handleUnclaim(task.completionId!)}
                >
                  <Text style={[s.claimBtnText, { color: colors.cap }]}>Unclaim</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    empty: {
      paddingVertical: 32,
      alignItems: "center",
    },
    emptyText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowVerified: {
      backgroundColor: colors.accentSoft + "44",
    },
    rowLeft: {
      width: 24,
      alignItems: "center",
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
    },
    checkMark: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.paper,
    },
    rowMid: {
      flex: 1,
      gap: 2,
    },
    taskNameRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    taskName: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.ink,
      flex: 1,
    },
    taskPoints: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.accent,
    },
    taskMeta: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.5,
    },
    verifiedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    aiBadge: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.fog,
      backgroundColor: colors.paper3,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radii.sm,
      overflow: "hidden",
    },
    rowRight: {
      width: 64,
      alignItems: "flex-end",
    },
    claimBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.paper3,
    },
    claimBtnText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      color: colors.ink,
    },
  });
