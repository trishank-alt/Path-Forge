import {
  IntentExtractionPort,
  QuestionProposalPort,
  RoadmapExplanationPort,
  CapabilityAssessmentPort,
  CurriculumDiscoveryPort,
  IntakeContext,
  QuestionContext,
  ExplanationContext,
} from "./ports";
import {
  IntentExtractionResult,
  IntentExtractionResultSchema,
  QuestionProposalResult,
  QuestionProposalResultSchema,
  RoadmapExplanationResult,
  RoadmapExplanationResultSchema,
  CurriculumDiscoveryContext,
  CurriculumProposal,
  CapabilityAssessmentResult,
  ProfileFact,
  ALLOWED_QUESTION_DIMENSIONS,
} from "../contracts";
import { DeterministicLlmAdapter } from "./deterministic-adapter";

export class OpenAiLlmAdapter
  implements
    IntentExtractionPort,
    QuestionProposalPort,
    RoadmapExplanationPort,
    CapabilityAssessmentPort,
    CurriculumDiscoveryPort
{
  private apiKey: string;
  private modelName: string;
  private fallback: DeterministicLlmAdapter;
  private lastExecutionMetadata: any = null;

  constructor(
    apiKey: string,
    modelName: string = "gpt-4o-mini",
    fallback: DeterministicLlmAdapter = new DeterministicLlmAdapter()
  ) {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.fallback = fallback;
  }

  public getLastExecutionMetadata() {
    return this.lastExecutionMetadata;
  }

  private async callOpenAi(systemPrompt: string, userPrompt: string): Promise<any> {
    const start = Date.now();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const latencyMs = Date.now() - start;
    if (!res.ok) {
      this.lastExecutionMetadata = {
        provider: "openai",
        modelName: this.modelName,
        fallbackUsed: true,
        failureCategory: res.status === 401 ? "auth_failure" : "provider_error",
        latencyMs,
        requestId: `openai_err_${Date.now()}`,
      };
      throw new Error(`OpenAI API failed: ${res.statusText}`);
    }

    const data = await res.json();
    this.lastExecutionMetadata = {
      provider: "openai",
      modelName: this.modelName,
      fallbackUsed: false,
      latencyMs,
      requestId: data.id || `openai_${Date.now()}`,
    };

    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }

  public async extract(context: IntakeContext): Promise<IntentExtractionResult> {
    try {
      const systemPrompt = `You are an expert technical career coach extracting structured facts from learner messages.
Extract declared goals, primary languages, target domains, and preferences.
Return JSON strictly conforming to IntentExtractionResult.`;
      const raw = await this.callOpenAi(systemPrompt, `User message: "${context.message}"`);
      const parsed = IntentExtractionResultSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      return this.fallback.extract(context);
    } catch (err) {
      return this.fallback.extract(context);
    }
  }

  public async proposeQuestions(context: QuestionContext): Promise<QuestionProposalResult> {
    try {
      if (!context.unknownDimensions || context.unknownDimensions.length === 0) {
        return { candidates: [] };
      }

      const systemPrompt = `You are an expert technical career coach. Propose high-value clarification questions.
Only ask for a dimension in Missing Dimensions. Never repeat an existing fact. Offer at most four candidates.
For a single-choice question, include useful choices and a “Not sure yet / Open to suggestions” choice.
Return JSON:
{
  "candidates": [
    {
      "dimension": "string",
      "question": "string",
      "answerType": "single_choice",
      "options": ["string"],
      "why": "string",
      "predictedAnswerBuckets": ["string"]
    }
  ]
}`;
      const raw = await this.callOpenAi(
        systemPrompt,
        `Goal: ${context.goalText.slice(0, 1000)}\nMissing Dimensions: ${JSON.stringify(context.unknownDimensions)}\nExisting Facts: ${JSON.stringify(
          context.existingFacts.filter((fact) => fact.status === "active").slice(-10).map((fact) => ({ dimension: fact.dimension, value: fact.normalizedValue }))
        )}\nCurrent Path Candidates: ${JSON.stringify(
          context.currentHypotheses.slice(0, 4).map((hypothesis) => ({ pathId: hypothesis.pathId, title: hypothesis.pathTitle }))
        )}`
      );
      const parsed = QuestionProposalResultSchema.safeParse(raw);
      if (parsed.success) {
        const allowedDimensions = new Set(context.unknownDimensions.map((dimension) => dimension.toLowerCase()));
        const canonicalAllowed = new Set(ALLOWED_QUESTION_DIMENSIONS as readonly string[]);
        const knownDimensions = new Set(
          context.existingFacts.filter((fact) => fact.status === "active").map((fact) => fact.dimension.toLowerCase())
        );
        const candidates = parsed.data.candidates
          .filter((candidate) => {
            const dimension = candidate.dimension.toLowerCase();
            return allowedDimensions.has(dimension) && canonicalAllowed.has(dimension) && !knownDimensions.has(dimension);
          })
          .slice(0, 4)
          .map((candidate) => ({
            ...candidate,
            dimension: candidate.dimension.toLowerCase(),
            options: candidate.answerType === "single_choice"
              ? [...new Set([...(candidate.options || []), "Not sure yet / Open to suggestions"])].slice(0, 6)
              : candidate.options,
          }));
        if (candidates.length > 0) return { candidates };
      }
      return this.fallback.proposeQuestions(context);
    } catch (err) {
      return this.fallback.proposeQuestions(context);
    }
  }

  public async explainRoadmap(context: ExplanationContext): Promise<RoadmapExplanationResult> {
    try {
      const systemPrompt = `Explain learning roadmap concisely.
Return JSON:
{
  "selectedPathId": "string",
  "assumptions": ["string"],
  "milestoneExplanations": [{"skillId": "string", "why": "string"}],
  "warnings": []
}`;
      const raw = await this.callOpenAi(systemPrompt, `Roadmap: ${JSON.stringify(context.roadmap)}`);
      const parsed = RoadmapExplanationResultSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      return this.fallback.explainRoadmap(context);
    } catch (err) {
      return this.fallback.explainRoadmap(context);
    }
  }

  /**
   * Assesses whether an uncatalogued career direction is constructible into a technical curriculum.
   */
  public async assessCurriculumCapability(
    goal: string,
    context?: { existingFacts?: ProfileFact[]; learnerBackground?: string }
  ): Promise<CapabilityAssessmentResult> {
    try {
      if (!this.apiKey || this.apiKey.trim() === "") {
        return this.fallback.assessCurriculumCapability(goal, context);
      }

      const systemPrompt = `You are a Technical Capability Assessor for PathFinder AI.
Evaluate whether the learner's declared career goal can reasonably be structured into a rigorous software or technical engineering curriculum.
Return strictly valid JSON with keys:
- "supported": boolean (true if technical, software, engineering, hardware, data, or computing track; false if impossible/nonsensical/non-technical)
- "confidence": number (0.0 to 1.0)
- "rationale": string (brief explanation of constructibility or reason for non-support)
- "recommendedTrack": string (optional normalized title)
- "requiredDimensions": array of strings (material decision dimensions needed to specialize, e.g. ["primary_language", "target_domain", "hours_per_week"])`;

      const res = (await this.callOpenAi(systemPrompt, JSON.stringify({ goal, ...context }))) as any;
      if (res && typeof res === "object" && typeof res.supported === "boolean") {
        return {
          supported: res.supported,
          confidence: typeof res.confidence === "number" ? res.confidence : res.supported ? 0.9 : 0.1,
          rationale: res.rationale || (res.supported ? "Constructible engineering track." : "Non-constructible intent."),
          recommendedTrack: res.recommendedTrack,
          requiredDimensions: Array.isArray(res.requiredDimensions)
            ? res.requiredDimensions
            : ["primary_language", "target_domain", "hours_per_week"],
        };
      }

      return this.fallback.assessCurriculumCapability(goal, context);
    } catch (err) {
      return this.fallback.assessCurriculumCapability(goal, context);
    }
  }

  /**
   * Generates a structured curriculum proposal via OpenAI for uncatalogued career tracks.
   * Untrusted LLM output is strictly verified downstream by deterministic CurriculumVerifier.
   */
  public async proposeCurriculum(
    context: CurriculumDiscoveryContext
  ): Promise<CurriculumProposal | null> {
    try {
      if (!this.apiKey || this.apiKey.trim() === "") {
        return this.fallback.proposeCurriculum(context);
      }

      const systemInstruction = `You are a Technical Curriculum Architecture Agent for PathFinder AI.
Your task is to synthesize a structured curriculum proposal for a learner target career role that is not currently pre-built in the catalog.

CRITICAL INSTRUCTIONS:
1. Target Role & Domain: Provide accurate, professional targetRole and domain titles.
2. Skill Volume & Hierarchy:
   - Provide between 4 and 8 distinct, rigorous technical skills.
   - Skill levels MUST range from foundational (level 1 or 2) to advanced/specialized (level 3 or 4).
   - Each skill MUST have: id (unique lowercase string, e.g. "skill_mech_cad"), title, domain, level (1-4), category, description, evidenceCriteria (at least 2 concrete checklist items), tags.
3. Prerequisite Graph (DAG):
   - Provide proposedEdges connecting skills with "required" dependencies.
   - Edges MUST form a valid Directed Acyclic Graph (DAG) with NO cycles.
   - A prerequisite skill's level MUST be less than or equal to the dependent skill's level (no level inversions).
4. Curated Learning Resources:
   - Provide at least 1 verified/credible learning resource per proposed skill.
   - Resource MUST have: id, skillId (matching a proposed skill id), title, provider, url (valid http/https link to authoritative documentation, course, or book), format ("documentation" | "video_course" | "interactive_course" | "book"), costType ("free" | "paid"), durationHours (5-60), qualityScore (0.8 - 0.98), description.
5. Practical Capstone Projects:
   - Provide 1 to 2 realistic practical projects.
   - Each project MUST target at least 2 proposed skills (targetSkillIds).
   - Each project MUST have: id, title, description, deliverables (at least 2 concrete deliverables), verificationChecklist (at least 2 concrete verification items), estimatedHours (20-100), domainContext.
6. Workload Sizing: Total estimatedLearningHours should be realistic for the career (between 60 and 350 hours).
7. Return strictly valid JSON with keys: targetRole, domain, description, specialization, proposedSkills, proposedEdges, proposedResources, proposedProjects, estimatedLearningHours, assumptions.`;

      const untrustedData = JSON.stringify({
        targetRole: context.targetRole,
        targetDomain: context.targetDomain,
        specialization: context.specialization,
        technicalConstraints: context.technicalConstraints,
        learnerBackground: context.learnerBackground,
      });

      const raw = (await this.callOpenAi(systemInstruction, untrustedData)) as any;

      if (!raw || typeof raw !== "object" || !Array.isArray(raw.proposedSkills) || raw.proposedSkills.length === 0) {
        return this.fallback.proposeCurriculum(context);
      }

      const normalizeSkillId = (rawId: string): string => {
        if (!rawId) return "skill_unknown";
        return rawId
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "");
      };

      // Sanitize & build valid proposal
      const sanitizedSkills = raw.proposedSkills.map((s: any, idx: number) => {
        const canonicalId = normalizeSkillId(s.id || `skill_${idx + 1}`);
        return {
          id: canonicalId,
          title: s.title || `Skill ${idx + 1}`,
          domain: s.domain || raw.domain || context.targetDomain || "Engineering",
          level: Math.max(1, Math.min(4, Math.round(Number(s.level) || 2))),
          category: s.category || "Technical Core",
          description: s.description || s.title || "Core competency",
          evidenceCriteria: Array.isArray(s.evidenceCriteria) && s.evidenceCriteria.length >= 2
            ? s.evidenceCriteria.map(String)
            : ["Demonstrate fundamental understanding and practical execution", "Build and verify end-to-end deliverables"],
          tags: Array.isArray(s.tags) ? s.tags.map(String) : ["core"],
        };
      });

      const skillLookup = new Map<string, string>();
      sanitizedSkills.forEach((s: any, idx: number) => {
        skillLookup.set(s.id, s.id);
        skillLookup.set(s.title.toLowerCase().trim(), s.id);
        skillLookup.set(normalizeSkillId(s.title), s.id);
        skillLookup.set(`skill_${idx + 1}`, s.id);
        skillLookup.set(`skill${idx + 1}`, s.id);
        skillLookup.set(String(idx + 1), s.id);
        if (raw.proposedSkills[idx]?.id) {
          skillLookup.set(String(raw.proposedSkills[idx].id).toLowerCase().trim(), s.id);
          skillLookup.set(normalizeSkillId(raw.proposedSkills[idx].id), s.id);
        }
      });

      const resolveCanonicalSkillId = (rawRef: any): string | null => {
        if (!rawRef) return null;
        const str = String(rawRef).trim();
        const norm = normalizeSkillId(str);
        return skillLookup.get(norm) || skillLookup.get(str.toLowerCase()) || null;
      };

      const sanitizedEdges = (Array.isArray(raw.proposedEdges) ? raw.proposedEdges : [])
        .map((e: any, idx: number) => {
          const fromRaw = e.fromSkillId || e.from || e.source || e.sourceSkillId || e.prerequisiteId;
          const toRaw = e.toSkillId || e.to || e.target || e.targetSkillId || e.dependentId;
          const fromSkillId = resolveCanonicalSkillId(fromRaw);
          const toSkillId = resolveCanonicalSkillId(toRaw);
          if (!fromSkillId || !toSkillId || fromSkillId === toSkillId) return null;
          return {
            id: normalizeSkillId(e.id || `edge_${idx + 1}`),
            fromSkillId,
            toSkillId,
            type: (e.type === "optional" ? "optional" : "required") as "required" | "optional",
            minimumLevel: "working" as const,
            rationale: e.rationale || "Prerequisite dependency",
          };
        })
        .filter((e: any) => e !== null);

      const sanitizedResources = (Array.isArray(raw.proposedResources) ? raw.proposedResources : [])
        .map((r: any, idx: number) => {
          let canonicalSkillId = resolveCanonicalSkillId(r.skillId);
          if (!canonicalSkillId && idx < sanitizedSkills.length) {
            canonicalSkillId = sanitizedSkills[idx].id;
          }
          if (!canonicalSkillId) return null;

          const rawUrl = String(r.url || "");
          const validUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
            ? rawUrl
            : "https://docs.engineering-standards.org";
          const rawFormat = String(r.format || "").toLowerCase();
          const format =
            rawFormat.includes("video")
              ? "video_series"
              : rawFormat.includes("book")
              ? "book"
              : rawFormat.includes("interactive")
              ? "interactive_course"
              : rawFormat.includes("lab")
              ? "lab_environment"
              : rawFormat.includes("repo") || rawFormat.includes("code")
              ? "code_repository"
              : "documentation";

          return {
            id: normalizeSkillId(r.id || `res_${idx + 1}`),
            skillId: canonicalSkillId,
            title: r.title && String(r.title).trim() ? String(r.title).trim() : `Comprehensive Guide to ${sanitizedSkills.find((s: any) => s.id === canonicalSkillId)?.title || "Engineering"}`,
            provider: r.provider && String(r.provider).trim() ? String(r.provider).trim() : "Authoritative Technical Standards",
            url: validUrl,
            format,
            costType: (r.costType === "paid" ? "paid" : "free") as "free" | "paid",
            durationHours: Math.max(5, Math.min(80, Number(r.durationHours) || 20)),
            qualityScore: Math.max(0.7, Math.min(0.99, Number(r.qualityScore) || 0.88)),
            description: r.description && String(r.description).trim() ? String(r.description).trim() : "In-depth learning resource.",
            provenance: "synthetic_unverified_external" as const,
          };
        })
        .filter((r: any) => r !== null);

      const sanitizedProjects = (Array.isArray(raw.proposedProjects) ? raw.proposedProjects : [])
        .map((p: any, idx: number) => {
          const rawIds = Array.isArray(p.targetSkillIds) ? p.targetSkillIds : [];
          const resolvedIds = Array.from(
            new Set(
              rawIds
                .map((id: any) => resolveCanonicalSkillId(id))
                .filter((id: any): id is string => Boolean(id))
            )
          );
          const validTargetSkillIds = resolvedIds.length >= 2
            ? resolvedIds
            : sanitizedSkills.slice(0, Math.min(sanitizedSkills.length, 3)).map((s: any) => s.id);

          const deliverables = Array.isArray(p.deliverables) && p.deliverables.filter((d: any) => String(d).trim().length > 0).length >= 2
            ? p.deliverables.map(String)
            : [
                "Complete implementation codebase with automated tests",
                "System architectural design and verification documentation",
              ];

          const verificationChecklist = Array.isArray(p.verificationChecklist) && p.verificationChecklist.filter((c: any) => String(c).trim().length > 0).length >= 2
            ? p.verificationChecklist.map(String)
            : [
                "All unit and integration tests pass successfully",
                "End-to-end functionality verified in staging environment",
              ];

          return {
            id: normalizeSkillId(p.id || `proj_${idx + 1}`),
            title: p.title && String(p.title).trim() ? String(p.title).trim() : "Capstone Practical Project",
            description: p.description && String(p.description).trim() ? String(p.description).trim() : "Practical hands-on implementation project.",
            targetSkillIds: validTargetSkillIds,
            estimatedHours: Math.max(15, Math.min(120, Number(p.estimatedHours) || 40)),
            deliverables,
            verificationChecklist,
            domainContext: p.domainContext || raw.domain || context.targetDomain || "Engineering",
          };
        });

      // Target skill weights normalized
      const targetSkillWeights: Record<string, number> = {};
      const totalWeight = sanitizedSkills.reduce((acc: number, s: any) => acc + (s.level || 1), 0);
      for (const s of sanitizedSkills) {
        targetSkillWeights[s.id] = Number(((s.level || 1) / totalWeight).toFixed(3));
      }

      const totalHours = Math.max(
        40,
        Math.min(
          400,
          Number(raw.estimatedLearningHours) ||
            sanitizedResources.reduce((acc: number, r: any) => acc + r.durationHours, 0) +
              sanitizedProjects.reduce((acc: number, p: any) => acc + p.estimatedHours, 0)
        )
      );

      const proposal: CurriculumProposal = {
        targetRole: raw.targetRole || context.targetRole,
        domain: raw.domain || context.targetDomain || "Engineering",
        description: raw.description || `Constructed curriculum for ${context.targetRole}`,
        specialization: raw.specialization || context.specialization,
        technologyEcosystem: "agnostic",
        proposedSkills: sanitizedSkills,
        proposedEdges: sanitizedEdges,
        targetSkillWeights,
        proposedResources: sanitizedResources,
        proposedProjects: sanitizedProjects,
        estimatedLearningHours: totalHours,
        assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : ["Synthesized via OpenAI Curriculum Discovery Port"],
      };

      return proposal;
    } catch (err) {
      return this.fallback.proposeCurriculum(context);
    }
  }
}
