import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import {
  InstrumentSerif_400Regular,
} from "@expo-google-fonts/instrument-serif";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { ConvexProvider } from "@/lib/ConvexProvider";
import { ThemeProvider, useThemeChoice } from "@/lib/ThemeContext";
import { useThemeColors } from "@/lib/useThemeColors";
import { useNotificationSetup } from "@/lib/useNotifications";
import { api } from "../convex/_generated/api";

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const colors = useThemeColors();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.profiles.getCurrentProfile,
    isAuthenticated ? {} : "skip",
  );

  // Register push token + handle notification taps
  useNotificationSetup(isAuthenticated);

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = (segments[0] ?? "") as string;
    const isOnLanding = currentRoute === "" || currentRoute === "index";
    const isOnOnboarding = currentRoute === "onboarding";

    if (!isAuthenticated) {
      // Not logged in → go to landing
      if (!isOnLanding) {
        router.replace("/");
        return; // Hide splash after navigation completes (next effect run)
      }
      SplashScreen.hideAsync();
      return;
    }

    // Authenticated — wait for profile to load before hiding splash
    if (profile === undefined) return;

    if (!profile || !profile.onboardingCompleted) {
      // Needs onboarding
      if (!isOnOnboarding) {
        router.replace("/onboarding");
        return; // Hide splash after navigation completes (next effect run)
      }
    } else {
      // Fully onboarded → dashboard
      if (isOnLanding || isOnOnboarding) {
        router.replace("/dashboard");
        return; // Hide splash after navigation completes (next effect run)
      }
    }

    // Already on the correct screen — safe to reveal
    SplashScreen.hideAsync();
  }, [isLoading, isAuthenticated, profile, segments, router]);

  // Native stack → real iOS "slide-over-page" transitions (the bell → inbox push,
  // user profiles, group create, etc.). Screens manage their own headers.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="dashboard" options={{ animation: "none" }} />
      <Stack.Screen name="profile" options={{ animation: "none" }} />
    </Stack>
  );
}

function RootLayoutInner() {
  const colors = useThemeColors();
  const { choice } = useThemeChoice();
  const systemScheme = useColorScheme();
  const effective = choice === "system" ? systemScheme : choice;

  return (
    <ConvexProvider>
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <StatusBar style={effective === "dark" ? "light" : "dark"} />
        <AuthGate />
      </View>
    </ConvexProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
