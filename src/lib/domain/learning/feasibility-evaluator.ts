import { FeasibilityResult, FeasibilityStatus } from "../../contracts";

export interface FeasibilityInput {
  requiredHours: number;
  hoursPerWeek: number;
  deadlineMonths: number;
}

export class FeasibilityEvaluator {
  /**
   * Deterministically evaluates the mathematical capacity and pacing feasibility
   * of completing a required workload given weekly time budget and deadline.
   *
   * Capacity classification:
   * - capacityRatio >= 1.0         -> "feasible"
   * - 0.75 <= capacityRatio < 1.0  -> "strained"
   * - capacityRatio < 0.75         -> "infeasible"
   *
   * Note: This evaluator is side-effect free and advisory. It MUST NOT mutate learner facts.
   */
  public evaluate(input: FeasibilityInput): FeasibilityResult {
    const { requiredHours, hoursPerWeek, deadlineMonths } = input;

    const safeHoursPerWeek = Math.max(0, hoursPerWeek);
    const safeDeadlineMonths = Math.max(0, deadlineMonths);
    const safeRequiredHours = Math.max(0, requiredHours);

    // 4.3 average weeks per month
    const availableHours = Number((safeHoursPerWeek * safeDeadlineMonths * 4.3).toFixed(1));
    const estimatedWeeks = safeHoursPerWeek > 0 ? Number((safeRequiredHours / safeHoursPerWeek).toFixed(1)) : 0;
    const capacityRatio = safeRequiredHours > 0 ? Number((availableHours / safeRequiredHours).toFixed(3)) : 1.0;

    let status: FeasibilityStatus = "feasible";
    if (capacityRatio < 0.75 || safeHoursPerWeek === 0 || safeDeadlineMonths === 0) {
      status = "infeasible";
    } else if (capacityRatio < 1.0) {
      status = "strained";
    } else {
      status = "feasible";
    }

    if (status === "infeasible") {
      const suggestedDeadlineMonths =
        safeHoursPerWeek > 0
          ? Math.ceil(safeRequiredHours / (safeHoursPerWeek * 4.3))
          : Math.ceil(safeRequiredHours / (8 * 4.3));
      const suggestedHoursPerWeek =
        safeDeadlineMonths > 0
          ? Math.ceil(safeRequiredHours / (safeDeadlineMonths * 4.3))
          : Math.ceil(safeRequiredHours / (6 * 4.3));

      const explanation = `The required curriculum (${safeRequiredHours} hours) cannot be completed within ${safeDeadlineMonths} month(s) at ${safeHoursPerWeek} hours/week (available: ${availableHours} hours, capacity ratio: ${(capacityRatio * 100).toFixed(1)}%).`;

      return {
        status: "infeasible",
        requiredHours: safeRequiredHours,
        availableHours,
        hoursPerWeek: safeHoursPerWeek,
        deadlineMonths: safeDeadlineMonths,
        estimatedWeeks,
        capacityRatio,
        explanation,
        alternative: {
          suggestedDeadlineMonths,
          suggestedHoursPerWeek,
          explanation: `To complete this track, adjust pace to at least ${suggestedHoursPerWeek} hours/week, or extend timeline to ${suggestedDeadlineMonths} months.`,
        },
      };
    }

    if (status === "strained") {
      const explanation = `The curriculum requires ${safeRequiredHours} hours against ${availableHours} available hours (${(capacityRatio * 100).toFixed(1)}% capacity). The timeline is tight but achievable with focused execution.`;
      return {
        status: "strained",
        requiredHours: safeRequiredHours,
        availableHours,
        hoursPerWeek: safeHoursPerWeek,
        deadlineMonths: safeDeadlineMonths,
        estimatedWeeks,
        capacityRatio,
        explanation,
      };
    }

    const explanation = `The curriculum requires ${safeRequiredHours} hours with ${availableHours} available hours (${(capacityRatio * 100).toFixed(1)}% capacity). The workload is fully feasible.`;
    return {
      status: "feasible",
      requiredHours: safeRequiredHours,
      availableHours,
      hoursPerWeek: safeHoursPerWeek,
      deadlineMonths: safeDeadlineMonths,
      estimatedWeeks,
      capacityRatio,
      explanation,
    };
  }
}

export const feasibilityEvaluator = new FeasibilityEvaluator();
