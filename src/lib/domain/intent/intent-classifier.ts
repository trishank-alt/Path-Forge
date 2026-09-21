import { ConversationalIntent, ConversationalIntentType } from "./conversational-intent";
import { RoadmapPhase } from "../../contracts";

export interface IntentClassificationContext {
  expectedDimension?: string | null;
  activePhase?: RoadmapPhase | null;
  declaredRole?: string | null;
}

export class IntentClassifier {
  /**
   * Deterministically classifies user message into a structured ConversationalIntent
   * prior to any dimension validation.
   */
  public classify(
    message: string,
    context?: IntentClassificationContext
  ): ConversationalIntent {
    const raw = (message || "").trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    if (!clean) {
      return {
        type: "uncertainty",
        rawMessage: raw,
        uncertaintyDetail: "Empty message",
      };
    }

    // 1. Deliverable Review
    const isDeliverableInquiry =
      clean.includes("review the current deliverable") ||
      clean.includes("review deliverable") ||
      clean.includes("current deliverable") ||
      clean.includes("what is the deliverable") ||
      clean.includes("explain deliverable");

    if (isDeliverableInquiry) {
      return {
        type: "deliverable_review",
        rawMessage: raw,
      };
    }

    if (clean.includes("working on it now")) {
      return {
        type: "deliverable_review",
        rawMessage: raw,
        deliverableFeedback: "in_progress",
      };
    }

    if (clean.includes("break it into smaller steps") || clean.includes("smaller steps")) {
      return {
        type: "deliverable_review",
        rawMessage: raw,
        deliverableFeedback: "break_down",
      };
    }

    if (clean.includes("different project") || clean.includes("change project") || clean.includes("another project")) {
      return {
        type: "deliverable_review",
        rawMessage: raw,
        deliverableFeedback: "change_project",
      };
    }

    // 2. Pace Adjustment
    const isPaceInquiry =
      clean.includes("adjust the pace") ||
      clean.includes("adjust pace") ||
      clean.includes("change pace") ||
      clean.includes("too fast") ||
      clean.includes("too slow") ||
      clean.includes("more time") ||
      clean.includes("less time") ||
      clean.includes("adjust hours");

    if (isPaceInquiry) {
      return {
        type: "pace_adjustment",
        rawMessage: raw,
      };
    }

    if (clean.includes("reduce weekly hours") || clean.includes("easier pace") || clean.includes("fewer hours")) {
      return {
        type: "pace_adjustment",
        rawMessage: raw,
        pacePreference: "reduce_hours",
      };
    }

    if (clean.includes("increase weekly hours") || clean.includes("faster pace") || clean.includes("more hours")) {
      return {
        type: "pace_adjustment",
        rawMessage: raw,
        pacePreference: "increase_hours",
      };
    }

    if (clean.includes("keep current pace") || clean.includes("pace as is")) {
      return {
        type: "pace_adjustment",
        rawMessage: raw,
        pacePreference: "keep_pace",
      };
    }

    // 3. Direction Pivot & Rejection Evaluation
    // Explicit rejection patterns: e.g. "I don't want backend anymore", "not interested in backend", "hate backend"
    const hasExplicitRejection =
      clean.includes("don t want") ||
      clean.includes("dont want") ||
      clean.includes("do not want") ||
      clean.includes("not interested in") ||
      clean.includes("no longer want") ||
      clean.includes("stop doing");

    // Extract rejected focus if present (e.g. backend, frontend, devops, etc.)
    let rejectedFocus: string | undefined;
    if (hasExplicitRejection) {
      const match = clean.match(/(?:don t want|dont want|do not want|not interested in|no longer want|stop doing)\s+([a-z]+)/i);
      if (match && match[1] && match[1] !== "to" && match[1] !== "a" && match[1] !== "the") {
        rejectedFocus = match[1].trim();
      }
    }

    // Directional pivot signal patterns
    const isPivotPhrase =
      clean.includes("change direction") ||
      clean.includes("change directions") ||
      clean.includes("switch direction") ||
      clean.includes("switch directions") ||
      clean.includes("pivot") ||
      clean.includes("explore other options") ||
      clean.includes("different direction") ||
      clean.includes("different path") ||
      clean.includes("different career") ||
      clean.includes("switch career") ||
      clean.includes("other options") ||
      clean.includes("another field in mind") ||
      clean.includes("type of work in mind");

    // Check for target field mentions (e.g. "AI", "machine learning", "frontend", "mobile", "cloud", "security", "data")
    let pivotTarget: string | null = null;
    if (clean.includes("ai") || clean.includes("machine learning") || clean.includes("ml")) {
      pivotTarget = "AI & Machine Learning";
    } else if (clean.includes("frontend") || clean.includes("web app") || clean.includes("ui")) {
      pivotTarget = "Frontend & UI Engineering";
    } else if (clean.includes("cloud") || clean.includes("devops") || clean.includes("sre")) {
      pivotTarget = "DevOps & Cloud Platform Engineer";
    } else if (clean.includes("mobile") || clean.includes("ios") || clean.includes("android")) {
      pivotTarget = "Mobile App Developer";
    } else if (clean.includes("data") || clean.includes("data science")) {
      pivotTarget = "Data Scientist & ML Engineer";
    } else if (clean.includes("security") || clean.includes("cybersecurity")) {
      pivotTarget = "Cybersecurity Engineer";
    }

    // If explicit rejection is paired with a new target:
    // e.g. "I don't want backend anymore. I'd like to explore AI."
    if (hasExplicitRejection && pivotTarget) {
      return {
        type: "pivot_request",
        rawMessage: raw,
        pivotTarget,
        hasExplicitRejection: true,
        rejectedFocus,
      };
    }

    // If explicit rejection alone (without new target):
    if (hasExplicitRejection) {
      return {
        type: "pivot_request",
        rawMessage: raw,
        pivotTarget: null,
        hasExplicitRejection: true,
        rejectedFocus,
      };
    }

    // Comparative interest WITHOUT rejection:
    // e.g. "I think AI might be more interesting than this", "Maybe AI", "AI seems interesting"
    // Crucial invariant: "I think AI might be more interesting" is interest evidence, NOT rejection!
    if (
      (clean.includes("more interesting than") ||
        clean.startsWith("maybe ") ||
        clean.includes("seems interesting") ||
        clean.includes("looks interesting") ||
        clean.includes("curious about")) &&
      pivotTarget
    ) {
      return {
        type: "free_form_evidence",
        rawMessage: raw,
        pivotTarget,
        hasExplicitRejection: false,
      };
    }

    // Pivot request phrase without explicit rejection:
    // e.g. "I want to change direction", "Can we change directions?", "I want to pivot"
    if (isPivotPhrase) {
      return {
        type: "pivot_request",
        rawMessage: raw,
        pivotTarget: pivotTarget || null,
        hasExplicitRejection: false,
      };
    }

    // 4. Difficulty / Struggle
    const isDifficulty =
      clean.includes("difficult") ||
      clean.includes("struggling") ||
      clean.includes("too hard") ||
      clean.includes("im stuck") ||
      clean.includes("i am stuck") ||
      clean.includes("having trouble");

    if (isDifficulty) {
      return {
        type: "difficulty",
        rawMessage: raw,
        difficultyDetail: raw,
      };
    }

    // 5. Uncertainty / Discovery Exploration
    const isUncertainty =
      clean.includes("no idea") ||
      clean.includes("don t know") ||
      clean.includes("dont know") ||
      clean.includes("not sure") ||
      clean.includes("undecided") ||
      clean.includes("confused") ||
      clean === "im not sure yet" ||
      clean === "i am not sure yet";

    if (isUncertainty) {
      return {
        type: "uncertainty",
        rawMessage: raw,
        uncertaintyDetail: raw,
      };
    }

    // 6. Active Question Dimension Answer
    // If the system is actively waiting for an expectedDimension and this is not a meta-conversational command:
    if (context?.expectedDimension) {
      return {
        type: "dimension_answer",
        rawMessage: raw,
        dimensionAnswer: raw,
      };
    }

    // 7. General free-form evidence / statement
    return {
      type: "free_form_evidence",
      rawMessage: raw,
      pivotTarget: pivotTarget || null,
      hasExplicitRejection: false,
    };
  }
}

export const intentClassifier = new IntentClassifier();
