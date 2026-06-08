import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { useSignedProofUrls } from "@/lib/useSignedProofUrls";
import { timeAgo } from "@/lib/timeAgo";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";

const SCREEN_WIDTH = Dimensions.get("window").width;
const REACTION_KINDS = ["HEART", "FIRE", "EYES"] as const;
const REACTION_EMOJI: Record<string, string> = {
  HEART: "\u2764\ufe0f",
  FIRE: "\ud83d\udd25",
  EYES: "\ud83d\udc40",
};

export default function ReceiptDetailScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const completionId = id as Id<"completions">;

  const receipt = useQuery(api.proofs.byCompletionId, { completionId });
  const toggleLike = useMutation(api.likes.toggle);
  const toggleCap = useMutation(api.challenges.toggle);
  const addComment = useMutation(api.comments.add);

  // Signed URL for R2 proof
  const signedUrls = useSignedProofUrls(
    receipt?.hasR2Proof ? [completionId] : [],
  );

  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);

  if (!receipt) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const proofUrl = receipt.proofUrl ?? signedUrls[completionId] ?? null;

  const handleReaction = async (kind: string) => {
    try {
      await toggleLike({ completionId, kind });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const handleCap = async () => {
    try {
      await toggleCap({ completionId });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const handleSubmitComment = async () => {
    const body = commentText.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await addComment({ completionId, body });
      setCommentText("");
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
    setSending(false);
  };

  return (
    <SafeAreaView style={s.safe}>
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
          <Text style={s.eyebrow}>
            Receipt · in {receipt.groupName}
          </Text>
          <Text style={s.title}>
            {receipt.taskName}
            <Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </View>

        {/* Revoked banner */}
        {receipt.revokedAt && (
          <View style={s.revokedBanner}>
            <Text style={s.revokedText}>
              This receipt was revoked (cap upheld)
            </Text>
          </View>
        )}

        {/* Proof image */}
        {proofUrl ? (
          <AnimatedPressable scaleDown={0.92} onPress={() => setLightboxOpen(true)}>
            <Image
              source={{ uri: proofUrl }}
              style={s.proofImage}
              contentFit="cover"
            />
          </AnimatedPressable>
        ) : (
          <View style={[s.proofImage, s.proofPlaceholder]}>
            <Text style={s.proofPlaceholderText}>No proof image</Text>
          </View>
        )}

        {/* Author row */}
        <View style={s.authorRow}>
          {receipt.avatarUrl ? (
            <Image
              source={{ uri: receipt.avatarUrl }}
              style={s.authorAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[s.authorAvatar, s.authorAvatarFallback]}>
              <Text style={s.authorInitial}>
                {receipt.displayName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={s.authorInfo}>
            <AnimatedPressable
              scaleDown={0.95}
              onPress={() => {
                if (!receipt.isYou) router.push(`/u/${receipt.userId}`);
              }}
            >
              <Text style={s.authorName}>
                {receipt.displayName}
                {receipt.isYou && (
                  <Text style={s.youBadge}> (you)</Text>
                )}
              </Text>
            </AnimatedPressable>
            {receipt.username && (
              <Text style={s.authorUsername}>@{receipt.username}</Text>
            )}
          </View>
          <Text style={s.timeLabel}>{timeAgo(receipt.verifiedAt)}</Text>
        </View>

        {/* Task info */}
        <View style={s.taskInfoRow}>
          <View style={s.categoryBadge}>
            <Text style={s.categoryText}>
              {receipt.taskCategory?.toLowerCase()}
            </Text>
          </View>
          {receipt.aiVerification && (
            <View style={s.aiBadge}>
              <Text style={s.aiBadgeText}>AI verified</Text>
            </View>
          )}
          <Text style={s.pointsLabel}>+{receipt.points} pts</Text>
        </View>

        {/* Reactions */}
        <View style={s.reactionsRow}>
          {REACTION_KINDS.map((kind) => {
            const r = receipt.reactions?.find((rx: any) => rx.kind === kind);
            const count = r?.count ?? 0;
            const byYou = r?.byYou ?? false;
            return (
              <AnimatedPressable
                key={kind}
                scaleDown={0.92}
                style={[s.reactionBtn, byYou && s.reactionBtnActive]}
                onPress={() => handleReaction(kind)}
              >
                <Text style={s.reactionEmoji}>{REACTION_EMOJI[kind]}</Text>
                {count > 0 && (
                  <Text
                    style={[s.reactionCount, byYou && s.reactionCountActive]}
                  >
                    {count}
                  </Text>
                )}
              </AnimatedPressable>
            );
          })}

          {/* Cap button */}
          <AnimatedPressable
            scaleDown={0.92}
            haptic="medium"
            style={[
              s.reactionBtn,
              receipt.challengedByYou && s.capBtnActive,
            ]}
            onPress={handleCap}
          >
            <Text style={s.reactionEmoji}>🧢</Text>
            {receipt.challengeCount > 0 && (
              <Text
                style={[
                  s.reactionCount,
                  receipt.challengedByYou && s.capCountActive,
                ]}
              >
                {receipt.challengeCount}
              </Text>
            )}
          </AnimatedPressable>
        </View>

        {/* Comments */}
        <View style={s.commentsSection}>
          <Text style={s.commentsSectionTitle}>
            Comments ({receipt.comments?.length ?? 0})
          </Text>

          {receipt.comments?.map((c: any) => (
            <View key={c._id} style={s.commentRow}>
              <Text style={s.commentAuthor}>
                {c.authorName}
                {c.isYou && <Text style={s.youBadge}> (you)</Text>}
              </Text>
              <Text style={s.commentBody}>{c.body}</Text>
              <Text style={s.commentTime}>{timeAgo(c.createdAt)}</Text>
            </View>
          ))}

          {/* Comment input */}
          <View style={s.commentInput}>
            <TextInput
              style={s.commentTextInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.mist}
              maxLength={240}
              multiline
            />
            <AnimatedPressable
              scaleDown={0.92}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || sending}
            >
              <Text
                style={[
                  s.commentSend,
                  (!commentText.trim() || sending) && { color: colors.mist },
                ]}
              >
                {sending ? "..." : "Send"}
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </ScrollView>

      {/* Lightbox */}
      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}
      >
        <AnimatedPressable
          scaleDown={0.98}
          style={s.lightboxBackdrop}
          onPress={() => setLightboxOpen(false)}
        >
          {proofUrl && (
            <Image
              source={{ uri: proofUrl }}
              style={s.lightboxImage}
              contentFit="contain"
            />
          )}
          <AnimatedPressable
            scaleDown={0.92}
            style={s.lightboxClose}
            onPress={() => setLightboxOpen(false)}
          >
            <Text style={s.lightboxCloseText}>✕</Text>
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    scroll: { paddingHorizontal: 24, paddingBottom: 60 },

    // Header
    headerBar: { paddingTop: 8, paddingBottom: 4 },
    backBtn: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.smoke,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    pageHead: { gap: 6, paddingVertical: 16, marginBottom: 8 },
    eyebrow: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
    },
    title: {
      fontFamily: fonts.serif,
      fontSize: 32,
      color: colors.ink,
      letterSpacing: -0.6,
    },

    // Revoked
    revokedBanner: {
      backgroundColor: colors.capSoft,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      marginBottom: 12,
    },
    revokedText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.cap,
    },

    // Proof
    proofImage: {
      width: "100%",
      height: SCREEN_WIDTH - 48,
      borderRadius: radii.md,
      marginBottom: 16,
    },
    proofPlaceholder: {
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    proofPlaceholderText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 0.5,
    },

    // Author
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    authorAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    authorAvatarFallback: {
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    authorInitial: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: colors.fog,
    },
    authorInfo: { flex: 1, gap: 1 },
    authorName: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.ink,
    },
    authorUsername: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 0.3,
    },
    youBadge: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
    },
    timeLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.5,
    },

    // Task info
    taskInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    categoryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.paper3,
      borderRadius: radii.pill,
    },
    categoryText: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.smoke,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    aiBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
    },
    aiBadgeText: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.accent,
      letterSpacing: 0.5,
    },
    pointsLabel: {
      fontFamily: fonts.monoMedium,
      fontSize: 13,
      color: colors.accent,
      marginLeft: "auto",
    },

    // Reactions
    reactionsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 24,
    },
    reactionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.pill,
    },
    reactionBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    reactionEmoji: { fontSize: 14 },
    reactionCount: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.smoke,
    },
    reactionCountActive: { color: colors.accent },
    capBtnActive: {
      borderColor: colors.cap,
      backgroundColor: colors.capSoft,
    },
    capCountActive: { color: colors.cap },

    // Comments
    commentsSection: { gap: 10 },
    commentsSectionTitle: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    commentRow: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      gap: 2,
    },
    commentAuthor: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.ink,
    },
    commentBody: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.smoke,
      lineHeight: 19,
    },
    commentTime: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 0.5,
      marginTop: 2,
    },

    // Comment input
    commentInput: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 4,
    },
    commentTextInput: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.ink,
      maxHeight: 80,
      paddingVertical: 0,
    },
    commentSend: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      color: colors.accent,
      paddingBottom: 1,
    },

    // Lightbox
    lightboxBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "center",
      alignItems: "center",
    },
    lightboxImage: {
      width: SCREEN_WIDTH - 32,
      height: SCREEN_WIDTH - 32,
      borderRadius: radii.md,
    },
    lightboxClose: {
      position: "absolute",
      top: 60,
      right: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    lightboxCloseText: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: "#fff",
    },
  });
