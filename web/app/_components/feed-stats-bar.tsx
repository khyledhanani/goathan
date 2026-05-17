"use client";

import { useEffect, useState } from "react";

function nextLocalMidnightUTC(now: number): number {
  const d = new Date(now);
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0),
  );
  return next.getTime();
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hr = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  if (hr > 0) return `${hr}h ${min}m`;
  return `${min}m`;
}

export function FeedStatsBar({
  todayDone,
  totalDailyTasks,
  todayPoints,
  groupCount,
}: {
  todayDone: number;
  totalDailyTasks: number;
  todayPoints: number;
  groupCount: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const remaining = formatRemaining(nextLocalMidnightUTC(Date.now()) - Date.now());

  return (
    <div className="feed-stats-bar fade-up">
      <span className="feed-stats-cell">
        <span className="num">{todayDone}</span>
        <span className="feed-stats-slash">/</span>
        <span className="num">{totalDailyTasks}</span>
        <span className="feed-stats-label">done</span>
      </span>
      <span className="feed-stats-cell">
        <span className="num">{todayPoints}</span>
        <span className="feed-stats-label">pts</span>
      </span>
      <span className="feed-stats-cell">
        <span className="num">{groupCount}</span>
        <span className="feed-stats-label">
          {groupCount === 1 ? "group" : "groups"}
        </span>
      </span>
      <span className="feed-stats-cell feed-stats-countdown">
        <span className="feed-stats-label">resets in</span>
        <span className="num">{remaining}</span>
      </span>
    </div>
  );
}
