import { Text, type StyleProp, type TextStyle } from "react-native";

type Props = {
  body: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
};

const MENTION_PART_RE = /(@[a-z0-9_.]{2,20})/gi;
const FULL_MENTION_RE = /^@[a-z0-9_.]{2,20}$/i;

export function MentionText({ body, style, mentionStyle }: Props) {
  const parts = body.split(MENTION_PART_RE);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (FULL_MENTION_RE.test(part)) {
          return (
            <Text key={`${part}-${index}`} style={mentionStyle}>
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
