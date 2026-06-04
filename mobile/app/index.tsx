import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, spacing, radii } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";

type AuthMode = "sign-in" | "sign-up";
type Status = "idle" | "google" | "password" | "dev" | "error";

const TASK_PILLS = [
  "Take a selfie",
  "Make your bed",
  "Hit the gym",
  "Do cardio",
  "Drink water",
  "Read 10 pages",
  "No takeout",
  "Sleep by 11",
];

export default function LandingScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const colors = useThemeColors();
  const devBypass = process.env.EXPO_PUBLIC_AUTH_DEV_BYPASS === "true";

  const [status, setStatus] = useState<Status>("idle");
  const [toast, setToast] = useState<ToastValue>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const busy = status !== "idle" && status !== "error";

  const onGoogleSignIn = async () => {
    setStatus("google");
    try {
      await signIn("google");
      router.replace("/dashboard");
    } catch (e) {
      setToast({ message: errorMessage(e, "Sign-in failed. Try again."), tone: "error" });
      setStatus("error");
    }
  };

  const onPasswordAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setToast({ message: "Email and password are required.", tone: "error" });
      return;
    }
    setStatus("password");
    try {
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: authMode === "sign-up" ? "signUp" : "signIn",
      });
      router.replace("/dashboard");
    } catch (e) {
      setToast({
        message: errorMessage(
          e,
          authMode === "sign-up"
            ? "Could not create account. Try again."
            : "Invalid email or password.",
        ),
        tone: "error",
      });
      setStatus("error");
    }
  };

  const onDevSignIn = async () => {
    setStatus("dev");
    try {
      await signIn("anonymous");
      router.replace("/dashboard");
    } catch (e) {
      setToast({ message: errorMessage(e, "Dev sign-in failed."), tone: "error" });
      setStatus("error");
    }
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={s.top}>
            <Text style={[s.brand, { color: colors.ink }]}>
              Receipts
              <Text style={[s.brandVersion, { color: colors.fog }]}>{"  "}v0.1</Text>
            </Text>
            <Text style={[s.eyebrow, { color: colors.fog }]}>
              <Text style={{ fontFamily: fonts.monoMedium, color: colors.ink }}>Private</Text>
              {"  ·  invite only"}
            </Text>
          </View>

          {/* ── Hero ── */}
          <View style={s.mid}>
            <Text style={[s.headline, { color: colors.ink }]}>
              {"Receipts for\n"}
              <Text style={[s.headlineUnderline, { textDecorationColor: colors.accent }]}>
                anything.
              </Text>
            </Text>

            <Text style={[s.subhead, { color: colors.smoke }]}>
              Make a group. Add daily or weekly tasks. Post proof when they're
              done. Your friends decide what counts.
            </Text>

            {/* Task pills */}
            <View style={s.pills}>
              {TASK_PILLS.map((t) => (
                <View key={t} style={[s.pill, { backgroundColor: colors.rule }]}>
                  <Text style={[s.pillText, { color: colors.smoke }]}>{t}</Text>
                </View>
              ))}
            </View>

            {/* ── Google sign-in ── */}
            <Pressable
              style={({ pressed }) => [
                s.btnGoogle,
                { backgroundColor: pressed ? colors.accentHover : colors.ink },
              ]}
              onPress={onGoogleSignIn}
              disabled={busy}
            >
              <View style={[s.googleIcon, { backgroundColor: colors.paper }]}>
                <GoogleGlyph />
              </View>
              <Text style={[s.btnGoogleText, { color: colors.paper }]}>
                {status === "google" ? "Opening Google…" : "Sign in with Google"}
              </Text>
              <Text style={[s.arrow, { color: colors.paper }]}>→</Text>
            </Pressable>

            {/* ── Divider ── */}
            <View style={s.divider}>
              <View style={[s.dividerLine, { backgroundColor: colors.rule }]} />
              <Text style={[s.dividerText, { color: colors.mist }]}>or</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.rule }]} />
            </View>

            {/* ── Email/Password ── */}
            <View style={s.emailSection}>
              <View style={s.authToggle}>
                <AnimatedPressable scaleDown={0.92} onPress={() => setAuthMode("sign-in")}>
                  <Text
                    style={[
                      s.authToggleText,
                      { color: authMode === "sign-in" ? colors.ink : colors.mist },
                      authMode === "sign-in" && s.authToggleActive,
                    ]}
                  >
                    Sign in
                  </Text>
                </AnimatedPressable>
                <Text style={[s.authToggleDot, { color: colors.mist }]}>·</Text>
                <AnimatedPressable scaleDown={0.92} onPress={() => setAuthMode("sign-up")}>
                  <Text
                    style={[
                      s.authToggleText,
                      { color: authMode === "sign-up" ? colors.ink : colors.mist },
                      authMode === "sign-up" && s.authToggleActive,
                    ]}
                  >
                    Sign up
                  </Text>
                </AnimatedPressable>
              </View>

              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.ink,
                    borderBottomColor: colors.rule,
                  },
                ]}
                placeholderTextColor={colors.mist}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!busy}
              />

              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.ink,
                    borderBottomColor: colors.rule,
                  },
                ]}
                placeholderTextColor={colors.mist}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
                editable={!busy}
              />

              <Pressable
                style={({ pressed }) => [
                  s.btnPrimary,
                  {
                    backgroundColor:
                      !email.trim() || !password.trim()
                        ? colors.paper3
                        : pressed
                          ? colors.accent
                          : colors.ink,
                  },
                ]}
                onPress={onPasswordAuth}
                disabled={busy || !email.trim() || !password.trim()}
              >
                <Text
                  style={[
                    s.btnPrimaryText,
                    {
                      color:
                        !email.trim() || !password.trim() ? colors.mist : colors.paper,
                    },
                  ]}
                >
                  {status === "password"
                    ? "One sec…"
                    : authMode === "sign-up"
                      ? "Create account"
                      : "Sign in"}
                </Text>
                <Text
                  style={[
                    s.arrow,
                    {
                      color:
                        !email.trim() || !password.trim() ? colors.mist : colors.paper,
                    },
                  ]}
                >
                  →
                </Text>
              </Pressable>
            </View>

            {/* ── Dev bypass ── */}
            {devBypass && (
              <Pressable
                style={({ pressed }) => [
                  s.btnGhost,
                  {
                    borderColor: pressed ? colors.ink : colors.rule,
                    backgroundColor: pressed ? colors.paper2 : "transparent",
                  },
                ]}
                onPress={onDevSignIn}
                disabled={busy}
              >
                <Text style={[s.btnGhostText, { color: colors.ink }]}>
                  {status === "dev" ? "Entering dev mode…" : "Skip sign-in for local dev"}
                </Text>
                <Text style={[s.arrowSmall, { color: colors.ink }]}>→</Text>
              </Pressable>
            )}

            {/* ── Fine print ── */}
            <Text style={[s.fineprint, { color: colors.fog }]}>
              We'll pull your name, email, and avatar from Google. You can change
              your tag in onboarding.
            </Text>
          </View>

          {/* ── Footer ── */}
          <View style={[s.footer, { borderTopColor: colors.rule }]}>
            <Text style={[s.eyebrow, { color: colors.fog }]}>
              © Receipts · small promises, daily receipts
            </Text>
            <View style={s.lattice}>
              {([
                ["Tasks", "Anything"],
                ["Proof", "Photo / screenshot"],
                ["Referee", "Your friends"],
              ] as const).map(([k, v]) => (
                <View key={k} style={s.latticeItem}>
                  <Text style={[s.latticeKey, { color: colors.fog }]}>{k}</Text>
                  <Text style={[s.latticeVal, { color: colors.ink }]}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62z"
        fill="#4285F4"
      />
      <Path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <Path
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
        fill="#FBBC05"
      />
      <Path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const styles = (c: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 24,
    },

    // ── Top bar ──
    top: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
    },
    brand: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      letterSpacing: -0.3,
    },
    brandVersion: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.4,
    },
    eyebrow: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },

    // ── Mid / hero ──
    mid: {
      flex: 1,
      justifyContent: "center",
      maxWidth: 560,
      paddingVertical: 32,
    },
    headline: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 64,
      lineHeight: 62,
      letterSpacing: -1.3,
      marginBottom: 24,
    },
    headlineUnderline: {
      textDecorationLine: "underline",
      textDecorationStyle: "solid",
    },
    subhead: {
      fontFamily: fonts.sans,
      fontSize: 17,
      lineHeight: 25.5,
      maxWidth: 480,
      marginBottom: 20,
    },

    // ── Task pills ──
    pills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 32,
      maxWidth: 480,
    },
    pill: {
      borderRadius: 100,
      paddingVertical: 5,
      paddingHorizontal: 14,
    },
    pillText: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 0.5,
    },

    // ── Google button ──
    btnGoogle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      width: "100%",
      paddingVertical: 16,
      paddingHorizontal: 22,
      borderRadius: radii.pill,
    },
    googleIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      padding: 2,
    },
    btnGoogleText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 15,
      flex: 1,
    },
    arrow: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 18,
      lineHeight: 20,
    },

    // ── Divider ──
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginVertical: 20,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    dividerText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },

    // ── Email/password section ──
    emailSection: {
      gap: 0,
    },
    authToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    authToggleText: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    authToggleActive: {
      fontFamily: fonts.monoMedium,
    },
    authToggleDot: {
      fontFamily: fonts.mono,
      fontSize: 11,
    },
    input: {
      width: "100%",
      paddingVertical: 14,
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 22,
      letterSpacing: -0.2,
      borderBottomWidth: 1,
      backgroundColor: "transparent",
      marginBottom: 4,
    },
    btnPrimary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 22,
      borderRadius: radii.pill,
      marginTop: 20,
    },
    btnPrimaryText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      letterSpacing: 0.1,
    },

    // ── Ghost button (dev) ──
    btnGhost: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: radii.pill,
      borderWidth: 1,
      marginTop: 10,
    },
    btnGhostText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
    },
    arrowSmall: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 16,
    },

    // ── Fine print ──
    fineprint: {
      marginTop: 16,
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 0.4,
      lineHeight: 16.5,
    },

    // ── Footer ──
    footer: {
      borderTopWidth: 1,
      paddingTop: 18,
      gap: 16,
    },
    lattice: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 28,
    },
    latticeItem: {
      gap: 2,
    },
    latticeKey: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.6,
      textTransform: "uppercase",
    },
    latticeVal: {
      fontFamily: fonts.mono,
      fontSize: 13,
      letterSpacing: 0.7,
    },
  });
