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
  reactions: {
    fire: number;
    receipt: number;
  };
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
      {
        title: "Gym session",
        cadence: "daily",
        points: 20,
        proofRequired: true,
        proofTypes: ["photo", "location", "friend"],
      },
      {
        title: "10k steps",
        cadence: "daily",
        points: 10,
        proofRequired: true,
        proofTypes: ["photo", "text"],
      },
      {
        title: "Protein target",
        cadence: "daily",
        points: 10,
        proofRequired: false,
        proofTypes: ["text", "photo"],
      },
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
      {
        title: "Two-hour deep work block",
        cadence: "daily",
        points: 20,
        proofRequired: true,
        proofTypes: ["photo", "text"],
      },
      {
        title: "Library or desk check-in",
        cadence: "daily",
        points: 10,
        proofRequired: true,
        proofTypes: ["photo", "location"],
      },
      {
        title: "Phone-away block",
        cadence: "daily",
        points: 10,
        proofRequired: false,
        proofTypes: ["text"],
      },
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
      {
        title: "Kitchen reset",
        cadence: "daily",
        points: 10,
        proofRequired: true,
        proofTypes: ["photo"],
      },
      {
        title: "Bins and recycling",
        cadence: "weekly",
        points: 20,
        proofRequired: true,
        proofTypes: ["photo", "friend"],
      },
      {
        title: "Shared area sweep",
        cadence: "weekly",
        points: 15,
        proofRequired: true,
        proofTypes: ["photo"],
      },
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
    tasks: template.tasks.map((task, index) => ({
      ...task,
      id: `${template.id}-task-${index + 1}`,
    })),
    createdAt: new Date().toISOString(),
  };
};

