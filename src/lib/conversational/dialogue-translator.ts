import {
  PlanningDecision,
  RoadmapPhase,
  UserWorkModel,
  QuestionDecision,
} from "../contracts";

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
  userMessage: string;
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
 * Takes the resulting planning decision and state from the deterministic engine
 * and translates it into natural, thoughtful conversational responses and lightweight events.
 *
 * It NEVER makes planning decisions or evaluates thresholds independently.
 */
export function translateDecisionToDialogue(
  input: DialogueTranslationInput
): DialogueTranslationResult {
  const {
    userMessage,
    decision,
    activePhase,
    previousPhase,
    activeQuestion,
    isInitialGreeting,
  } = input;

  const msgLower = (userMessage || "").toLowerCase().trim();

  // 1. Initial Greeting / Discovery Welcome
  if (isInitialGreeting || !msgLower) {
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

  // 2. Phase Superseded (Directional Pivot / Material Incompatibility)
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
    // Check if user mentioned tediousness
    if (msgLower.includes("tedious") || msgLower.includes("boring") || msgLower.includes("repetitive")) {
      return {
        replyText:
          "Backend feeling tedious is useful information, but I wouldn't throw away the direction based on that alone.\n\nWhat part feels tedious to you?",
        suggestedChips: [
          "Building APIs",
          "Databases & Schemas",
          "Debugging & Logging",
          "Backend work in general",
          "Something else",
        ],
        transparentReasoning:
          "User expressed tedium. Decision Engine selected DISAMBIGUATE to isolate the root cause before taking action.",
      };
    }

    const q = activeQuestion?.selectedQuestion;
    if (q) {
      return {
        replyText: q.question,
        suggestedChips: q.options || undefined,
        transparentReasoning: `Decision Engine selected DISAMBIGUATE on dimension '${q.dimension}': ${activeQuestion.decisionRationale}`,
      };
    }
  }

  // 7. Conversational Dialogue with Phase Continuity (DecisionMode = CONTINUE / no phase mutation)
  // Scenario A: Difficulty / Struggle
  if (
    msgLower.includes("difficult") ||
    msgLower.includes("struggling") ||
    msgLower.includes("hard") ||
    msgLower.includes("stuck")
  ) {
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

  // Scenario C: Side Interest
  if (
    (msgLower.includes("also interested in") || msgLower.includes("interested in ai")) &&
    activePhase
  ) {
    return {
      replyText:
        "That's great—AI engineering and backend systems actually share many foundational engineering principles in data flow, API architecture, and performance. For now, let's keep your current phase focused on these core fundamentals, and we can look at introducing an AI-focused experiment or project later.",
      suggestedChips: [
        "Sounds good, keep current focus",
        "Can we do a small AI experiment later?",
        "What concepts overlap between both?",
      ],
      transparentReasoning:
        "User expressed secondary interest. In accordance with invariant M, side interests do NOT supersede the active phase. Phase preserved.",
    };
  }

  // Scenario H: Discovery with unknown career
  if (
    msgLower.includes("no idea") ||
    msgLower.includes("don't know") ||
    msgLower.includes("confused") ||
    msgLower.includes("not sure")
  ) {
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

  // Scenario I: Direction mention without commitment
  if (
    msgLower.includes("ai seems interesting") ||
    msgLower.includes("backend might be interesting") ||
    msgLower.includes("looks interesting")
  ) {
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
        "User mentioned a possible direction. Captured as interest signal without prematurely manufacturing a roadmap phase.",
    };
  }

  // General Uncertainty / "feels weird"
  if (msgLower.includes("weird") || msgLower.includes("hate") || msgLower.includes("dislike")) {
    return {
      replyText:
        "That's useful information, but I'm not sure yet whether you dislike the field itself or just the specific tasks we've touched so far. Can you pinpoint which part felt frustrating or unrewarding?",
      suggestedChips: [
        "The syntax & setup was annoying",
        "The problem wasn't interesting",
        "I don't like working without visuals",
        "It just didn't click",
      ],
      transparentReasoning:
        "User expressed negative reaction. Gathering specific evidence on root causes before evaluating phase alignment.",
    };
  }

  // Default conversational response
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
