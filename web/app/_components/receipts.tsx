"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedItem, Member, Tab, Task, View } from "@/lib/types";
import { SEED_FEED, SEED_MEMBERS, SEED_TASKS, SEED_WEEKLY } from "@/lib/seed";
import { genCode, titleCase } from "@/lib/utils";
import { AuthScreen } from "./auth-screen";
import { GroupSetupScreen } from "./group-setup";
import { Rail } from "./rail";
import { TopNav } from "./top-nav";
import { TodayPage } from "./today";
import { LeaderboardPage } from "./leaderboard";
import { GroupPage } from "./group";
import { TasksPage } from "./tasks";
import { AddTaskModal } from "./add-task-modal";

export function Receipts() {
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
    () =>
      members.map((m) =>
        m.isYou ? { ...m, weeklyPoints: m.weeklyPoints + todaysPoints } : m,
      ),
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
  const gapToLeader =
    leader && youLive ? Math.max(0, leader.weeklyPoints - youLive.weeklyPoints) : 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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
      if (next.has(id)) next.delete(id);
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
          <TasksPage tasks={tasks} isAdmin={you?.isAdmin} onAdd={() => setAddOpen(true)} />
        )}
      </main>
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} onAdd={addTask} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
