import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import { hapticLight, hapticMedium } from "@/lib/haptics";

// ── Types ──────────────────────────────────────────────────────────────

type ReactionKind = "HEART" | "FIRE" | "EYES";

interface Reaction {
  kind: ReactionKind;
  count: number;
  byYou: boolean;
}

interface Comment {
  _id: Id<"comments">;
  authorUserId: Id<"users">;
  authorName: string;
  isYou: boolean;
  body: string;
  createdAt: number;
}

interface AiVerification {
  status: "PENDING" | "PASSED" | "INCONCLUSIVE" | "FAILED" | "ERROR" | "SKIPPED";
  confidence: number | null;
  reasoning: string | null;
  flags: string[];
}

export interface FeedCardItem {
  completionId: Id<"completions">;
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isYou: boolean;
  groupId: Id<"groups">;
  groupName: string;
  taskName: string;
  taskCategory: string;
  points: number;
  verifiedAt: number;
  claimedAt: number;
  revokedAt: number | null;
  proofUrl: string | null;
  hasR2Proof: boolean;
  reactions: Reaction[];
  challengeCount: number;
  challengedByYou: boolean;
  comments: Comment[];
  aiVerification: AiVerification | null;
}

interface Props {
  item: FeedCardItem;
  signedUrl?: string;
  onUserPress?: (userId: Id<"users">) => void;
  onGroupPress?: (groupId: Id<"groups">) => void;
}

const REACTION_EMOJI: Record<ReactionKind, string> = {
  HEART: "\u2764\uFE0F",
  FIRE: "\uD83D\uDD25",
  EYES: "\uD83D\uDC40",
};

const CATEGORY_TAG: Record<string, string> = {
  MORNING: "morning",
  MOVE: "move",
  FUEL: "fuel",
  MIND: "mind",
  REST: "rest",
};

const AI_LABELS: Record<string, { symbol: string; label: string }> = {
  PASSED: { symbol: "\u2713", label: "Verified" },
  FAILED: { symbol: "\u2717", label: "Failed" },
  INCONCLUSIVE: { symbol: "?", label: "Unclear" },
  ERROR: { symbol: "!", label: "Error" },
  PENDING: { symbol: "\u2026", label: "Checking" },
};

// ── Component ──────────────────────────────────────────────────────────

