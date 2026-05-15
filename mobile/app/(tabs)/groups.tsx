import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../../constants/theme";
import { useApp, templates } from "../../store/AppContext";

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));

const daysRemaining = (endIso: string) => {
  const end = new Date(endIso);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
};

function Avatar({ name, color, size = 30 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, width: size, height: size }]}>
      <Text style={{ color: "#fff", fontSize: size * 0.3, fontWeight: "900" }}>{getInitials(name)}</Text>
    </View>
  );
}

export default function GroupsScreen() {
  const {
    state,
    selectedGroup,
    selectedChallenge,
    setSelectedGroupId,
    leaderboard,
    createGroup,
    addMember,
    startChallenge,
  } = useApp();

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [challengeName, setChallengeName] = useState(templates[0].name);
  const [challengeDuration, setChallengeDuration] = useState(String(templates[0].durationDays));
  const [challengeStake, setChallengeStake] = useState(templates[0].stakeHint);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0];

  const handleCreateGroup = () => {
    if (!groupName.trim()) return Alert.alert("Name required");
    const members = groupMembers.split(",").map((s) => s.trim()).filter(Boolean);
    createGroup(groupName.trim(), members);
    setGroupName(""); setGroupMembers("");
    setShowNewGroup(false);
  };

  const handleStartChallenge = () => {
    startChallenge(
      selectedTemplate,
      challengeName.trim() || selectedTemplate.name,
      parseInt(challengeDuration) || selectedTemplate.durationDays,
      challengeStake.trim() || selectedTemplate.stakeHint,
    );
    setShowNewChallenge(false);
    Alert.alert("Challenge started", challengeName || selectedTemplate.name);
  };

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    addMember(newMemberName.trim());
    setNewMemberName("");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>GROUPS</Text>
          <Pressable style={styles.accentBtn} onPress={() => setShowNewGroup(true)}>
            <Text style={styles.accentBtnText}>+ New Group</Text>
          </Pressable>
        </View>

        {/* Group list */}
        <View style={styles.section}>
          {state.groups.map((group) => (
            <Pressable
              key={group.id}
              style={[styles.groupRow, group.id === selectedGroup?.id && styles.groupRowActive]}
              onPress={() => setSelectedGroupId(group.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupName, group.id === selectedGroup?.id && { color: colors.accent }]}>
                  {group.name}
                </Text>
                <Text style={styles.groupMeta}>{group.members.length} members · {group.description}</Text>
              </View>
              <View style={styles.memberStack}>
                {group.members.slice(0, 3).map((m, i) => (
                  <View key={m.id} style={[styles.stackAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }]}>
                    <Avatar name={m.name} color={m.color} size={26} />
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Active challenge */}
        {selectedGroup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ACTIVE CHALLENGE</Text>
              <Pressable style={styles.ghostBtn} onPress={() => setShowNewChallenge(true)}>
                <Text style={styles.ghostBtnText}>+ Start New</Text>
              </Pressable>
            </View>

            {selectedChallenge ? (
              <View style={styles.challengeCard}>
                <Text style={styles.eyebrow}>Active</Text>
                <Text style={styles.challengeTitle}>{selectedChallenge.name}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>TIME LEFT</Text>
                    <Text style={styles.metaValue}>{daysRemaining(selectedChallenge.endDate)}d</Text>
                  </View>
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>ENDS</Text>
                    <Text style={styles.metaValue}>{formatDate(selectedChallenge.endDate)}</Text>
                  </View>
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>STAKES</Text>
                    <Text style={styles.metaValue} numberOfLines={2}>{selectedChallenge.stakeLabel}</Text>
                  </View>
                </View>
                {/* Tasks */}
                <View style={styles.taskList}>
                  {selectedChallenge.tasks.map((task) => (
                    <View key={task.id} style={styles.taskItem}>
                      <Text style={styles.taskDot}>·</Text>
                      <Text style={styles.taskName}>{task.title}</Text>
                      <Text style={styles.taskPts}>{task.points}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Pressable style={styles.emptyChallenge} onPress={() => setShowNewChallenge(true)}>
                <Text style={styles.emptyText}>No active challenge · Tap to start one</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LEADERBOARD</Text>
            <View style={styles.leaderCard}>
              {leaderboard.map((row, i) => (
                <View key={row.member.id} style={[styles.leaderRow, i === 0 && styles.leaderRowFirst, i < leaderboard.length - 1 && styles.leaderRowBorder]}>
                  <Text style={[styles.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Text>
                  <Avatar name={row.member.name} color={row.member.color} size={28} />
                  <View style={{ flex: 1, marginLeft: 9 }}>
                    <Text style={styles.leaderName}>{row.member.name}</Text>
                    <Text style={styles.leaderMeta}>{row.receipts} receipts</Text>
                  </View>
                  <Text style={[styles.leaderPts, i === 0 && { color: colors.gold }]}>{row.points}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add member */}
        {selectedGroup && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADD MEMBER TO {selectedGroup.name.toUpperCase()}</Text>
            <View style={styles.addMemberRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Member name"
                placeholderTextColor={colors.muted}
                value={newMemberName}
                onChangeText={setNewMemberName}
                onSubmitEditing={handleAddMember}
                returnKeyType="done"
              />
              <Pressable style={styles.iconBtn} onPress={handleAddMember}>
                <Text style={styles.iconBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

      </ScrollView>

      {/* New Group Modal */}
      <Modal visible={showNewGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNewGroup(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>NEW GROUP</Text>
            <Pressable onPress={() => setShowNewGroup(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Group name</Text>
            <TextInput style={styles.textInput} placeholder="Flat 4 Lock-In" placeholderTextColor={colors.muted} value={groupName} onChangeText={setGroupName} />
            <Text style={styles.fieldLabel}>Members (comma separated)</Text>
            <TextInput style={styles.textInput} placeholder="Kaya, Dan, Mina" placeholderTextColor={colors.muted} value={groupMembers} onChangeText={setGroupMembers} />
            <Pressable style={styles.logBtn} onPress={handleCreateGroup}>
              <Text style={styles.logBtnText}>CREATE GROUP</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* New Challenge Modal */}
      <Modal visible={showNewChallenge} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNewChallenge(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>NEW CHALLENGE</Text>
            <Pressable onPress={() => setShowNewChallenge(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 14 }}>
            <Text style={styles.fieldLabel}>Template</Text>
            <View style={styles.templateGrid}>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.templateCard, t.id === selectedTemplateId && styles.templateCardActive]}
                  onPress={() => {
                    setSelectedTemplateId(t.id);
                    setChallengeName(t.name);
                    setChallengeDuration(String(t.durationDays));
                    setChallengeStake(t.stakeHint);
                  }}
                >
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateCategory}>{t.category}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Challenge name</Text>
            <TextInput style={styles.textInput} value={challengeName} onChangeText={setChallengeName} />
            <Text style={styles.fieldLabel}>Duration (days)</Text>
            <TextInput style={styles.textInput} value={challengeDuration} onChangeText={setChallengeDuration} keyboardType="number-pad" />
            <Text style={styles.fieldLabel}>Stakes</Text>
            <TextInput style={styles.textInput} value={challengeStake} onChangeText={setChallengeStake} />
            <Pressable style={styles.logBtn} onPress={handleStartChallenge}>
              <Text style={styles.logBtnText}>START CHALLENGE</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 20 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { fontWeight: "900", fontSize: 28, color: colors.white, letterSpacing: 1 },
  accentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  accentBtnText: { fontWeight: "900", fontSize: 12, color: colors.bg, letterSpacing: 0.8 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: {
    fontFamily: "Courier New",
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  ghostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderHi,
  },
  ghostBtnText: { fontFamily: "Courier New", fontSize: 11, color: colors.white2, fontWeight: "700" },

  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  groupRowActive: { borderColor: `${colors.accent}44`, backgroundColor: colors.accentDim },
  groupName: { fontWeight: "800", fontSize: 15, color: colors.white, letterSpacing: 0.3 },
  groupMeta: { fontFamily: "Courier New", fontSize: 10, color: colors.muted, marginTop: 2, letterSpacing: 0.2 },
  memberStack: { flexDirection: "row", alignItems: "center" },
  stackAvatar: { borderWidth: 2, borderColor: colors.surface2, borderRadius: radius.sm },
  avatar: { borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },

  challengeCard: {
    padding: 16,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  eyebrow: {
    fontFamily: "Courier New",
    fontSize: 10,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  challengeTitle: { fontWeight: "900", fontSize: 20, color: colors.white, letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: 8 },
  metaBox: {
    flex: 1,
    padding: 10,
    backgroundColor: colors.surface3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  metaLabel: { fontFamily: "Courier New", fontSize: 9, color: colors.muted, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" },
  metaValue: { fontFamily: "Courier New", fontSize: 12, color: colors.accent, fontWeight: "700" },

  taskList: { gap: 5 },
  taskItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskDot: { color: colors.faint, fontSize: 16, lineHeight: 20 },
  taskName: { flex: 1, fontWeight: "700", fontSize: 13, color: colors.white2 },
  taskPts: { fontFamily: "Courier New", fontSize: 10, color: colors.muted },

  emptyChallenge: {
    padding: 20,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderHi,
    alignItems: "center",
  },
  emptyText: { fontFamily: "Courier New", fontSize: 11, color: colors.muted, letterSpacing: 0.4 },

  leaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: colors.surface2,
  },
  leaderRowFirst: { backgroundColor: colors.goldDim },
  leaderRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rank: { fontWeight: "900", fontSize: 16, color: colors.faint, width: 24, textAlign: "center" },
  leaderName: { fontWeight: "800", fontSize: 14, color: colors.white, letterSpacing: 0.3 },
  leaderMeta: { fontFamily: "Courier New", fontSize: 10, color: colors.muted, marginTop: 1 },
  leaderPts: { fontWeight: "900", fontSize: 20, color: colors.accent },

  addMemberRow: { flexDirection: "row", gap: 8 },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: colors.white,
    fontFamily: "Courier New",
    fontSize: 13,
  },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderHi,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { color: colors.white, fontSize: 20, fontWeight: "700" },
  fieldLabel: {
    fontFamily: "Courier New",
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },

  logBtn: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logBtnText: { fontWeight: "900", fontSize: 15, color: colors.bg, letterSpacing: 1.5 },

  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateCard: {
    flex: 1,
    minWidth: "30%",
    padding: 12,
    backgroundColor: colors.surface3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  templateCardActive: { borderColor: `${colors.accent}55`, backgroundColor: colors.accentDim },
  templateName: { fontWeight: "800", fontSize: 13, color: colors.white, letterSpacing: 0.3 },
  templateCategory: { fontFamily: "Courier New", fontSize: 9, color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase" },

  modal: { flex: 1, backgroundColor: colors.surface2 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontWeight: "900", fontSize: 22, color: colors.white, letterSpacing: 1 },
  modalClose: { fontSize: 18, color: colors.muted, fontWeight: "700" },
  modalBody: { padding: 20, gap: 14 },
});
