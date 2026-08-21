import { SkillEdge, SkillNode } from "../../contracts";
import { SEEDED_EDGES, SEEDED_SKILLS } from "../../persistence/seed-data";

export class SkillGraph {
  private nodes: Map<string, SkillNode> = new Map();
  private edges: SkillEdge[] = [];
  private outgoingEdges: Map<string, SkillEdge[]> = new Map(); // fromSkillId -> edges
  private incomingEdges: Map<string, SkillEdge[]> = new Map(); // toSkillId -> edges

  constructor(nodes: SkillNode[] = SEEDED_SKILLS, edges: SkillEdge[] = SEEDED_EDGES) {
    this.edges = edges;
    for (const node of nodes) {
      this.nodes.set(node.id, node);
      this.outgoingEdges.set(node.id, []);
      this.incomingEdges.set(node.id, []);
    }

    for (const edge of edges) {
      this.outgoingEdges.get(edge.fromSkillId)?.push(edge);
      this.incomingEdges.get(edge.toSkillId)?.push(edge);
    }

    this.detectCycles();
  }

  public getSkill(id: string): SkillNode | undefined {
    return this.nodes.get(id);
  }

  public getAllSkills(): SkillNode[] {
    return Array.from(this.nodes.values());
  }

  public getPrerequisites(skillId: string): SkillEdge[] {
    return this.incomingEdges.get(skillId) || [];
  }

  public getDependents(skillId: string): SkillEdge[] {
    return this.outgoingEdges.get(skillId) || [];
  }

  /**
   * Resolves the full transitive closure of all prerequisites for a set of target skills in topological order.
   */
  public resolvePrerequisitesTopological(targetSkillIds: string[]): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string, path: Set<string>) => {
      if (visited.has(id)) return;
      if (path.has(id)) {
        throw new Error(`Cycle detected involving skill: ${id}`);
      }

      path.add(id);
      const prereqs = this.getPrerequisites(id);
      for (const p of prereqs) {
        if (p.type === "required" || p.type === "recommended") {
          visit(p.fromSkillId, new Set(path));
        }
      }
      path.delete(id);

      visited.add(id);
      order.push(id);
    };

    for (const targetId of targetSkillIds) {
      visit(targetId, new Set());
    }

    return order;
  }

  /**
   * Detects cycles in the graph during initialization to guarantee a valid DAG.
   */
  public detectCycles(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const isCyclicUtil = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const dependents = this.getDependents(nodeId);
      for (const edge of dependents) {
        const neighbor = edge.toSkillId;
        if (!visited.has(neighbor)) {
          if (isCyclicUtil(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (isCyclicUtil(nodeId)) {
          throw new Error(`Cycle detected in skill graph involving: ${nodeId}`);
        }
      }
    }

    return false;
  }
}
