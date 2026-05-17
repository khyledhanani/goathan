"use client";

import { useEffect, useState } from "react";

function msUntilNextUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, next - now);
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

export function DayResetCountdown({ label = "Day resets in" }: { label?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const remaining = msUntilNextUtcMidnight(Date.now());
  void tick;
  return (
    <span className="countdown">
      <span className="countdown-label">{label}</span>{" "}
      <span className="countdown-value num">{formatRemaining(remaining)}</span>
    </span>
  );
}

function msUntilNextMonday(now: number): number {
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
  const startOfNextWeek = startOfThisWeek + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, startOfNextWeek - now);
}

function formatLong(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

export function WeekResetCountdown({
  label = "Comp ends in",
}: {
  label?: string;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const remaining = msUntilNextMonday(Date.now());
  void tick;
  return (
    <span className="countdown">
      <span className="countdown-label">{label}</span>{" "}
      <span className="countdown-value num">{formatLong(remaining)}</span>
    </span>
  );
}
