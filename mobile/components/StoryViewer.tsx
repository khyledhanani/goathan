import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Image } from "expo-image";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import type { StoryBundle } from "./StoriesRail";

const { width: SCREEN_W } = Dimensions.get("window");

interface Props {
  bundle: StoryBundle | null;
  signedUrls: Record<string, string>;
  onClose: () => void;
}

const CATEGORY_COLOR: Record<string, string> = {
  MORNING: "#e8a838",
  MOVE: "#3a8fd4",
  FUEL: "#5cb85c",
  MIND: "#9b59b6",
  REST: "#7f8c8d",
};

export function StoryViewer({ bundle, signedUrls, onClose }: Props) {
  const colors = useThemeColors();
  const s = styles(colors);
  const [index, setIndex] = useState(0);

  if (!bundle) return null;

  const items = bundle.items;
  const item = items[index];
  if (!item) return null;

  const imageUrl = signedUrls[item.completionId] ?? item.proofUrl;

  const goNext = () => {
    if (index < items.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.container}>
        {/* Progress pips */}
        <View style={s.progress}>
          {items.map((_, i) => (
            <View
              key={i}
              style={[s.pip, i <= index ? s.pipActive : s.pipInactive]}
            />
          ))}
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {bundle.avatarUrl ? (
              <Image source={{ uri: bundle.avatarUrl }} style={s.avatar} transition={150} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarLetter}>
                  {bundle.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={s.name}>
                {bundle.isYou ? "You" : bundle.displayName}
              </Text>
              <Text style={s.time}>{timeAgo(item.verifiedAt)}</Text>
            </View>
          </View>
          <AnimatedPressable scaleDown={0.92} onPress={onClose} hitSlop={16}>
            <Text style={s.closeBtn}>✕</Text>
          </AnimatedPressable>
        </View>

        {/* Content */}
        <Pressable
          style={s.content}
          onPress={(e) => {
            const x = e.nativeEvent.locationX;
            if (x < SCREEN_W * 0.35) goPrev();
            else goNext();
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={s.image}
              contentFit="contain"
              transition={300}
              placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
            />
          ) : (
            <View style={s.noImage}>
              <Text style={s.noImageText}>No proof photo</Text>
            </View>
          )}
        </Pressable>

        {/* Footer */}
        <View style={s.footer}>
          <View
            style={[
              s.categoryBadge,
              {
                backgroundColor:
                  (CATEGORY_COLOR[item.taskCategory] ?? colors.fog) + "22",
              },
            ]}
          >
            <Text
              style={[
                s.categoryText,
                {
                  color: CATEGORY_COLOR[item.taskCategory] ?? colors.fog,
                },
              ]}
            >
              {item.taskCategory.toLowerCase()}
            </Text>
          </View>
          <Text style={s.taskName}>{item.taskName}</Text>
          <View style={s.footerMeta}>
            <Text style={s.groupName}>{item.groupName}</Text>
            <Text style={s.points}>+{item.points} pts</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    progress: {
      flexDirection: "row",
      gap: 3,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    pip: {
      flex: 1,
      height: 2,
      borderRadius: 1,
    },
    pipActive: {
      backgroundColor: colors.accent,
    },
    pipInactive: {
      backgroundColor: colors.rule,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      color: colors.smoke,
    },
    name: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: colors.ink,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.fog,
    },
    closeBtn: {
      fontFamily: fonts.sans,
      fontSize: 20,
      color: colors.fog,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
      width: SCREEN_W,
      flex: 1,
    },
    noImage: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    noImageText: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.mist,
      letterSpacing: 1,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 6,
    },
    categoryBadge: {
      alignSelf: "flex-start",
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radii.pill,
    },
    categoryText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    taskName: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    footerMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    groupName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.fog,
    },
    points: {
      fontFamily: fonts.monoMedium,
      fontSize: 12,
      color: colors.accent,
    },
  });
