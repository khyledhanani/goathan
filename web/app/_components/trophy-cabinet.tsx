"use client";

import Link from "next/link";
import type { Id } from "../../convex/_generated/dataModel";

type Medal = "GOLD" | "SILVER" | "BRONZE";

type TrophyItem = {
  _id: Id<"weekResults">;
  weekKey: string;
  weekEndMs: number;
  groupId: Id<"groups">;
  groupName: string;
  rank: number;
  weekPoints: number;
  medal: Medal;
};

type TrophyData = {
  counts: { gold: number; silver: number; bronze: number };
  items: TrophyItem[];
};

function formatWeekRange(weekEndMs: number): string {
  const end = new Date(weekEndMs - 1);
  const start = new Date(weekEndMs - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${fmt(start)} – ${end.getUTCDate()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

export function TrophyCabinet({
  data,
  emptyOwn,
}: {
  data: TrophyData | null | undefined;
  emptyOwn: boolean;
}) {
  if (data === undefined) {
    return <p className="muted-line">Loading…</p>;
  }
  if (data === null || data.items.length === 0) {
    return (
      <div className="activity-empty">
        <p className="eyebrow">No medals yet</p>
        <p className="activity-empty-line">
          {emptyOwn
            ? "Finish a week in the top 3 of any group and your trophy lands here."
            : "Nothing to show yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="trophy-cabinet">
      <div className="trophy-counts">
        <span className="trophy-count trophy-count-gold">
          <MedalGlyph medal="GOLD" />
          <span className="num">{data.counts.gold}</span>
        </span>
        <span className="trophy-count trophy-count-silver">
          <MedalGlyph medal="SILVER" />
          <span className="num">{data.counts.silver}</span>
        </span>
        <span className="trophy-count trophy-count-bronze">
          <MedalGlyph medal="BRONZE" />
          <span className="num">{data.counts.bronze}</span>
        </span>
      </div>

      <ul className="trophy-list">
        {data.items.map((t) => (
          <li key={t._id} className={`trophy-row trophy-row-${t.medal.toLowerCase()}`}>
            <span className="trophy-row-medal">
              <MedalGlyph medal={t.medal} />
            </span>
            <span className="trophy-row-meta">
              <Link
                href={`/group/${t.groupId}`}
                className="trophy-row-group"
              >
                {t.groupName}
              </Link>
              <span className="trophy-row-week mono">
                {formatWeekRange(t.weekEndMs)}
              </span>
            </span>
            <span className="trophy-row-pts num">
              {t.weekPoints} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MedalGlyph({ medal }: { medal: Medal }) {
  const color =
    medal === "GOLD"
      ? "var(--medal-gold)"
      : medal === "SILVER"
        ? "var(--medal-silver)"
        : "var(--medal-bronze)";
  const initial = medal === "GOLD" ? "1" : medal === "SILVER" ? "2" : "3";
  return (
    <span className="medal" aria-label={`${medal.toLowerCase()} medal`}>
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path
          d="M7.5 2h9l1.5 4.5L12 9 6 6.5z"
          fill={color}
          opacity="0.55"
        />
        <circle
          cx="12"
          cy="15.5"
          r="6.5"
          fill={color}
          stroke="var(--ink)"
          strokeWidth="0.6"
        />
        <text
          x="12"
          y="18"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fill="var(--ink)"
          fontFamily="var(--font-mono), monospace"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
}
