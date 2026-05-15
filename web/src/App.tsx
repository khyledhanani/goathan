import { useEffect, useMemo, useState } from "react";

/* ============================================================
   RECEIPTS — editorial sports terminal
   Mocked data, local state only.
   ============================================================ */

type Category = "GYM" | "CARDIO" | "NUTRITION" | "RECOVERY" | "PROGRESS";
type Frequency = "DAILY" | "WEEKLY";
type Proof = "PHOTO" | "SCREENSHOT" | "MANUAL" | "VIDEO";

type Task = {
  id: string;
  name: string;
  description: string;
  category: Category;
  points: number;
  frequency: Frequency;
  proof: Proof;
};

type Member = {
  id: string;
  name: string;
  handle: string;
  weeklyPoints: number;
  isYou?: boolean;
  isAdmin?: boolean;
};

type FeedItem = {
  id: string;
  memberId: string;
  verb: "completed" | "hit" | "locked in" | "claimed" | "called cap on";
  taskName: string;
  isPerfectDay?: boolean;
  capCall?: boolean;
  timeAgo: string;
};

type View = "auth" | "group-setup" | "app";
type Tab = "today" | "leaderboard" | "group" | "tasks";

/* ============================================================
   Seed
   ============================================================ */

const SEED_TASKS: Task[] = [
  { id: "t1", name: "Gym check-in",   description: "Scan in at the gym. Geofenced.",          category: "GYM",       points: 25, frequency: "DAILY", proof: "PHOTO" },
  { id: "t2", name: "10K steps",      description: "Hit 10,000 steps before midnight.",       category: "CARDIO",    points: 15, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t3", name: "Protein goal",   description: "Hit 1g per pound bodyweight.",            category: "NUTRITION", points: 20, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t4", name: "Calorie target", description: "Stay in your cut or bulk window.",        category: "NUTRITION", points: 15, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t5", name: "Water goal",     description: "Drink at least one gallon.",              category: "NUTRITION", points: 10, frequency: "DAILY", proof: "MANUAL" },
  { id: "t6", name: "Workout logged", description: "Log a full workout in your tracker.",     category: "GYM",       points: 20, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t7", name: "Seven hours",    description: "No excuses. Seven hours of sleep min.",   category: "RECOVERY",  points: 10, frequency: "DAILY", proof: "SCREENSHOT" },
];

const SEED_WEEKLY: Task[] = [
  { id: "tw1", name: "PR or weight target", description: "Hit a personal record or weight goal.", category: "GYM",      points: 50, frequency: "WEEKLY", proof: "VIDEO" },
  { id: "tw2", name: "Progress check",      description: "Post a Sunday progress pic.",           category: "PROGRESS", points: 30, frequency: "WEEKLY", proof: "PHOTO" },
];

const SEED_MEMBERS: Omit<Member, "isYou">[] = [
  { id: "m1", name: "Rayhan", handle: "@rayy",         weeklyPoints: 412 },
  { id: "m2", name: "Kamran", handle: "@kam",          weeklyPoints: 388, isAdmin: true },
  { id: "m3", name: "Ayaan",  handle: "@ayaan.lifts",  weeklyPoints: 305 },
  { id: "m4", name: "Maya",   handle: "@maya.bee",     weeklyPoints: 279 },
  { id: "m5", name: "Devon",  handle: "@dev1k",        weeklyPoints: 254 },
  { id: "m6", name: "Priya",  handle: "@p.ria",        weeklyPoints: 198 },
];

const SEED_FEED: FeedItem[] = [
  { id: "f1", memberId: "m1", verb: "completed",      taskName: "Gym check-in",            timeAgo: "2m" },
  { id: "f2", memberId: "m2", verb: "hit",            taskName: "Protein goal",            timeAgo: "11m" },
  { id: "f3", memberId: "m3", verb: "locked in",      taskName: "Workout logged",          timeAgo: "27m" },
  { id: "f4", memberId: "m4", verb: "claimed",        taskName: "a perfect day",           isPerfectDay: true, timeAgo: "48m" },
  { id: "f5", memberId: "m5", verb: "called cap on",  taskName: "Rayhan's 10K steps",      capCall: true, timeAgo: "1h" },
  { id: "f6", memberId: "m1", verb: "hit",            taskName: "Seven hours",             timeAgo: "3h" },
];

const CATEGORIES: Category[] = ["GYM", "CARDIO", "NUTRITION", "RECOVERY", "PROGRESS"];
const FREQUENCIES: Frequency[] = ["DAILY", "WEEKLY"];
const PROOFS: Proof[] = ["PHOTO", "SCREENSHOT", "MANUAL", "VIDEO"];

/* ============================================================
   Helpers
   ============================================================ */

const genCode = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

/* ============================================================
   ROOT
   ============================================================ */

export default function App() {
  const [view, setView] = useState<View>("auth");
  const [userName, setUserName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([...SEED_TASKS, ...SEED_WEEKLY]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [challenged, setChallenged] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<FeedItem[]>(SEED_FEED);
  const [tab, setTab] = useState<Tab>("today");
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const todayTasks = useMemo(() => tasks.filter((t) => t.frequency === "DAILY"), [tasks]);
  const weeklyTasks = useMemo(() => tasks.filter((t) => t.frequency === "WEEKLY"), [tasks]);

  const todaysPoints = useMemo(
    () => todayTasks.filter((t) => completed.has(t.id)).reduce((s, t) => s + t.points, 0),
    [todayTasks, completed],
  );

  const perfectDayCount = useMemo(
    () => todayTasks.filter((t) => completed.has(t.id)).length,
    [todayTasks, completed],
  );

  const perfectDay = perfectDayCount === todayTasks.length && todayTasks.length > 0;

  const you = useMemo(() => members.find((m) => m.isYou), [members]);

  const liveMembers = useMemo<Member[]>(
    () => members.map((m) => (m.isYou ? { ...m, weeklyPoints: m.weeklyPoints + todaysPoints } : m)),
    [members, todaysPoints],
  );

  const ranked = useMemo(
    () => [...liveMembers].sort((a, b) => b.weeklyPoints - a.weeklyPoints),
    [liveMembers],
  );

  const yourRank = useMemo(() => {
    const i = ranked.findIndex((m) => m.isYou);
    return i === -1 ? 0 : i + 1;
  }, [ranked]);

  const leader = ranked[0];
  const youLive = ranked.find((m) => m.isYou);
  const gapToLeader = leader && youLive ? Math.max(0, leader.weeklyPoints - youLive.weeklyPoints) : 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- actions ---- */

  const onAuth = (name: string) => {
    setUserName(titleCase(name.trim()) || "You");
    setView("group-setup");
  };

  const onCreate = (name: string) => {
    setGroupName(titleCase(name.trim()) || "The Squad");
    setInviteCode(genCode());
    const m: Member[] = [
      { id: "you", name: userName || "You", handle: "@you", weeklyPoints: 0, isYou: true, isAdmin: true },
      ...SEED_MEMBERS.map((mm) => ({ ...mm })),
    ];
    setMembers(m);
    setView("app");
  };

  const onJoin = (code: string) => {
    setGroupName("The Locker Room");
    setInviteCode(code.toUpperCase());
    const m: Member[] = [
      { id: "you", name: userName || "You", handle: "@you", weeklyPoints: 0, isYou: true, isAdmin: false },
      ...SEED_MEMBERS.map((mm) => ({ ...mm })),
    ];
    setMembers(m);
    setView("app");
  };

  const toggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
        setFeed((f) => f.filter((x) => !(x.taskName === task.name && x.memberId === "you")));
      } else {
        next.add(taskId);
        const verb: FeedItem["verb"] = task.category === "NUTRITION" ? "hit" : "locked in";
        setFeed((f) => [
          {
            id: `you-${Date.now()}`,
            memberId: "you",
            verb,
            taskName: task.name,
            timeAgo: "now",
          },
          ...f,
        ]);
      }
      return next;
    });
  };

  const callCap = (id: string, label: string, who: string) => {
    setChallenged((prev) => {
      const next = new Set(prev);
      const wasChallenged = next.has(id);
      if (wasChallenged) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!challenged.has(id)) {
      setFeed((f) => [
        {
          id: `cap-${Date.now()}`,
          memberId: "you",
          verb: "called cap on",
          taskName: `${who}'s ${label}`,
          capCall: true,
          timeAgo: "now",
        },
        ...f,
      ]);
    }
  };

  const addTask = (t: Omit<Task, "id">) => {
    setTasks((prev) => [...prev, { ...t, id: `tn-${Date.now()}` }]);
    setAddOpen(false);
    setToast("New line added to the slate");
  };

  /* ============================================================
     Render
     ============================================================ */

  if (view === "auth") {
    return (
      <>
        <AuthScreen onSubmit={onAuth} />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  if (view === "group-setup") {
    return (
      <>
        <GroupSetupScreen userName={userName} onCreate={onCreate} onJoin={onJoin} />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  return (
    <div className="app has-rail">
      <Rail
        tab={tab}
        setTab={setTab}
        groupName={groupName}
        you={you}
        yourRank={yourRank}
        ranked={ranked}
        liveYouPoints={youLive?.weeklyPoints ?? 0}
      />
      <TopNav tab={tab} setTab={setTab} groupName={groupName} />
      <main className="main">
        {tab === "today" && (
          <TodayPage
            groupName={groupName}
            tasks={todayTasks}
            weeklyTasks={weeklyTasks}
            completed={completed}
            challenged={challenged}
            todaysPoints={todaysPoints}
            yourRank={yourRank}
            rankOf={ranked.length}
            perfectDayCount={perfectDayCount}
            totalTasks={todayTasks.length}
            perfectDay={perfectDay}
            feed={feed.slice(0, 7)}
            members={liveMembers}
            onToggle={toggleTask}
            onCallCap={callCap}
          />
        )}
        {tab === "leaderboard" && (
          <LeaderboardPage
            groupName={groupName}
            ranked={ranked}
            leader={leader}
            gapToLeader={gapToLeader}
            yourRank={yourRank}
            youPoints={youLive?.weeklyPoints ?? 0}
          />
        )}
        {tab === "group" && (
          <GroupPage
            groupName={groupName}
            inviteCode={inviteCode}
            members={liveMembers}
            youAdmin={you?.isAdmin}
            onCopy={() => {
              navigator.clipboard?.writeText(inviteCode).catch(() => {});
              setToast("Invite code copied");
            }}
          />
        )}
        {tab === "tasks" && (
          <TasksPage
            tasks={tasks}
            isAdmin={you?.isAdmin}
            onAdd={() => setAddOpen(true)}
          />
        )}
      </main>
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} onAdd={addTask} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ============================================================
   AUTH
   ============================================================ */

function AuthScreen({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="entry">
      <div className="entry-top fade-up">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <span className="eyebrow"><b>Private</b> · invite only</span>
      </div>

      <div className="entry-mid">
        <h1 className="entry-hed fade-up d1">
          Keep each other<br />
          <span className="underline">honest.</span>
        </h1>
        <p className="entry-dek fade-up d2">
          A private squad. A daily slate. Points for what you actually do — and a way
          to call out the friends who didn't.
        </p>

        <div className="fade-up d3" style={{ maxWidth: 420 }}>
          <label className="field">
            <span className="field-label">
              <span>Display name</span>
              <span className="hint">Visible to your squad</span>
            </span>
            <input
              className="field-input"
              placeholder="What should we tag you as"
              value={name}
              maxLength={22}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onSubmit(name);
              }}
            />
          </label>

          <div style={{ marginTop: 28, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              className="btn-primary"
              disabled={!name.trim()}
              onClick={() => onSubmit(name)}
            >
              Lock in
              <span className="arrow">→</span>
            </button>
            <span className="eyebrow">No password. No email.</span>
          </div>
        </div>
      </div>

      <div className="entry-foot fade-up d4">
        <span className="eyebrow">© Receipts · keep score</span>
        <div className="lattice">
          <div>
            <span className="k">Squads</span>
            <span className="v">Invite&nbsp;only</span>
          </div>
          <div>
            <span className="k">Scoring</span>
            <span className="v">Pts / week</span>
          </div>
          <div>
            <span className="k">Referee</span>
            <span className="v">Your&nbsp;friends</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   GROUP SETUP
   ============================================================ */

function GroupSetupScreen({
  userName,
  onCreate,
  onJoin,
}: {
  userName: string;
  onCreate: (name: string) => void;
  onJoin: (code: string) => void;
}) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [gname, setGname] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="entry">
      <div className="entry-top fade-up">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <span className="eyebrow">Welcome, <b>{userName}</b></span>
      </div>

      <div className="entry-mid">
        <h1 className="entry-hed fade-up d1">
          Start a <span className="underline">squad</span>.
        </h1>
        <p className="entry-dek fade-up d2">
          Make a private group with friends, or drop in with a code someone sent you.
        </p>

        <div className="fade-up d3" style={{ maxWidth: 460 }}>
          <div className="seg">
            <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
              Create
            </button>
            <span className="seg-dot">/</span>
            <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
              Join with code
            </button>
          </div>

          {mode === "create" ? (
            <>
              <label className="field">
                <span className="field-label">
                  <span>Squad name</span>
                  <span className="hint">You'll be admin</span>
                </span>
                <input
                  className="field-input"
                  placeholder="The Goon Squad"
                  value={gname}
                  maxLength={22}
                  onChange={(e) => setGname(e.target.value)}
                />
              </label>
              <div style={{ marginTop: 28 }}>
                <button className="btn-primary" disabled={!gname.trim()} onClick={() => onCreate(gname)}>
                  Open lobby<span className="arrow">→</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">
                  <span>Invite code</span>
                  <span className="hint">6 characters</span>
                </span>
                <input
                  className="field-input mono-input"
                  placeholder="ABC123"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                />
              </label>
              <div style={{ marginTop: 28 }}>
                <button className="btn-primary" disabled={code.length !== 6} onClick={() => onJoin(code)}>
                  Join squad<span className="arrow">→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="entry-foot fade-up d4">
        <span className="eyebrow">Step <b>2 / 2</b></span>
        <span className="eyebrow">Private group · no public discovery</span>
      </div>
    </div>
  );
}

/* ============================================================
   RAIL (desktop sidebar)
   ============================================================ */

function Rail({
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
  const items: { key: Tab; label: string; key2: string; icon: JSX.Element }[] = [
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

/* ============================================================
   TOP NAV (mobile)
   ============================================================ */

function TopNav({
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

/* ============================================================
   TODAY
   ============================================================ */

function TodayPage({
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
          <span className="eyebrow"><b>{groupName}</b> · week 3</span>
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
            {yourRank}<span className="ord">{ordinal(yourRank)}</span>
          </div>
          <div className="sub">of {rankOf} this week</div>
        </div>
        <div className="stat has-bar">
          <div className="k">Perfect day</div>
          <div className="v num">{perfectDayCount}<span style={{ color: "var(--mist)" }}>/{totalTasks}</span></div>
          <div className="bar" style={{ ["--cols" as any]: totalTasks }}>
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
                    <b>{m.name}</b>{" "}
                    {f.verb}{" "}
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
          <span><b>{task.category}</b></span>
          <span className="sep">·</span>
          <span>Proof <b>{task.proof}</b></span>
          <span className="sep">·</span>
          <span>{task.frequency}</span>
          {done && !challenged && <span className="task-tag lockedin">Locked in</span>}
          {done && challenged && <span className="task-tag capped">Cap called</span>}
        </div>
      </div>
      <div className="task-points">
        <span className="pts">{task.points}</span>
        {done && (
          <button
            className={`cap-btn ${challenged ? "called" : ""}`}
            onClick={onCallCap}
          >
            {challenged ? "Cap called" : "Call cap"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LEADERBOARD
   ============================================================ */

function LeaderboardPage({
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
          <span className="eyebrow"><b>{groupName}</b> · week 3</span>
          <h1 className="h-page" style={{ marginTop: 8 }}>Standings<span className="roman">.</span></h1>
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
            {yourRank}<span className="ord">{ordinal(yourRank)}</span>
          </div>
          <div className="gap">
            <b>{youPoints}</b> pts · {gapToLeader === 0 ? "leading" : `${gapToLeader} behind ${leader?.name}`}
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

/* ============================================================
   GROUP
   ============================================================ */

function GroupPage({
  groupName,
  inviteCode,
  members,
  youAdmin,
  onCopy,
}: {
  groupName: string;
  inviteCode: string;
  members: Member[];
  youAdmin?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <span className="eyebrow">
            <b>{members.length}</b> members · private
            {youAdmin && <> · you are <b>admin</b></>}
          </span>
          <h1 className="h-page" style={{ marginTop: 8 }}>{groupName}<span className="roman">.</span></h1>
        </div>
        <div className="meta-block">
          <span className="eyebrow">Founded</span>
          <span className="v">Week 3 · v0.1</span>
        </div>
      </header>

      <section className="invite-card fade-up d1">
        <div>
          <div className="label">Invite code</div>
          <div className="code">{inviteCode}</div>
        </div>
        <button className="btn-ghost" onClick={onCopy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
          Copy code
        </button>
      </section>

      <header className="section-head">
        <h2 className="h-section">The roster.</h2>
        <span className="eyebrow">Pts · week</span>
      </header>

      <div className="member-table fade-up d2">
        {[...members]
          .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
          .map((m) => (
            <div key={m.id} className="member-row">
              <div>
                <div className="member-name">
                  {m.name}
                  {m.isYou && (
                    <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontStyle: "normal", fontSize: 10, color: "var(--accent)", letterSpacing: "0.14em" }}>
                      YOU
                    </span>
                  )}
                </div>
                <div className="member-role">
                  {m.handle} · {m.isAdmin ? "Admin" : "Member"}
                </div>
              </div>
              <div className="member-pts num">{m.weeklyPoints}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ============================================================
   TASKS / ADMIN
   ============================================================ */

function TasksPage({
  tasks,
  isAdmin,
  onAdd,
}: {
  tasks: Task[];
  isAdmin?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <span className="eyebrow">
            {tasks.length} active lines · {isAdmin ? <>you <b>manage</b> this slate</> : <b>admin only</b>}
          </span>
          <h1 className="h-page" style={{ marginTop: 8 }}>The slate<span className="roman">.</span></h1>
        </div>
        <div className="meta-block">
          <span className="eyebrow">Frequency mix</span>
          <span className="v">
            {tasks.filter((t) => t.frequency === "DAILY").length} daily ·{" "}
            {tasks.filter((t) => t.frequency === "WEEKLY").length} weekly
          </span>
        </div>
      </header>

      <div className="admin-bar fade-up d1">
        <span className="eyebrow">Daily & weekly props</span>
        {isAdmin && (
          <button className="btn-primary" onClick={onAdd}>
            New line<span className="arrow">+</span>
          </button>
        )}
      </div>

      <div className="admin-table fade-up d2">
        {tasks.map((t) => (
          <div key={t.id} className="admin-row">
            <div className="name">{t.name}</div>
            <div className="pts num">{t.points}</div>
            <div className="meta">
              <span><b>{t.category}</b></span>
              <span className="sep">·</span>
              <span>{t.frequency}</span>
              <span className="sep">·</span>
              <span>Proof <b>{t.proof}</b></span>
              <span className="sep">·</span>
              <span style={{ color: "var(--smoke)" }}>{t.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   ADD TASK MODAL
   ============================================================ */

function AddTaskModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: Omit<Task, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState<number>(20);
  const [cat, setCat] = useState<Category>("GYM");
  const [freq, setFreq] = useState<Frequency>("DAILY");
  const [proof, setProof] = useState<Proof>("PHOTO");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      name: titleCase(name.trim()),
      description: desc.trim() || "Mark as done when you complete it.",
      category: cat,
      points: Number.isFinite(points) && points > 0 ? Math.floor(points) : 10,
      frequency: freq,
      proof,
    });
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New line.</h2>
        <div className="sub">Score for the squad · admin only</div>

        <div className="modal-grid">
          <label className="field full">
            <span className="field-label">
              <span>Task name</span>
              <span className="hint">Required</span>
            </span>
            <input
              className="field-input compact"
              placeholder="Leg day check"
              value={name}
              maxLength={36}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field full">
            <span className="field-label">
              <span>Description</span>
              <span className="hint">Optional</span>
            </span>
            <input
              className="field-input compact"
              placeholder="What's the bar to clear"
              value={desc}
              maxLength={90}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label"><span>Points</span></span>
            <input
              className="field-input compact"
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value, 10))}
            />
          </label>

          <div>
            <span className="field-label"><span>Frequency</span></span>
            <div className="option-grid">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={freq === f ? "active" : ""}
                  onClick={() => setFreq(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="full">
            <span className="field-label"><span>Category</span></span>
            <div className="option-grid cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cat === c ? "active" : ""}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="full">
            <span className="field-label"><span>Proof requirement</span></span>
            <div className="option-grid cols-4">
              {PROOFS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={proof === p ? "active" : ""}
                  onClick={() => setProof(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={submit}>
            Drop the line<span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
