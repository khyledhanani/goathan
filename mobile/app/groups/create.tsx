import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";
import {
  GROUP_STARTER_PACKS,
  tasksForStarterPack,
  taskTemplateById,
  type GroupStarterPack,
} from "@/lib/task-templates";

// ── Reset mode types ───────────────────────────────────────────────────

type ResetMode = "weekly" | "monthly" | "custom" | "fixed";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function nextWeekday(day: number): number {
  const now = new Date();
  const current = now.getUTCDay();
  const diff = (day - current + 7) % 7 || 7;
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + diff);
  return utcMidnight(target);
}

// ── Component ──────────────────────────────────────────────────────────

export default function CreateGroupScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const createGroup = useMutation(api.groups.create);

  // Form state
  const [name, setName] = useState("");
  const [selectedPack, setSelectedPack] = useState<GroupStarterPack>(
    GROUP_STARTER_PACKS[0],
  );
  const [resetMode, setResetMode] = useState<ResetMode>("weekly");
  const [weekday, setWeekday] = useState(1); // Monday
  const [monthDay, setMonthDay] = useState(1);
  const [customDays, setCustomDays] = useState("30");
  const [fixedEndDate, setFixedEndDate] = useState("");
  const [stakeKind, setStakeKind] = useState<"PENALTY" | "REWARD" | null>(null);
  const [stakeText, setStakeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);

  // Derived
  const tasks = useMemo(() => tasksForStarterPack(selectedPack), [selectedPack]);
  const totalPoints = useMemo(
    () => tasks.reduce((sum, t) => sum + t.points, 0),
    [tasks],
  );
  const canSubmit = name.trim().length > 0 && !submitting;

  const buildResetConfig = () => {
    switch (resetMode) {
      case "weekly":
        return {
          durationDays: 7,
          repeat: true,
          anchorDate: nextWeekday(weekday),
        };
      case "monthly":
        return {
          cadence: "monthly" as const,
          anchorDayOfMonth: monthDay,
          anchorDate: utcMidnight(new Date()),
        };
      case "custom": {
        const days = Math.max(1, Math.min(365, parseInt(customDays) || 7));
        return {
          durationDays: days,
          repeat: true,
          anchorDate: utcMidnight(new Date()),
        };
      }
      case "fixed": {
        const end = new Date(fixedEndDate);
        const now = new Date();
        const diffMs = end.getTime() - now.getTime();
        const days = Math.max(1, Math.ceil(diffMs / 86_400_000));
        return {
          durationDays: days,
          repeat: false,
          anchorDate: utcMidnight(now),
        };
      }
    }
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const reset = buildResetConfig();
      const result = await createGroup({
        name: name.trim(),
        tasks: tasks.length > 0 ? tasks : undefined,
        ...reset,
        stakeKind: stakeKind ?? undefined,
        stakeText: stakeText.trim() || undefined,
      });
      if (result.ok) {
        setToast({ message: "Group created!", tone: "success" });
        router.replace(`/group/${result.groupId}`);
      } else {
        setToast({ message: result.error, tone: "error" });
        setSubmitting(false);
      }
    } catch (e) {
      setToast({ message: errorMessage(e, "Could not create group."), tone: "error" });
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.headerBar}>
            <AnimatedPressable scaleDown={0.95} onPress={() => router.back()} hitSlop={12}>
              <Text style={s.backBtn}>← back</Text>
            </AnimatedPressable>
          </View>

          <View style={s.pageHead}>
            <Text style={s.eyebrow}>New group</Text>
            <Text style={s.title}>
              Create<Text style={{ color: colors.accent }}>.</Text>
            </Text>
          </View>

          {/* ── Group name ── */}
          <View style={s.field}>
            <Text style={s.label}>Group name</Text>
            <TextInput
              style={s.textInput}
              value={name}
              onChangeText={setName}
              placeholder="The Sunday Crew"
              placeholderTextColor={colors.mist}
              maxLength={40}
              autoFocus
            />
            <Text style={s.charCount}>{name.length}/40</Text>
          </View>

          {/* ── Starter pack ── */}
          <View style={s.field}>
            <Text style={s.label}>Starter pack</Text>
            <View style={s.packGrid}>
              {GROUP_STARTER_PACKS.map((pack) => {
                const active = selectedPack.id === pack.id;
                return (
                  <AnimatedPressable
                    key={pack.id}
                    scaleDown={0.98}
                    style={[
                      s.packCard,
                      {
                        borderColor: active ? colors.accent : colors.rule,
                        backgroundColor: active ? colors.accentSoft : "transparent",
                      },
                    ]}
                    onPress={() => setSelectedPack(pack)}
                  >
                    <Text
                      style={[
                        s.packLabel,
                        { color: active ? colors.accent : colors.ink },
                      ]}
                    >
                      {pack.label}
                    </Text>
                    <Text style={s.packBlurb} numberOfLines={2}>
                      {pack.blurb}
                    </Text>
                    <Text style={s.packCount}>
                      {pack.taskIds.length === 0
                        ? "Blank slate"
                        : `${pack.taskIds.length} tasks`}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          {/* ── Task preview ── */}
          {tasks.length > 0 && (
            <View style={s.field}>
              <View style={s.previewHeader}>
                <Text style={s.label}>Starting slate</Text>
                <Text style={s.previewPoints}>{totalPoints} pts/day max</Text>
              </View>
              <View style={s.taskList}>
                {selectedPack.taskIds.map((id) => {
                  const t = taskTemplateById(id);
                  if (!t) return null;
                  return (
                    <View key={id} style={s.taskRow}>
                      <View style={s.taskInfo}>
                        <Text style={s.taskCategory}>
                          {t.category.toLowerCase()}
                        </Text>
                        <Text style={s.taskName}>{t.name}</Text>
                      </View>
                      <View style={s.taskMeta}>
                        <Text style={s.taskPoints}>+{t.points}</Text>
                        <Text style={s.taskFreq}>
                          {t.frequency === "WEEKLY" ? "wk" : "day"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Reset period ── */}
          <View style={s.field}>
            <Text style={s.label}>Reset period</Text>
            <View style={s.modeTabs}>
              {(["weekly", "monthly", "custom", "fixed"] as ResetMode[]).map(
                (mode) => {
                  const active = resetMode === mode;
                  return (
                    <AnimatedPressable
                      key={mode}
                      scaleDown={0.92}
                      style={[
                        s.modeTab,
                        {
                          backgroundColor: active
                            ? colors.ink
                            : colors.paper3,
                        },
                      ]}
                      onPress={() => setResetMode(mode)}
                    >
                      <Text
                        style={[
                          s.modeTabText,
                          { color: active ? colors.paper : colors.smoke },
                        ]}
                      >
                        {mode === "fixed" ? "fixed end" : mode}
                      </Text>
                    </AnimatedPressable>
                  );
                },
              )}
            </View>

            {/* Conditional fields */}
            {resetMode === "weekly" && (
              <View style={s.resetDetail}>
                <Text style={s.resetHint}>Resets every week on:</Text>
                <View style={s.weekdayRow}>
                  {WEEKDAYS.map((d, i) => {
                    const active = weekday === i;
                    return (
                      <AnimatedPressable
                        key={i}
                        scaleDown={0.92}
                        style={[
                          s.weekdayBtn,
                          {
                            backgroundColor: active
                              ? colors.accent
                              : colors.paper3,
                          },
                        ]}
                        onPress={() => setWeekday(i)}
                      >
                        <Text
                          style={[
                            s.weekdayText,
                            { color: active ? colors.paper : colors.smoke },
                          ]}
                        >
                          {d}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            )}

            {resetMode === "monthly" && (
              <View style={s.resetDetail}>
                <Text style={s.resetHint}>Resets monthly on day:</Text>
                <View style={s.inlineInput}>
                  <TextInput
                    style={s.numberInput}
                    value={String(monthDay)}
                    onChangeText={(t) => {
                      const n = parseInt(t) || 1;
                      setMonthDay(Math.max(1, Math.min(31, n)));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={s.resetHint}>of each month</Text>
                </View>
              </View>
            )}

            {resetMode === "custom" && (
              <View style={s.resetDetail}>
                <Text style={s.resetHint}>Resets every:</Text>
                <View style={s.inlineInput}>
                  <TextInput
                    style={s.numberInput}
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={s.resetHint}>days</Text>
                </View>
              </View>
            )}

            {resetMode === "fixed" && (
              <View style={s.resetDetail}>
                <Text style={s.resetHint}>Ends on (MM/DD/YYYY):</Text>
                <TextInput
                  style={[s.textInput, { fontSize: 16 }]}
                  value={fixedEndDate}
                  onChangeText={setFixedEndDate}
                  placeholder="06/30/2026"
                  placeholderTextColor={colors.mist}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}
          </View>

          {/* ── Stakes ── */}
          <View style={s.field}>
            <View style={s.stakeHeader}>
              <Text style={s.label}>Stakes</Text>
              <Text style={s.hintText}>Optional</Text>
            </View>
            <View style={s.stakeToggle}>
              <AnimatedPressable
                scaleDown={0.92}
                style={[
                  s.stakeBtn,
                  {
                    backgroundColor:
                      stakeKind === "PENALTY" ? colors.capSoft : colors.paper3,
                    borderColor:
                      stakeKind === "PENALTY" ? colors.cap : colors.rule,
                  },
                ]}
                onPress={() =>
                  setStakeKind(stakeKind === "PENALTY" ? null : "PENALTY")
                }
              >
                <Text style={s.stakeIcon}>⚡</Text>
                <Text
                  style={[
                    s.stakeBtnText,
                    {
                      color:
                        stakeKind === "PENALTY" ? colors.cap : colors.smoke,
                    },
                  ]}
                >
                  Penalty
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                scaleDown={0.92}
                style={[
                  s.stakeBtn,
                  {
                    backgroundColor:
                      stakeKind === "REWARD" ? colors.accentSoft : colors.paper3,
                    borderColor:
                      stakeKind === "REWARD" ? colors.accent : colors.rule,
                  },
                ]}
                onPress={() =>
                  setStakeKind(stakeKind === "REWARD" ? null : "REWARD")
                }
              >
                <Text style={s.stakeIcon}>🏆</Text>
                <Text
                  style={[
                    s.stakeBtnText,
                    {
                      color:
                        stakeKind === "REWARD" ? colors.accent : colors.smoke,
                    },
                  ]}
                >
                  Reward
                </Text>
              </AnimatedPressable>
            </View>
            {stakeKind && (
              <View style={{ marginTop: 10 }}>
                <TextInput
                  style={s.stakeInput}
                  value={stakeText}
                  onChangeText={setStakeText}
                  placeholder={
                    stakeKind === "PENALTY"
                      ? "Loser buys coffee for the group"
                      : "Winner picks next week's workout"
                  }
                  placeholderTextColor={colors.mist}
                  maxLength={140}
                  multiline
                />
                <Text style={s.charCount}>{stakeText.length}/140</Text>
              </View>
            )}
          </View>

          {/* ── Submit ── */}
          <View style={s.submitRow}>
            <Pressable
              style={({ pressed }) => [
                s.submitBtn,
                {
                  backgroundColor: !canSubmit
                    ? colors.paper3
                    : pressed
                      ? colors.accent
                      : colors.ink,
                },
              ]}
              onPress={handleCreate}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.paper} />
              ) : (
                <>
                  <Text
                    style={[
                      s.submitText,
                      { color: !canSubmit ? colors.mist : colors.paper },
                    ]}
                  >
                    Create group
                  </Text>
                  <Text
                    style={[
                      s.submitArrow,
                      { color: !canSubmit ? colors.mist : colors.paper },
                    ]}
                  >
                    →
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    scroll: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },

    // Header
    headerBar: {
      paddingTop: 8,
      paddingBottom: 4,
    },
    backBtn: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.smoke,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    pageHead: {
      gap: 6,
      paddingVertical: 16,
      marginBottom: 8,
    },
    eyebrow: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
    },
    title: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 48,
      color: colors.ink,
      letterSpacing: -1,
    },

    // Fields
    field: {
      marginBottom: 28,
    },
    label: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
      marginBottom: 8,
    },
    hintText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.5,
    },
    textInput: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 24,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 12,
      letterSpacing: -0.3,
    },
    charCount: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      textAlign: "right",
      marginTop: 4,
    },

    // Starter packs
    packGrid: {
      gap: 8,
    },
    packCard: {
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 4,
    },
    packLabel: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 20,
      letterSpacing: -0.2,
    },
    packBlurb: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.fog,
      lineHeight: 17,
    },
    packCount: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.5,
      marginTop: 2,
    },

    // Task preview
    previewHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    previewPoints: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.accent,
      letterSpacing: 0.5,
    },
    taskList: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    taskRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    taskInfo: {
      flex: 1,
      gap: 2,
    },
    taskCategory: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    taskName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.ink,
    },
    taskMeta: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    taskPoints: {
      fontFamily: fonts.monoMedium,
      fontSize: 12,
      color: colors.accent,
    },
    taskFreq: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 0.5,
    },

    // Reset period
    modeTabs: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 12,
    },
    modeTab: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
    },
    modeTabText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      letterSpacing: 0.1,
    },
    resetDetail: {
      gap: 8,
    },
    resetHint: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
    },
    weekdayRow: {
      flexDirection: "row",
      gap: 6,
    },
    weekdayBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.sm,
      alignItems: "center",
    },
    weekdayText: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    inlineInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    numberInput: {
      fontFamily: fonts.monoMedium,
      fontSize: 18,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 8,
      width: 60,
      textAlign: "center",
    },

    // Stakes
    stakeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    stakeToggle: {
      flexDirection: "row",
      gap: 8,
    },
    stakeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderWidth: 1,
      borderRadius: radii.md,
    },
    stakeIcon: {
      fontSize: 16,
    },
    stakeBtnText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
    },
    stakeInput: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      padding: 12,
      minHeight: 60,
      textAlignVertical: "top",
    },

    // Submit
    submitRow: {
      paddingTop: 8,
      paddingBottom: 20,
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      borderRadius: radii.pill,
    },
    submitText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 15,
      letterSpacing: 0.1,
    },
    submitArrow: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 18,
    },
  });
