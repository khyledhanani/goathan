import React, { useState } from "react";
import {
  FlatList,
  Image,
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
import { CheckIn } from "../../types";

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));

function Avatar({ name, color, size = 30 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, width: size, height: size, borderRadius: radius.sm }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.3 }]}>{getInitials(name)}</Text>
    </View>
  );
}

function FeedCard({ checkIn }: { checkIn: CheckIn }) {
  const { state, selectedGroup, reactToCheckIn, toggleChallenge, addComment } = useApp();
  const [commentText, setCommentText] = useState("");

  const member = selectedGroup?.members.find((m) => m.id === checkIn.memberId);

  const handleComment = () => {
    if (!commentText.trim()) return;
    addComment(checkIn.id, commentText);
    setCommentText("");
  };

  return (
    <View style={styles.card}>
      {/* Photo hero */}
      {checkIn.photoUri ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: checkIn.photoUri }} style={styles.photo} />
          {checkIn.challenged && (
            <View style={styles.challengedBadgeOverlay}>
              <Text style={styles.challengedBadgeText}>CHALLENGED</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.cardBody}>
        {/* Header */}
        <View style={styles.cardHead}>
          <Avatar name={member?.name ?? "?"} color={member?.color ?? "#444"} size={32} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {member?.name ?? "Unknown"} — {checkIn.taskTitle}
            </Text>
            <Text style={styles.cardMeta}>
              {formatDate(checkIn.createdAt)} · {checkIn.points} pts · {checkIn.proofType}
            </Text>
          </View>
          {!checkIn.photoUri && checkIn.challenged && (
            <View style={styles.challengedBadge}>
              <Text style={styles.challengedBadgeText}>CHALLENGED</Text>
            </View>
          )}
        </View>

        {/* Proof text */}
        <View style={[styles.proofBlock, !checkIn.photoUri && styles.proofBlockHero]}>
          <Text style={[styles.proofText, !checkIn.photoUri && styles.proofTextHero]}>
            {checkIn.proofText}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={() => reactToCheckIn(checkIn.id, "fire")}>
            <Text style={styles.actionText}>🔥 {checkIn.reactions.fire}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => reactToCheckIn(checkIn.id, "receipt")}>
            <Text style={styles.actionText}>🧾 {checkIn.reactions.receipt}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => toggleChallenge(checkIn.id)}>
            <Text style={[styles.actionText, checkIn.challenged && { color: colors.danger }]}>
              {checkIn.challenged ? "Clear" : "Challenge"}
            </Text>
          </Pressable>
        </View>

        {/* Comments */}
        {checkIn.comments.length > 0 && (
          <View style={styles.comments}>
            {checkIn.comments.map((c) => {
              const cm = selectedGroup?.members.find((m) => m.id === c.memberId);
              return (
                <Text key={c.id} style={styles.commentText}>
                  <Text style={{ color: colors.white }}>{cm?.name ?? "Member"}: </Text>
                  {c.body}
                </Text>
              );
            })}
          </View>
        )}

        {/* Comment input */}
        <View style={styles.commentRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={colors.muted}
            value={commentText}
            onChangeText={setCommentText}
            onSubmitEditing={handleComment}
            returnKeyType="send"
          />
          <Pressable style={styles.sendBtn} onPress={handleComment}>
            <Text style={styles.sendBtnText}>↑</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { feed, selectedGroup, selectedMember, setSelectedMemberId } = useApp();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{selectedGroup?.name ?? "No Group"}</Text>
          <Text style={styles.headerTitle}>PROOF FEED</Text>
        </View>
        {selectedMember && (
          <View style={styles.memberBadge}>
            <Avatar name={selectedMember.name} color={selectedMember.color} size={28} />
            <Text style={styles.memberName}>{selectedMember.name}</Text>
          </View>
        )}
      </View>

      {/* Member switcher */}
      {selectedGroup && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.memberStrip}
          contentContainerStyle={styles.memberStripContent}
        >
          {selectedGroup.members.map((member) => (
            <Pressable
              key={member.id}
              style={[styles.memberChip, member.id === selectedMember?.id && styles.memberChipActive]}
              onPress={() => setSelectedMemberId(member.id)}
            >
              <Avatar name={member.name} color={member.color} size={24} />
              <Text style={[styles.memberChipText, member.id === selectedMember?.id && styles.memberChipTextActive]}>
                {member.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Feed */}
      {feed.length > 0 ? (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedCard checkIn={item} />}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyText}>NO RECEIPTS YET</Text>
          <Text style={styles.emptySubtext}>Log a task to submit your first proof</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    fontFamily: "Courier New",
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontWeight: "900",
    fontSize: 26,
    color: colors.white,
    letterSpacing: 1,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberName: { color: colors.white, fontWeight: "700", fontSize: 13 },

  memberStrip: {
    maxHeight: 52,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberStripContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  memberChipActive: {
    borderColor: `${colors.accent}55`,
    backgroundColor: colors.accentDim,
  },
  memberChipText: { color: colors.white2, fontSize: 12, fontWeight: "600" },
  memberChipTextActive: { color: colors.accent },

  feedList: { padding: 12, gap: 12 },

  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },

  photoWrap: { position: "relative", aspectRatio: 4 / 3, backgroundColor: colors.surface3 },
  photo: { width: "100%", height: "100%", resizeMode: "cover" },
  challengedBadgeOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
    borderRadius: radius.sm,
  },

  cardBody: { padding: 12, gap: 9 },

  cardHead: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: {
    fontWeight: "800",
    fontSize: 13,
    color: colors.white,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    lineHeight: 18,
  },
  cardMeta: {
    fontFamily: "Courier New",
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  challengedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
    borderRadius: radius.sm,
  },
  challengedBadgeText: {
    fontFamily: "Courier New",
    fontSize: 9,
    fontWeight: "700",
    color: colors.danger,
    letterSpacing: 0.6,
  },

  proofBlock: {
    padding: 9,
    backgroundColor: colors.surface3,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderHi,
    borderRadius: radius.sm,
  },
  proofBlockHero: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    padding: 14,
    minHeight: 70,
    justifyContent: "center",
  },
  proofText: {
    fontFamily: "Courier New",
    fontSize: 11,
    color: colors.white2,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  proofTextHero: { fontSize: 13, color: colors.white, lineHeight: 20 },

  actions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface3,
  },
  actionText: {
    fontFamily: "Courier New",
    fontSize: 11,
    color: colors.white2,
    fontWeight: "700",
  },

  comments: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentText: {
    fontFamily: "Courier New",
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
  },

  commentRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  commentInput: {
    flex: 1,
    height: 36,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    color: colors.white,
    fontFamily: "Courier New",
    fontSize: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { color: colors.bg, fontWeight: "900", fontSize: 16 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontWeight: "900", fontSize: 18, color: colors.muted, letterSpacing: 1.5 },
  emptySubtext: { fontFamily: "Courier New", fontSize: 11, color: colors.faint, textAlign: "center", letterSpacing: 0.4 },

  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "900", letterSpacing: 0.5 },
});
