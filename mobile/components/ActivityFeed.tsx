import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Image } from "expo-image";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";

// ── Types ──────────────────────────────────────────────────────────────

interface Comment {
  _id: Id<"comments">;
  authorUserId: Id<"users">;
  authorName: string;
  isYou: boolean;
  body: string;
  createdAt: number;
}

export interface ActivityItem {
  completionId: Id<"completions">;
  memberUserId: Id<"users">;
  memberDisplayName: string;
  memberAvatarUrl?: string;
  isYou: boolean;
  taskName: string;
  taskCategory: string;
  points: number;
  claimedAt: number;
  verifiedAt: number | null;
  revokedAt: number | null;
  proofUrl: string | null;
  hasR2Proof?: boolean;
  challengeCount: number;
  challengedByYou: boolean;
  comments: Comment[];
  aiVerification: {
    status: string;
    confidence: number | null;
    reasoning: string | null;
    flags: string[];
  } | null;
}

interface Props {
  items: ActivityItem[];
  signedUrls: Record<string, string>;
}

// ── Component ──────────────────────────────────────────────────────────

export function ActivityFeed({ items, signedUrls }: Props) {
  const colors = useThemeColors();
  const s = styles(colors);

  if (items.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>
          Nothing yet. Lock in a task and you'll show up here.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.list}>
      {items.map((item, i) => (
        <ActivityRow
          key={item.completionId}
          item={item}
          signedUrl={signedUrls[item.completionId]}
          isLast={i === items.length - 1}
        />
      ))}
    </View>
  );
}

function ActivityRow({
  item,
  signedUrl,
  isLast,
}: {
  item: ActivityItem;
  signedUrl?: string;
  isLast: boolean;
}) {
  const colors = useThemeColors();
  const s = styles(colors);
  const toggleChallenge = useMutation(api.challenges.toggle);
  const addComment = useMutation(api.comments.add);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const isVerified = item.verifiedAt != null;
  const isExpired =
    !isVerified && Date.now() - item.claimedAt > 15 * 60 * 1000;
  const isRevoked = item.revokedAt != null;
  const imageUrl = signedUrl ?? item.proofUrl;

  const verb = isVerified
    ? "verified"
    : isExpired
      ? "no-showed"
      : "claimed";

  const handleCap = async () => {
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
    <View style={[s.row, !isLast && s.rowBorder]}>
      {/* Header line */}
      <View style={s.rowHeader}>
        {item.memberAvatarUrl ? (
          <Image source={{ uri: item.memberAvatarUrl }} style={s.avatar} transition={150} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarLetter}>
              {item.memberDisplayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={s.rowHeaderText}>
          <Text style={s.headerLine}>
            <Text style={s.memberName}>
              {item.isYou ? "You" : item.memberDisplayName}
            </Text>
            <Text style={s.verb}>
              {" "}
              {verb}{" "}
            </Text>
            <Text
              style={[
                s.taskNameText,
                isExpired && { color: colors.cap },
                isRevoked && { textDecorationLine: "line-through" as const },
              ]}
            >
              {item.taskName}
            </Text>
          </Text>
          <View style={s.metaRow}>
            <Text style={s.metaText}>{timeAgo(item.claimedAt)}</Text>
            {item.challengeCount > 0 && (
              <Text style={[s.metaText, { color: colors.cap }]}>
                {item.challengeCount} cap{item.challengeCount !== 1 ? "s" : ""}
              </Text>
            )}
            {isRevoked && (
              <Text style={[s.metaText, { color: colors.cap }]}>revoked</Text>
            )}
            <Text style={[s.metaText, { color: colors.accent }]}>
              +{item.points}
            </Text>
          </View>
        </View>
      </View>

      {/* Proof thumbnail + cap button */}
      {isVerified && imageUrl && (
        <View style={s.proofRow}>
          <Image source={{ uri: imageUrl }} style={s.proofThumb} contentFit="cover" transition={200} placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }} />
          {!item.isYou && !isRevoked && (
            <AnimatedPressable scaleDown={0.92} haptic="medium" style={s.capBtn} onPress={handleCap}>
              <Text
                style={[
                  s.capBtnText,
                  item.challengedByYou && { color: colors.cap },
                ]}
              >
                {item.challengedByYou ? "Cap called" : "Call cap"}
              </Text>
            </AnimatedPressable>
          )}
        </View>
      )}

      {/* Comments toggle */}
      <AnimatedPressable
        scaleDown={0.92}
        style={s.commentToggle}
        onPress={() => setShowComments(!showComments)}
      >
        <Text style={s.commentToggleText}>
          {item.comments.length > 0
            ? `${item.comments.length} comment${item.comments.length !== 1 ? "s" : ""}`
            : "Comment"}
        </Text>
      </AnimatedPressable>

      {/* Comments section */}
      {showComments && (
        <View style={s.commentsSection}>
          {item.comments.map((c) => (
            <View key={c._id} style={s.commentRow}>
              <Text style={s.commentAuthor}>
                {c.isYou ? "You" : c.authorName}
              </Text>
              <Text style={s.commentBody}>{c.body}</Text>
            </View>
          ))}
          <View style={s.commentInputRow}>
            <TextInput
              style={s.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={
                item.comments.length > 0 ? "Reply..." : "Comment..."
              }
              placeholderTextColor={colors.mist}
              maxLength={240}
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            {sendingComment ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <AnimatedPressable
                scaleDown={0.92}
                onPress={handleSendComment}
                disabled={!commentText.trim()}
              >
                <Text
                  style={{
                    fontFamily: fonts.sansSemiBold,
                    fontSize: 14,
                    color: commentText.trim() ? colors.accent : colors.mist,
                  }}
                >
                  ↵
                </Text>
              </AnimatedPressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    list: {},
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
      paddingVertical: 14,
      gap: 10,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },

    // Header
    rowHeader: {
      flexDirection: "row",
      gap: 10,
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    avatarFallback: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      color: colors.smoke,
    },
    rowHeaderText: {
      flex: 1,
      gap: 2,
    },
    headerLine: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
      lineHeight: 19,
    },
    memberName: {
      fontFamily: fonts.sansSemiBold,
      color: colors.ink,
    },
    verb: {
      color: colors.fog,
    },
    taskNameText: {
      fontFamily: fonts.sansMedium,
      color: colors.ink,
    },
    metaRow: {
      flexDirection: "row",
      gap: 8,
    },
    metaText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.3,
    },

    // Proof
    proofRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginLeft: 40,
    },
    proofThumb: {
      width: 56,
      height: 56,
      borderRadius: radii.sm,
      backgroundColor: colors.paper3,
    },
    capBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radii.pill,
      backgroundColor: colors.paper3,
    },
    capBtnText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.smoke,
      letterSpacing: 0.5,
    },

    // Comments
    commentToggle: {
      marginLeft: 40,
    },
    commentToggleText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 0.3,
    },
    commentsSection: {
      marginLeft: 40,
      gap: 6,
      paddingTop: 4,
    },
    commentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      alignItems: "baseline",
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
    commentInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    commentInput: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 6,
    },
  });
