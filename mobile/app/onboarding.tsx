import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, spacing, radii } from "@/lib/theme";
import { MAIN_GOAL_OPTIONS, type MainGoal } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const colors = useThemeColors();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);

  const [signingOut, setSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (profile === undefined) return;
    if (profile === null) {
      void upsertFromAuth({});
      return;
    }
    setBootstrapped(true);
    if (profile.onboardingCompleted) {
      router.replace("/dashboard");
      return;
    }
    setDisplayName((curr) => curr || profile.displayName || "");
    setUsername((curr) => curr || profile.username || "");
    setMainGoal((curr) => curr ?? profile.mainGoal ?? null);
  }, [authLoading, isAuthenticated, profile, upsertFromAuth, router]);

  const usernameValid = /^[a-z0-9_.]{2,20}$/.test(username.trim());
  const usernameHint =
    username.length > 0 && !usernameValid
      ? "2–20 chars · a–z, 0–9, _ or ."
      : null;

  const canSubmit = useMemo(
    () => displayName.trim().length > 0 && usernameValid && !submitting,
    [displayName, usernameValid, submitting],
  );

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await completeOnboarding({
        displayName: displayName.trim(),
        username: username.trim(),
        mainGoal: mainGoal ?? undefined,
      });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
        setSubmitting(false);
        return;
      }
      router.replace("/dashboard");
    } catch (e) {
      setToast({ message: errorMessage(e, "Could not save. Try again."), tone: "error" });
      setSubmitting(false);
    }
  };

  // Goal grid columns based on screen width
  const goalColumns = width >= 640 ? 2 : 1;

  if (authLoading || profile === undefined || !bootstrapped) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={[s.eyebrow, { color: colors.fog }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
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
            <View style={s.topRight}>
              <Text style={[s.eyebrow, { color: colors.fog }]}>
                {"Step "}
                <Text style={{ fontFamily: fonts.monoMedium, color: colors.ink }}>1 of 1</Text>
                {"  ·  onboarding"}
              </Text>
              <AnimatedPressable
                scaleDown={0.92}
                onPress={async () => {
                  setSigningOut(true);
                  try {
                    await signOut();
                    router.replace("/");
                  } catch {
                    setSigningOut(false);
                  }
                }}
                disabled={signingOut}
              >
                <Text style={[s.btnLink, { color: signingOut ? colors.mist : colors.smoke }]}>
                  {signingOut ? "Out…" : "Log out"}
                </Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* ── Hero ── */}
          <View style={s.mid}>
            <Text style={[s.headline, { color: colors.ink }]}>
              {"You're "}
              <Text style={[s.headlineUnderline, { textDecorationColor: colors.accent }]}>
                in
              </Text>
              .
            </Text>

            <Text style={[s.subhead, { color: colors.smoke }]}>
              Set your tag and pick your angle. You can change either later.
            </Text>

            {/* ── Form ── */}
            <View style={s.form}>
              {/* Display name */}
              <View style={s.field}>
                <View style={s.fieldLabel}>
                  <Text style={[s.labelText, { color: colors.fog }]}>Display name</Text>
                  <Text style={[s.hintText, { color: colors.mist }]}>Visible to your group</Text>
                </View>
                <TextInput
                  style={[s.fieldInput, { color: colors.ink, borderBottomColor: colors.rule }]}
                  value={displayName}
                  maxLength={32}
                  autoFocus
                  onChangeText={setDisplayName}
                  placeholder="What should we tag you as"
                  placeholderTextColor={colors.mist}
                />
              </View>

              {/* Username */}
              <View style={[s.field, { marginTop: 22 }]}>
                <View style={s.fieldLabel}>
                  <Text style={[s.labelText, { color: colors.fog }]}>Username</Text>
                  <Text style={[s.hintText, { color: colors.mist }]}>
                    {usernameHint ?? "Required · a–z, 0–9, _ or ."}
                  </Text>
                </View>
                <TextInput
                  style={[
                    s.fieldInputMono,
                    { color: colors.ink, borderBottomColor: colors.rule },
                  ]}
                  value={username}
                  maxLength={20}
                  onChangeText={(t) =>
                    setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ""))
                  }
                  placeholder="rahul"
                  placeholderTextColor={colors.mist}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Goal picker */}
              <View style={{ marginTop: 26 }}>
                <View style={s.fieldLabel}>
                  <Text style={[s.labelText, { color: colors.fog }]}>What's the angle?</Text>
                  <Text style={[s.hintText, { color: colors.mist }]}>Pick one (optional)</Text>
                </View>
                <View style={[s.goalGrid, { gap: 8 }]}>
                  {MAIN_GOAL_OPTIONS.map((opt) => {
                    const active = mainGoal === opt.value;
                    return (
                      <AnimatedPressable
                        key={opt.value}
                        scaleDown={0.98}
                        style={[
                          s.goalCard,
                          {
                            width: goalColumns === 2 ? "48.5%" : "100%",
                            borderColor: active ? colors.accent : colors.rule,
                            backgroundColor: active ? colors.accentSoft : "transparent",
                          },
                        ]}
                        onPress={() =>
                          setMainGoal(mainGoal === opt.value ? null : opt.value)
                        }
                      >
                        <Text
                          style={[
                            s.goalLabel,
                            { color: active ? colors.accent : colors.ink },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={[s.goalBlurb, { color: colors.fog }]}>
                          {opt.blurb}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>

              {/* Submit */}
              <View style={s.submitRow}>
                <Pressable
                  style={({ pressed }) => [
                    s.btnPrimary,
                    {
                      backgroundColor: !canSubmit
                        ? colors.paper3
                        : pressed
                          ? colors.accent
                          : colors.ink,
                    },
                  ]}
                  onPress={onSubmit}
                  disabled={!canSubmit}
                >
                  <Text
                    style={[
                      s.btnPrimaryText,
                      { color: !canSubmit ? colors.mist : colors.paper },
                    ]}
                  >
                    {submitting ? "Locking in…" : "Bring the receipts"}
                  </Text>
                  <Text
                    style={[
                      s.arrow,
                      { color: !canSubmit ? colors.mist : colors.paper },
                    ]}
                  >
                    →
                  </Text>
                </Pressable>
                <Text style={[s.eyebrow, { color: colors.fog }]}>You can edit this later</Text>
              </View>
            </View>
          </View>

          {/* ── Footer ── */}
          <View style={[s.footer, { borderTopColor: colors.rule }]}>
            <Text style={[s.eyebrow, { color: colors.fog }]}>No receipts, no rank</Text>
            <Text style={[s.eyebrow, { color: colors.fog }]}>Private · invite only</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // ── Top ──
  top: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 14,
  },
  brand: {
    fontFamily: fonts.serif,
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
  btnLink: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },

  // ── Mid ──
  mid: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 680,
    paddingVertical: 32,
  },
  headline: {
    fontFamily: fonts.serif,
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
    marginBottom: 20,
  },

  // ── Form ──
  form: {
    maxWidth: 600,
  },
  field: {},
  fieldLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  labelText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  hintText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  fieldInput: {
    width: "100%",
    paddingVertical: 14,
    fontFamily: fonts.serif,
    fontSize: 28,
    letterSpacing: -0.3,
    borderBottomWidth: 1,
    backgroundColor: "transparent",
  },
  fieldInputMono: {
    width: "100%",
    paddingVertical: 14,
    fontFamily: fonts.monoMedium,
    fontSize: 22,
    letterSpacing: 1.3,
    borderBottomWidth: 1,
    backgroundColor: "transparent",
  },

  // ── Goal grid ──
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  goalCard: {
    flexDirection: "column",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: 8,
  },
  goalLabel: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: -0.2,
  },
  goalBlurb: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ── Submit ──
  submitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    flexWrap: "wrap",
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
  },
  btnPrimaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  arrow: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 20,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: 1,
    paddingTop: 18,
    gap: 16,
    flexWrap: "wrap",
  },
});
