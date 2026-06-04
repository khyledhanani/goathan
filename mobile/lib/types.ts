export type MainGoal =
  | "STRONGER"
  | "LOSE_FAT"
  | "CONSISTENCY"
  | "COMPETE"
  | "HEALTH";

export const MAIN_GOAL_OPTIONS: { value: MainGoal; label: string; blurb: string }[] = [
  { value: "STRONGER",    label: "Get stronger",        blurb: "Add weight to the bar." },
  { value: "LOSE_FAT",    label: "Lose fat",            blurb: "Eat clean, train hard." },
  { value: "CONSISTENCY", label: "Build consistency",   blurb: "Show up every day." },
  { value: "COMPETE",     label: "Compete with friends", blurb: "Win the week." },
  { value: "HEALTH",      label: "Improve health",      blurb: "Move better, sleep better." },
];

export const mainGoalLabel = (g: MainGoal | undefined): string =>
  MAIN_GOAL_OPTIONS.find((o) => o.value === g)?.label ?? "—";
