export type Cadence = "daily" | "weekly" | "once";
export type ProofType = "photo" | "text" | "location" | "friend";

export type Member = {
  id: string;
  name: string;
  handle: string;
  color: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  members: Member[];
  createdAt: string;
};

export type TaskTemplate = {
  title: string;
  cadence: Cadence;
  points: number;
  proofRequired: boolean;
  proofTypes: ProofType[];
};

export type Template = {
  id: string;
  name: string;
  category: string;
  durationDays: number;
  stakeHint: string;
  icon: "gym" | "study" | "home";
  tasks: TaskTemplate[];
};

export type ChallengeTask = TaskTemplate & { id: string };

export type Challenge = {
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

export type Comment = {
  id: string;
  memberId: string;
  body: string;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  challengeId: string;
  taskId: string;
  taskTitle: string;
  memberId: string;
  date: string;
  proofType: ProofType;
  proofText: string;
  photoUri?: string;
  points: number;
  challenged: boolean;
  reactions: { fire: number; receipt: number };
  comments: Comment[];
  createdAt: string;
};

export type AppState = {
  groups: Group[];
  challenges: Challenge[];
  checkIns: CheckIn[];
};
