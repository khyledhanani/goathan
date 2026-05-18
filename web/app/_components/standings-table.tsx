"use client";

import type { Id } from "../../convex/_generated/dataModel";

type StandingsRow = {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isAdmin: boolean;
  isYou: boolean;
  weekPoints: number;
  perfectDays?: number;
};

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  if (rows.length === 0) {
    return <p className="muted-line">No one on the board yet.</p>;
  }

  return (
    <ol className="standings">
      {rows.map((row, idx) => (
        <li
          key={row.userId}
          className={`standings-row ${row.isYou ? "you" : ""}`}
        >
          <span className="standings-rank num">
            {String(idx + 1).padStart(2, "0")}
          </span>
          {row.avatarUrl ? (
            <img
              src={row.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="avatar"
            />
          ) : (
            <span className="avatar avatar-fallback">
              {row.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="standings-main">
            <span className="standings-name">
              {row.displayName}
              {row.isYou && <span className="standings-you">you</span>}
            </span>
            <span className="standings-sub">
              {row.username ? `@${row.username}` : "—"}
              {row.isAdmin && " · admin"}
              {row.perfectDays !== undefined && row.perfectDays > 0 && (
                <span className="standings-perfect mono">
                  {" · "}
                  <span className="num">{row.perfectDays}</span>{" "}
                  perfect day{row.perfectDays === 1 ? "" : "s"}
                </span>
              )}
            </span>
          </div>
          <div className="standings-pts">
            <span className="num">{row.weekPoints}</span>
            <span className="pts-label">pts</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
