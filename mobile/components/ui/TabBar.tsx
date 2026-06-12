import { View, Text, StyleSheet } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — bottom TabBar (port of the prototype's TabBar in app.jsx)
// Three equal columns: Feed · circular mint add button · Profile.
// Presentational — only the add button is a callback; nav is via expo-router.
// ════════════════════════════════════════════════════════════════════════

interface Props {
  onAdd: () => void;
  /** Called when Home is tapped while already on the dashboard (lets the
   *  dashboard reset the pager to the feed + show refresh feedback directly,
   *  instead of round-tripping through a route param). */
  onHome?: () => void;
}

function NavTab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const s = styles(c);
  return (
    <AnimatedPressable
      scaleDown={0.9}
      dimOnPress={false}
      style={s.navTab}
      onPress={onPress}
    >
      <Icon
        name={icon}
        size={26}
        color={active ? c.inkStrong : c.faint}
        strokeWidth={active ? 1.9 : 1.6}
      />
      <Text style={[s.label, { color: active ? c.inkStrong : c.faint }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function TabBar({ onAdd, onHome }: Props) {
  const c = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const s = styles(c);

  const feedActive = pathname === "/dashboard";
  const profileActive = pathname.startsWith("/profile");

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
      <NavTab
        icon="home"
        label="Home"
        active={feedActive}
        // Already on the dashboard (feed or a group page): let the dashboard
        // reset to the feed + show the spinner directly. From another screen
        // (e.g. Profile): route to the feed, which the dashboard reads via
        // `group=feed`.
        onPress={() => {
          if (feedActive && onHome) onHome();
          else router.replace("/dashboard?group=feed");
        }}
      />

      <View style={s.addCol}>
        <AnimatedPressable
          scaleDown={0.92}
          haptic="medium"
          dimOnPress={false}
          accessibilityLabel="Add receipt"
          style={s.addBtn}
          onPress={onAdd}
        >
          <Icon name="camera" size={25} color={c.onAccent} />
        </AnimatedPressable>
      </View>

      <NavTab
        icon="person"
        label="Profile"
        active={profileActive}
        onPress={() => { if (!profileActive) router.replace("/profile"); }}
      />
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: c.line,
      backgroundColor: c.paper,
      paddingTop: 14,
    },
    navTab: {
      flex: 1,
      alignItems: "center",
      gap: 7,
    },
    label: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: "uppercase",
    },
    addCol: {
      flex: 1,
      alignItems: "center",
    },
    addBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#8AC7A8",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 6,
    },
  });
