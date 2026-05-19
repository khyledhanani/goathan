export type TaskCategory = "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
export type TaskFrequency = "DAILY" | "WEEKLY";
export type TaskProof = "PHOTO" | "SCREENSHOT" | "VIDEO";

export type TaskTemplateInput = {
  name: string;
  description?: string;
  category: TaskCategory;
  points: number;
  frequency: TaskFrequency;
  proof: TaskProof;
};

export type TaskTemplate = TaskTemplateInput & {
  id: string;
  label: string;
};

export type GroupStarterPack = {
  id: string;
  label: string;
  blurb: string;
  taskIds: string[];
};

export const TASK_CATEGORIES: TaskCategory[] = [
  "MORNING",
  "MOVE",
  "FUEL",
  "MIND",
  "REST",
];

export const TASK_FREQUENCIES: TaskFrequency[] = ["DAILY", "WEEKLY"];
export const TASK_PROOFS: TaskProof[] = ["PHOTO", "SCREENSHOT", "VIDEO"];

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "workout",
    label: "Workout session",
    name: "Workout session",
    description: "Post proof from the gym, class, run, or home workout.",
    category: "MOVE",
    frequency: "DAILY",
    points: 25,
    proof: "PHOTO",
  },
  {
    id: "strength",
    label: "Strength session",
    name: "Strength session",
    description: "Lift with intent. Upload a gym photo or workout log.",
    category: "MOVE",
    frequency: "DAILY",
    points: 30,
    proof: "PHOTO",
  },
  {
    id: "cardio",
    label: "Run / cardio",
    name: "Run or cardio",
    description: "Show the session, route, machine, or tracker summary.",
    category: "MOVE",
    frequency: "DAILY",
    points: 20,
    proof: "SCREENSHOT",
  },
  {
    id: "steps",
    label: "10k steps",
    name: "10k steps",
    description: "Upload a step-count screenshot showing 10,000+ steps.",
    category: "MOVE",
    frequency: "DAILY",
    points: 15,
    proof: "SCREENSHOT",
  },
  {
    id: "mobility",
    label: "Mobility",
    name: "Mobility or stretch",
    description: "Five minutes minimum. Mat, timer, or pose proof counts.",
    category: "MOVE",
    frequency: "DAILY",
    points: 10,
    proof: "PHOTO",
  },
  {
    id: "protein",
    label: "Protein target",
    name: "Hit protein target",
    description: "Upload a tracker screenshot or meal log for the day.",
    category: "FUEL",
    frequency: "DAILY",
    points: 20,
    proof: "SCREENSHOT",
  },
  {
    id: "calories",
    label: "Calorie target",
    name: "Hit calorie target",
    description: "Upload a food-log screenshot showing the daily target.",
    category: "FUEL",
    frequency: "DAILY",
    points: 15,
    proof: "SCREENSHOT",
  },
  {
    id: "no-alcohol",
    label: "No alcohol",
    name: "No alcohol",
    description: "Daily check-in. Post a clean calendar, note, or context shot.",
    category: "FUEL",
    frequency: "DAILY",
    points: 15,
    proof: "PHOTO",
  },
  {
    id: "no-takeout",
    label: "No takeout",
    name: "No takeout",
    description: "Cook or prep your own food. Show the meal or log.",
    category: "FUEL",
    frequency: "DAILY",
    points: 15,
    proof: "PHOTO",
  },
  {
    id: "water",
    label: "Water target",
    name: "Hit water target",
    description: "Show your bottle, tracker, or daily hydration log.",
    category: "FUEL",
    frequency: "DAILY",
    points: 10,
    proof: "PHOTO",
  },
  {
    id: "weigh-in",
    label: "Weekly weigh-in",
    name: "Weekly weigh-in",
    description: "Upload a scale photo or weight-tracker screenshot.",
    category: "FUEL",
    frequency: "WEEKLY",
    points: 25,
    proof: "PHOTO",
  },
  {
    id: "progress-photo",
    label: "Progress photo",
    name: "Progress photo",
    description: "Same lighting, same angle if possible.",
    category: "FUEL",
    frequency: "WEEKLY",
    points: 20,
    proof: "PHOTO",
  },
  {
    id: "sunlight",
    label: "Morning sunlight",
    name: "Morning sunlight",
    description: "Get outside early. Upload an outdoor daylight photo.",
    category: "MORNING",
    frequency: "DAILY",
    points: 10,
    proof: "PHOTO",
  },
  {
    id: "make-bed",
    label: "Make your bed",
    name: "Make your bed",
    description: "Start clean. Snap the made bed before leaving the room.",
    category: "MORNING",
    frequency: "DAILY",
    points: 5,
    proof: "PHOTO",
  },
  {
    id: "morning-routine",
    label: "Morning routine",
    name: "Morning routine",
    description: "Complete your chosen morning routine and post proof.",
    category: "MORNING",
    frequency: "DAILY",
    points: 15,
    proof: "PHOTO",
  },
  {
    id: "deep-work",
    label: "Deep work block",
    name: "Deep work block",
    description: "Complete a focused block and upload timer or notes proof.",
    category: "MIND",
    frequency: "DAILY",
    points: 25,
    proof: "PHOTO",
  },
  {
    id: "read",
    label: "Read pages",
    name: "Read 20 pages",
    description: "Upload the book, notes, or reading tracker.",
    category: "MIND",
    frequency: "DAILY",
    points: 10,
    proof: "PHOTO",
  },
  {
    id: "journal",
    label: "Journal reflection",
    name: "Journal reflection",
    description: "Write a short reflection and post a page or notes screenshot.",
    category: "MIND",
    frequency: "DAILY",
    points: 10,
    proof: "PHOTO",
  },
  {
    id: "practice-questions",
    label: "Practice questions",
    name: "Practice questions",
    description: "Complete a question set and upload the score or tracker.",
    category: "MIND",
    frequency: "DAILY",
    points: 25,
    proof: "SCREENSHOT",
  },
  {
    id: "screen-cutoff",
    label: "Screen cutoff",
    name: "Screen cutoff",
    description: "Post your screen-time setting, bedtime mode, or lock screen.",
    category: "REST",
    frequency: "DAILY",
    points: 10,
    proof: "SCREENSHOT",
  },
  {
    id: "sleep",
    label: "Sleep target",
    name: "Seven hours sleep",
    description: "Upload a sleep-tracker screenshot showing seven hours.",
    category: "REST",
    frequency: "DAILY",
    points: 15,
    proof: "SCREENSHOT",
  },
  {
    id: "bedtime",
    label: "Bedtime target",
    name: "Hit bedtime target",
    description: "Show sleep mode, alarm setup, or tracker proof.",
    category: "REST",
    frequency: "DAILY",
    points: 10,
    proof: "SCREENSHOT",
  },
];

