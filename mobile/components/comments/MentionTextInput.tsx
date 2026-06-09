import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type TextInputSelectionChangeEventData,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Avatar } from "@/components/ui/primitives";
import { fonts } from "@/lib/theme";
import { useThemeColors } from "@/lib/useThemeColors";

export type MentionMember = {
  userId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  isYou?: boolean;
};

type MentionTrigger = {
  start: number;
  end: number;
  query: string;
};

function findMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/(^|[\s([{,.:;!?])@([a-z0-9_.]*)$/i);
  if (!match) return null;

  const at = beforeCursor.lastIndexOf("@");
  if (at < 0) return null;

  return {
    start: at,
    end: cursor,
    query: match[2].toLowerCase(),
  };
}

// ── Hook: reusable mention logic ──────────────────────────────────────

export function useMention(
  value: string,
  onChangeText: (text: string) => void,
  members: MentionMember[],
  opts?: { maxLength?: number; maxSuggestions?: number },
) {
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: value.length, end: value.length });
  const [selectionOverride, setSelectionOverride] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const maxSuggestions = opts?.maxSuggestions ?? 5;
  const maxLength = opts?.maxLength;

  const trigger = findMentionTrigger(value, selection.start);
  const suggestions = useMemo(() => {
    if (!trigger) return [];
    const query = trigger.query;
    return members
      .filter((member) => member.username && !member.isYou)
      .filter((member) => {
        const username = member.username!.toLowerCase();
        const displayName = member.displayName.toLowerCase();
        return (
          query.length === 0 ||
          username.startsWith(query) ||
          displayName.includes(query)
        );
      })
      .slice(0, maxSuggestions);
  }, [members, maxSuggestions, trigger]);

  const handleSelectionChange = (
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    setSelection(event.nativeEvent.selection);
  };

  const insertMention = (member: MentionMember) => {
    if (!trigger || !member.username) return;
    const mention = `@${member.username} `;
    const next =
      value.slice(0, trigger.start) + mention + value.slice(trigger.end);
    const capped =
      typeof maxLength === "number" && next.length > maxLength
        ? next.slice(0, maxLength)
        : next;
    const cursor = Math.min(trigger.start + mention.length, capped.length);
    onChangeText(capped);
    setSelection({ start: cursor, end: cursor });
    setSelectionOverride({ start: cursor, end: cursor });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setSelectionOverride(null);
    });
  };

  return {
    inputRef,
    suggestions,
    insertMention,
    handleSelectionChange,
    selectionOverride,
  };
}

// ── Suggestion list (render anywhere) ─────────────────────────────────

export function MentionSuggestions({
  suggestions,
  onSelect,
  style,
}: {
  suggestions: MentionMember[];
  onSelect: (member: MentionMember) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  if (suggestions.length === 0) return null;
  return (
    <View
      style={[
        styles.suggestions,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          shadowColor: colors.inkStrong,
        },
        style,
      ]}
    >
      {suggestions.map((member) => (
        <Pressable
          key={member.userId}
          onPress={() => onSelect(member)}
          style={({ pressed }) => [
            styles.suggestionRow,
            pressed && { backgroundColor: colors.surface2 },
          ]}
        >
          <Avatar
            initial={member.displayName}
            uri={member.avatarUrl}
            size={36}
          />
          <View style={styles.suggestionText}>
            <Text
              style={[styles.suggestionName, { color: colors.inkStrong }]}
              numberOfLines={1}
            >
              {member.displayName}
            </Text>
            <Text
              style={[styles.suggestionUsername, { color: colors.mutedDim }]}
              numberOfLines={1}
            >
              @{member.username}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ── Self-contained input (for simple cases like FeedCard) ─────────────

type Props = Omit<TextInputProps, "onChangeText" | "style" | "value"> & {
  value: string;
  onChangeText: (text: string) => void;
  members: MentionMember[];
  inputStyle?: StyleProp<TextStyle>;
  rootStyle?: StyleProp<ViewStyle>;
  maxSuggestions?: number;
};

export function MentionTextInput({
  value,
  onChangeText,
  members,
  inputStyle,
  rootStyle,
  maxLength,
  maxSuggestions = 5,
  onSelectionChange,
  ...inputProps
}: Props) {
  const {
    inputRef,
    suggestions,
    insertMention,
    handleSelectionChange,
    selectionOverride,
  } = useMention(value, onChangeText, members, { maxLength, maxSuggestions });

  const onSel = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    handleSelectionChange(e);
    onSelectionChange?.(e);
  };

  return (
    <View style={[styles.root, rootStyle]}>
      <MentionSuggestions suggestions={suggestions} onSelect={insertMention} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={onSel}
        selection={selectionOverride ?? undefined}
        maxLength={maxLength}
        style={inputStyle}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
  },
  suggestions: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,
    marginBottom: 8,
    elevation: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
  },
  suggestionName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
  },
  suggestionUsername: {
    fontFamily: fonts.mono,
    fontSize: 11,
    marginTop: 1,
  },
});
