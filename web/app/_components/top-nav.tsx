import type { Tab } from "@/lib/types";

export function TopNav({
  tab,
  setTab,
  groupName,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  groupName: string;
}) {
  const items: { key: Tab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "leaderboard", label: "Standings" },
    { key: "group", label: "Squad" },
    { key: "tasks", label: "Slate" },
  ];
  return (
    <header className="topnav">
      <div className="topnav-top">
        <span className="topnav-brand">
          Receipts.<span className="v">v0.1</span>
        </span>
        <span className="eyebrow">{groupName}</span>
      </div>
      <nav className="topnav-tabs">
        {items.map((it) => (
          <button
            key={it.key}
            className={`topnav-tab ${tab === it.key ? "active" : ""}`}
            onClick={() => setTab(it.key)}
          >
            {it.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
