import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";

export default function ExpandProofScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { completionId: cId } = useLocalSearchParams<{ completionId: string }>();
  const completionId = cId as Id<"completions">;

  const basket = useQuery(api.completions.claimBasketOptions, { completionId });
  const expandProof = useMutation(api.completions.expandProof);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);

  // Debug: log what the backend returns
  useMemo(() => {
    if (!basket) return;
    console.log("[ExpandProof] Backend returned", basket.groups.length, "groups:");
    for (const g of basket.groups) {
      console.log(`  [${g.groupName}] ${g.tasks.length} tasks:`, g.tasks.map((t: any) => t.name));
    }
  }, [basket]);

  const filteredGroups = useMemo(() => {
    if (!basket) return [];
    const q = search.trim().toLowerCase();
    return basket.groups
      .map((g: any) => ({
        ...g,
        tasks: g.tasks.filter((t: any) =>
          q ? t.name.toLowerCase().includes(q) : true,
        ),
      }))
      .filter((g: any) => g.tasks.length > 0);
  }, [basket, search]);

  const selectedTasks = useMemo(() => {
    if (!basket) return [];
    return basket.groups
      .flatMap((g: any) => g.tasks)
      .filter((t: any) => selected.has(t._id));
  }, [basket, selected]);

  const totalPoints = selectedTasks.reduce((sum: number, t: any) => sum + t.points, 0);

  const toggle = (taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else if (next.size < 39) next.add(taskId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      const additionalTaskIds = [...selected] as Id<"tasks">[];
      const result = await expandProof({ completionId, additionalTaskIds });
      if (result.ok) {
        setToast({
          message: `Verified ${result.completionIds.length} more tasks!`,
          tone: "success",
        });
        setTimeout(() => router.back(), 600);
      } else {
        setToast({ message: result.error, tone: "error" });
        setSubmitting(false);
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
      setSubmitting(false);
    }
  };

  if (!basket) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalAvailable = basket.groups.reduce((s: number, g: any) => s + g.tasks.length, 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.headerBar}>
          <AnimatedPressable scaleDown={0.95} onPress={() => router.back()} hitSlop={12}>
            <Text style={s.backBtn}>← back</Text>
          </AnimatedPressable>
        </View>

        <View style={s.pageHead}>
          <Text style={s.eyebrow}>Expand proof</Text>
          <Text style={s.title}>
            Use for more<Text style={{ color: colors.accent }}>.</Text>
          </Text>
          <Text style={s.subtitle}>
            This photo will be used as proof for each selected task.
          </Text>
        </View>

        {/* Search */}
        {totalAvailable > 5 && (
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks..."
            placeholderTextColor={colors.mist}
          />
        )}

        {/* Task list grouped by group */}
        {filteredGroups.map((g: any) => (
          <View key={g.groupId} style={s.groupSection}>
            <Text style={s.groupName}>{g.groupName}</Text>
            {g.tasks.map((task: any) => {
              const isSelected = selected.has(task._id);
              return (
                <AnimatedPressable
                  key={task._id}
                  scaleDown={0.98}
                  style={[
                    s.taskRow,
                    isSelected && { backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => toggle(task._id)}
                >
                  <View
                    style={[
                      s.checkbox,
                      isSelected && {
                        backgroundColor: colors.accent,
                        borderColor: colors.accent,
                      },
                    ]}
                  >
                    {isSelected && <Text style={s.checkMark}>✓</Text>}
                  </View>
                  <View style={s.taskInfo}>
                    <Text style={s.taskName}>{task.name}</Text>
                    <Text style={s.taskMeta}>
                      {task.category.toLowerCase()} ·{" "}
                      {task.frequency.toLowerCase()} · {task.proof.toLowerCase()}
                    </Text>
                  </View>
                  <Text style={s.taskPoints}>+{task.points}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        ))}

        {totalAvailable === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>
              No more image-proof tasks available this period.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky submit bar */}
      {selected.size > 0 && (
        <View style={s.submitBar}>
          <AnimatedPressable
            scaleDown={0.97}
            style={[
              s.submitBtn,
              { backgroundColor: submitting ? colors.paper3 : colors.ink },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.paper} />
            ) : (
              <Text style={s.submitText}>
                Submit {selected.size} more · +{totalPoints} pts
              </Text>
            )}
          </AnimatedPressable>
        </View>
      )}

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { fontFamily: fonts.mono, fontSize: 11, color: colors.fog, letterSpacing: 1.5, textTransform: "uppercase" },
    title: { fontFamily: fonts.serif, fontSize: 36, color: colors.ink, letterSpacing: -0.8 },
    scroll: { paddingHorizontal: 24, paddingBottom: 100 },

    headerBar: { paddingTop: 8, paddingBottom: 4 },
    backBtn: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.smoke, letterSpacing: 1.1, textTransform: "uppercase" },
    pageHead: { gap: 6, paddingVertical: 16, marginBottom: 12 },
    eyebrow: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog },
    subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.smoke, lineHeight: 21 },

    searchInput: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 10,
      marginBottom: 16,
    },

    groupSection: { marginBottom: 20 },
    groupName: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: colors.fog,
      marginBottom: 6,
    },

    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      marginBottom: 2,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.rule,
      justifyContent: "center",
      alignItems: "center",
    },
    checkMark: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.paper,
    },
    taskInfo: { flex: 1, gap: 1 },
    taskName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
    taskMeta: { fontFamily: fonts.mono, fontSize: 9, color: colors.mist, letterSpacing: 0.5 },
    taskPoints: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.accent },

    emptyState: { paddingVertical: 40, alignItems: "center" },
    emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.fog, textAlign: "center" },

    submitBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingVertical: 16,
      paddingBottom: 32,
      backgroundColor: colors.paperTranslucent,
    },
    submitBtn: {
      paddingVertical: 16,
      borderRadius: radii.pill,
      alignItems: "center",
    },
    submitText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 15,
      color: colors.paper,
      letterSpacing: 0.1,
    },
  });
