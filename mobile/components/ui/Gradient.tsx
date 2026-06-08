import { useId, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — real linear gradient. expo-linear-gradient isn't installed, but
// react-native-svg is, so we paint a <Rect> filled with an <SvgLinearGradient>.
//
// We MEASURE the container and draw with exact pixel dimensions — SVG "100%"
// sizing is unreliable inside flex/absolute parents (it collapsed to ~20px),
// so the Rect is given concrete width/height instead.
// Renders as a touch-transparent, absolute-fill layer by default — drop it
// behind overlay content for a true fade (not a flat band).
// ════════════════════════════════════════════════════════════════════════

export interface GradientStop {
  /** 0 (start) … 1 (end) */
  offset: number;
  color: string;
  /** 0 … 1 (defaults to 1) */
  opacity?: number;
}

interface Props {
  stops: GradientStop[];
  /** Direction in 0…1 bounding-box space. Defaults to top → bottom. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
}

export function LinearGradient({
  stops,
  start = { x: 0, y: 0 },
  end = { x: 0, y: 1 },
  style,
}: Props) {
  // useId is stable per instance + deterministic across renders. SVG ids can't
  // contain ":" inside url(#…), so strip the colons React inserts.
  const id = `grad-${useId().replace(/:/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w !== width || prev.h !== height ? { w: width, h: height } : prev));
  };

  return (
    <View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, style]}>
      {size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <SvgLinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
              {stops.map((stop, i) => (
                <Stop
                  key={i}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity ?? 1}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}
