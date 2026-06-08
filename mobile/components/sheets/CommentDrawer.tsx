import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Icon } from "@/components/ui/Icon";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii, springs } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import { hapticLight } from "@/lib/haptics";

const { height: SCREEN_H } = Dimensions.get("window");

interface RawComment {
  _id: Id<"comments">;
  authorName: string;
  isYou: boolean;
  body: string;
  createdAt: number;
}

interface Props {
  completionId: Id<"completions"> | null;
  onClose: () => void;
  meInitial?: string;
  meAvatarUrl?: string | null;
}

// TikTok / IG-style comment drawer: snap half↔full via the grabber, sticky
// input that lifts above the keyboard, comments scrolling behind. Self-queries
// the proof's comments so new ones appear live.
export function CommentDrawer({ completionId, onClose, meInitial, meAvatarUrl }: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [snap, setSnap] = useState<"half" | "full">("half");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const listRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const ty = useSharedValue(SCREEN_H);
  const backdrop = useSharedValue(0);

  const proof = useQuery(
    api.proofs.byCompletionId,
    completionId ? { completionId } : "skip",
  );
  const addComment = useMutation(api.comments.add);
  const comments = (proof?.comments ?? []) as RawComment[];

  const visible = completionId != null;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setSnap("half");
      ty.value = withSpring(0, springs.sheet);
      backdrop.value = withTiming(1, { duration: 240 });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: 200 });
      ty.value = withTiming(SCREEN_H, { duration: 240 }, (fin) => {
        if (fin) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) ty.value = g.dy;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40) {
          runOnJS(setSnap)("full");
          ty.value = withSpring(0, springs.sheet);
        } else if (g.dy > 90) {
          runOnJS(Keyboard.dismiss)();
          onClose();
        } else {
          ty.value = withSpring(0, springs.sheet);
        }
      },
      onPanResponderTerminate: () => {
        ty.value = withSpring(0, springs.sheet);
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !completionId) return;
    setSending(true);
    try {
      await addComment({ completionId, body });
      setText("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {}
    setSending(false);
  };

  if (!mounted) return null;

  const height = snap === "full" ? SCREEN_H * 0.9 : SCREEN_H * 0.58;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdropBase, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: c.surface, borderColor: c.line, height },
              sheetStyle,
            ]}
          >
            {/* Grabber + header (drag target) */}
            <View {...pan.panHandlers} style={styles.head}>
              <View style={[styles.grabber, { backgroundColor: c.lineStrong }]} />
              <View style={styles.headRow}>
                <Text style={[styles.headLabel, { color: c.muted }]}>
                  {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
                </Text>
                <AnimatedPressable
                  scaleDown={0.9}
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: c.surface2, borderColor: c.line }]}
                >
                  <Icon name="x" size={16} color={c.muted} />
                </AnimatedPressable>
              </View>
            </View>

            {/* Comments */}
            <ScrollView
              ref={listRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => Keyboard.dismiss()}
              showsVerticalScrollIndicator={false}
            >
              {proof === undefined ? null : comments.length ? (
                comments.map((cm) => (
                  <View key={cm._id} style={styles.commentRow}>
                    <Avatar initial={cm.authorName} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.commentMeta}>
                        <Text style={[styles.commentAuthor, { color: c.inkStrong }]}>
                          {cm.isYou ? "You" : cm.authorName}
                        </Text>
                        <Text style={[styles.commentWhen, { color: c.mutedDim }]}>
                          {"  "}
                          {timeAgo(cm.createdAt)}
                        </Text>
                      </Text>
                      <Text style={[styles.commentBody, { color: c.ink }]}>{cm.body}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setLiked((l) => ({ ...l, [cm._id]: !l[cm._id] }));
                      }}
                      hitSlop={8}
                      style={{ paddingTop: 2 }}
                    >
                      <Icon
                        name="heart"
                        size={15}
                        color={liked[cm._id] ? c.accent : c.mutedDim}
                        fill={liked[cm._id] ? c.accent : undefined}
                      />
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={{ paddingTop: 40 }}>
                  <EmptyState head="No comments yet" body="Start the conversation." />
                </View>
              )}
            </ScrollView>

            {/* Sticky input */}
            <View
              style={[
                styles.inputRow,
                {
                  borderTopColor: c.line,
                  backgroundColor: c.surface,
                  paddingBottom: 12 + (Platform.OS === "android" ? 0 : insets.bottom > 0 ? 4 : 0),
                },
              ]}
            >
              <Avatar initial={meInitial ?? "?"} uri={meAvatarUrl} size={34} />
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onFocus={() => setSnap("full")}
                placeholder="Add a comment…"
                placeholderTextColor={c.mutedDim}
                style={[styles.input, { backgroundColor: c.paper, borderColor: c.line, color: c.ink }]}
                returnKeyType="send"
                onSubmitEditing={send}
                maxLength={240}
              />
              <AnimatedPressable
                scaleDown={0.9}
                onPress={send}
                disabled={!text.trim()}
                style={[
                  styles.sendBtn,
                  { backgroundColor: text.trim() ? c.accent : c.surface2 },
                ]}
              >
                <Icon name="arrowR" size={19} color={text.trim() ? c.onAccent : c.mutedDim} />
              </AnimatedPressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdropBase: { backgroundColor: "rgba(0,0,0,0.5)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
    elevation: 24,
  },
  head: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  grabber: { width: 40, height: 5, borderRadius: 999, alignSelf: "center", marginBottom: 14 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  commentRow: { flexDirection: "row", gap: 12, paddingVertical: 12 },
  commentMeta: { flexDirection: "row", alignItems: "baseline" },
  commentAuthor: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  commentWhen: { fontFamily: fonts.mono, fontSize: 11 },
  commentBody: { fontFamily: fonts.sans, fontSize: 15, marginTop: 3, lineHeight: 21 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: fonts.sans,
    fontSize: 15,
    minWidth: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
