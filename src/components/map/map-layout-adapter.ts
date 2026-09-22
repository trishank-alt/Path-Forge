import { LearnerProfile, RoadmapPhase, UserWorkModel, ProfileFact, EvidenceItem } from "@/lib/contracts";
import { SEEDED_EDGES, SEEDED_SKILLS } from "@/lib/persistence/seed-data";

export type NodeStatus = "demonstrated" | "developing" | "emerging" | "explored" | "current";
export type NodeKind = "capability" | "activity" | "direction" | "characteristic";

export interface MapNodeEvidence {
  id: string;
  source: string;
  timestamp?: string;
  explanation?: string;
  signal?: any;
  confidence?: number;
  reliability?: number;
}

export interface MapNodeViewModel {
  id: string;
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  x: number;
  y: number;
  radius: number;
  description?: string;
  domain?: string;
  evidenceCount: number;
  evidence: MapNodeEvidence[];
  connectedNodeIds: string[];
  isCurrentPosition?: boolean;
  level?: string;
}

export interface MapEdgeViewModel {
  id: string;
  source: string;
  target: string;
  relationship: "prerequisite" | "related" | "developing" | "target";
  label?: string;
}

export interface CareerMapGraph {
  nodes: MapNodeViewModel[];
  edges: MapEdgeViewModel[];
  currentPositionNodeId: string | null;
  discoveryMode: boolean;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Deterministic string hash returning float between 0 and 1
 */
function deterministicHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) / 2147483647;
}

/**
 * Normalizes a skill/capability name to a standard key for matching
 */
