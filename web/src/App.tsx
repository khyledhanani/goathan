import {
  BookOpenCheck,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Dumbbell,
  Flame,
  Home,
  ImageIcon,
  MessageSquare,
  Plus,
  ReceiptText,
  ShieldQuestion,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Cadence = "daily" | "weekly" | "once";
type ProofType = "photo" | "text" | "location" | "friend";

type Member = {
  id: string;
  name: string;
  handle: string;
  color: string;
};

type Group = {
  id: string;
  name: string;
  description: string;
  members: Member[];
  createdAt: string;
};

type TaskTemplate = {
  title: string;
  cadence: Cadence;
  points: number;
  proofRequired: boolean;
  proofTypes: ProofType[];
};

type Template = {
  id: string;
  name: string;
  category: string;
  durationDays: number;
  stakeHint: string;
  icon: "gym" | "study" | "home";
  tasks: TaskTemplate[];
};

type ChallengeTask = TaskTemplate & {
  id: string;
};

type Challenge = {
  id: string;
  groupId: string;
  templateId: string;
  name: string;
  durationDays: number;
  stakeLabel: string;
  startDate: string;
  endDate: string;
  tasks: ChallengeTask[];
  createdAt: string;
};

type Comment = {
  id: string;
  memberId: string;
  body: string;
  createdAt: string;
};

type CheckIn = {
  id: string;
  challengeId: string;
  taskId: string;
  taskTitle: string;
  memberId: string;
  date: string;
  proofType: ProofType;
  proofText: string;
  photoDataUrl?: string;
  photoName?: string;
  points: number;
  challenged: boolean;
  reactions: { fire: number; receipt: number };
  comments: Comment[];
  createdAt: string;
};

type AppState = {
  groups: Group[];
  challenges: Challenge[];
  checkIns: CheckIn[];
};

type ProofDraft = {
  proofType: ProofType;
  proofText: string;
  photoDataUrl?: string;
  photoName?: string;
};

const STORAGE_KEY = "receipts-app-state-v1";

const memberColors = [
  "#187a63",
  "#c4472d",
  "#3d6fb6",
  "#a56a08",
  "#6c5a9e",
  "#2c7a9b",
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const makeMember = (name: string, index: number): Member => ({
  id: uid("member"),
  name,
  handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "member"}`,
  color: memberColors[index % memberColors.length],
});

const templates: Template[] = [
  {
    id: "gym-lock-in",
    name: "Gym Lock-In",
    category: "Fitness",
    durationDays: 28,
    stakeHint: "Loser buys post-workout food",
    icon: "gym",
    tasks: [
      { title: "Gym session", cadence: "daily", points: 20, proofRequired: true, proofTypes: ["photo", "location", "friend"] },
      { title: "10k steps", cadence: "daily", points: 10, proofRequired: true, proofTypes: ["photo", "text"] },
      { title: "Protein target", cadence: "daily", points: 10, proofRequired: false, proofTypes: ["text", "photo"] },
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
      { title: "Two-hour deep work block", cadence: "daily", points: 20, proofRequired: true, proofTypes: ["photo", "text"] },
      { title: "Library or desk check-in", cadence: "daily", points: 10, proofRequired: true, proofTypes: ["photo", "location"] },
      { title: "Phone-away block", cadence: "daily", points: 10, proofRequired: false, proofTypes: ["text"] },
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
      { title: "Kitchen reset", cadence: "daily", points: 10, proofRequired: true, proofTypes: ["photo"] },
      { title: "Bins and recycling", cadence: "weekly", points: 20, proofRequired: true, proofTypes: ["photo", "friend"] },
      { title: "Shared area sweep", cadence: "weekly", points: 15, proofRequired: true, proofTypes: ["photo"] },
    ],
  },
];

const buildChallengeFromTemplate = (
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
    tasks: template.tasks.map((task, i) => ({ ...task, id: `${template.id}-task-${i + 1}` })),
    createdAt: new Date().toISOString(),
  };
};

const seedState = (): AppState => {
  const groupMembers = ["Kaya", "Dan", "Mina", "Jay"].map(makeMember);
  const groupId = "group-flat-4";
  const challenge = buildChallengeFromTemplate(groupId, templates[0], "May Lock-In League", 28, "Bottom score buys dinner");
  return {
    groups: [
      { id: groupId, name: "Flat 4 Lock-In", description: "Gym and reset challenges before summer.", members: groupMembers, createdAt: new Date().toISOString() },
      { id: "group-exams", name: "Exam Grind Crew", description: "Revision blocks, library receipts, and coffee debts.", members: ["Sam", "Ari", "Nia"].map(makeMember), createdAt: new Date().toISOString() },
    ],
    challenges: [challenge],
    checkIns: [
      {
        id: "checkin-seed-1",
        challengeId: challenge.id,
        taskId: challenge.tasks[0].id,
        taskTitle: challenge.tasks[0].title,
        memberId: groupMembers[0].id,
        date: todayIso(),
        proofType: "photo",
        proofText: "Leg day logged. Receipts attached in the group chat.",
        points: challenge.tasks[0].points,
        challenged: false,
        reactions: { fire: 3, receipt: 2 },
        comments: [{ id: "comment-seed-1", memberId: groupMembers[2].id, body: "Count it.", createdAt: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
      },
    ],
  };
};

const loadState = (): AppState => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedState();
  try { return JSON.parse(stored) as AppState; } catch { return seedState(); }
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));

const daysRemaining = (endIso: string) => {
  const end = new Date(endIso);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
};

const getInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const templateIcon = (icon: Template["icon"]) => {
  if (icon === "gym") return <Dumbbell aria-hidden="true" size={16} />;
  if (icon === "study") return <BookOpenCheck aria-hidden="true" size={16} />;
  return <Home aria-hidden="true" size={16} />;
};

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [selectedGroupId, setSelectedGroupId] = useState(state.groups[0]?.id ?? "");
  const [selectedChallengeId, setSelectedChallengeId] = useState(
    state.challenges.find((c) => c.groupId === state.groups[0]?.id)?.id ?? "",
  );
  const [selectedMemberId, setSelectedMemberId] = useState(state.groups[0]?.members[0]?.id ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [challengeName, setChallengeName] = useState(templates[0].name);
  const [challengeDuration, setChallengeDuration] = useState(templates[0].durationDays);
  const [challengeStake, setChallengeStake] = useState(templates[0].stakeHint);
  const [proofDrafts, setProofDrafts] = useState<Record<string, ProofDraft>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [quickTaskId, setQuickTaskId] = useState<string>("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const selectedGroup = useMemo(
    () => state.groups.find((g) => g.id === selectedGroupId) ?? state.groups[0],
    [selectedGroupId, state.groups],
  );

  const groupChallenges = useMemo(
    () => state.challenges.filter((c) => c.groupId === selectedGroup?.id),
    [selectedGroup?.id, state.challenges],
  );

  const selectedChallenge = useMemo(
    () => groupChallenges.find((c) => c.id === selectedChallengeId) ?? groupChallenges[0],
    [groupChallenges, selectedChallengeId],
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId],
  );

  const selectedMember = useMemo(
    () => selectedGroup?.members.find((m) => m.id === selectedMemberId) ?? selectedGroup?.members[0],
    [selectedGroup?.members, selectedMemberId],
  );

  const challengeCheckIns = useMemo(
    () => selectedChallenge ? state.checkIns.filter((ci) => ci.challengeId === selectedChallenge.id) : [],
    [selectedChallenge, state.checkIns],
  );

  const feed = useMemo(
    () => [...challengeCheckIns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [challengeCheckIns],
  );

  const leaderboard = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.members
      .map((member) => {
        const memberCheckIns = challengeCheckIns.filter((ci) => ci.memberId === member.id);
        return {
          member,
          points: memberCheckIns.reduce((sum, ci) => sum + ci.points, 0),
          receipts: memberCheckIns.length,
          challenged: memberCheckIns.filter((ci) => ci.challenged).length,
        };
      })
      .sort((a, b) => b.points - a.points || b.receipts - a.receipts);
  }, [challengeCheckIns, selectedGroup]);

  const quickTask = useMemo(
    () => selectedChallenge?.tasks.find((t) => t.id === quickTaskId) ?? selectedChallenge?.tasks[0],
    [quickTaskId, selectedChallenge],
  );

  const quickDraft = proofDrafts[quickTask?.id ?? ""] ?? {
    proofType: quickTask?.proofTypes[0] ?? "text",
    proofText: "",
  };

  const quickTaskCompleted = Boolean(
    selectedChallenge &&
      quickTask &&
      challengeCheckIns.some(
        (ci) => ci.taskId === quickTask.id && ci.memberId === selectedMember?.id && ci.date === todayIso(),
      ),
  );

  useEffect(() => {
    if (!selectedGroup) return;
    const firstChallenge = state.challenges.find((c) => c.groupId === selectedGroup.id);
    setSelectedMemberId((cur) =>
      selectedGroup.members.some((m) => m.id === cur) ? cur : selectedGroup.members[0]?.id ?? "",
    );
    setSelectedChallengeId((cur) =>
      state.challenges.some((c) => c.id === cur && c.groupId === selectedGroup.id)
        ? cur
        : firstChallenge?.id ?? "",
    );
  }, [selectedGroup, state.challenges]);

  useEffect(() => {
    setChallengeName(selectedTemplate.name);
    setChallengeDuration(selectedTemplate.durationDays);
    setChallengeStake(selectedTemplate.stakeHint);
  }, [selectedTemplate]);

  useEffect(() => {
    setQuickTaskId(selectedChallenge?.tasks[0]?.id ?? "");
  }, [selectedChallenge?.id]);

  const updateProofDraft = (taskId: string, patch: Partial<ProofDraft>) => {
    setProofDrafts((cur) => {
      const existing = cur[taskId] ?? { proofType: "photo", proofText: "" };
      return { ...cur, [taskId]: { ...existing, ...patch } };
    });
  };

  const handleProofFile = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateProofDraft(taskId, {
        photoDataUrl: typeof reader.result === "string" ? reader.result : undefined,
        photoName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const createGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    const parsedMembers = newGroupMembers.split(",").map((m) => m.trim()).filter(Boolean);
    const members = (parsedMembers.length ? parsedMembers : ["You"]).map(makeMember);
    const group: Group = { id: uid("group"), name, description: "Private challenge group.", members, createdAt: new Date().toISOString() };
    setState((cur) => ({ ...cur, groups: [...cur.groups, group] }));
    setSelectedGroupId(group.id);
    setSelectedMemberId(group.members[0]?.id ?? "");
    setSelectedChallengeId("");
    setNewGroupName("");
    setNewGroupMembers("");
    setNotice(`${group.name} created.`);
  };

  const addMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroup) return;
    const name = newMemberName.trim();
    if (!name) return;
    const member = makeMember(name, selectedGroup.members.length);
    setState((cur) => ({
      ...cur,
      groups: cur.groups.map((g) =>
        g.id === selectedGroup.id ? { ...g, members: [...g.members, member] } : g,
      ),
    }));
    setNewMemberName("");
    setNotice(`${member.name} added to ${selectedGroup.name}.`);
  };

  const startChallenge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroup) return;
    const challenge = buildChallengeFromTemplate(
      selectedGroup.id,
      selectedTemplate,
      challengeName.trim() || selectedTemplate.name,
      Math.max(1, challengeDuration),
      challengeStake.trim() || selectedTemplate.stakeHint,
    );
    setState((cur) => ({ ...cur, challenges: [...cur.challenges, challenge] }));
    setSelectedChallengeId(challenge.id);
    setNotice(`${challenge.name} started.`);
  };

  const submitCheckIn = (task: ChallengeTask) => {
    if (!selectedChallenge || !selectedMember) return;
    const draft = proofDrafts[task.id] ?? { proofType: task.proofTypes[0] ?? "text", proofText: "" };
    const hasProof = Boolean(draft.proofText.trim() || draft.photoDataUrl);
    if (task.proofRequired && !hasProof) {
      setNotice("Add a note or photo before submitting that receipt.");
      return;
    }
    const alreadyCheckedIn = state.checkIns.some(
      (ci) => ci.challengeId === selectedChallenge.id && ci.taskId === task.id && ci.memberId === selectedMember.id && ci.date === todayIso(),
    );
    if (alreadyCheckedIn) {
      setNotice(`${selectedMember.name} already logged ${task.title} today.`);
      return;
    }
    const checkIn: CheckIn = {
      id: uid("checkin"),
      challengeId: selectedChallenge.id,
      taskId: task.id,
      taskTitle: task.title,
      memberId: selectedMember.id,
      date: todayIso(),
      proofType: draft.proofType,
      proofText: draft.proofText.trim() || "Proof uploaded.",
      photoDataUrl: draft.photoDataUrl,
      photoName: draft.photoName,
      points: task.points,
      challenged: false,
      reactions: { fire: 0, receipt: 0 },
      comments: [],
      createdAt: new Date().toISOString(),
    };
    setState((cur) => ({ ...cur, checkIns: [...cur.checkIns, checkIn] }));
    setProofDrafts((cur) => { const next = { ...cur }; delete next[task.id]; return next; });
    setNotice(`${task.title} logged for ${selectedMember.name}.`);
  };

  const reactToCheckIn = (checkInId: string, reaction: "fire" | "receipt") => {
    setState((cur) => ({
      ...cur,
      checkIns: cur.checkIns.map((ci) =>
        ci.id === checkInId
          ? { ...ci, reactions: { ...ci.reactions, [reaction]: ci.reactions[reaction] + 1 } }
          : ci,
      ),
    }));
  };

  const toggleChallenge = (checkInId: string) => {
    setState((cur) => ({
      ...cur,
      checkIns: cur.checkIns.map((ci) =>
        ci.id === checkInId ? { ...ci, challenged: !ci.challenged } : ci,
      ),
    }));
  };

  const addComment = (checkInId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember) return;
    const body = commentDrafts[checkInId]?.trim();
    if (!body) return;
    const comment: Comment = { id: uid("comment"), memberId: selectedMember.id, body, createdAt: new Date().toISOString() };
    setState((cur) => ({
      ...cur,
      checkIns: cur.checkIns.map((ci) =>
        ci.id === checkInId ? { ...ci, comments: [...ci.comments, comment] } : ci,
      ),
    }));
    setCommentDrafts((cur) => ({ ...cur, [checkInId]: "" }));
  };

  const findMember = (memberId: string) => selectedGroup?.members.find((m) => m.id === memberId);

  return (
    <main className="app-shell">

      {/* ══ SIDEBAR ══════════════════════════════════ */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ReceiptText aria-hidden="true" size={20} />
          </div>
          <div>
            <h1>Receipts</h1>
            <p>No proof, no points.</p>
          </div>
        </div>

        <section className="sidebar-section">
          <div className="section-title">
            <Users aria-hidden="true" size={13} />
            <span>Groups</span>
          </div>
          <div className="group-list">
            {state.groups.map((group) => (
              <button
                className={`group-button ${group.id === selectedGroup?.id ? "active" : ""}`}
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                type="button"
              >
                <span>{group.name}</span>
                <small>{group.members.length} members</small>
              </button>
            ))}
          </div>
        </section>

        {selectedGroup && (
          <form className="add-member-form" onSubmit={addMember}>
            <label htmlFor="sidebar-member-name">Add to {selectedGroup.name}</label>
            <div className="inline-row">
              <input
                id="sidebar-member-name"
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Member name"
                value={newMemberName}
              />
              <button className="icon-button" title="Add member" type="submit">
                <Plus aria-hidden="true" size={15} />
              </button>
            </div>
          </form>
        )}

        <div className="sidebar-actions">
          <button
            className="secondary-button full"
            onClick={() => setShowGroupModal(true)}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
            New Group
          </button>
          <button
            className="primary-button full"
            onClick={() => setShowChallengeModal(true)}
            type="button"
          >
            <Flame aria-hidden="true" size={15} />
            New Challenge
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ═════════════════════════════ */}
      <section className="main-content">
        {notice ? <div className="notice">{notice}</div> : null}

        {/* Quick-log bar */}
        {selectedChallenge && quickTask ? (
          <div className="quick-log-bar">
            <select
              aria-label="Task to log"
              onChange={(e) => setQuickTaskId(e.target.value)}
              value={quickTask.id}
            >
              {selectedChallenge.tasks.map((task) => {
                const done = challengeCheckIns.some(
                  (ci) => ci.taskId === task.id && ci.memberId === selectedMember?.id && ci.date === todayIso(),
                );
                return (
                  <option key={task.id} value={task.id}>
                    {done ? "✓ " : ""}{task.title}
                  </option>
                );
              })}
            </select>
            <select
              aria-label="Proof type"
              disabled={quickTaskCompleted}
              onChange={(e) => updateProofDraft(quickTask.id, { proofType: e.target.value as ProofType })}
              value={quickDraft.proofType}
            >
              {quickTask.proofTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              disabled={quickTaskCompleted}
              onChange={(e) => updateProofDraft(quickTask.id, { proofText: e.target.value })}
              placeholder="Proof note..."
              value={quickDraft.proofText}
            />
            <label className={`file-button ${quickTaskCompleted ? "disabled" : ""}`}>
              <ImageIcon aria-hidden="true" size={14} />
              <input
                accept="image/*"
                disabled={quickTaskCompleted}
                onChange={(e) => handleProofFile(quickTask.id, e)}
                type="file"
              />
              {quickDraft.photoName ? "Ready" : "Photo"}
            </label>
            <button
              className="primary-button"
              disabled={quickTaskCompleted}
              onClick={() => quickTask && submitCheckIn(quickTask)}
              type="button"
            >
              <Camera aria-hidden="true" size={14} />
              Log
            </button>
          </div>
        ) : null}

        {/* Feed */}
        <section className="feed-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">{selectedGroup?.name ?? "No group selected"}</p>
              <h3>Proof Feed</h3>
            </div>
            <MessageSquare aria-hidden="true" size={17} />
          </div>

          {feed.length ? (
            <div className="feed-list">
              {feed.map((checkIn) => {
                const member = findMember(checkIn.memberId);
                return (
                  <article className="feed-item" key={checkIn.id}>
                    {/* Photo hero */}
                    {checkIn.photoDataUrl ? (
                      <div className="feed-photo">
                        <img alt={`${checkIn.taskTitle} proof`} src={checkIn.photoDataUrl} />
                        {checkIn.challenged && (
                          <span className="challenge-badge challenge-badge--overlay">challenged</span>
                        )}
                      </div>
                    ) : null}

                    <div className="feed-body">
                      {/* Header */}
                      <div className="feed-head">
                        <span className="avatar" style={{ backgroundColor: member?.color ?? "#4b5563" }}>
                          {getInitials(member?.name ?? "U")}
                        </span>
                        <div>
                          <h4>{member?.name ?? "Unknown"} — {checkIn.taskTitle}</h4>
                          <p>{formatDate(checkIn.createdAt)} · {checkIn.points} pts · {checkIn.proofType}</p>
                        </div>
                        {!checkIn.photoDataUrl && checkIn.challenged ? (
                          <span className="challenge-badge">challenged</span>
                        ) : null}
                      </div>

                      {/* Proof text */}
                      <p className={`proof-text ${!checkIn.photoDataUrl ? "proof-text--hero" : ""}`}>
                        {checkIn.proofText}
                      </p>

                      {/* Actions */}
                      <div className="feed-actions">
                        <button className="ghost-button" onClick={() => reactToCheckIn(checkIn.id, "fire")} title="Fire" type="button">
                          <Flame aria-hidden="true" size={14} /> {checkIn.reactions.fire}
                        </button>
                        <button className="ghost-button" onClick={() => reactToCheckIn(checkIn.id, "receipt")} title="Receipt" type="button">
                          <ReceiptText aria-hidden="true" size={14} /> {checkIn.reactions.receipt}
                        </button>
                        <button className="ghost-button" onClick={() => toggleChallenge(checkIn.id)} type="button">
                          <ShieldQuestion aria-hidden="true" size={14} />
                          {checkIn.challenged ? "Clear" : "Challenge"}
                        </button>
                      </div>

                      {/* Comments */}
                      {checkIn.comments.length ? (
                        <div className="comments">
                          {checkIn.comments.map((comment) => {
                            const cm = findMember(comment.memberId);
                            return (
                              <p key={comment.id}>
                                <strong>{cm?.name ?? "Member"}:</strong> {comment.body}
                              </p>
                            );
                          })}
                        </div>
                      ) : null}

                      <form className="comment-form" onSubmit={(e) => addComment(checkIn.id, e)}>
                        <input
                          aria-label="Comment"
                          onChange={(e) =>
                            setCommentDrafts((cur) => ({ ...cur, [checkIn.id]: e.target.value }))
                          }
                          placeholder="Add a comment..."
                          value={commentDrafts[checkIn.id] ?? ""}
                        />
                        <button className="icon-button" title="Post" type="submit">
                          <Plus aria-hidden="true" size={14} />
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <CircleDollarSign aria-hidden="true" size={22} />
              <p>Receipts will land here once members check in.</p>
            </div>
          )}
        </section>
      </section>

      {/* ══ RIGHT PANEL ══════════════════════════════ */}
      <aside className="right-panel">

        {/* User switcher */}
        <div className="user-switcher">
          <p className="eyebrow">Active member</p>
          <div className="user-switcher-row">
            <span
              className="avatar avatar--lg"
              style={{ backgroundColor: selectedMember?.color ?? "#4b5563" }}
            >
              {getInitials(selectedMember?.name ?? "?")}
            </span>
            <select
              aria-label="Switch member"
              onChange={(e) => setSelectedMemberId(e.target.value)}
              value={selectedMemberId}
            >
              {selectedGroup?.members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active challenge */}
        {selectedChallenge ? (
          <section className="challenge-card">
            <div className="challenge-card-header">
              <p className="eyebrow">Active challenge</p>
              {groupChallenges.length > 1 && (
                <select
                  aria-label="Switch challenge"
                  onChange={(e) => setSelectedChallengeId(e.target.value)}
                  value={selectedChallenge.id}
                >
                  {groupChallenges.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <h3 className="challenge-name">{selectedChallenge.name}</h3>
            <div className="challenge-meta">
              <div>
                <span>Time left</span>
                <strong>{daysRemaining(selectedChallenge.endDate)} days</strong>
              </div>
              <div>
                <span>Ends</span>
                <strong>{formatDate(selectedChallenge.endDate)}</strong>
              </div>
              <div>
                <span>Stakes</span>
                <strong>{selectedChallenge.stakeLabel}</strong>
              </div>
            </div>
            <div className="task-status-list">
              {selectedChallenge.tasks.map((task) => {
                const done = challengeCheckIns.some(
                  (ci) => ci.taskId === task.id && ci.memberId === selectedMember?.id && ci.date === todayIso(),
                );
                return (
                  <div className="task-status-row" key={task.id}>
                    <CheckCircle2 aria-hidden="true" className={done ? "done-icon" : "idle-icon"} size={14} />
                    <span>{task.title}</span>
                    <span className="task-pts">{task.points}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="empty-panel">
            <Trophy aria-hidden="true" size={22} />
            <p>No active challenge.</p>
          </div>
        )}

        {/* Leaderboard */}
        <section className="leaderboard-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Standings</p>
              <h3>Leaderboard</h3>
            </div>
            <Trophy aria-hidden="true" size={16} />
          </div>
          <div className="leaderboard">
            {leaderboard.map((row, index) => (
              <div
                className={`leaderboard-row rank-${index + 1}`}
                data-rank={index + 1}
                key={row.member.id}
              >
                <span className="rank">{index + 1}</span>
                <span className="avatar" style={{ backgroundColor: row.member.color }}>
                  {getInitials(row.member.name)}
                </span>
                <div>
                  <strong>{row.member.name}</strong>
                  <small>
                    {row.receipts} receipts
                    {row.challenged ? ` · ${row.challenged} challenged` : ""}
                  </small>
                </div>
                <b>{row.points}</b>
              </div>
            ))}
          </div>
        </section>

        <button
          className="secondary-button full"
          onClick={() => setShowChallengeModal(true)}
          type="button"
        >
          <Flame aria-hidden="true" size={14} />
          Start Challenge
        </button>
      </aside>

      {/* ══ GROUP MODAL ══════════════════════════════ */}
      {showGroupModal && (
        <div className="modal-backdrop" onClick={() => setShowGroupModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Group</h3>
              <button className="icon-button" onClick={() => setShowGroupModal(false)} type="button">
                <X aria-hidden="true" size={15} />
              </button>
            </div>
            <form
              onSubmit={(e) => { createGroup(e); setShowGroupModal(false); }}
              style={{ display: "grid", gap: 10 }}
            >
              <label htmlFor="modal-group-name">Group name</label>
              <input
                id="modal-group-name"
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Flat 4 Lock-In"
                value={newGroupName}
              />
              <label htmlFor="modal-group-members">Members (comma separated)</label>
              <input
                id="modal-group-members"
                onChange={(e) => setNewGroupMembers(e.target.value)}
                placeholder="Kaya, Dan, Mina, Jay"
                value={newGroupMembers}
              />
              <button className="primary-button full" type="submit">
                <Plus aria-hidden="true" size={15} />
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ CHALLENGE MODAL ══════════════════════════ */}
      {showChallengeModal && (
        <div className="modal-backdrop" onClick={() => setShowChallengeModal(false)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Challenge</h3>
              <button className="icon-button" onClick={() => setShowChallengeModal(false)} type="button">
                <X aria-hidden="true" size={15} />
              </button>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 10 }}>Pick a template</p>
              <div className="template-list">
                {templates.map((template) => (
                  <button
                    className={`template-card ${template.id === selectedTemplate.id ? "active" : ""}`}
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    type="button"
                  >
                    <span>{templateIcon(template.icon)}</span>
                    <strong>{template.name}</strong>
                    <small>{template.category}</small>
                  </button>
                ))}
              </div>
            </div>
            <form
              className="challenge-form"
              onSubmit={(e) => { startChallenge(e); setShowChallengeModal(false); }}
            >
              <label htmlFor="modal-challenge-name">Challenge name</label>
              <input
                id="modal-challenge-name"
                onChange={(e) => setChallengeName(e.target.value)}
                value={challengeName}
              />
              <label htmlFor="modal-duration">Duration (days)</label>
              <input
                id="modal-duration"
                min={1}
                onChange={(e) => setChallengeDuration(Number(e.target.value))}
                type="number"
                value={challengeDuration}
              />
              <label htmlFor="modal-stake">Stakes</label>
              <input
                id="modal-stake"
                onChange={(e) => setChallengeStake(e.target.value)}
                value={challengeStake}
              />
              <button className="primary-button full" type="submit">
                <Flame aria-hidden="true" size={15} />
                Start Challenge
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
