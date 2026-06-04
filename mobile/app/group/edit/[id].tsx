import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";
import {
  TASK_TEMPLATES,
  type TaskTemplate,
} from "@/lib/task-templates";

// ── Reset mode helpers ─────────────────────────────────────────────────

type ResetMode = "weekly" | "monthly" | "custom" | "fixed";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CATEGORIES = ["MORNING", "MOVE", "FUEL", "MIND", "REST"] as const;
const FREQUENCIES = ["DAILY", "WEEKLY"] as const;
const PROOFS = ["PHOTO", "SCREENSHOT", "VIDEO"] as const;

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

// ── Main Screen ────────────────────────────────────────────────────────

export default function GroupEditScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;

  const today = useQuery(api.groups.todayView, { groupId });
  const updateSettings = useMutation(api.groups.updateSettings);
  const leaveGroup = useMutation(api.groups.leave);
  const createTask = useMutation(api.tasks.create);
  const removeTask = useMutation(api.tasks.remove);
  const inviteByUsername = useMutation(api.groups.inviteByUsername);

  const [toast, setToast] = useState<ToastValue>(null);

  // ── Settings form state ───────────────────────────────────────────────
  const [name, setName] = useState("");
  const [resetMode, setResetMode] = useState<ResetMode>("weekly");
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [customDays, setCustomDays] = useState("30");
  const [stakeKind, setStakeKind] = useState<"PENALTY" | "REWARD" | null>(null);
  const [stakeText, setStakeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── Invite state ──────────────────────────────────────────────────────
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);

  // ── Add task state ────────────────────────────────────────────────────
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskCategory, setTaskCategory] = useState<typeof CATEGORIES[number]>("MOVE");
  const [taskPoints, setTaskPoints] = useState("25");
  const [taskFrequency, setTaskFrequency] = useState<typeof FREQUENCIES[number]>("DAILY");
  const [taskProof, setTaskProof] = useState<typeof PROOFS[number]>("PHOTO");
  const [addingTask, setAddingTask] = useState(false);

  // ── Initialize from server data ──────────────────────────────────────
  useEffect(() => {
    if (!today || initialized) return;
    const g = today.group;
    setName(g.name);
    setStakeKind(g.stakeKind ?? null);
    setStakeText(g.stakeText ?? "");

    if (g.cadence === "monthly") {
      setResetMode("monthly");
      setMonthDay(g.anchorDayOfMonth ?? 1);
    } else if (g.durationDays === 7) {
      setResetMode("weekly");
      if (g.anchorDate) {
        setWeekday(new Date(g.anchorDate).getUTCDay());
      }
    } else if (g.repeat === false) {
      setResetMode("fixed");
    } else if (g.durationDays) {
      setResetMode("custom");
      setCustomDays(String(g.durationDays));
    }
    setInitialized(true);
  }, [today, initialized]);

  // ── Save settings ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const reset = buildResetConfig();
      const result = await updateSettings({
        groupId,
        name: name.trim(),
        ...reset,
        stakeKind: stakeKind ?? undefined,
        stakeText: stakeText.trim() || undefined,
      });
      if (result.ok) {
        setToast({ message: "Settings saved", tone: "success" });
      } else {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
    setSaving(false);
  };

  const buildResetConfig = () => {
    switch (resetMode) {
      case "weekly":
        return { durationDays: 7, repeat: true, anchorDate: nextWeekday(weekday) };
      case "monthly":
        return { cadence: "monthly" as const, anchorDayOfMonth: monthDay, anchorDate: utcMidnight(new Date()) };
      case "custom":
        return { durationDays: Math.max(1, Math.min(365, parseInt(customDays) || 7)), repeat: true, anchorDate: utcMidnight(new Date()) };
      case "fixed":
        return { durationDays: Math.max(1, parseInt(customDays) || 30), repeat: false, anchorDate: utcMidnight(new Date()) };
    }
  };

  // ── Invite by username ────────────────────────────────────────────────
  const handleInvite = async () => {
    const u = inviteUsername.trim().replace(/^@/, "").toLowerCase();
    if (u.length < 2 || inviting) return;
    setInviting(true);
    try {
      const result = await inviteByUsername({ groupId, username: u });
      if (result.ok) {
        setToast({ message: `Invited ${result.displayName}`, tone: "success" });
        setInviteUsername("");
      } else {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
    setInviting(false);
  };

  // ── Add task ──────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!taskName.trim() || addingTask) return;
    setAddingTask(true);
    try {
      const result = await createTask({
        groupId,
        name: taskName.trim(),
        description: taskDesc.trim() || undefined,
        category: taskCategory,
        points: Math.max(1, Math.min(200, parseInt(taskPoints) || 10)),
        frequency: taskFrequency,
        proof: taskProof,
      });
      if (result.ok) {
        setToast({ message: "Task added", tone: "success" });
        setTaskName("");
        setTaskDesc("");
        setTaskPoints("25");
        setShowAddTask(false);
      } else {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
    setAddingTask(false);
  };

  // ── Remove task ───────────────────────────────────────────────────────
  const handleRemoveTask = (taskId: Id<"tasks">, taskNameStr: string) => {
    Alert.alert(
      `Remove "${taskNameStr}"?`,
      "This deletes the task and all its history (completions, proof photos, comments, caps). This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await removeTask({ taskId });
              if (result.ok) {
                setToast({ message: "Task removed", tone: "success" });
              } else {
                setToast({ message: result.error, tone: "error" });
              }
            } catch (e) {
              setToast({ message: errorMessage(e), tone: "error" });
            }
          },
        },
      ],
    );
  };

  // ── Leave group ───────────────────────────────────────────────────────
  const handleLeave = () => {
    const isAdmin = today?.isAdmin;
    Alert.alert(
      `Leave ${today?.group.name ?? "this group"}?`,
      isAdmin
        ? "You're the admin. If others remain, admin transfers to the longest member. All your standings and completions will be deleted."
        : "Your standings, completions, and history in this group will be deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAdmin ? "Leave anyway" : "Leave group",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveGroup({ groupId });
              router.replace("/groups");
            } catch (e) {
              setToast({ message: errorMessage(e), tone: "error" });
            }
          },
        },
      ],
    );
  };

  // ── Pre-fill from template ────────────────────────────────────────────
  const fillFromTemplate = (t: TaskTemplate) => {
    setTaskName(t.name);
    setTaskDesc(t.description ?? "");
    setTaskCategory(t.category);
    setTaskPoints(String(t.points));
    setTaskFrequency(t.frequency);
    setTaskProof(t.proof);
  };

  // ── Loading ───────────────────────────────────────────────────────────
  if (!today) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={s.eyebrow}>Group settings</Text>
            <Text style={s.title}>
              Edit<Text style={{ color: colors.accent }}>.</Text>
            </Text>
          </View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* GROUP NAME                                                  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <View style={s.field}>
            <Text style={s.label}>Group name</Text>
            <TextInput
              style={s.textInput}
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder="Group name"
              placeholderTextColor={colors.mist}
            />
            <Text style={s.charCount}>{name.length}/40</Text>
          </View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* RESET PERIOD                                                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <View style={s.field}>
            <Text style={s.label}>Reset period</Text>
            <View style={s.modeTabs}>
              {(["weekly", "monthly", "custom", "fixed"] as ResetMode[]).map((mode) => {
                const active = resetMode === mode;
                return (
                  <AnimatedPressable
                    key={mode}
                    scaleDown={0.92}
                    style={[s.modeTab, { backgroundColor: active ? colors.ink : colors.paper3 }]}
                    onPress={() => setResetMode(mode)}
                  >
                    <Text style={[s.modeTabText, { color: active ? colors.paper : colors.smoke }]}>
                      {mode === "fixed" ? "fixed end" : mode}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {resetMode === "weekly" && (
              <View style={s.resetDetail}>
                <Text style={s.hint}>Resets every week on:</Text>
                <View style={s.weekdayRow}>
                  {WEEKDAYS.map((d, i) => {
                    const active = weekday === i;
                    return (
                      <AnimatedPressable
                        key={i}
                        scaleDown={0.92}
                        style={[s.weekdayBtn, { backgroundColor: active ? colors.accent : colors.paper3 }]}
                        onPress={() => setWeekday(i)}
                      >
                        <Text style={[s.weekdayText, { color: active ? colors.paper : colors.smoke }]}>{d}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            )}
            {resetMode === "monthly" && (
              <View style={s.resetDetail}>
                <Text style={s.hint}>Resets monthly on day:</Text>
                <View style={s.inlineRow}>
                  <TextInput
                    style={s.numberInput}
                    value={String(monthDay)}
                    onChangeText={(t) => setMonthDay(Math.max(1, Math.min(31, parseInt(t) || 1)))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={s.hint}>of each month</Text>
                </View>
              </View>
            )}
            {(resetMode === "custom" || resetMode === "fixed") && (
              <View style={s.resetDetail}>
                <Text style={s.hint}>{resetMode === "custom" ? "Resets every:" : "Duration:"}</Text>
                <View style={s.inlineRow}>
                  <TextInput
                    style={s.numberInput}
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={s.hint}>days</Text>
                </View>
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STAKES                                                      */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <View style={s.field}>
            <View style={s.fieldHeader}>
              <Text style={s.label}>Stakes</Text>
              <Text style={s.hintSmall}>Optional</Text>
            </View>
            <View style={s.stakeToggle}>
              <AnimatedPressable
                scaleDown={0.92}
                style={[s.stakeBtn, { backgroundColor: stakeKind === "PENALTY" ? colors.capSoft : colors.paper3, borderColor: stakeKind === "PENALTY" ? colors.cap : colors.rule }]}
                onPress={() => setStakeKind(stakeKind === "PENALTY" ? null : "PENALTY")}
              >
                <Text style={s.stakeIcon}>⚡</Text>
                <Text style={[s.stakeBtnText, { color: stakeKind === "PENALTY" ? colors.cap : colors.smoke }]}>Penalty</Text>
              </AnimatedPressable>
              <AnimatedPressable
                scaleDown={0.92}
                style={[s.stakeBtn, { backgroundColor: stakeKind === "REWARD" ? colors.accentSoft : colors.paper3, borderColor: stakeKind === "REWARD" ? colors.accent : colors.rule }]}
                onPress={() => setStakeKind(stakeKind === "REWARD" ? null : "REWARD")}
              >
                <Text style={s.stakeIcon}>🏆</Text>
                <Text style={[s.stakeBtnText, { color: stakeKind === "REWARD" ? colors.accent : colors.smoke }]}>Reward</Text>
              </AnimatedPressable>
            </View>
            {stakeKind && (
              <View style={{ marginTop: 10 }}>
                <TextInput
                  style={s.stakeInput}
                  value={stakeText}
                  onChangeText={setStakeText}
                  placeholder={stakeKind === "PENALTY" ? "Loser buys coffee for the group" : "Winner picks next week's workout"}
                  placeholderTextColor={colors.mist}
                  maxLength={140}
                  multiline
                />
                <Text style={s.charCount}>{stakeText.length}/140</Text>
              </View>
            )}
          </View>

          {/* Save button */}
          <Pressable
            style={({ pressed }) => [s.saveBtn, { backgroundColor: saving ? colors.paper3 : pressed ? colors.accent : colors.ink }]}
            onPress={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.paper} />
            ) : (
              <Text style={[s.saveBtnText, { color: colors.paper }]}>Save settings</Text>
            )}
          </Pressable>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* INVITE BY USERNAME                                          */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <View style={[s.field, { marginTop: 36 }]}>
            <Text style={s.sectionTitle}>
              Invite<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <View style={s.inviteRow}>
              <TextInput
                style={s.inviteInput}
                value={inviteUsername}
                onChangeText={setInviteUsername}
                placeholder="@username"
                placeholderTextColor={colors.mist}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleInvite}
              />
              <AnimatedPressable
                scaleDown={0.92}
                style={[s.inviteBtn, { backgroundColor: inviteUsername.replace(/^@/, "").trim().length >= 2 ? colors.accent : colors.paper3 }]}
                onPress={handleInvite}
                disabled={inviteUsername.replace(/^@/, "").trim().length < 2 || inviting}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color={colors.paper} />
                ) : (
                  <Text style={[s.inviteBtnText, { color: inviteUsername.replace(/^@/, "").trim().length >= 2 ? colors.paper : colors.mist }]}>Invite</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TASKS                                                       */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <View style={[s.field, { marginTop: 20 }]}>
            <View style={s.fieldHeader}>
              <Text style={s.sectionTitle}>
                Tasks<Text style={{ color: colors.accent }}>.</Text>
              </Text>
              <AnimatedPressable scaleDown={0.92} onPress={() => setShowAddTask(!showAddTask)}>
                <Text style={[s.headerLink, showAddTask && { color: colors.accent }]}>
                  {showAddTask ? "cancel" : "+ add"}
                </Text>
              </AnimatedPressable>
            </View>

            {/* Add task form */}
            {showAddTask && (
              <View style={s.addTaskForm}>
                {/* Template picker */}
                <Text style={s.miniLabel}>Quick fill from template</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.templateScroll}>
                  {TASK_TEMPLATES.map((t) => (
                    <AnimatedPressable key={t.id} scaleDown={0.92} style={s.templateChip} onPress={() => fillFromTemplate(t)}>
                      <Text style={s.templateChipText}>{t.label}</Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>

                {/* Name */}
                <Text style={s.miniLabel}>Task name</Text>
                <TextInput
                  style={s.smallInput}
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholder="e.g. Workout session"
                  placeholderTextColor={colors.mist}
                  maxLength={60}
                />

                {/* Description */}
                <Text style={s.miniLabel}>Description (optional)</Text>
                <TextInput
                  style={s.smallInput}
                  value={taskDesc}
                  onChangeText={setTaskDesc}
                  placeholder="What counts as proof?"
                  placeholderTextColor={colors.mist}
                  maxLength={120}
                />

                {/* Category */}
                <Text style={s.miniLabel}>Category</Text>
                <View style={s.chipRow}>
                  {CATEGORIES.map((c) => (
                    <AnimatedPressable
                      key={c}
                      scaleDown={0.92}
                      style={[s.chip, taskCategory === c && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                      onPress={() => setTaskCategory(c)}
                    >
                      <Text style={[s.chipText, taskCategory === c && { color: colors.accent }]}>{c.toLowerCase()}</Text>
                    </AnimatedPressable>
                  ))}
                </View>

                {/* Points + Frequency */}
                <View style={s.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Points</Text>
                    <TextInput
                      style={s.smallInput}
                      value={taskPoints}
                      onChangeText={setTaskPoints}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniLabel}>Frequency</Text>
                    <View style={s.chipRow}>
                      {FREQUENCIES.map((f) => (
                        <AnimatedPressable
                          key={f}
                          scaleDown={0.92}
                          style={[s.chip, taskFrequency === f && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                          onPress={() => setTaskFrequency(f)}
                        >
                          <Text style={[s.chipText, taskFrequency === f && { color: colors.accent }]}>{f.toLowerCase()}</Text>
                        </AnimatedPressable>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Proof type */}
                <Text style={s.miniLabel}>Proof type</Text>
                <View style={s.chipRow}>
                  {PROOFS.map((p) => (
                    <AnimatedPressable
                      key={p}
                      scaleDown={0.92}
                      style={[s.chip, taskProof === p && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                      onPress={() => setTaskProof(p)}
                    >
                      <Text style={[s.chipText, taskProof === p && { color: colors.accent }]}>{p.toLowerCase()}</Text>
                    </AnimatedPressable>
                  ))}
                </View>

                {/* Add button */}
                <AnimatedPressable
                  scaleDown={0.97}
                  style={[s.addTaskBtn, { backgroundColor: taskName.trim() ? colors.accent : colors.paper3 }]}
                  onPress={handleAddTask}
                  disabled={!taskName.trim() || addingTask}
                >
                  {addingTask ? (
                    <ActivityIndicator size="small" color={colors.paper} />
                  ) : (
                    <Text style={[s.addTaskBtnText, { color: taskName.trim() ? colors.paper : colors.mist }]}>Add task</Text>
                  )}
                </AnimatedPressable>
              </View>
            )}

            {/* Current tasks list */}
            <View style={s.taskList}>
              {today.slate.map((task) => (
                <View key={task._id} style={s.taskRow}>
                  <View style={s.taskInfo}>
                    <Text style={s.taskCategory}>{task.category.toLowerCase()}</Text>
                    <Text style={s.taskName}>{task.name}</Text>
                  </View>
                  <Text style={s.taskPts}>+{task.points}</Text>
                  <AnimatedPressable scaleDown={0.92} haptic="medium" onPress={() => handleRemoveTask(task._id, task.name)} hitSlop={8}>
                    <Text style={s.removeBtn}>✕</Text>
                  </AnimatedPressable>
                </View>
              ))}
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* DANGER ZONE                                                 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <View style={s.dangerZone}>
            <Text style={s.dangerLabel}>Danger zone</Text>
            <AnimatedPressable scaleDown={0.92} haptic="medium" style={s.dangerBtn} onPress={handleLeave}>
              <Text style={s.dangerBtnText}>Leave group</Text>
            </AnimatedPressable>
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
    safe: { flex: 1, backgroundColor: colors.paper },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { fontFamily: fonts.mono, fontSize: 11, color: colors.fog, letterSpacing: 1.5, textTransform: "uppercase" },
    scroll: { paddingHorizontal: 24, paddingBottom: 60 },

    // Header
    headerBar: { paddingTop: 8, paddingBottom: 4 },
    backBtn: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.smoke, letterSpacing: 1.1, textTransform: "uppercase" },
    pageHead: { gap: 6, paddingVertical: 16, marginBottom: 8 },
    eyebrow: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog },
    title: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 48, color: colors.ink, letterSpacing: -1 },

    // Fields
    field: { marginBottom: 24 },
    fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    label: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog, marginBottom: 8 },
    hintSmall: { fontFamily: fonts.mono, fontSize: 10, color: colors.mist, letterSpacing: 0.5 },
    hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.fog },
    textInput: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 24, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.rule, paddingVertical: 12, letterSpacing: -0.3 },
    charCount: { fontFamily: fonts.mono, fontSize: 9, color: colors.mist, textAlign: "right", marginTop: 4 },
    sectionTitle: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 28, color: colors.ink, letterSpacing: -0.3 },
    headerLink: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.smoke, letterSpacing: 1.1, textTransform: "uppercase" },

    // Reset period
    modeTabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
    modeTab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.pill },
    modeTabText: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 0.1 },
    resetDetail: { gap: 8 },
    weekdayRow: { flexDirection: "row", gap: 6 },
    weekdayBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, alignItems: "center" },
    weekdayText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 0.5 },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    numberInput: { fontFamily: fonts.monoMedium, fontSize: 18, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.rule, paddingVertical: 8, width: 60, textAlign: "center" },

    // Stakes
    stakeToggle: { flexDirection: "row", gap: 8 },
    stakeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderWidth: 1, borderRadius: radii.md },
    stakeIcon: { fontSize: 16 },
    stakeBtnText: { fontFamily: fonts.sansMedium, fontSize: 13 },
    stakeInput: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, borderWidth: 1, borderColor: colors.rule, borderRadius: radii.md, padding: 12, minHeight: 60, textAlignVertical: "top" },

    // Save
    saveBtn: { paddingVertical: 14, borderRadius: radii.pill, alignItems: "center", marginBottom: 8 },
    saveBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 14, letterSpacing: 0.1 },

    // Invite
    inviteRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    inviteInput: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 15, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.rule, paddingVertical: 10, letterSpacing: 0.5 },
    inviteBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: radii.md, justifyContent: "center", alignItems: "center" },
    inviteBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 13 },

    // Add task
    addTaskForm: { gap: 12, padding: 14, borderWidth: 1, borderColor: colors.rule, borderRadius: radii.md, marginBottom: 12 },
    miniLabel: { fontFamily: fonts.monoMedium, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: colors.fog },
    smallInput: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.rule, paddingVertical: 8 },
    templateScroll: { marginVertical: 4 },
    templateChip: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.paper3, borderRadius: radii.pill, marginRight: 6 },
    templateChipText: { fontFamily: fonts.mono, fontSize: 10, color: colors.smoke, letterSpacing: 0.3 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.rule, borderRadius: radii.pill },
    chipText: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.smoke, letterSpacing: 0.5 },
    twoCol: { flexDirection: "row", gap: 16 },
    addTaskBtn: { paddingVertical: 10, borderRadius: radii.pill, alignItems: "center" },
    addTaskBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 13 },

    // Task list
    taskList: { borderWidth: 1, borderColor: colors.rule, borderRadius: radii.md, overflow: "hidden" },
    taskRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.rule, gap: 8 },
    taskInfo: { flex: 1, gap: 1 },
    taskCategory: { fontFamily: fonts.monoMedium, fontSize: 9, color: colors.mist, letterSpacing: 1, textTransform: "uppercase" },
    taskName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
    taskPts: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.accent },
    removeBtn: { fontFamily: fonts.sans, fontSize: 16, color: colors.cap, paddingHorizontal: 4 },

    // Danger zone
    dangerZone: { marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.rule, gap: 12 },
    dangerLabel: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.cap },
    dangerBtn: { paddingVertical: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.cap, alignItems: "center" },
    dangerBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.cap },
  });
