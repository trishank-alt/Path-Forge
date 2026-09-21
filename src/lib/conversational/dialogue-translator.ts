import {
  PlanningDecision,
  RoadmapPhase,
  UserWorkModel,
  QuestionDecision,
} from "../contracts";
import { ConversationalIntent } from "../domain/intent/conversational-intent";
import { intentClassifier } from "../domain/intent/intent-classifier";
import { sanitizeSuggestedChips } from "./chip-sanitizer";

export interface InlinePlanningEvent {
  type: "plan_updated" | "new_phase" | "experiment_proposed" | "phase_completed";
  title: string;
  previousPhaseTitle?: string;
  previousPhaseStatus?: "superseded" | "completed";
  reason?: string;
  newPhaseTitle?: string;
  newPhaseGoal?: string;
  duration?: string;
  experimentTitle?: string;
  experimentGoal?: string;
  experimentDurationMinutes?: number;
}

export interface DialogueTranslationInput {
  userMessage?: string;
  intent?: ConversationalIntent | null;
  decision?: PlanningDecision | null;
  activePhase?: RoadmapPhase | null;
  previousPhase?: RoadmapPhase | null;
  workModel?: UserWorkModel | null;
  activeQuestion?: QuestionDecision | null;
  extractedFactsCount?: number;
  isInitialGreeting?: boolean;
}

export interface DialogueTranslationResult {
  replyText: string;
  inlineEvent?: InlinePlanningEvent;
  suggestedChips?: string[];
  transparentReasoning?: string;
}

/**
 * Pure presentation-only translator.
 * Takes structured planning decision, conversational intent, and state
 * and translates it into natural, thoughtful conversational responses and lightweight events.
 *
 * It NEVER makes planning decisions or evaluates thresholds independently.
 */
export function translateDecisionToDialogue(
  input: DialogueTranslationInput
): DialogueTranslationResult {
  const result = evaluateDialogue(input);
  const userMsg = input.userMessage || "";
  const intentType = input.intent?.type;

  return {
    ...result,
    suggestedChips: sanitizeSuggestedChips(result.suggestedChips, {
      userMessage: userMsg,
      intentType,
    }),
  };
}