export const GROUP_STARTER_PACKS: GroupStarterPack[] = [
  {
    id: "the-cut",
    label: "The Cut",
    blurb: "For summer cuts, wedding cuts, and body recomp groups.",
    taskIds: [
      "workout",
      "steps",
      "protein",
      "calories",
      "no-alcohol",
      "weigh-in",
      "progress-photo",
    ],
  },
  {
    id: "seventy-five-soft",
    label: "75 Soft",
    blurb: "A realistic discipline challenge without the performative chaos.",
    taskIds: ["workout", "steps", "water", "read", "journal", "sleep"],
  },
  {
    id: "monk-mode",
    label: "Monk Mode",
    blurb: "Training, focus, low distraction, and boring consistency.",
    taskIds: [
      "morning-routine",
      "workout",
      "deep-work",
      "screen-cutoff",
      "read",
      "bedtime",
    ],
  },
  {
    id: "the-reset",
    label: "The Reset",
    blurb: "Low-friction wellness for people restarting from zero.",
    taskIds: [
      "make-bed",
      "sunlight",
      "steps",
      "no-takeout",
      "mobility",
      "sleep",
    ],
  },
  {
    id: "strength-camp",
    label: "Strength Camp",
    blurb: "Gym-first accountability with recovery and fuel built in.",
    taskIds: [
      "strength",
      "protein",
      "mobility",
      "sleep",
      "weigh-in",
      "progress-photo",
    ],
  },
  {
    id: "study-sprint",
    label: "Study Sprint",
    blurb: "Exam prep, certification pushes, coding blocks, or school.",
    taskIds: [
      "deep-work",
      "practice-questions",
      "read",
      "journal",
      "screen-cutoff",
      "sleep",
    ],
  },
  {
    id: "blank",
    label: "Start Blank",
    blurb: "Build the slate yourself from scratch.",
    taskIds: [],
  },
];

export function taskTemplateById(id: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find((template) => template.id === id);
}

export function tasksForStarterPack(pack: GroupStarterPack): TaskTemplateInput[] {
  return pack.taskIds
    .map((id) => taskTemplateById(id))
    .filter((task): task is TaskTemplate => task !== undefined)
    .map(({ name, description, category, frequency, points, proof }) => ({
      name,
      description,
      category,
      frequency,
      points,
      proof,
    }));
}