export function FeedCard({ item, signedUrl, onUserPress, onGroupPress }: Props) {
  const colors = useThemeColors();
  const s = styles(colors);
  const toggleLike = useMutation(api.likes.toggle);
  const toggleChallenge = useMutation(api.challenges.toggle);
  const addComment = useMutation(api.comments.add);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [showAiDetail, setShowAiDetail] = useState(false);

  const imageUrl = signedUrl ?? item.proofUrl;
  const isRevoked = item.revokedAt != null;

  const handleReaction = async (kind: ReactionKind) => {
    hapticLight();
    try {
      await toggleLike({ completionId: item.completionId, kind });
    } catch {}
  };

  const handleCap = async () => {
    hapticMedium();
    try {
      await toggleChallenge({ completionId: item.completionId });
    } catch {}
  };

  const handleSendComment = async () => {
    const body = commentText.trim();
    if (!body || sendingComment) return;
    setSendingComment(true);
    try {
      await addComment({ completionId: item.completionId, body });
      setCommentText("");
    } catch {}
    setSendingComment(false);
  };

  return (
    <View style={[s.card, isRevoked && s.cardRevoked]}>
      {/* Revoked banner */}
      {isRevoked && (
        <View style={s.revokedBanner}>
          <Text style={s.revokedText}>REVOKED</Text>
          <Text style={s.revokedSub}>{item.challengeCount} cap{item.challengeCount !== 1 ? "s" : ""} called</Text>
        </View>
      )}

      {/* Header: avatar + name + group + time */}
      <View style={s.header}>
        <AnimatedPressable
          scaleDown={0.95}
          style={s.avatar}
          onPress={() => onUserPress?.(item.userId)}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={s.avatarImg} transition={150} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarLetter}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </AnimatedPressable>
        <View style={s.headerText}>
          <View style={s.headerLine}>
            <AnimatedPressable scaleDown={0.95} onPress={() => onUserPress?.(item.userId)}>
              <Text style={s.nameText}>
                {item.isYou ? "You" : item.displayName}
              </Text>
            </AnimatedPressable>
            <Text style={s.metaText}> in </Text>
            <AnimatedPressable scaleDown={0.95} onPress={() => onGroupPress?.(item.groupId)}>
              <Text style={s.groupText}>{item.groupName}</Text>
            </AnimatedPressable>
          </View>
          <View style={s.headerLine}>
            <Text style={s.categoryTag}>
              {CATEGORY_TAG[item.taskCategory] ?? item.taskCategory.toLowerCase()}
            </Text>
            <Text style={s.metaText}> · {timeAgo(item.verifiedAt)}</Text>
          </View>
        </View>
      </View>

      {/* Proof image */}
      {imageUrl && (
        <View style={s.imageWrap}>
          <Image
            source={{ uri: imageUrl }}
            style={s.proofImage}
            contentFit="cover"
            transition={300}
            placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
          />
        </View>
      )}

      {/* Task name + points + AI badge */}
      <View style={s.taskRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.taskName}>{item.taskName}</Text>
        </View>
        <View style={s.taskRight}>
          {item.aiVerification &&
            item.aiVerification.status !== "SKIPPED" && (
              <AnimatedPressable scaleDown={0.92} onPress={() => setShowAiDetail(!showAiDetail)}>
                <AiBadge status={item.aiVerification.status} colors={colors} />
              </AnimatedPressable>
            )}
          <Text style={s.pointsText}>+{item.points}</Text>
        </View>
      </View>

      {/* AI detail popover */}
      {showAiDetail && item.aiVerification && (
        <View style={s.aiDetail}>
          <Text style={s.aiDetailTitle}>
            {AI_LABELS[item.aiVerification.status]?.label ?? item.aiVerification.status}
          </Text>
          {item.aiVerification.confidence != null && (
            <Text style={s.aiDetailMeta}>
              {Math.round(item.aiVerification.confidence * 100)}% confidence
            </Text>
          )}
          {item.aiVerification.reasoning && (
            <Text style={s.aiDetailReasoning}>{item.aiVerification.reasoning}</Text>
          )}
          {item.aiVerification.flags.length > 0 && (
            <View style={s.aiFlags}>
              {item.aiVerification.flags.map((f, i) => (
                <Text key={i} style={s.aiFlag}>{f}</Text>
              ))}
            </View>
          )}
          <Text style={s.aiFooter}>AI signal · humans still decide</Text>
        </View>
      )}

      {/* Reactions row */}
      <View style={s.reactionsRow}>
        <View style={s.reactionsLeft}>
          {(["HEART", "FIRE", "EYES"] as ReactionKind[]).map((kind) => {
            const r = item.reactions.find((rx) => rx.kind === kind);
            const count = r?.count ?? 0;
            const byYou = r?.byYou ?? false;
            return (
              <AnimatedPressable
                key={kind}
                scaleDown={0.92}
                style={[s.reactionBtn, byYou && s.reactionActive]}
                onPress={() => handleReaction(kind)}
              >
                <Text style={s.reactionEmoji}>{REACTION_EMOJI[kind]}</Text>
                {count > 0 && (
                  <Text style={[s.reactionCount, byYou && s.reactionCountActive]}>
                    {count}
                  </Text>
                )}
              </AnimatedPressable>
            );
          })}
        </View>
        <View style={s.reactionsRight}>
          {/* Comments toggle */}
          <AnimatedPressable
            scaleDown={0.92}
            style={s.actionBtn}
            onPress={() => setShowComments(!showComments)}
          >
            <Text style={s.actionIcon}>💬</Text>
            {item.comments.length > 0 && (
              <Text style={s.actionCount}>{item.comments.length}</Text>
            )}
          </AnimatedPressable>
          {/* Cap/challenge */}
          <AnimatedPressable scaleDown={0.92} haptic="medium" style={s.actionBtn} onPress={handleCap}>
            <Text style={[s.actionIcon, item.challengedByYou && { opacity: 1 }]}>
              🚩
            </Text>
            {item.challengeCount > 0 && (
              <Text style={[s.actionCount, item.challengedByYou && s.capActive]}>
                {item.challengeCount}
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>

      {/* Comments section */}
      {showComments && (
        <View style={s.commentsSection}>
          {item.comments.map((c) => (
            <View key={c._id} style={s.commentRow}>
              <Text style={s.commentAuthor}>
                {c.isYou ? "You" : c.authorName}
              </Text>
              <Text style={s.commentBody}>{c.body}</Text>
              <Text style={s.commentTime}>{timeAgo(c.createdAt)}</Text>
            </View>
          ))}
          <View style={s.commentInput}>
            <TextInput
              style={s.commentTextInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.mist}
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            {sendingComment ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <AnimatedPressable scaleDown={0.92} onPress={handleSendComment} disabled={!commentText.trim()}>
                <Text
                  style={[
                    s.sendBtn,
                    { color: commentText.trim() ? colors.accent : colors.mist },
                  ]}
                >
                  Send
                </Text>
              </AnimatedPressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── AI Badge ───────────────────────────────────────────────────────────

function AiBadge({
  status,
  colors,
}: {
  status: string;
  colors: Colors;
}) {
  const info = AI_LABELS[status];
  if (!info) return null;

  const color =
    status === "PASSED"
      ? colors.accent
      : status === "FAILED"
        ? colors.cap
        : colors.fog;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          color,
          letterSpacing: 0.5,
        }}
      >
        AI {info.symbol}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 16,
      gap: 12,
    },
    cardRevoked: {
      opacity: 0.6,
    },
    revokedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.capSoft,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
    },
    revokedText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      color: colors.cap,
    },
    revokedSub: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.cap,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: "hidden",
    },
    avatarImg: {
      width: 36,
      height: 36,
    },
    avatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: colors.smoke,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    headerLine: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    nameText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      color: colors.ink,
    },
    metaText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
    },
    groupText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.accent,
    },
    categoryTag: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1,
      color: colors.fog,
      textTransform: "uppercase",
    },

    // Proof image
    imageWrap: {
      borderRadius: radii.md,
      overflow: "hidden",
    },
    proofImage: {
      width: "100%",
      aspectRatio: 4 / 3,
      backgroundColor: colors.paper3,
    },

    // Task row
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    taskName: {
      fontFamily: fonts.serif,
      fontSize: 20,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    taskRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pointsText: {
      fontFamily: fonts.monoMedium,
      fontSize: 12,
      color: colors.accent,
      letterSpacing: 0.5,
    },

    // AI detail
    aiDetail: {
      backgroundColor: colors.paper2,
      borderRadius: radii.md,
      padding: 12,
      gap: 6,
    },
    aiDetailTitle: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      color: colors.ink,
    },
    aiDetailMeta: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
    },
    aiDetailReasoning: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.smoke,
      lineHeight: 19,
    },
    aiFlags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    aiFlag: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.fog,
      backgroundColor: colors.paper3,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radii.pill,
      overflow: "hidden",
    },
    aiFooter: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 0.5,
      marginTop: 2,
    },

    // Reactions
    reactionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    reactionsLeft: {
      flexDirection: "row",
      gap: 4,
    },
    reactionsRight: {
      flexDirection: "row",
      gap: 8,
    },
    reactionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.paper2,
    },
    reactionActive: {
      backgroundColor: colors.accentSoft,
    },
    reactionEmoji: {
      fontSize: 14,
    },
    reactionCount: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.fog,
    },
    reactionCountActive: {
      color: colors.accent,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      padding: 4,
    },
    actionIcon: {
      fontSize: 14,
      opacity: 0.7,
    },
    actionCount: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.fog,
    },
    capActive: {
      color: colors.cap,
    },

    // Comments
    commentsSection: {
      gap: 8,
      paddingTop: 4,
    },
    commentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: 6,
    },
    commentAuthor: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      color: colors.ink,
    },
    commentBody: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.smoke,
      flex: 1,
    },
    commentTime: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
    },
    commentInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    commentTextInput: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 8,
    },
    sendBtn: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
  });
