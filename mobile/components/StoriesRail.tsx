import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { Id } from "../convex/_generated/dataModel";

export interface StoryBundle {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isYou: boolean;
  latestAt: number;
  items: {
    completionId: Id<"completions">;
    taskName: string;
    taskCategory: string;
    groupId: Id<"groups">;
    groupName: string;
    points: number;
    verifiedAt: number;
    proofUrl: string | null;
    hasR2Proof: boolean;
  }[];
}

interface Props {
  bundles: StoryBundle[];
  onPress: (bundle: StoryBundle) => void;
}

export function StoriesRail({ bundles, onPress }: Props) {
  const colors = useThemeColors();
  const s = styles(colors);

  if (bundles.length === 0) return null;

  const totalItems = bundles.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.label}>Today's receipts</Text>
        <Text style={s.count}>{totalItems}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {bundles.map((bundle) => (
          <AnimatedPressable
            key={bundle.userId}
            scaleDown={0.95}
            style={s.pip}
            onPress={() => onPress(bundle)}
          >
            <View
              style={[
                s.ring,
                bundle.isYou ? s.ringYou : s.ringOther,
              ]}
            >
              {bundle.avatarUrl ? (
                <Image source={{ uri: bundle.avatarUrl }} style={s.avatarImg} transition={150} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarLetter}>
                    {bundle.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {bundle.items.length > 1 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{bundle.items.length}</Text>
              </View>
            )}
            <Text style={s.pipName} numberOfLines={1}>
              {bundle.isYou ? "You" : bundle.displayName.split(" ")[0]}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    label: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
    },
    count: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.accent,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.pill,
      overflow: "hidden",
    },
    scroll: {
      gap: 14,
      paddingVertical: 4,
    },
    pip: {
      alignItems: "center",
      width: 58,
    },
    ring: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    ringYou: {
      borderColor: colors.accent,
    },
    ringOther: {
      borderColor: colors.rule,
    },
    avatarImg: {
      width: 46,
      height: 46,
      borderRadius: 23,
    },
    avatarFallback: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 18,
      color: colors.smoke,
    },
    badge: {
      position: "absolute",
      top: 0,
      right: 2,
      backgroundColor: colors.accent,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.paper,
    },
    pipName: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.fog,
      marginTop: 4,
      textAlign: "center",
    },
  });
