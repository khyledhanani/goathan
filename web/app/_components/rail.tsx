import type { ReactNode } from "react";
import type { Member, Tab } from "@/lib/types";

export function Rail({
  tab,
  setTab,
  groupName,
  you,
  yourRank,
  ranked,
  liveYouPoints,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  groupName: string;
  you?: Member;
  yourRank: number;
  ranked: Member[];
  liveYouPoints: number;
}) {
  const items: { key: Tab; label: string; key2: string; icon: ReactNode }[] = [
    {
      key: "today",
      label: "Today",
      key2: "01",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      ),
    },
    {
      key: "leaderboard",
      label: "Standings",
      key2: "02",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path d="M4 20V11M11 20V5M18 20v-6" />
        </svg>
      ),
    },
    {
      key: "group",
      label: "Squad",
      key2: "03",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="9" cy="9" r="3.2" />
          <circle cx="17" cy="11" r="2.4" />
          <path d="M3.5 19c.8-3 3.2-4.6 5.5-4.6s4.7 1.6 5.5 4.6" />
          <path d="M15 18.5c.8-2 2.3-2.9 3.8-2.9 1.2 0 2.1.5 2.7 1.4" />
        </svg>
      ),
    },
    {
      key: "tasks",
      label: "Slate",
      key2: "04",
      icon: (
        <svg className="ico" viewBox="0 0 24 24">
          <path d="M4 6h12M4 12h12M4 18h8" />
          <path d="M19 5l-2 2-1-1" />
          <path d="M19 11l-2 2-1-1" />
          <path d="M19 17l-2 2-1-1" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="rail">
      <div className="rail-brand">
        <span className="wordmark">Receipts.</span>
        <span className="v">v0.1</span>
      </div>

      <nav className="rail-nav">
        {items.map((it) => (
          <button
            key={it.key}
            className={`rail-nav-item ${tab === it.key ? "active" : ""}`}
            onClick={() => setTab(it.key)}
          >
            {it.icon}
            <span>{it.label}</span>
            <span className="key">{it.key2}</span>
          </button>
        ))}
      </nav>

      <div className="rail-spacer" />

      <div className="rail-foot">
        <span className="label">Your squad</span>
        <div className="squad">{groupName}</div>
        <div className="you-line">
          <span>Rank</span>
          <span className="v num">#{yourRank} / {ranked.length}</span>
        </div>
        <div className="you-line">
          <span>Pts / week</span>
          <span className="v num">{liveYouPoints}</span>
        </div>
        <div className="you-line" style={{ marginTop: 4 }}>
          <span>Signed in</span>
          <span className="v" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            {you?.name}
          </span>
        </div>
      </div>
    </aside>
  );
}
