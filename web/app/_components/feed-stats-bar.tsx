"use client";

import { useEffect, useState } from "react";

function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
  );
}

function nextMondayUtc(now: number): number {
  const d = new Date(now);
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  const startOfThisWeek = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysFromMonday,
    0,
    0,
    0,
  );
  return startOfThisWeek + 7 * 24 * 60 * 60 * 1000;
}

function formatHM(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hr = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  if (hr > 0) return `${hr}h ${min}m`;
  return `${min}m`;
}

function formatDH(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const day = Math.floor(total / 86400);
  const hr = Math.floor((total % 86400) / 3600);
  if (day > 0) return `${day}d ${hr}h`;
  return `${hr}h`;
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

  const dayRemaining = formatHM(nextUtcMidnight(Date.now()) - Date.now());
  const weekRemaining = formatDH(nextMondayUtc(Date.now()) - Date.now());

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
        <span className="feed-stats-label">pts today</span>
      </span>
      <span className="feed-stats-cell">
        <span className="num">{groupCount}</span>
        <span className="feed-stats-label">
          {groupCount === 1 ? "group" : "groups"}
        </span>
      </span>
      <span className="feed-stats-cell feed-stats-countdown">
        <span className="feed-stats-cd-row">
          <span className="feed-stats-label">day</span>
          <span className="num">{dayRemaining}</span>
        </span>
        <span className="feed-stats-cd-row feed-stats-cd-week">
          <span className="feed-stats-label">comp</span>
          <span className="num">{weekRemaining}</span>
        </span>
      </span>
    </div>
  );
}