function evaluateDialogue(
  input: DialogueTranslationInput
): DialogueTranslationResult {
  const {
    userMessage = "",
    decision,
    activePhase,
    previousPhase,
    activeQuestion,
    isInitialGreeting,
  } = input;

  // Derive intent from structured input or fallback to classifier if caller passed raw message
  const intent: ConversationalIntent =
    input.intent ||
    intentClassifier.classify(userMessage, {
      activePhase,
      expectedDimension: activeQuestion?.selectedQuestion?.dimension,
    });

  // 1. Initial Greeting / Discovery Welcome
  if (isInitialGreeting || (!userMessage && !decision && !activePhase)) {
    return {
      replyText:
        "Hi, I'm PathForge. I'm here to help you figure out what engineering work genuinely fits you through conversation, practical exploration, and adaptive learning.\n\nTo get started, what kinds of problems, technology, or projects are you curious about?",
      suggestedChips: [
        "I'm curious about backend & APIs",
        "AI & Machine Learning interests me",
        "Frontend & UI engineering",
        "I have no idea what career I want",
      ],
      transparentReasoning: "Initial discovery state initialized. Waiting for user input to capture first evidence signals.",
    };
  }

  // 2. Phase Superseded (Directional Pivot / Material Incompatibility evaluated by DecisionEngine)
  if (
    decision?.phaseDisposition === "supersede" &&
    decision.createdPhaseId &&
    activePhase
  ) {
    const reasonText =
      decision.rationale || "You decided this direction is no longer a fit.";
    return {
      replyText: `I think we have enough evidence to change direction. When a direction clearly isn't fitting, moving on is the right call.\n\nI'm replacing your previous phase with an active exploration phase: "${activePhase.objective}". Your previous phase will remain preserved in your history so we don't lose what we learned from it.`,
      inlineEvent: {
        type: "plan_updated",
        title: "PLAN UPDATED",
        previousPhaseTitle: previousPhase?.objective || "Previous Focus",
        previousPhaseStatus: "superseded",
        reason: reasonText,
        newPhaseTitle: activePhase.objective,
        newPhaseGoal: activePhase.project?.description || activePhase.objective,
        duration: `${activePhase.duration.estimatedWeeks} weeks`,
      },
      transparentReasoning: `Decision Engine evaluated phaseDisposition = 'supersede' based on explicit rejection / accumulated negative signals: ${decision.rationale}`,
    };
  }

  // 3. Phase Completed -> Next Phase Committed
  if (
    (decision?.phaseDisposition === "complete" || previousPhase?.status === "completed") &&
    decision?.mode === "commit" &&
    activePhase &&
    activePhase.id !== previousPhase?.id
  ) {
    return {
      replyText: `Great work completing Phase ${previousPhase?.phaseNumber || 1}! Based on your deliverable and reflection, we have enough evidence to advance to the next intervention: "${activePhase.objective}".`,
      inlineEvent: {
        type: "new_phase",
        title: "NEW INTERVENTION ACTIVATED",
        newPhaseTitle: `Phase ${activePhase.phaseNumber}: ${activePhase.objective}`,
        newPhaseGoal: activePhase.project?.description || activePhase.objective,
        duration: `${activePhase.duration.estimatedWeeks} weeks (${activePhase.duration.weeklyHours}h/wk)`,
      },
      transparentReasoning: `Decision Engine evaluated phaseDisposition = 'complete' + mode = 'commit'. Previous intervention marked COMPLETED and Phase ${activePhase.phaseNumber} created.`,
    };
  }

  // 4. Initial Sustained Intervention Created
  if (
    decision?.mode === "commit" &&
    decision?.createdPhaseId &&
    !previousPhase &&
    activePhase
  ) {
    return {
      replyText: `Based on what you've shared, I've established your first learning intervention: "${activePhase.objective}".\n\nRather than assuming a rigid multi-month path, this phase is designed specifically to test how you respond to real engineering work in this space. Take a look at the details in the panel on the right.`,
      inlineEvent: {
        type: "new_phase",
        title: "INTERVENTION ACTIVATED",
        newPhaseTitle: `Phase ${activePhase.phaseNumber}: ${activePhase.objective}`,
        newPhaseGoal: activePhase.project?.description || activePhase.objective,
        duration: `${activePhase.duration.estimatedWeeks} weeks (${activePhase.duration.weeklyHours}h/wk)`,
      },
      transparentReasoning: `Decision Engine evaluated mode = 'commit' for target '${activePhase.objective}'. Activated Phase 1 intervention.`,
    };
  }

  // 5. Experiment Proposal (DecisionMode = EXPLORE)
  if (decision?.mode === "explore" || decision?.activeExperiment) {
    const exp = decision.activeExperiment;
    const durationMins = exp ? exp.estimatedHours * 60 : 60;
    return {
      replyText: `Rather than guessing, let's test it.\n\nI'd like you to spend about ${durationMins} minutes on a focused diagnostic probe: "${exp?.objective || 'Hands-on practical exploration'}". Afterward, tell me which parts you enjoyed, tolerated, and disliked so we can make an evidence-informed decision.`,
      inlineEvent: {
        type: "experiment_proposed",
        title: "PRACTICAL EXPERIMENT PROPOSED",
        experimentTitle: exp?.objective || "Rapid Hands-on Probe",
        experimentGoal: exp?.hypothesis || "Test real-world affinity before committing to a phase",
        experimentDurationMinutes: durationMins,
      },
      suggestedChips: [
        "I'm ready to start the experiment",
        "Can we adjust the time commitment?",
        "Tell me more about what to build",
      ],
      transparentReasoning: `Decision Engine evaluated mode = 'explore'. Generating diagnostic probe without creating a sustained roadmap phase.`,
    };
  }

  // 6. Targeted Disambiguation (DecisionMode = DISAMBIGUATE or activeQuestion)
  if (decision?.mode === "disambiguate" || activeQuestion?.selectedQuestion) {
    const q = activeQuestion?.selectedQuestion;
    if (q) {
      return {
        replyText: q.question,
        suggestedChips: q.options || undefined,
        transparentReasoning: `Decision Engine selected DISAMBIGUATE on dimension '${q.dimension}': ${activeQuestion.decisionRationale}`,
      };
    }
  }

  // 7. Structured Interaction Intent Presentation (Presentation Layer Only)

  // 7A. Unspecified Pivot Request
  if (intent.type === "pivot_request" && !intent.hasExplicitRejection) {
    return {
      replyText:
        "Absolutely. Before we change the plan, what are you thinking of moving toward? It can be a specific field, a type of work, or something you're only vaguely curious about.",
      suggestedChips: [
        "I have another field in mind",
        "I have a type of work in mind",
        "I'm not sure yet",
      ],
      transparentReasoning:
        "User signaled intent to reconsider direction without specifying a destination. Preserving active phase and gathering candidate alternatives.",
    };
  }

  // 7B. Pace Adjustment Inquiry & Selection
  if (intent.type === "pace_adjustment") {
    if (intent.pacePreference) {
      return {
        replyText:
          "I've factored that pace preference into your planning constraints. We will adjust the weekly expectation accordingly.",
        suggestedChips: activePhase
          ? [
              "Let's review the current deliverable",
              "I want to change direction",
              "Can we adjust the pace?",
            ]
          : [
              "I want to build web applications",
              "I'm interested in cloud & APIs",
              "I want to explore data & AI",
            ],
        transparentReasoning:
          `User specified pace preference: '${intent.pacePreference}'. Updated capacity constraint in UserWorkModel.`,
      };
    }

    return {
      replyText:
        "We can easily adjust the pace to fit your schedule. Would you prefer to reduce your weekly time commitment to keep things manageable, or accelerate the timeline?",
      suggestedChips: [
        "Reduce weekly hours (easier pace)",
        "Increase weekly hours (faster pace)",
        "Keep current pace as is",
      ],
      transparentReasoning:
        "User inquired about pace adjustment. Preserving phase while gathering capacity preferences.",
    };
  }

  // 7C. Deliverable Review
  if (intent.type === "deliverable_review") {
    if (intent.deliverableFeedback === "change_project") {
      return {
        replyText:
          "Noticed that this project isn't resonating with you. What kind of engineering project would feel more engaging or relevant to your goals?",
        suggestedChips: [
          "Something with a visual frontend",
          "A command-line tool or automation script",
          "Working directly with real-world datasets",
          "Can we break it into smaller steps?",
        ],
        transparentReasoning:
          "User requested a different project. Gathering practical interest signals to adapt intervention within DecisionEngine.",
      };
    }

    const deliverableText =
      activePhase?.project?.description ||
      activePhase?.project?.title ||
      "a practical project milestone testing real engineering skills";

    return {
      replyText: `Here is what we're working toward in this phase:\n\n${deliverableText}\n\nThis deliverable is designed to provide observable evidence of your practical problem-solving in this domain. How is your progress coming along?`,
      suggestedChips: [
        "I'm working on it now",
        "Can we break it into smaller steps?",
        "I'd like a different project",
      ],
      transparentReasoning:
        "User requested review of current deliverable. Presenting practical requirements and measurement value.",
    };
  }

  // 7D. Difficulty / Struggle
  if (intent.type === "difficulty") {
    return {
      replyText:
        "That sounds more like difficulty with the current material than a change in direction. Let's adjust how we approach this phase rather than abandoning it.\n\nWhich specific concepts are feeling tough—is it the data modeling, asynchronous flow, or the overall setup?",
      suggestedChips: [
        "Data modeling & queries",
        "Asynchronous flow & promises",
        "Tooling & project setup",
        "I'd like an easier practice exercise",
      ],
      transparentReasoning:
        "User reported difficulty. In accordance with invariant N, difficulty alone does NOT supersede the active phase. Preserving phase and offering scaffolding.",
    };
  }

  // 7E. Comparative Interest / Side Interest without Rejection
  if (intent.type === "free_form_evidence" && intent.pivotTarget) {
    if (activePhase) {
      return {
        replyText:
          `That's great—${intent.pivotTarget} and your current focus actually share many foundational engineering principles in data flow, architecture, and problem-solving. For now, let's keep your current phase focused on these core fundamentals, and we can look at introducing an exploratory experiment or project later.`,
        suggestedChips: [
          "Sounds good, keep current focus",
          "Can we do a small exploration experiment later?",
          "What concepts overlap between both?",
        ],
        transparentReasoning:
          `User expressed interest in '${intent.pivotTarget}'. In accordance with the Interest Invariant, side interests do NOT supersede the active phase. Phase preserved.`,
      };
    } else {
      return {
        replyText:
          "What makes that area interesting to you? Is it the idea of building intelligent apps, working with models, or automating complex workflows?",
        suggestedChips: [
          "Building intelligent user apps",
          "Working directly with models & prompts",
          "Automating workflows & pipelines",
          "Something else",
        ],
        transparentReasoning:
          "User mentioned a possible direction in discovery. Captured as interest signal without prematurely manufacturing a roadmap phase.",
      };
    }
  }

  // 7F. Discovery Uncertainty
  if (intent.type === "uncertainty") {
    return {
      replyText:
        "That's completely fine—figuring that out is exactly what we're here for. You don't need to know your destination upfront.\n\nLet's start from what you've actually enjoyed building or doing in the past. What kind of problem solving or tinkering has felt rewarding to you?",
      suggestedChips: [
        "I liked building user interfaces",
        "I enjoyed writing logic & algorithms",
        "I like working with data & numbers",
        "I'm completely new to coding",
      ],
      transparentReasoning:
        "User expressed uncertainty. In accordance with the Discovery Invariant, no phase is manufactured. Gathering baseline evidence.",
    };
  }

  // 8. Default Conversational Fallback
  return {
    replyText: activePhase
      ? "I've captured that feedback and factored it into your work model. Tell me more about what you're thinking, or let me know if you want to adjust our approach to this phase."
      : "I've noted that in your profile. Tell me more about what kind of problems you want to work on or what you'd like to explore next.",
    suggestedChips: activePhase
      ? [
          "Let's review the current deliverable",
          "I want to change direction",
          "Can we adjust the pace?",
        ]
      : [
          "I want to build web applications",
          "I'm interested in cloud & APIs",
          "I want to explore data & AI",
        ],
    transparentReasoning:
      decision?.rationale || "Evidence captured into UserWorkModel. Current phase state maintained.",
  };
}
