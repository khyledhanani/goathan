import { Tabs } from "expo-router";
import { colors } from "../../constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: "Courier New",
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Feed" }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: "Log" }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: "Groups" }}
      />
    </Tabs>
  );
}
