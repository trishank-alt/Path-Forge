/**
 * Generic, reusable conversational chip sanitizer.
 * Enforces the invariant:
 * "A suggested conversational action must not immediately reproduce itself as the same suggested action."
 */

export interface ChipSanitizationOptions {
  userMessage?: string;
  intentType?: string;
}

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes tokens and strips trivial plural 's' on action words for equivalence checking.
 */
function tokenizeAndStem(text: string): string[] {
  const norm = normalize(text);
  if (!norm) return [];
  return norm.split(" ").map((word) => {
    if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
      return word.slice(0, -1);
    }
    return word;
  });
}

/**
 * Equivalence clusters for conversational action prompts.
 * If the user's message is an invocation of an action, candidate chips
 * must not re-suggest invoking that same action.
 */
const ACTION_EQUIVALENCE_CLUSTERS: string[][] = [
  // Direction Change Cluster
  [
    "i want to change direction",
    "change direction",
    "can we change direction",
    "can we change directions",
    "change directions",
    "switch direction",
    "switch directions",
    "i want to pivot",
    "pivot",
    "explore other options",
    "different direction",
    "different path",
    "different career",
    "switch career",
  ],
  // Pace Adjustment Cluster
  [
    "can we adjust the pace",
    "adjust the pace",
    "adjust pace",
    "can we adjust pace",
    "change pace",
    "change the pace",
    "adjust hours",
  ],
  // Deliverable Review Cluster
  [
    "let s review the current deliverable",
    "lets review the current deliverable",
    "review the current deliverable",
    "review deliverable",
    "what is the deliverable",
    "explain deliverable",
  ],
];

/**
 * Checks if two short action phrases share high semantic token overlap
 * without falling into the substring trap.
 */
function areSemanticallyEquivalent(tokensA: string[], tokensB: string[]): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // Filter out stop words
  const stopWords = new Set(["i", "we", "can", "let", "lets", "s", "the", "a", "an", "to"]);
  const coreA = tokensA.filter((t) => !stopWords.has(t));
  const coreB = tokensB.filter((t) => !stopWords.has(t));

  if (coreA.length === 0 || coreB.length === 0) return false;

  // Exact match of core action tokens
  if (coreA.length === coreB.length && coreA.every((t, idx) => t === coreB[idx])) {
    return true;
  }

  // Jaccard similarity on core action tokens
  const setA = new Set(coreA);
  const setB = new Set(coreB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...coreA, ...coreB]).size;
  const jaccard = intersection / union;

  // If both are short phrases and share almost all core tokens (e.g. "change direction" vs "can we change directions")
  return jaccard >= 0.75;
}

export function sanitizeSuggestedChips(
  candidateChips: string[] | undefined,
  optionsOrUserMessage?: ChipSanitizationOptions | string
): string[] | undefined {
  if (!candidateChips || candidateChips.length === 0) return undefined;

  const userMsg =
    typeof optionsOrUserMessage === "string"
      ? optionsOrUserMessage
      : optionsOrUserMessage?.userMessage || "";

  const normUser = normalize(userMsg);
  const userTokens = tokenizeAndStem(userMsg);

  // Find if user message belongs to an action equivalence cluster
  let matchingCluster: Set<string> | null = null;
  if (normUser) {
    for (const cluster of ACTION_EQUIVALENCE_CLUSTERS) {
      const clusterTokens = cluster.map((c) => tokenizeAndStem(c).join(" "));
      const userTokenStr = userTokens.join(" ");
      if (
        cluster.some((item) => normalize(item) === normUser) ||
        clusterTokens.some((itemTokens) => itemTokens === userTokenStr)
      ) {
        matchingCluster = new Set(cluster.map((c) => tokenizeAndStem(c).join(" ")));
        break;
      }
    }
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const chip of candidateChips) {
    const normChip = normalize(chip);
    if (!normChip) continue;

    // 1. Remove exact self-reference
    if (normUser && normChip === normUser) {
      continue;
    }

    const chipTokens = tokenizeAndStem(chip);
    const chipTokenStr = chipTokens.join(" ");

    // 2. Remove cluster-equivalent self-reference
    if (matchingCluster && matchingCluster.has(chipTokenStr)) {
      continue;
    }

    // 3. Remove high-overlap token equivalent self-reference for short phrases
    if (userTokens.length > 0 && areSemanticallyEquivalent(userTokens, chipTokens)) {
      continue;
    }

    // 4. Deduplicate (preserve original casing of first appearance)
    if (seen.has(normChip)) {
      continue;
    }
    seen.add(normChip);

    sanitized.push(chip);
  }

  return sanitized.length > 0 ? sanitized : undefined;
}
