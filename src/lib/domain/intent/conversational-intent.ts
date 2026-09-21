export type ConversationalIntentType =
  | "pivot_request"
  | "pace_adjustment"
  | "deliverable_review"
  | "difficulty"
  | "question"
  | "uncertainty"
  | "free_form_evidence"
  | "dimension_answer";

export interface ConversationalIntent {
  type: ConversationalIntentType;
  rawMessage: string;
  pivotTarget?: string | null;
  hasExplicitRejection?: boolean;
  rejectedFocus?: string;
  pacePreference?: "reduce_hours" | "increase_hours" | "keep_pace" | string;
  deliverableFeedback?: "in_progress" | "break_down" | "change_project" | string;
  difficultyDetail?: string;
  uncertaintyDetail?: string;
  dimensionAnswer?: string;
}
