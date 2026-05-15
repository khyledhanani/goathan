import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../../constants/theme";
import { useApp, todayIso } from "../../store/AppContext";
import { ChallengeTask } from "../../types";

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export default function LogScreen() {
  const {
    selectedChallenge,
    selectedMember,
    challengeCheckIns,
    submitCheckIn,
    setSelectedMemberId,
    selectedGroup,
  } = useApp();

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    selectedChallenge?.tasks[0]?.id ?? ""
  );
  const [proofText, setProofText] = useState("");
  const [proofType, setProofType] = useState("photo");

  const activeTask: ChallengeTask | undefined =
    selectedChallenge?.tasks.find((t) => t.id === selectedTaskId) ??
    selectedChallenge?.tasks[0];

  const doneToday = Boolean(
    activeTask &&
      selectedMember &&
      challengeCheckIns.some(
        (ci) =>
          ci.taskId === activeTask.id &&
          ci.memberId === selectedMember.id &&
          ci.date === todayIso()
      )
  );

  const handleLog = () => {
    if (!activeTask) return;
    const error = submitCheckIn(activeTask, proofText, proofType);
    if (error) {
      Alert.alert("Can't log", error);
    } else {
      setProofText("");
      Alert.alert("Logged", `${activeTask.title} receipt submitted.`);
    }
  };

  const daysRemaining = (endIso: string) => {
    const end = new Date(endIso);
    end.setHours(23, 59, 59, 999);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  };

  if (!selectedChallenge) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>NO ACTIVE CHALLENGE</Text>
          <Text style={styles.emptySub}>Start one from the Groups tab</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Log a Receipt</Text>
          <Text style={styles.headerTitle}>{selectedChallenge.name}</Text>
          <Text style={styles.headerMeta}>
            {daysRemaining(selectedChallenge.endDate)} days left · {selectedChallenge.stakeLabel}
          </Text>
        </View>

        {/* Member switcher */}
        {selectedGroup && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Logging as</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
              {selectedGroup.members.map((m) => (
                <Pressable
                  key={m.id}
                  style={[styles.memberChip, m.id === selectedMember?.id && styles.memberChipActive]}
                  onPress={() => setSelectedMemberId(m.id)}
                >
                  <View style={[styles.avatar, { backgroundColor: m.color }]}>
                    <Text style={styles.avatarText}>{getInitials(m.name)}</Text>
                  </View>
                  <Text style={[styles.memberChipText, m.id === selectedMember?.id && { color: colors.accent }]}>
                    {m.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Task selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Task</Text>
          <View style={styles.taskList}>
            {selectedChallenge.tasks.map((task) => {
              const done = challengeCheckIns.some(
                (ci) => ci.taskId === task.id && ci.memberId === selectedMember?.id && ci.date === todayIso()
              );
              const active = task.id === (activeTask?.id ?? selectedChallenge.tasks[0]?.id);
              return (
                <Pressable
                  key={task.id}
                  style={[styles.taskRow, active && styles.taskRowActive, done && styles.taskRowDone]}
                  onPress={() => {
                    setSelectedTaskId(task.id);
                    setProofType(task.proofTypes[0] ?? "photo");
                  }}
                >
                  <Text style={[styles.taskCheck, done && { color: colors.accent }]}>
                    {done ? "✓" : "○"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, done && { color: colors.muted }]}>{task.title}</Text>
                    <Text style={styles.taskMeta}>{task.cadence} · {task.points} pts{task.proofRequired ? " · proof req'd" : ""}</Text>
                  </View>
                  {active && !done && (
                    <View style={styles.activePip} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Proof type */}
        {activeTask && !doneToday && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Proof type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.proofTypeRow}>
              {activeTask.proofTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.proofTypeChip, proofType === type && styles.proofTypeChipActive]}
                  onPress={() => setProofType(type)}
                >
                  <Text style={[styles.proofTypeText, proofType === type && { color: colors.accent }]}>
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Proof note */}
        {activeTask && !doneToday && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Note {activeTask.proofRequired ? "(required)" : "(optional)"}
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Describe your proof..."
              placeholderTextColor={colors.muted}
              value={proofText}
              onChangeText={setProofText}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* Submit */}
        <View style={styles.section}>
          {doneToday ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneIcon}>✓</Text>
              <Text style={styles.doneText}>Already logged today</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.logBtn, pressed && styles.logBtnPressed]}
              onPress={handleLog}
            >
              <Text style={styles.logBtnText}>SUBMIT RECEIPT</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 20 },

  header: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  eyebrow: {
    fontFamily: "Courier New",
    fontSize: 10,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerTitle: { fontWeight: "900", fontSize: 22, color: colors.white, letterSpacing: 0.5 },
  headerMeta: { fontFamily: "Courier New", fontSize: 11, color: colors.muted, letterSpacing: 0.3 },

  section: { gap: 8 },
  sectionLabel: {
    fontFamily: "Courier New",
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },

  memberRow: { gap: 8, flexDirection: "row" },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  memberChipActive: { borderColor: `${colors.accent}55`, backgroundColor: colors.accentDim },
  memberChipText: { color: colors.white2, fontSize: 13, fontWeight: "600" },
  avatar: { width: 24, height: 24, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  taskList: { gap: 6 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskRowActive: { borderColor: `${colors.accent}44`, backgroundColor: colors.accentDim },
  taskRowDone: { opacity: 0.5 },
  taskCheck: { fontFamily: "Courier New", fontSize: 16, color: colors.faint, width: 20 },
  taskTitle: { fontWeight: "700", fontSize: 14, color: colors.white, letterSpacing: 0.3 },
  taskMeta: { fontFamily: "Courier New", fontSize: 10, color: colors.muted, marginTop: 2, letterSpacing: 0.3 },
  activePip: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },

  proofTypeRow: { gap: 8, flexDirection: "row" },
  proofTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  proofTypeChipActive: { borderColor: `${colors.accent}55`, backgroundColor: colors.accentDim },
  proofTypeText: { fontFamily: "Courier New", fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 },

  noteInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.white,
    fontFamily: "Courier New",
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: "top",
  },

  logBtn: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  logBtnPressed: { backgroundColor: colors.accentGlow },
  logBtnText: { fontWeight: "900", fontSize: 16, color: colors.bg, letterSpacing: 1.5 },

  doneBox: {
    height: 52,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  doneIcon: { fontSize: 18, color: colors.accent },
  doneText: { fontFamily: "Courier New", fontWeight: "700", fontSize: 13, color: colors.muted, letterSpacing: 0.8 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontWeight: "900", fontSize: 18, color: colors.muted, letterSpacing: 1.5 },
  emptySub: { fontFamily: "Courier New", fontSize: 12, color: colors.faint, textAlign: "center" },
});
