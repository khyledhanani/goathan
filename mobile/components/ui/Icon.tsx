import Svg, { Path, Circle } from "react-native-svg";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — line icon set (ported 1:1 from the prototype's data.jsx ICONS)
// Stroke-based (currentColor → `color`); pass `fill` for solid glyphs.
// ════════════════════════════════════════════════════════════════════════

export type IconName =
  | "home"
  | "groups"
  | "userPlus"
  | "groupsAdd"
  | "bell"
  | "person"
  | "chevL"
  | "chevR"
  | "chevD"
  | "heart"
  | "flame"
  | "eye"
  | "arrowR"
  | "flag"
  | "camera"
  | "check"
  | "plus"
  | "comment"
  | "x"
  | "settings"
  | "pencil"
  | "medal"
  | "share"
  | "clock"
  | "bolt";

type El = ["p", string] | ["c", number, number, number];

const ICONS: Record<IconName, El[]> = {
  home: [["p", "M3 10.5 12 3l9 7.5"], ["p", "M5 9.5V20h14V9.5"]],
  groups: [
    ["c", 9, 8, 3.2],
    ["p", "M3.4 19c0-3 2.5-5.2 5.6-5.2S14.6 16 14.6 19"],
    ["p", "M16 5.4a3 3 0 0 1 0 5.7M18.2 19c0-2.5-1-4-2.7-4.8"],
  ],
  userPlus: [
    ["c", 9, 8, 3.4],
    ["p", "M3.4 19.5c0-3.2 2.6-5.4 5.6-5.4 1 0 2 .25 2.8.7"],
    ["p", "M18 13.5v6M15 16.5h6"],
  ],
  groupsAdd: [
    ["c", 8.5, 8, 3.1],
    ["p", "M2.8 19c0-2.9 2.5-5 5.7-5 1 0 2 .2 2.8.6"],
    ["p", "M14.6 5.7a3 3 0 0 1 .2 5.7"],
    ["p", "M18.5 14.5v5M16 17h5"],
  ],
  bell: [
    ["p", "M18 8.5a6 6 0 1 0-12 0c0 5.5-2.2 6.8-2.2 6.8h16.4S18 14 18 8.5Z"],
    ["p", "M10.2 19a2 2 0 0 0 3.6 0"],
  ],
  person: [["c", 12, 8, 3.4], ["p", "M5.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"]],
  chevL: [["p", "M15 5l-7 7 7 7"]],
  chevR: [["p", "M9 5l7 7-7 7"]],
  chevD: [["p", "M5 9l7 7 7-7"]],
  heart: [["p", "M12 20.3 4.7 13a4.5 4.5 0 1 1 6.4-6.35l.9.9.9-.9A4.5 4.5 0 1 1 19.3 13Z"]],
  flame: [
    ["p", "M12 2.6c1.1 2.5 2 3.5 3.1 4.9 1.1 1.4 2.2 2.8 2.2 5a5.3 5.3 0 0 1-10.6 0c0-1.2.4-2.2 1.1-3.1.3.9.9 1.5 1.6 1.8C9 12.6 9.6 9.8 12 2.6Z"],
  ],
  eye: [
    ["p", "M2.6 12C2.6 12 6.1 6.7 12 6.7S21.4 12 21.4 12 17.9 17.3 12 17.3 2.6 12 2.6 12Z"],
    ["c", 12, 12, 2.5],
  ],
  arrowR: [["p", "M4 12h15"], ["p", "M13 6l6 6-6 6"]],
  flag: [["p", "M5 21V4"], ["p", "M5 4.5h11l-2.2 3.5L16 11.5H5"]],
  camera: [
    ["p", "M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.3-2h7.4L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z"],
    ["c", 12, 12.5, 3.4],
  ],
  check: [["p", "M4.5 12.5l5 5 10-11"]],
  plus: [["p", "M12 5v14"], ["p", "M5 12h14"]],
  comment: [["p", "M4 5.5h16v10H9l-4 3.2V15.5H4Z"]],
  x: [["p", "M6 6l12 12"], ["p", "M18 6 6 18"]],
  settings: [
    ["c", 12, 12, 3],
    ["p", "M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"],
  ],
  pencil: [
    ["p", "M14.5 5.5l4 4M4 20l1.2-4.2L15.5 5.5a2 2 0 0 1 3 3L8.2 18.8 4 20Z"],
  ],
  medal: [
    ["c", 12, 14.5, 5],
    ["p", "M8.5 10 6 3h4l2 4M15.5 10 18 3h-4l-2 4"],
    ["p", "M12 12.6l.9 1.8 2 .3-1.45 1.4.35 2L12 17.1l-1.8.95.35-2L9.1 14.7l2-.3Z"],
  ],
  share: [
    ["c", 6, 12, 2.4],
    ["c", 17, 6, 2.4],
    ["c", 17, 18, 2.4],
    ["p", "M8.1 11 14.9 7.2M8.1 13l6.8 3.8"],
  ],
  clock: [["c", 12, 12, 8.5], ["p", "M12 7.5V12l3 2"]],
  bolt: [["p", "M13 2 5 13h6l-1 9 8-12h-6l1-8Z"]],
};

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  /** When set, the glyph is filled with this color (used for active states). */
  fill?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, fill, strokeWidth = 1.6 }: IconProps) {
  const els = ICONS[name] ?? [];
  const fillColor = fill ?? "none";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {els.map((el, i) =>
        el[0] === "p" ? (
          <Path
            key={i}
            d={el[1]}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={fillColor}
          />
        ) : (
          <Circle
            key={i}
            cx={el[1]}
            cy={el[2]}
            r={el[3]}
            stroke={color}
            strokeWidth={strokeWidth}
            fill={fillColor}
          />
        ),
      )}
    </Svg>
  );
}
