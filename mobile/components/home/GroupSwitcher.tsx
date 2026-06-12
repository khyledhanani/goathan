import { useRef } from "react";
import { View, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolateColor,
  type SharedValue,
} from "react-native-reanimated";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { SwitcherTab } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — GroupSwitcher (port of the prototype's GroupTabs)
// A single horizontal row of serif tab labels whose active tab is centered.
// The whole thing is driven by the pager's live scroll offset (scrollX): as
// you drag Feed→Group→Group, the centered tab and the per-tab emphasis
// (size via scale, colour, accent ".") interpolate CONTINUOUSLY with the drag
// — stop halfway and the switcher sits halfway. Tabs render at the active
// size and shrink via transform so layout (and thus centering) stays stable.
// ════════════════════════════════════════════════════════════════════════

const ACTIVE_SIZE = 25;
const INACTIVE_RATIO = 19 / 25; // inactive label ≈ serif 19 → scale ~0.76

interface Props {
  tabs: SwitcherTab[];
  /** Live pager scroll offset (px) on the UI thread. */
  scrollX: SharedValue<number>;
  /** Width of one pager page (px) — scrollX / pageWidth = fractional tab index. */
  pageWidth: number;
  onPick: (i: number) => void;
}

export function GroupSwitcher({ tabs, scrollX, pageWidth, onPick }: Props) {
  const c = useThemeColors();
  const s = styles(c);

  // Per-tab centre offsets within the row (measured), mirrored into a shared
  // value so the position worklet can read them on the UI thread.
  const metrics = useRef<{ x: number; width: number }[]>([]);
  const centers = useSharedValue<number[]>([]);
  const vw = useSharedValue(0);

  const onTabLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    metrics.current[i] = { x, width };
    centers.value = tabs.map((_, j) => {
      const m = metrics.current[j];
      return m ? m.x + m.width / 2 : 0;
    });
  };

  // Translate the row so the interpolated active-tab centre sits at the
  // viewport centre — tracks scrollX frame-by-frame. The row stays invisible
  // until every tab is measured + the viewport is known, so it never paints a
  // left-aligned frame that then pops to centre on mount.
  const tabCount = tabs.length;
  const rowStyle = useAnimatedStyle(() => {
    const cs = centers.value;
    const n = cs.length;
    let ready = n >= tabCount && tabCount > 0 && vw.value > 0 && pageWidth > 0;
    if (ready) {
      for (let k = 0; k < n; k++) {
        if (cs[k] <= 0) {
          ready = false;
          break;
        }
      }
    }
    if (!ready) {
      return { opacity: 0, transform: [{ translateX: 0 }] };
    }
    const p = scrollX.value / pageWidth;
    const cp = Math.min(Math.max(p, 0), n - 1);
    const i0 = Math.floor(cp);
    const i1 = Math.min(i0 + 1, n - 1);
    const center = cs[i0] + (cs[i1] - cs[i0]) * (cp - i0);
    return { opacity: 1, transform: [{ translateX: vw.value / 2 - center }] };
  });

  return (
    <View
      style={s.viewport}
      onLayout={(e) => {
        vw.value = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View style={[s.row, rowStyle]}>
        {tabs.map((t, i) => (
          <Tab
            key={t.key}
            label={t.label}
            index={i}
            scrollX={scrollX}
            pageWidth={pageWidth}
            colors={c}
            onPress={() => onPick(i)}
            onLayout={onTabLayout(i)}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// One tab. Emphasis (scale + dim + colour + accent dot) interpolates with the
// drag distance from this tab.
function Tab({
  label,
  index,
  scrollX,
  pageWidth,
  colors,
  onPress,
  onLayout,
}: {
  label: string;
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  colors: Colors;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const s = styles(colors);

  const emphasis = useAnimatedStyle(() => {
    const p = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const d = Math.min(Math.abs(p - index), 1);
    return {
      transform: [{ scale: 1 - d * (1 - INACTIVE_RATIO) }],
      opacity: 1 - d * 0.5,
    };
  });

  const labelColor = useAnimatedStyle(() => {
    const p = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const d = Math.min(Math.abs(p - index), 1);
    return { color: interpolateColor(d, [0, 1], [colors.inkStrong, colors.mutedDim]) };
  });

  return (
    <AnimatedPressable
      scaleDown={0.96}
      dimOnPress={false}
      haptic={null}
      onPress={onPress}
      onLayout={onLayout}
      style={s.tab}
    >
      <Animated.View style={[s.tabInner, emphasis]}>
        <Animated.Text style={[s.label, labelColor]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    viewport: {
      overflow: "hidden",
      alignSelf: "stretch",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    tab: {
      flexShrink: 0,
      paddingVertical: 2,
      marginHorizontal: 7,
    },
    tabInner: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    label: {
      fontFamily: fonts.serif,
      fontSize: ACTIVE_SIZE,
      lineHeight: 28,
      includeFontPadding: false,
      color: c.inkStrong,
    },
  });