function normalizeKey(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Transforms backend LearnerProfile and UserWorkModel into a deterministic
 * view model for the SVG Career Map.
 */
export function buildCareerMapGraph(profile: LearnerProfile | null): CareerMapGraph {
  if (!profile) {
    return {
      nodes: [],
      edges: [],
      currentPositionNodeId: null,
      discoveryMode: true,
      bounds: { minX: -400, maxX: 400, minY: -300, maxY: 300 },
    };
  }

  const workModel: UserWorkModel = profile.workModel || {
    capabilities: {},
    activities: {},
    workCharacteristics: {},
    preferences: { domains: [], languages: [], learningModes: [], resourceBudget: "free_only" },
    constraints: { hoursPerWeek: 8, deadlineMonths: 6, timezone: "UTC", safetyScopeConfirmed: false },
    uncertainties: [],
    negativeSignals: {},
    evidenceIds: [],
    lastUpdatedAt: new Date().toISOString(),
  };

  const activePhase = profile.activePhase;
  const phaseHistory = profile.phaseHistory || [];
  const completedPhases = phaseHistory.filter((p) => p.status === "completed");
  const supersededPhases = phaseHistory.filter((p) => p.status === "superseded");
  const discoveryMode = !activePhase;

  const rawFacts = profile.facts || [];
  const rawEvidence = profile.evidenceHistory || [];

  // 1. Collect all capability tokens and targets
  const activeTargets = new Set(
    (activePhase?.capabilityTargets || []).map((t) => normalizeKey(t))
  );
  const completedTargets = new Set(
    completedPhases.flatMap((p) => p.capabilityTargets || []).map((t) => normalizeKey(t))
  );
  const supersededTargets = new Set(
    supersededPhases.flatMap((p) => p.capabilityTargets || []).map((t) => normalizeKey(t))
  );

  const nodesMap = new Map<string, MapNodeViewModel>();
  const edges: MapEdgeViewModel[] = [];

  // Helper to find evidence for a capability
  const findEvidenceForCapability = (capName: string, capKey: string): MapNodeEvidence[] => {
    const list: MapNodeEvidence[] = [];

    // From profile.evidenceHistory
    for (const ev of rawEvidence) {
      const dim = (ev.dimension || "").toLowerCase();
      const sig = typeof ev.signal === "string" ? ev.signal.toLowerCase() : JSON.stringify(ev.signal).toLowerCase();
      if (
        dim.includes(capKey) ||
        dim.includes(capName.toLowerCase()) ||
        sig.includes(capKey) ||
        sig.includes(capName.toLowerCase()) ||
        (ev.supportedTargetIds && ev.supportedTargetIds.includes(capKey))
      ) {
        list.push({
          id: ev.id,
          source: ev.source || "evidence",
          timestamp: ev.timestamp,
          explanation: ev.explanation || (typeof ev.signal === "string" ? ev.signal : undefined),
          signal: ev.signal,
          confidence: ev.confidence,
        });
      }
    }

    // From profile.facts
    for (const f of rawFacts) {
      const dim = (f.dimension || "").toLowerCase();
      const val = typeof f.normalizedValue === "string" ? f.normalizedValue.toLowerCase() : String(f.rawValue).toLowerCase();
      if (
        dim.includes(capKey) ||
        dim.includes(capName.toLowerCase()) ||
        val.includes(capKey) ||
        val.includes(capName.toLowerCase())
      ) {
        if (!list.some((existing) => existing.id === f.id)) {
          list.push({
            id: f.id,
            source: f.source || "user_answer",
            timestamp: f.updatedAt || f.createdAt,
            explanation: f.evidence || String(f.rawValue),
            signal: f.normalizedValue ?? f.rawValue,
            reliability: f.reliability,
          });
        }
      }
    }

    return list;
  };

  // 2. Add Current Position / Focus Node
  let currentPositionNodeId: string | null = null;
  if (activePhase) {
    currentPositionNodeId = "node_current_focus";
    const shortTitle = activePhase.objective.length > 40
      ? activePhase.objective.substring(0, 37) + "..."
      : activePhase.objective;

    nodesMap.set(currentPositionNodeId, {
      id: currentPositionNodeId,
      label: "Current Focus",
      kind: "direction",
      status: "current",
      x: 0,
      y: 0,
      radius: 36,
      description: activePhase.objective,
      domain: profile.declaredTargetRole || undefined,
      evidenceCount: activePhase.evidenceTargets?.length || 0,
      evidence: (activePhase.evidenceTargets || []).map((et, idx) => ({
        id: `et_${idx}`,
        source: "active_target",
        explanation: `${et.dimension}: looking for ${et.expectedSignal}`,
      })),
      connectedNodeIds: [],
      isCurrentPosition: true,
    });
  } else {
    // Discovery Mode Position Node
    currentPositionNodeId = "node_discovery_center";
    const domainLabel = profile.declaredTargetRole || (workModel.preferences.domains[0] ?? "Exploratory Navigation");
    nodesMap.set(currentPositionNodeId, {
      id: currentPositionNodeId,
      label: domainLabel,
      kind: "direction",
      status: "current",
      x: 0,
      y: 0,
      radius: 32,
      description: "You are currently exploring candidate engineering directions through conversation and diagnostic evidence.",
      domain: domainLabel,
      evidenceCount: rawFacts.length,
      evidence: rawFacts.slice(0, 5).map((f) => ({
        id: f.id,
        source: f.source,
        timestamp: f.createdAt,
        explanation: f.evidence || String(f.rawValue),
      })),
      connectedNodeIds: [],
      isCurrentPosition: true,
    });
  }

  // 3. Collect all user capabilities from workModel
  const capabilitiesList = Object.values(workModel.capabilities);

  // Also include any activePhase targets not yet in workModel
  if (activePhase) {
    for (const target of activePhase.capabilityTargets) {
      const key = normalizeKey(target);
      if (!capabilitiesList.some((c) => normalizeKey(c.name) === key)) {
        capabilitiesList.push({
          id: `cap_${key}`,
          name: target,
          level: "novice",
          status: "inferred",
          confidence: 0.5,
          supportingEvidenceIds: [],
          contradictingEvidenceIds: [],
          lastAssessedAt: null,
        });
      }
    }
  }

  // Group capabilities by ring/status
  const developingNodes: Array<{ name: string; key: string; cap: any }> = [];
  const demonstratedNodes: Array<{ name: string; key: string; cap: any }> = [];
  const emergingNodes: Array<{ name: string; key: string; cap: any }> = [];
  const exploredNodes: Array<{ name: string; key: string; cap: any }> = [];

  for (const cap of capabilitiesList) {
    const key = normalizeKey(cap.name);
    const isActivelyDeveloping = activeTargets.has(key);
    const isCompleted = completedTargets.has(key) || cap.status === "demonstrated" || (cap.supportingEvidenceIds && cap.supportingEvidenceIds.length >= 2);
    const isSuperseded = supersededTargets.has(key) && !isActivelyDeveloping;

    if (isActivelyDeveloping) {
      developingNodes.push({ name: cap.name, key, cap });
    } else if (isCompleted) {
      demonstratedNodes.push({ name: cap.name, key, cap });
    } else if (isSuperseded) {
      exploredNodes.push({ name: cap.name, key, cap });
    } else {
      emergingNodes.push({ name: cap.name, key, cap });
    }
  }

  // 4. Lay out Developing Nodes in Inner Orbit (r: 160px - 190px)
  const innerR = 175;
  developingNodes.forEach((item, idx) => {
    const total = developingNodes.length || 1;
    const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
    const x = Math.round(Math.cos(angle) * innerR);
    const y = Math.round(Math.sin(angle) * innerR);
    const nodeId = `node_${item.key}`;
    const ev = findEvidenceForCapability(item.name, item.key);

    nodesMap.set(nodeId, {
      id: nodeId,
      label: item.name,
      kind: "capability",
      status: "developing",
      x,
      y,
      radius: 24,
      level: item.cap.level,
      description: `Actively developing capability targeted by Phase ${activePhase?.phaseNumber || 1}.`,
      evidenceCount: ev.length,
      evidence: ev,
      connectedNodeIds: currentPositionNodeId ? [currentPositionNodeId] : [],
    });

    if (currentPositionNodeId) {
      edges.push({
        id: `edge_${currentPositionNodeId}_${nodeId}`,
        source: currentPositionNodeId,
        target: nodeId,
        relationship: "developing",
        label: "active focus",
      });
      nodesMap.get(currentPositionNodeId)?.connectedNodeIds.push(nodeId);
    }
  });

  // 5. Lay out Demonstrated Nodes in Middle Orbit (r: 290px - 340px)
  const midR = 310;
  demonstratedNodes.forEach((item, idx) => {
    const total = demonstratedNodes.length || 1;
    const offset = deterministicHash(item.key) * 0.4 - 0.2;
    const angle = (idx / total) * 2 * Math.PI + Math.PI / 4 + offset;
    const x = Math.round(Math.cos(angle) * midR);
    const y = Math.round(Math.sin(angle) * midR);
    const nodeId = `node_${item.key}`;
    const ev = findEvidenceForCapability(item.name, item.key);

    nodesMap.set(nodeId, {
      id: nodeId,
      label: item.name,
      kind: "capability",
      status: "demonstrated",
      x,
      y,
      radius: 22,
      level: item.cap.level,
      description: "Demonstrated capability supported by verified project deliverables and practical evidence.",
      evidenceCount: Math.max(1, ev.length),
      evidence: ev,
      connectedNodeIds: [],
    });
  });

  // 6. Lay out Emerging Nodes (r: 420px - 470px)
  const outerR = 430;
  emergingNodes.forEach((item, idx) => {
    const total = emergingNodes.length || 1;
    const offset = deterministicHash(item.key) * 0.5 - 0.25;
    const angle = (idx / total) * 2 * Math.PI - Math.PI / 3 + offset;
    const x = Math.round(Math.cos(angle) * outerR);
    const y = Math.round(Math.sin(angle) * outerR);
    const nodeId = `node_${item.key}`;
    const ev = findEvidenceForCapability(item.name, item.key);

    nodesMap.set(nodeId, {
      id: nodeId,
      label: item.name,
      kind: "capability",
      status: "emerging",
      x,
      y,
      radius: 18,
      level: item.cap.level,
      description: "Emerging capability signal inferred from self-report, interests, or initial technical responses.",
      evidenceCount: ev.length,
      evidence: ev,
      connectedNodeIds: [],
    });
  });

  // 7. Lay out Explored / Superseded Nodes (left-lateral cluster)
  const exploredX = -460;
  exploredNodes.forEach((item, idx) => {
    const y = -120 + idx * 80;
    const nodeId = `node_${item.key}`;
    const ev = findEvidenceForCapability(item.name, item.key);

    nodesMap.set(nodeId, {
      id: nodeId,
      label: item.name,
      kind: "capability",
      status: "explored",
      x: exploredX,
      y,
      radius: 19,
      description: "Explored capability from a superseded or redirected learning phase preserved in history.",
      evidenceCount: ev.length,
      evidence: ev,
      connectedNodeIds: [],
    });
  });

  // 8. Add Semantic and Prerequisite Edges from SEEDED_EDGES
  // We only connect nodes that ACTUALLY exist in our map
  const activeNodeKeys = new Map<string, string>();
  for (const [nodeId, node] of nodesMap.entries()) {
    activeNodeKeys.set(normalizeKey(node.label), nodeId);
  }

  for (const edge of SEEDED_EDGES) {
    const fromKey = normalizeKey(edge.fromSkillId);
    const toKey = normalizeKey(edge.toSkillId);

    const sourceNodeId = activeNodeKeys.get(fromKey);
    const targetNodeId = activeNodeKeys.get(toKey);

    if (sourceNodeId && targetNodeId && sourceNodeId !== targetNodeId) {
      const edgeId = `edge_prereq_${sourceNodeId}_${targetNodeId}`;
      if (!edges.some((e) => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: sourceNodeId,
          target: targetNodeId,
          relationship: "prerequisite",
          label: edge.type,
        });

        nodesMap.get(sourceNodeId)?.connectedNodeIds.push(targetNodeId);
        nodesMap.get(targetNodeId)?.connectedNodeIds.push(sourceNodeId);
      }
    }
  }

  // Also connect demonstrated nodes to related developing nodes if not connected
  if (developingNodes.length > 0 && demonstratedNodes.length > 0) {
    demonstratedNodes.slice(0, 3).forEach((dem) => {
      const demId = `node_${dem.key}`;
      const dev = developingNodes[0];
      const devId = `node_${dev.key}`;
      const edgeId = `edge_rel_${demId}_${devId}`;
      if (!edges.some((e) => e.source === demId && e.target === devId)) {
        edges.push({
          id: edgeId,
          source: demId,
          target: devId,
          relationship: "related",
          label: "foundation for",
        });
        nodesMap.get(demId)?.connectedNodeIds.push(devId);
        nodesMap.get(devId)?.connectedNodeIds.push(demId);
      }
    });
  }

  // 9. Calculate graph bounding box
  const allNodes = Array.from(nodesMap.values());
  let minX = -450;
  let maxX = 450;
  let minY = -350;
  let maxY = 350;

  for (const n of allNodes) {
    if (n.x - 60 < minX) minX = n.x - 60;
    if (n.x + 60 > maxX) maxX = n.x + 60;
    if (n.y - 60 < minY) minY = n.y - 60;
    if (n.y + 60 > maxY) maxY = n.y + 60;
  }

  return {
    nodes: allNodes,
    edges,
    currentPositionNodeId,
    discoveryMode,
    bounds: { minX, maxX, minY, maxY },
  };
}
