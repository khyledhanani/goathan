import type { FeedItem, Member, Task } from "@/lib/types";
import { ordinal } from "@/lib/utils";

export function TodayPage({
  groupName,
  tasks,
  weeklyTasks,
  completed,
  challenged,
  todaysPoints,
  yourRank,
  rankOf,
  perfectDayCount,
  totalTasks,
  perfectDay,
  feed,
  members,
  onToggle,
  onCallCap,
}: {
  groupName: string;
  tasks: Task[];
  weeklyTasks: Task[];
  completed: Set<string>;
  challenged: Set<string>;
  todaysPoints: number;
  yourRank: number;
  rankOf: number;
  perfectDayCount: number;
  totalTasks: number;
  perfectDay: boolean;
  feed: FeedItem[];
  members: Member[];
  onToggle: (id: string) => void;
  onCallCap: (id: string, label: string, who: string) => void;
}) {
  const memberById = (id: string) => members.find((m) => m.id === id);
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <span className="eyebrow">
            <b>{groupName}</b> · week 3
          </span>
          <h1 className="h-page" style={{ marginTop: 8 }}>
            Today<span className="roman">.</span>
          </h1>
        </div>
        <div className="meta-block">
          <span className="eyebrow">Slate posted</span>
          <span className="v">{dateStr}</span>
        </div>
      </header>

      <section className="stat-strip fade-up d1">
        <div className="stat">
          <div className="k">Points today</div>
          <div className="v num">{todaysPoints}</div>
          <div className="sub accent">
            {todaysPoints > 0 ? "On the board" : "Awaiting first lock-in"}
          </div>
        </div>
        <div className="stat">
          <div className="k">Rank</div>
          <div className="v num">
            {yourRank}
            <span className="ord">{ordinal(yourRank)}</span>
          </div>
          <div className="sub">of {rankOf} this week</div>
        </div>
        <div className="stat has-bar">
          <div className="k">Perfect day</div>
          <div className="v num">
            {perfectDayCount}
            <span style={{ color: "var(--mist)" }}>/{totalTasks}</span>
          </div>
          <div className="bar" style={{ ["--cols" as string]: totalTasks } as React.CSSProperties}>
            {Array.from({ length: totalTasks }).map((_, i) => (
              <span key={i} className={i < perfectDayCount ? "on" : ""} />
            ))}
          </div>
        </div>
        <div className="stat">
          <div className="k">Status</div>
          <div className="v" style={{ fontStyle: "italic" }}>
            {perfectDay ? "Perfect" : todaysPoints === 0 ? "Idle" : "Live"}
          </div>
          <div className="sub">{perfectDay ? "Receipt secured" : "Keep clocking in"}</div>
        </div>
      </section>

      <div className="today-grid">
        <section className="fade-up d2">
          <header className="section-head">
            <h2 className="h-section">The slate.</h2>
            <span className="eyebrow">{tasks.length} daily lines</span>
          </header>
          <div className="task-list">
            {tasks.map((t) => {
              const done = completed.has(t.id);
              const cid = `you-${t.id}`;
              const isCh = challenged.has(cid);
              return (
                <TaskRow
                  key={t.id}
                  task={t}
                  done={done}
                  challenged={isCh}
                  onToggle={() => onToggle(t.id)}
                  onCallCap={() => onCallCap(cid, t.name, "You")}
                />
              );
            })}
          </div>

          {weeklyTasks.length > 0 && (
            <>
              <header className="section-head" style={{ marginTop: 48 }}>
                <h2 className="h-section">Weekly lines.</h2>
                <span className="eyebrow">{weeklyTasks.length} bonus props</span>
              </header>
              <div className="task-list">
                {weeklyTasks.map((t) => {
                  const done = completed.has(t.id);
                  const cid = `you-${t.id}`;
                  const isCh = challenged.has(cid);
                  return (
                    <TaskRow
                      key={t.id}
                      task={t}
                      done={done}
                      challenged={isCh}
                      onToggle={() => onToggle(t.id)}
                      onCallCap={() => onCallCap(cid, t.name, "You")}
                    />
                  );
                })}
              </div>
            </>
          )}
        </section>

        <aside className="fade-up d3">
          <header className="section-head">
            <h2 className="h-section">The ticker.</h2>
            <span className="eyebrow">Live</span>
          </header>
          <div className="feed">
            {feed.map((f) => {
              const m = memberById(f.memberId);
              if (!m) return null;
              const isFresh = f.timeAgo === "now";
              return (
                <div key={f.id} className="feed-row">
                  <span className={`feed-dot ${f.capCall ? "cap" : isFresh ? "fresh" : ""}`} />
                  <div className="feed-text">
                    <b>{m.name}</b> {f.verb}{" "}
                    <span className={`obj ${f.capCall ? "cap" : f.isPerfectDay ? "win" : ""}`}>
                      {f.taskName}
                    </span>
                    {f.isPerfectDay && " ✦"}
                  </div>
                  <span className="feed-time">{f.timeAgo}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  done,
  challenged,
  onToggle,
  onCallCap,
}: {
  task: Task;
  done: boolean;
  challenged: boolean;
  onToggle: () => void;
  onCallCap: () => void;
}) {
  return (
    <div className={`task-row ${done ? "done" : ""} ${challenged ? "challenged" : ""}`}>
      <button
        className={`task-check ${done ? "checked" : ""} ${challenged ? "challenged" : ""}`}
        aria-label="Toggle complete"
        onClick={onToggle}
      >
        {done && (
          <svg viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>
      <div className="task-main">
        <h3 className="task-name">{task.name}</h3>
        <div className="task-meta">
          <span>
            <b>{task.category}</b>
          </span>
          <span className="sep">·</span>
          <span>
            Proof <b>{task.proof}</b>
          </span>
          <span className="sep">·</span>
          <span>{task.frequency}</span>
          {done && !challenged && <span className="task-tag lockedin">Locked in</span>}
          {done && challenged && <span className="task-tag capped">Cap called</span>}
        </div>
      </div>
      <div className="task-points">
        <span className="pts">{task.points}</span>
        {done && (
          <button className={`cap-btn ${challenged ? "called" : ""}`} onClick={onCallCap}>
            {challenged ? "Cap called" : "Call cap"}
          </button>
        )}
      </div>
    </div>
  );
}
