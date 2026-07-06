/**
 * The PAR-Q readiness questions (the standard seven, in plain British
 * English). Answers are yes/no; any yes marks the screening positive so the
 * team follows up before the next session. Wording is placeholder pending
 * clinical sign-off (CLAUDE.md §7 #8).
 */
export const PARQ_QUESTIONS: { code: string; text: string }[] = [
  {
    code: "heart_condition",
    text: "Has your doctor ever said that you have a heart condition or high blood pressure?",
  },
  {
    code: "chest_pain",
    text: "Do you feel pain in your chest at rest, during daily activities, or when you are physically active?",
  },
  {
    code: "dizziness",
    text: "Do you lose balance because of dizziness, or have you lost consciousness in the last 12 months?",
  },
  {
    code: "chronic_condition",
    text: "Have you been diagnosed with another chronic medical condition, other than heart disease or high blood pressure?",
  },
  {
    code: "medications",
    text: "Are you currently taking prescribed medication for a chronic medical condition?",
  },
  {
    code: "joint_problem",
    text: "Do you currently have, or have you had within the last 12 months, a bone, joint or soft tissue problem that could be made worse by becoming more physically active?",
  },
  {
    code: "supervised_only",
    text: "Has your doctor ever said that you should only do physical activity under medical supervision?",
  },
];

export type ParqAnswers = Record<string, boolean>;
