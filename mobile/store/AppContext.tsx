import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Challenge, ChallengeTask, CheckIn, Comment, Group, Member, Template } from "../types";

const STORAGE_KEY = "receipts-app-state-v1";

// ── Helpers ──────────────────────────────────────────
const todayIso = () => new Date().toISOString().slice(0, 10);

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const memberColors = ["#187a63","#c4472d","#3d6fb6","#a56a08","#6c5a9e","#2c7a9b"];

export const makeMember = (name: string, index: number): Member => ({
  id: uid("member"),
  name,
  handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "member"}`,
  color: memberColors[index % memberColors.length],
});

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const buildChallengeFromTemplate = (
  groupId: string,
  template: Template,
  name = template.name,
  durationDays = template.durationDays,
  stakeLabel = template.stakeHint,
): Challenge => {
  const start = new Date();
  const end = addDays(start, durationDays - 1);
  return {
    id: uid("challenge"),
    groupId,
    templateId: template.id,
    name,
    durationDays,
    stakeLabel,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    tasks: template.tasks.map((t, i) => ({ ...t, id: `${template.id}-task-${i + 1}` })),
    createdAt: new Date().toISOString(),
  };
};

export const templates: Template[] = [
  {
    id: "gym-lock-in",
    name: "Gym Lock-In",
    category: "Fitness",
    durationDays: 28,
    stakeHint: "Loser buys post-workout food",
    icon: "gym",
    tasks: [
      { title: "Gym session",    cadence: "daily", points: 20, proofRequired: true,  proofTypes: ["photo","location","friend"] },
      { title: "10k steps",      cadence: "daily", points: 10, proofRequired: true,  proofTypes: ["photo","text"] },
      { title: "Protein target", cadence: "daily", points: 10, proofRequired: false, proofTypes: ["text","photo"] },
    ],
  },
  {
    id: "exam-grind",
    name: "Exam Grind",
    category: "Study",
    durationDays: 14,
    stakeHint: "Missed threshold buys coffee",
    icon: "study",
    tasks: [
      { title: "Two-hour deep work block",  cadence: "daily", points: 20, proofRequired: true,  proofTypes: ["photo","text"] },
      { title: "Library or desk check-in",  cadence: "daily", points: 10, proofRequired: true,  proofTypes: ["photo","location"] },
      { title: "Phone-away block",           cadence: "daily", points: 10, proofRequired: false, proofTypes: ["text"] },
    ],
  },
  {
    id: "flat-reset",
    name: "Flat Reset",
    category: "House",
    durationDays: 21,
    stakeHint: "Lowest score cleans Sunday",
    icon: "home",
    tasks: [
      { title: "Kitchen reset",      cadence: "daily",  points: 10, proofRequired: true, proofTypes: ["photo"] },
      { title: "Bins and recycling", cadence: "weekly", points: 20, proofRequired: true, proofTypes: ["photo","friend"] },
      { title: "Shared area sweep",  cadence: "weekly", points: 15, proofRequired: true, proofTypes: ["photo"] },
    ],
  },
];

// ── Seed ─────────────────────────────────────────────
const seedState = (): AppState => {
  const members = ["Kaya","Dan","Mina","Jay"].map(makeMember);
  const groupId = "group-flat-4";
  const challenge = buildChallengeFromTemplate(groupId, templates[0], "May Lock-In League", 28, "Bottom score buys dinner");
  return {
    groups: [
      { id: groupId, name: "Flat 4 Lock-In", description: "Gym and reset challenges before summer.", members, createdAt: new Date().toISOString() },
      { id: "group-exams", name: "Exam Grind Crew", description: "Revision blocks and coffee debts.", members: ["Sam","Ari","Nia"].map(makeMember), createdAt: new Date().toISOString() },
    ],
    challenges: [challenge],
    checkIns: [
      {
        id: "checkin-seed-1",
        challengeId: challenge.id,
        taskId: challenge.tasks[0].id,
        taskTitle: challenge.tasks[0].title,
        memberId: members[0].id,
        date: todayIso(),
        proofType: "photo",
        proofText: "Leg day logged. Receipts in the group chat.",
        points: challenge.tasks[0].points,
        challenged: false,
        reactions: { fire: 3, receipt: 2 },
        comments: [{ id: "c-seed-1", memberId: members[2].id, body: "Count it.", createdAt: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
      },
    ],
  };
};

// ── Context ──────────────────────────────────────────
type AppContextValue = {
  state: AppState;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  selectedChallengeId: string;
  setSelectedChallengeId: (id: string) => void;
  selectedGroup: Group | undefined;
  selectedChallenge: Challenge | undefined;
  selectedMember: Member | undefined;
  challengeCheckIns: CheckIn[];
  feed: CheckIn[];
  leaderboard: { member: Member; points: number; receipts: number; challenged: number }[];
  createGroup: (name: string, memberNames: string[]) => void;
  addMember: (name: string) => void;
  startChallenge: (template: Template, name: string, duration: number, stake: string) => void;
  submitCheckIn: (task: ChallengeTask, proofText: string, proofType: string, photoUri?: string) => string | null;
  reactToCheckIn: (checkInId: string, reaction: "fire" | "receipt") => void;
  toggleChallenge: (checkInId: string) => void;
  addComment: (checkInId: string, body: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(seedState);
  const [loaded, setLoaded] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedChallengeId, setSelectedChallengeId] = useState("");

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AppState;
          setState(parsed);
          setSelectedGroupId(parsed.groups[0]?.id ?? "");
          setSelectedMemberId(parsed.groups[0]?.members[0]?.id ?? "");
          const firstChallenge = parsed.challenges.find((c) => c.groupId === parsed.groups[0]?.id);
          setSelectedChallengeId(firstChallenge?.id ?? "");
        } catch { /* use seed */ }
      } else {
        const seed = seedState();
        setState(seed);
        setSelectedGroupId(seed.groups[0]?.id ?? "");
        setSelectedMemberId(seed.groups[0]?.members[0]?.id ?? "");
        const firstChallenge = seed.challenges.find((c) => c.groupId === seed.groups[0]?.id);
        setSelectedChallengeId(firstChallenge?.id ?? "");
      }
      setLoaded(true);
    });
  }, []);

  // Persist on change
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const selectedGroup = useMemo(
    () => state.groups.find((g) => g.id === selectedGroupId) ?? state.groups[0],
    [state.groups, selectedGroupId],
  );

  const selectedChallenge = useMemo(() => {
    const groupChallenges = state.challenges.filter((c) => c.groupId === selectedGroup?.id);
    return groupChallenges.find((c) => c.id === selectedChallengeId) ?? groupChallenges[0];
  }, [state.challenges, selectedGroup?.id, selectedChallengeId]);

  const selectedMember = useMemo(
    () => selectedGroup?.members.find((m) => m.id === selectedMemberId) ?? selectedGroup?.members[0],
    [selectedGroup, selectedMemberId],
  );

  const challengeCheckIns = useMemo(
    () => selectedChallenge ? state.checkIns.filter((ci) => ci.challengeId === selectedChallenge.id) : [],
    [state.checkIns, selectedChallenge],
  );

  const feed = useMemo(
    () => [...challengeCheckIns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [challengeCheckIns],
  );

  const leaderboard = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.members
      .map((member) => {
        const cis = challengeCheckIns.filter((ci) => ci.memberId === member.id);
        return { member, points: cis.reduce((s, ci) => s + ci.points, 0), receipts: cis.length, challenged: cis.filter((ci) => ci.challenged).length };
      })
      .sort((a, b) => b.points - a.points || b.receipts - a.receipts);
  }, [challengeCheckIns, selectedGroup]);

  const createGroup = useCallback((name: string, memberNames: string[]) => {
    const members = (memberNames.length ? memberNames : ["You"]).map(makeMember);
    const group: Group = { id: uid("group"), name, description: "Private challenge group.", members, createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, groups: [...s.groups, group] }));
    setSelectedGroupId(group.id);
    setSelectedMemberId(group.members[0]?.id ?? "");
    setSelectedChallengeId("");
  }, []);

  const addMember = useCallback((name: string) => {
    if (!selectedGroup) return;
    const member = makeMember(name, selectedGroup.members.length);
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) => g.id === selectedGroup.id ? { ...g, members: [...g.members, member] } : g),
    }));
  }, [selectedGroup]);

  const startChallenge = useCallback((template: Template, name: string, duration: number, stake: string) => {
    if (!selectedGroup) return;
    const challenge = buildChallengeFromTemplate(selectedGroup.id, template, name || template.name, Math.max(1, duration), stake || template.stakeHint);
    setState((s) => ({ ...s, challenges: [...s.challenges, challenge] }));
    setSelectedChallengeId(challenge.id);
  }, [selectedGroup]);

  const submitCheckIn = useCallback((task: ChallengeTask, proofText: string, proofType: string, photoUri?: string): string | null => {
    if (!selectedChallenge || !selectedMember) return "No active challenge or member.";
    if (task.proofRequired && !proofText.trim() && !photoUri) return "Add a note or photo first.";
    const already = state.checkIns.some(
      (ci) => ci.challengeId === selectedChallenge.id && ci.taskId === task.id && ci.memberId === selectedMember.id && ci.date === todayIso(),
    );
    if (already) return `${selectedMember.name} already logged ${task.title} today.`;

    const checkIn: CheckIn = {
      id: uid("checkin"),
      challengeId: selectedChallenge.id,
      taskId: task.id,
      taskTitle: task.title,
      memberId: selectedMember.id,
      date: todayIso(),
      proofType: proofType as CheckIn["proofType"],
      proofText: proofText.trim() || "Proof uploaded.",
      photoUri,
      points: task.points,
      challenged: false,
      reactions: { fire: 0, receipt: 0 },
      comments: [],
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, checkIns: [...s.checkIns, checkIn] }));
    return null;
  }, [selectedChallenge, selectedMember, state.checkIns]);

  const reactToCheckIn = useCallback((checkInId: string, reaction: "fire" | "receipt") => {
    setState((s) => ({
      ...s,
      checkIns: s.checkIns.map((ci) =>
        ci.id === checkInId ? { ...ci, reactions: { ...ci.reactions, [reaction]: ci.reactions[reaction] + 1 } } : ci,
      ),
    }));
  }, []);

  const toggleChallenge = useCallback((checkInId: string) => {
    setState((s) => ({
      ...s,
      checkIns: s.checkIns.map((ci) => ci.id === checkInId ? { ...ci, challenged: !ci.challenged } : ci),
    }));
  }, []);

  const addComment = useCallback((checkInId: string, body: string) => {
    if (!selectedMember || !body.trim()) return;
    const comment: Comment = { id: uid("comment"), memberId: selectedMember.id, body: body.trim(), createdAt: new Date().toISOString() };
    setState((s) => ({
      ...s,
      checkIns: s.checkIns.map((ci) => ci.id === checkInId ? { ...ci, comments: [...ci.comments, comment] } : ci),
    }));
  }, [selectedMember]);

  return (
    <AppContext.Provider value={{
      state, selectedGroupId, setSelectedGroupId, selectedMemberId, setSelectedMemberId,
      selectedChallengeId, setSelectedChallengeId, selectedGroup, selectedChallenge,
      selectedMember, challengeCheckIns, feed, leaderboard,
      createGroup, addMember, startChallenge, submitCheckIn,
      reactToCheckIn, toggleChallenge, addComment,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { todayIso };
