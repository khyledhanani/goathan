import type { Member } from "@/lib/types";
import { ordinal } from "@/lib/utils";

export function LeaderboardPage({
  groupName,
  ranked,
  leader,
  gapToLeader,
  yourRank,
  youPoints,
}: {
  groupName: string;
  ranked: Member[];
  leader?: Member;
  gapToLeader: number;
  yourRank: number;
  youPoints: number;
}) {
  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <span className="eyebrow">
            <b>{groupName}</b> · week 3
          </span>
          <h1 className="h-page" style={{ marginTop: 8 }}>
            Standings<span className="roman">.</span>
          </h1>
        </div>
        <div className="meta-block">
          <span className="eyebrow">Closes</span>
          <span className="v">Sun · 11:59 PM</span>
        </div>
      </header>

      <section className="lead-summary fade-up d1">
        <div className="quote">
          <span className="name">{leader?.name}</span> is on top with{" "}
          <span className="num" style={{ fontStyle: "normal" }}>{leader?.weeklyPoints}</span> points
          this week — and {ranked.length - 1} others are chasing.
        </div>
        <div className="you-card">
          <div className="label">You stand</div>
          <div className="v">
            {yourRank}
            <span className="ord">{ordinal(yourRank)}</span>
          </div>
          <div className="gap">
            <b>{youPoints}</b> pts ·{" "}
            {gapToLeader === 0 ? "leading" : `${gapToLeader} behind ${leader?.name}`}
          </div>
        </div>
      </section>

      <header className="section-head">
        <h2 className="h-section">The board.</h2>
        <span className="eyebrow">Points · this week</span>
      </header>

      <div className="lead-table fade-up d2">
        {ranked.map((m, i) => (
          <div key={m.id} className={`lead-row ${m.isYou ? "you" : ""}`} data-pos={i + 1}>
            <span className="lead-rank num">{(i + 1).toString().padStart(2, "0")}</span>
            <div className="lead-main">
              <div className="lead-name">
                {m.name}
                {m.isYou && <span className="you-tag">You</span>}
              </div>
              <div className="lead-sub">
                {m.handle} · {m.isAdmin ? "Admin" : "Member"}
              </div>
            </div>
            <div className="lead-points num">
              {m.weeklyPoints}
              <span className="l">pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