const seedState = (): AppState => {
  const groupMembers = ["Kaya", "Dan", "Mina", "Jay"].map(makeMember);
  const groupId = "group-flat-4";
  const challenge = buildChallengeFromTemplate(
    groupId,
    templates[0],
    "May Lock-In League",
    28,
    "Bottom score buys dinner",
  );

  return {
    groups: [
      {
        id: groupId,
        name: "Flat 4 Lock-In",
        description: "Gym and reset challenges before summer.",
        members: groupMembers,
        createdAt: new Date().toISOString(),
      },
      {
        id: "group-exams",
        name: "Exam Grind Crew",
        description: "Revision blocks, library receipts, and coffee debts.",
        members: ["Sam", "Ari", "Nia"].map(makeMember),
        createdAt: new Date().toISOString(),
      },
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
        comments: [
          {
            id: "comment-seed-1",
            memberId: groupMembers[2].id,
            body: "Count it.",
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
  };
};

const loadState = (): AppState => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedState();

  try {
    return JSON.parse(stored) as AppState;
  } catch {
    return seedState();
  }
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );

const daysRemaining = (endIso: string) => {
  const end = new Date(endIso);
  const now = new Date();
  end.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const templateIcon = (icon: Template["icon"]) => {
  if (icon === "gym") return <Dumbbell aria-hidden="true" size={18} />;
  if (icon === "study") return <BookOpenCheck aria-hidden="true" size={18} />;
  return <Home aria-hidden="true" size={18} />;
};

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [selectedGroupId, setSelectedGroupId] = useState(state.groups[0]?.id ?? "");
  const [selectedChallengeId, setSelectedChallengeId] = useState(
    state.challenges.find((challenge) => challenge.groupId === state.groups[0]?.id)?.id ?? "",
  );
  const [selectedMemberId, setSelectedMemberId] = useState(
    state.groups[0]?.members[0]?.id ?? "",
  );
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

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const selectedGroup = useMemo(
    () => state.groups.find((group) => group.id === selectedGroupId) ?? state.groups[0],
    [selectedGroupId, state.groups],
  );

  const groupChallenges = useMemo(
    () => state.challenges.filter((challenge) => challenge.groupId === selectedGroup?.id),
    [selectedGroup?.id, state.challenges],
  );

  const selectedChallenge = useMemo(
    () =>
      groupChallenges.find((challenge) => challenge.id === selectedChallengeId) ??
      groupChallenges[0],
    [groupChallenges, selectedChallengeId],
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId],
  );

  const selectedMember = useMemo(
    () =>
      selectedGroup?.members.find((member) => member.id === selectedMemberId) ??
      selectedGroup?.members[0],
    [selectedGroup?.members, selectedMemberId],
  );

  const challengeCheckIns = useMemo(
    () =>
      selectedChallenge
        ? state.checkIns.filter((checkIn) => checkIn.challengeId === selectedChallenge.id)
        : [],
    [selectedChallenge, state.checkIns],
  );

  const feed = useMemo(
    () =>
      [...challengeCheckIns].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [challengeCheckIns],
  );

  const leaderboard = useMemo(() => {
    if (!selectedGroup) return [];

    return selectedGroup.members
      .map((member) => {
        const memberCheckIns = challengeCheckIns.filter(
          (checkIn) => checkIn.memberId === member.id,
        );
        return {
          member,
          points: memberCheckIns.reduce((sum, checkIn) => sum + checkIn.points, 0),
          receipts: memberCheckIns.length,
          challenged: memberCheckIns.filter((checkIn) => checkIn.challenged).length,
        };
      })
      .sort((a, b) => b.points - a.points || b.receipts - a.receipts);
  }, [challengeCheckIns, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) return;
    const firstChallenge = state.challenges.find(
      (challenge) => challenge.groupId === selectedGroup.id,
    );

    setSelectedMemberId((current) =>
      selectedGroup.members.some((member) => member.id === current)
        ? current
        : selectedGroup.members[0]?.id ?? "",
    );
    setSelectedChallengeId((current) =>
      state.challenges.some(
        (challenge) => challenge.id === current && challenge.groupId === selectedGroup.id,
      )
        ? current
        : firstChallenge?.id ?? "",
    );
  }, [selectedGroup, state.challenges]);

  useEffect(() => {
    setChallengeName(selectedTemplate.name);
    setChallengeDuration(selectedTemplate.durationDays);
    setChallengeStake(selectedTemplate.stakeHint);
  }, [selectedTemplate]);

  const updateProofDraft = (taskId: string, patch: Partial<ProofDraft>) => {
    setProofDrafts((current) => {
      const existing = current[taskId] ?? { proofType: "photo", proofText: "" };
      return {
        ...current,
        [taskId]: {
          ...existing,
          ...patch,
        },
      };
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

    const parsedMembers = newGroupMembers
      .split(",")
      .map((member) => member.trim())
      .filter(Boolean);
    const members = (parsedMembers.length ? parsedMembers : ["You"]).map(makeMember);
    const group: Group = {
      id: uid("group"),
      name,
      description: "Private challenge group.",
      members,
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({ ...current, groups: [...current.groups, group] }));
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
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === selectedGroup.id
          ? { ...group, members: [...group.members, member] }
          : group,
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

    setState((current) => ({
      ...current,
      challenges: [...current.challenges, challenge],
    }));
    setSelectedChallengeId(challenge.id);
    setNotice(`${challenge.name} started.`);
  };

  const submitCheckIn = (task: ChallengeTask) => {
    if (!selectedChallenge || !selectedMember) return;

    const draft = proofDrafts[task.id] ?? {
      proofType: task.proofTypes[0] ?? "text",
      proofText: "",
    };
    const hasProof = Boolean(draft.proofText.trim() || draft.photoDataUrl);
    if (task.proofRequired && !hasProof) {
      setNotice("Add a note or photo before submitting that receipt.");
      return;
    }

    const alreadyCheckedIn = state.checkIns.some(
      (checkIn) =>
        checkIn.challengeId === selectedChallenge.id &&
        checkIn.taskId === task.id &&
        checkIn.memberId === selectedMember.id &&
        checkIn.date === todayIso(),
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

    setState((current) => ({
      ...current,
      checkIns: [...current.checkIns, checkIn],
    }));
    setProofDrafts((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
    setNotice(`${task.title} logged for ${selectedMember.name}.`);
  };

  const reactToCheckIn = (checkInId: string, reaction: "fire" | "receipt") => {
    setState((current) => ({
      ...current,
      checkIns: current.checkIns.map((checkIn) =>
        checkIn.id === checkInId
          ? {
              ...checkIn,
              reactions: {
                ...checkIn.reactions,
                [reaction]: checkIn.reactions[reaction] + 1,
              },
            }
          : checkIn,
      ),
    }));
  };

  const toggleChallenge = (checkInId: string) => {
    setState((current) => ({
      ...current,
      checkIns: current.checkIns.map((checkIn) =>
        checkIn.id === checkInId
          ? { ...checkIn, challenged: !checkIn.challenged }
          : checkIn,
      ),
    }));
  };

  const addComment = (checkInId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember) return;

    const body = commentDrafts[checkInId]?.trim();
    if (!body) return;

    const comment: Comment = {
      id: uid("comment"),
      memberId: selectedMember.id,
      body,
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      checkIns: current.checkIns.map((checkIn) =>
        checkIn.id === checkInId
          ? { ...checkIn, comments: [...checkIn.comments, comment] }
          : checkIn,
      ),
    }));
    setCommentDrafts((current) => ({ ...current, [checkInId]: "" }));
  };

  const findMember = (memberId: string) =>
    selectedGroup?.members.find((member) => member.id === memberId);

  if (!selectedGroup) {
    return <main className="empty-screen">Create a group to start.</main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ReceiptText aria-hidden="true" size={22} />
          </div>
          <div>
            <h1>Receipts</h1>
            <p>No proof, no points.</p>
          </div>
        </div>

        <section className="sidebar-section">
          <div className="section-title">
            <Users aria-hidden="true" size={16} />
            <span>Groups</span>
          </div>
          <div className="group-list">
            {state.groups.map((group) => (
              <button
                className={`group-button ${group.id === selectedGroup.id ? "active" : ""}`}
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

        <form className="create-box" onSubmit={createGroup}>
          <label htmlFor="group-name">New group</label>
          <input
            id="group-name"
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="Group name"
            value={newGroupName}
          />
          <input
            onChange={(event) => setNewGroupMembers(event.target.value)}
            placeholder="Members, comma separated"
            value={newGroupMembers}
          />
          <button className="primary-button full" type="submit">
            <Plus aria-hidden="true" size={16} />
            Create group
          </button>
        </form>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Private group</p>
            <h2>{selectedGroup.name}</h2>
            <p className="muted">{selectedGroup.description}</p>
          </div>
          <form className="invite-form" onSubmit={addMember}>
            <input
              aria-label="Member name"
              onChange={(event) => setNewMemberName(event.target.value)}
              placeholder="Add member"
              value={newMemberName}
            />
            <button className="icon-button" title="Add member" type="submit">
              <Plus aria-hidden="true" size={18} />
            </button>
          </form>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}

        <section className="member-strip" aria-label="Group members">
          {selectedGroup.members.map((member) => (
            <button
              className={`member-chip ${member.id === selectedMember?.id ? "active" : ""}`}
              key={member.id}
              onClick={() => setSelectedMemberId(member.id)}
              type="button"
            >
              <span className="avatar" style={{ backgroundColor: member.color }}>
                {getInitials(member.name)}
              </span>
              <span>{member.name}</span>
            </button>
          ))}
        </section>

        <div className="main-grid">
          <section className="challenge-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Active challenge</p>
                <h3>{selectedChallenge?.name ?? "Start a challenge"}</h3>
              </div>
              {groupChallenges.length ? (
                <select
                  aria-label="Challenge"
                  onChange={(event) => setSelectedChallengeId(event.target.value)}
                  value={selectedChallenge?.id ?? ""}
                >
                  {groupChallenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {selectedChallenge ? (
              <>
                <div className="challenge-meta">
                  <div>
                    <span>{formatDate(selectedChallenge.startDate)}</span>
                    <strong>{formatDate(selectedChallenge.endDate)}</strong>
                  </div>
                  <div>
                    <span>Time left</span>
                    <strong>{daysRemaining(selectedChallenge.endDate)} days</strong>
                  </div>
                  <div>
                    <span>Stakes</span>
                    <strong>{selectedChallenge.stakeLabel}</strong>
                  </div>
                </div>

                <div className="tasks">
                  {selectedChallenge.tasks.map((task) => {
                    const draft = proofDrafts[task.id] ?? {
                      proofType: task.proofTypes[0] ?? "text",
                      proofText: "",
                    };
                    const completedToday = challengeCheckIns.some(
                      (checkIn) =>
                        checkIn.taskId === task.id &&
                        checkIn.memberId === selectedMember?.id &&
                        checkIn.date === todayIso(),
                    );

                    return (
                      <article
                        className="task-row"
                        data-testid={`task-row-${task.id}`}
                        key={task.id}
                      >
                        <div className="task-main">
                          <div className="task-title-row">
                            <CheckCircle2
                              aria-hidden="true"
                              className={completedToday ? "done-icon" : "idle-icon"}
                              size={18}
                            />
                            <div>
                              <h4>{task.title}</h4>
                              <p>
                                {task.cadence} / {task.points} pts
                                {task.proofRequired ? " / proof required" : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="proof-controls">
                          <select
                            aria-label={`${task.title} proof type`}
                            disabled={completedToday}
                            onChange={(event) =>
                              updateProofDraft(task.id, {
                                proofType: event.target.value as ProofType,
                              })
                            }
                            value={draft.proofType}
                          >
                            {task.proofTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <input
                            data-testid={`proof-note-${task.id}`}
                            disabled={completedToday}
                            onChange={(event) =>
                              updateProofDraft(task.id, { proofText: event.target.value })
                            }
                            placeholder="Proof note"
                            value={draft.proofText}
                          />
                          <label className={`file-button ${completedToday ? "disabled" : ""}`}>
                            <ImageIcon aria-hidden="true" size={16} />
                            <input
                              accept="image/*"
                              disabled={completedToday}
                              onChange={(event) => handleProofFile(task.id, event)}
                              type="file"
                            />
                            {draft.photoName ? "Photo ready" : "Photo"}
                          </label>
                          <button
                            className="primary-button"
                            data-testid={`log-${task.id}`}
                            disabled={completedToday}
                            onClick={() => submitCheckIn(task)}
                            type="button"
                          >
                            <Camera aria-hidden="true" size={16} />
                            Log
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="empty-panel">
                <Trophy aria-hidden="true" size={24} />
                <p>Pick a template to start the first league for this group.</p>
              </div>
            )}
          </section>

          <aside className="right-rail">
            <section className="template-panel">
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">Templates</p>
                  <h3>Start league</h3>
                </div>
              </div>
              <div className="template-list">
                {templates.map((template) => (
                  <button
                    className={`template-card ${
                      template.id === selectedTemplate.id ? "active" : ""
                    }`}
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

              <form className="challenge-form" onSubmit={startChallenge}>
                <label htmlFor="challenge-name">Challenge name</label>
                <input
                  id="challenge-name"
                  onChange={(event) => setChallengeName(event.target.value)}
                  value={challengeName}
                />
                <label htmlFor="challenge-duration">Duration</label>
                <input
                  id="challenge-duration"
                  min={1}
                  onChange={(event) => setChallengeDuration(Number(event.target.value))}
                  type="number"
                  value={challengeDuration}
                />
                <label htmlFor="challenge-stake">Stakes</label>
                <input
                  id="challenge-stake"
                  onChange={(event) => setChallengeStake(event.target.value)}
                  value={challengeStake}
                />
                <button className="primary-button full" type="submit">
                  <Flame aria-hidden="true" size={16} />
                  Start challenge
                </button>
              </form>
            </section>

            <section className="leaderboard-panel">
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">Leaderboard</p>
                  <h3>Standings</h3>
                </div>
                <Trophy aria-hidden="true" size={18} />
              </div>
              <div className="leaderboard">
                {leaderboard.map((row, index) => (
                  <div className={`leaderboard-row rank-${index + 1}`} data-rank={index + 1} key={row.member.id}>
                    <span className="rank">{index + 1}</span>
                    <span className="avatar" style={{ backgroundColor: row.member.color }}>
                      {getInitials(row.member.name)}
                    </span>
                    <div>
                      <strong>{row.member.name}</strong>
                      <small>
                        {row.receipts} receipts
                        {row.challenged ? ` / ${row.challenged} challenged` : ""}
                      </small>
                    </div>
                    <b>{row.points}</b>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="feed-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Proof feed</p>
              <h3>Receipts</h3>
            </div>
            <MessageSquare aria-hidden="true" size={18} />
          </div>

          {feed.length ? (
            <div className="feed-list">
              {feed.map((checkIn) => {
                const member = findMember(checkIn.memberId);
                return (
                  <article className="feed-item" key={checkIn.id}>
                    <div className="feed-head">
                      <span
                        className="avatar"
                        style={{ backgroundColor: member?.color ?? "#4b5563" }}
                      >
                        {getInitials(member?.name ?? "U")}
                      </span>
                      <div>
                        <h4>
                          {member?.name ?? "Unknown"} logged {checkIn.taskTitle}
                        </h4>
                        <p>
                          {formatDate(checkIn.createdAt)} / {checkIn.points} pts /{" "}
                          {checkIn.proofType}
                        </p>
                      </div>
                      {checkIn.challenged ? (
                        <span className="challenge-badge">challenged</span>
                      ) : null}
                    </div>

                    <p className="proof-text">{checkIn.proofText}</p>
                    {checkIn.photoDataUrl ? (
                      <img
                        alt={`${checkIn.taskTitle} proof`}
                        className="proof-image"
                        src={checkIn.photoDataUrl}
                      />
                    ) : null}

                    <div className="feed-actions">
                      <button
                        className="ghost-button"
                        onClick={() => reactToCheckIn(checkIn.id, "fire")}
                        title="Add fire reaction"
                        type="button"
                      >
                        <Flame aria-hidden="true" size={16} />
                        {checkIn.reactions.fire}
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => reactToCheckIn(checkIn.id, "receipt")}
                        title="Add receipt reaction"
                        type="button"
                      >
                        <ReceiptText aria-hidden="true" size={16} />
                        {checkIn.reactions.receipt}
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => toggleChallenge(checkIn.id)}
                        type="button"
                      >
                        <ShieldQuestion aria-hidden="true" size={16} />
                        {checkIn.challenged ? "Clear" : "Challenge"}
                      </button>
                    </div>

                    {checkIn.comments.length ? (
                      <div className="comments">
                        {checkIn.comments.map((comment) => {
                          const commentMember = findMember(comment.memberId);
                          return (
                            <p key={comment.id}>
                              <strong>{commentMember?.name ?? "Member"}:</strong> {comment.body}
                            </p>
                          );
                        })}
                      </div>
                    ) : null}

                    <form className="comment-form" onSubmit={(event) => addComment(checkIn.id, event)}>
                      <input
                        aria-label="Comment"
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [checkIn.id]: event.target.value,
                          }))
                        }
                        placeholder="Comment"
                        value={commentDrafts[checkIn.id] ?? ""}
                      />
                      <button className="icon-button" title="Post comment" type="submit">
                        <Plus aria-hidden="true" size={16} />
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <CircleDollarSign aria-hidden="true" size={24} />
              <p>Receipts will land here once members check in.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
