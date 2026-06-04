import { View, Text, StyleSheet } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

// ── Icons (24x24 stroke-based, Feather-style) ──────────────────────────

function HomeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <Path d="M9 21V12h6v9" />
    </Svg>
  );
}

function GroupsIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <Path d="M9 11a4 4 0 100-8 4 4 0 000 8z" />
      <Path d="M23 21v-2a4 4 0 00-3-3.87" />
      <Path d="M16 3.13a4 4 0 010 7.75" />
    </Svg>
  );
}

function BellIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  );
}

function ProfileIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Path d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </Svg>
  );
}

const TABS = [
  { key: "home", label: "Home", Icon: HomeIcon, path: "/dashboard" },
  { key: "groups", label: "Groups", Icon: GroupsIcon, path: "/groups" },
  { key: "notifications", label: "Notifs", Icon: BellIcon, path: "/inbox" },
  { key: "profile", label: "Profile", Icon: ProfileIcon, path: "/profile" },
] as const;

function isActive(pathname: string, tabPath: string): boolean {
  if (tabPath === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(tabPath);
}

interface Props {
  unreadCount?: number;
}

export function BottomTabBar({ unreadCount = 0 }: Props) {
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const s = styles(colors);

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.path);
        const color = active ? colors.ink : colors.mist;
        return (
          <AnimatedPressable
            key={tab.key}
            scaleDown={0.88}
            dimOnPress={false}
            style={s.tab}
            onPress={() => router.push(tab.path)}
          >
            <tab.Icon color={color} />
            <Text
              style={[
                s.label,
                { color },
                active && s.labelActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.key === "notifications" && unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.rule,
      backgroundColor: colors.paper,
      paddingTop: 8,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      gap: 3,
      paddingVertical: 4,
    },
    label: {
      fontFamily: fonts.mono,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    labelActive: {
      fontFamily: fonts.monoMedium,
    },
    badge: {
      position: "absolute",
      top: 0,
      right: "18%",
      backgroundColor: colors.accent,
      borderRadius: 7,
      minWidth: 14,
      height: 14,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
    },
    badgeText: {
      fontFamily: fonts.monoMedium,
      fontSize: 8,
      color: colors.paper,
    },
  });
