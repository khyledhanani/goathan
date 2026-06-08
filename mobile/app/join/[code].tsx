import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

type JoinState = "joining" | "joined" | "error" | "already";

export default function JoinByCodeScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isAuthenticated, isLoading } = useConvexAuth();

  const joinByCode = useMutation(api.groups.joinByCode);

  const [state, setState] = useState<JoinState>("joining");
  const [errorMsg, setErrorMsg] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (isLoading || attempted.current) return;
    if (!isAuthenticated) {
      // Not logged in — redirect to sign in
      router.replace("/");
      return;
    }
    if (!code) return;

    attempted.current = true;

    (async () => {
      try {
        const result = await joinByCode({ inviteCode: code.toUpperCase().trim() });
        if (result.ok) {
          setState("joined");
          setTimeout(() => {
            router.navigate(`/dashboard?group=${result.groupId}`);
          }, 800);
        } else {
          if (result.error?.includes("already")) {
            setState("already");
          } else {
            setState("error");
            setErrorMsg(result.error);
          }
        }
      } catch (e) {
        setState("error");
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }, [isLoading, isAuthenticated, code]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.eyebrow}>Join group</Text>
        <Text style={s.title}>
          Join up<Text style={{ color: colors.accent }}>.</Text>
        </Text>

        <View style={s.statusCard}>
          {state === "joining" && (
            <>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.statusText}>
                Hooking you in with code{" "}
                <Text style={s.codeHighlight}>{code?.toUpperCase()}</Text>...
              </Text>
            </>
          )}

          {state === "joined" && (
            <>
              <Text style={s.successIcon}>✓</Text>
              <Text style={s.statusText}>
                You're in. Heading to the group...
              </Text>
            </>
          )}

          {state === "already" && (
            <>
              <Text style={s.statusText}>
                You're already in this group.
              </Text>
            </>
          )}

          {state === "error" && (
            <>
              <Text style={s.errorText}>{errorMsg}</Text>
            </>
          )}
        </View>

        <AnimatedPressable
          scaleDown={0.97}
          style={s.homeBtn}
          onPress={() => router.replace("/dashboard")}
        >
          <Text style={s.homeBtnText}>Go to dashboard</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      gap: 12,
    },
    eyebrow: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
    },
    title: {
      fontFamily: fonts.serif,
      fontSize: 40,
      color: colors.ink,
      letterSpacing: -0.8,
      marginBottom: 16,
    },
    statusCard: {
      alignItems: "center",
      gap: 12,
      paddingVertical: 24,
      paddingHorizontal: 20,
      backgroundColor: colors.paper2,
      borderRadius: radii.md,
      width: "100%",
    },
    statusText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.smoke,
      textAlign: "center",
      lineHeight: 21,
    },
    codeHighlight: {
      fontFamily: fonts.monoMedium,
      fontSize: 14,
      color: colors.ink,
      letterSpacing: 1,
    },
    successIcon: {
      fontFamily: fonts.sansBold,
      fontSize: 28,
      color: colors.accent,
    },
    errorText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.cap,
      textAlign: "center",
      lineHeight: 21,
    },
    homeBtn: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
    },
    homeBtnText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: colors.paper,
    },
  });
