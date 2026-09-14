import {
  IntentExtractionPort,
  QuestionProposalPort,
  RoadmapExplanationPort,
  AssessmentGenerationPort,
  CapabilityAssessmentPort,
  CurriculumDiscoveryPort,
  IntakeContext,
  QuestionContext,
  ExplanationContext,
  AssessmentContext,
} from "./ports";
import {
  IntentExtractionResult,
  QuestionProposalResult,
  RoadmapExplanationResult,
  AssessmentGenerationResult,
  CurriculumDiscoveryContext,
  CurriculumProposal,
  CapabilityAssessmentResult,
  ProfileFact,
} from "../contracts";
import { isNonCommittalAnswer } from "../domain/intent/path-compatibility-gate";

export class DeterministicLlmAdapter
  implements
    IntentExtractionPort,
    QuestionProposalPort,
    RoadmapExplanationPort,
    AssessmentGenerationPort,
    CapabilityAssessmentPort,
    CurriculumDiscoveryPort {
  /**
   * Deterministically extracts facts, unknown dimensions, and potential contradictions from natural language.
   */
  public async extract(context: IntakeContext): Promise<IntentExtractionResult> {
    const text = context.message.toLowerCase();
    const facts: IntentExtractionResult["facts"] = [];
    const unknownDimensions: string[] = [];
    let detectedGoal: string | undefined;
    let targetRoleHint: string | undefined;

    // 1. Goal Detection
    if (text.includes("vlsi") || text.includes("chip design") || text.includes("asic") || text.includes("fpga") || text.includes("mixed-signal") || text.includes("mixed signal")) {
      detectedGoal = "VLSI Design Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "VLSI Design Engineer",
        rawValue: "VLSI Design Engineer",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "VLSI Design",
        rawValue: "VLSI Design",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      if (text.includes("mixed-signal") || text.includes("mixed signal")) {
        facts.push({
          dimension: "specialization_focus",
          value: "Mixed-signal design",
          rawValue: "Mixed-signal design",
          evidence: context.message,
          reliability: 0.95,
          impact: "high",
        });
      } else if (text.includes("rtl design") || text.includes("rtl")) {
        facts.push({
          dimension: "specialization_focus",
          value: "RTL design",
          rawValue: "RTL design",
          evidence: context.message,
          reliability: 0.95,
          impact: "high",
        });
      } else if (text.includes("physical design") || text.includes("tapeout")) {
        facts.push({
          dimension: "specialization_focus",
          value: "ASIC Physical Design",
          rawValue: "ASIC Physical Design",
          evidence: context.message,
          reliability: 0.95,
          impact: "high",
        });
      } else if (text.includes("uvm") || text.includes("verification")) {
        facts.push({
          dimension: "specialization_focus",
          value: "UVM Functional Verification",
          rawValue: "UVM Functional Verification",
          evidence: context.message,
          reliability: 0.95,
          impact: "high",
        });
      }
    } else if (text.includes("bioinformatics") || text.includes("genomics")) {
      detectedGoal = "Bioinformatics Scientist";
      facts.push({
        dimension: "declared_goal",
        value: "Bioinformatics Scientist",
        rawValue: "Bioinformatics Scientist",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Bioinformatics",
        rawValue: "Bioinformatics",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("aerospace") || text.includes("avionics") || text.includes("flight control")) {
      detectedGoal = "Aerospace Avionics Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "Aerospace Avionics Engineer",
        rawValue: "Aerospace Avionics Engineer",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Aerospace Avionics",
        rawValue: "Aerospace Avionics",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("quantum")) {
      detectedGoal = "Quantum Hardware Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "Quantum Hardware Engineer",
        rawValue: "Quantum Hardware Engineer",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Quantum Computing",
        rawValue: "Quantum Computing",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
    } else if (
      text.includes("robotics") ||
      text.includes("ros 2") ||
      text.includes("ros2") ||
      (text.includes("mechanical") && text.includes("robot"))
    ) {
      detectedGoal = "Mechanical Engineer specializing in Robotics";
      facts.push({
        dimension: "declared_goal",
        value: "Mechanical Engineer specializing in Robotics",
        rawValue: "Mechanical Engineer specializing in Robotics",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Robotics & Autonomous Systems",
        rawValue: "Robotics & Autonomous Systems",
        evidence: context.message,
        reliability: 0.98,
        impact: "high",
      });
      facts.push({
        dimension: "specialization_focus",
        value: "Robotics Control & Autonomous Navigation",
        rawValue: "Robotics Control & Autonomous Navigation",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("devops") || text.includes("cloud platform") || text.includes("infrastructure engineer") || text.includes("sre") || text.includes("kubernetes")) {
      detectedGoal = "DevOps & Cloud Platform Infrastructure Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "devops_cloud_engineer",
        rawValue: "DevOps & Cloud Platform Infrastructure Engineer",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Cloud Infrastructure & DevOps CI/CD",
        rawValue: "Cloud Infrastructure",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
      facts.push({
        dimension: "architecture_preference",
        value: "Container Orchestration & Cloud Infrastructure as Code",
        rawValue: "Cloud Infrastructure as Code",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (
      (text.includes("backend") || text.includes("back-end") || text.includes("api developer") || text.includes("architect")) &&
      !text.includes("fullstack") &&
      !text.includes("full stack") &&
      !text.includes("frontend")
    ) {
      detectedGoal = "Backend Software Engineering";
      facts.push({
        dimension: "declared_goal",
        value: "backend_engineering",
        rawValue: context.message,
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (
      text.includes("frontend") ||
      text.includes("front-end") ||
      text.includes("fullstack") ||
      text.includes("full stack") ||
      text.includes("react") ||
      /\bui\b/.test(text) ||
      text.includes("user interface") ||
      text.includes("web app") ||
      text.includes("web development") ||
      text.includes("html") ||
      text.includes("css")
    ) {
      detectedGoal = "Full-Stack Web & Applications Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "fullstack_software_engineer",
        rawValue: "Full-Stack Web & Applications Engineer",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Full-Stack Web & Product Applications",
        rawValue: "Web Applications & UI",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (
      text.includes("c++") ||
      text.includes("systems programming") ||
      text.includes("systems engineer") ||
      text.includes("systems developer") ||
      text.includes("systems software") ||
      text.includes("low-level") ||
      text.includes("embedded") ||
      text.includes("game engine")
    ) {
      detectedGoal = "Systems & High-Performance C++ Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "systems_cpp_engineer",
        rawValue: "Systems & High-Performance C++ Engineer",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("red team") || text.includes("cybersecurity") || text.includes("security")) {
      detectedGoal = "Ethical Cybersecurity & Defensive Red-Teaming";
      facts.push({
        dimension: "declared_goal",
        value: "cybersecurity_defensive",
        rawValue: context.message,
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else {
      const match = context.message.match(/I want to (?:be|become|specialize in|learn|study|pursue|work as an?|work in)\s+(?:an?\s+)?([^.,;]+)/i);
      if (match && match[1]) {
        detectedGoal = match[1].trim();
        facts.push({
          dimension: "declared_goal",
          value: detectedGoal,
          rawValue: detectedGoal,
          evidence: context.message,
          reliability: 0.95,
          impact: "high",
        });
      }
    }

    // 2. Skill & Knowledge Extraction
    if (text.includes("http") || text.includes("rest")) {
      facts.push({
        dimension: "known_skills",
        value: { skill: "http_rest_protocols", level: "working" },
        rawValue: "HTTP & REST APIs",
        evidence: "Mentioned knowledge of HTTP/REST",
        reliability: 0.9,
        impact: "medium",
      });
    }

    // 3. Language Extraction
    if (text.includes("java") && !text.includes("javascript")) {
      facts.push({
        dimension: "primary_language",
        value: "Java",
        rawValue: "Java (Proficient / Stated)",
        evidence: "Explicitly specified Java as language",
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("typescript") || text.includes("javascript") || text.includes("node")) {
      facts.push({
        dimension: "primary_language",
        value: "TypeScript / Node.js",
        rawValue: "TypeScript / Node.js",
        evidence: "Specified TypeScript/Node.js",
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("python") || text.includes("fastapi")) {
      facts.push({
        dimension: "primary_language",
        value: "Python",
        rawValue: "Python",
        evidence: "Specified Python",
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("c++") || text.includes("cpp")) {
      facts.push({
        dimension: "primary_language",
        value: "C++",
        rawValue: "Modern C++ (C++17/20)",
        evidence: "Specified C++ language",
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("systemverilog") || text.includes("verilog") || text.includes("vhdl")) {
      const langName = text.includes("systemverilog") ? "SystemVerilog" : text.includes("vhdl") ? "VHDL" : "Verilog";
      facts.push({
        dimension: "primary_language",
        value: langName,
        rawValue: langName,
        evidence: `Specified ${langName} as HDL language`,
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("ros 2") || text.includes("ros2") || text.includes("robotics") || text.includes("kinematics")) {
      facts.push({
        dimension: "primary_language",
        value: "C++",
        rawValue: "Modern C++ (ROS 2 & Kinematics)",
        evidence: "Specified ROS 2 robotics toolchain",
        reliability: 0.95,
        impact: "high",
      });
    }

    // 4. Domain & Specialization Extraction
    if (text.includes("erp") || text.includes("enterprise") || text.includes("banking") || text.includes("fintech")) {
      facts.push({
        dimension: "target_domain",
        value: "Enterprise Systems & Software",
        rawValue: "Enterprise / ERP",
        evidence: "Specified Enterprise/ERP domain",
        reliability: 0.95,
        impact: "high",
      });
      if (text.includes("java")) {
        targetRoleHint = "Enterprise Java Backend Engineer";
      } else if (text.includes("typescript") || text.includes("node")) {
        targetRoleHint = "Enterprise Node/TypeScript Backend Engineer";
      } else if (text.includes("python")) {
        targetRoleHint = "Enterprise Python Backend Engineer";
      } else {
        targetRoleHint = "Enterprise Backend Engineer";
      }
    } else if (text.includes("systems") || text.includes("low-level") || text.includes("high-performance") || text.includes("embedded")) {
      facts.push({
        dimension: "target_domain",
        value: "Systems & High-Performance Engineering",
        rawValue: "Systems Engineering",
        evidence: "Specified Systems/Performance domain",
        reliability: 0.95,
        impact: "high",
      });
      targetRoleHint = "Systems & High-Performance C++ Engineer";
    } else if (text.includes("saas") || text.includes("web product") || text.includes("startup")) {
      facts.push({
        dimension: "target_domain",
        value: "SaaS Web Products",
        rawValue: "SaaS Web Products",
        evidence: "Specified SaaS/Web Product domain",
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("cloud") || text.includes("async") || text.includes("api")) {
      facts.push({
        dimension: "target_domain",
        value: "Cloud Backend Services",
        rawValue: "Cloud Services & APIs",
        evidence: "Specified Cloud/API backend domain",
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("robotics") || text.includes("ros 2") || text.includes("ros2") || text.includes("kinematics")) {
      facts.push({
        dimension: "target_domain",
        value: "Robotics & Autonomous Systems",
        rawValue: "Autonomous Robotics & Control",
        evidence: "Specified robotics domain",
        reliability: 0.95,
        impact: "high",
      });
    }

    // 5. Architecture Preference
    if (text.includes("microservice") || text.includes("distributed")) {
      facts.push({
        dimension: "architecture_preference",
        value: "Microservices & Distributed Systems",
        rawValue: "Microservices",
        evidence: "Preference for distributed microservices",
        reliability: 0.9,
        impact: "medium",
      });
    } else if (text.includes("monolith") || text.includes("transactional")) {
      facts.push({
        dimension: "architecture_preference",
        value: "Transactional Enterprise Architecture",
        rawValue: "Enterprise Architecture",
        evidence: "Preference for transactional architectures",
        reliability: 0.9,
        impact: "medium",
      });
    }

    // 6. Time constraints
    const hoursMatch = text.match(/(\d+)\s*(hours|hrs)/i);
    if (hoursMatch) {
      const hrs = parseInt(hoursMatch[1], 10);
      facts.push({
        dimension: "hours_per_week",
        value: hrs,
        rawValue: `${hrs} hours/week`,
        evidence: `Mentioned ${hrs} hours per week`,
        reliability: 1.0,
        impact: "high",
      });
    }

    // 7. Cybersecurity Ethical Confirmation
    if (text.includes("authorized") || text.includes("ethical") || text.includes("lab only") || text.includes("defensive")) {
      facts.push({
        dimension: "ethical_scope_confirmed",
        value: "confirmed",
        rawValue: "Authorized Lab Scope Confirmed",
        evidence: "Learner explicitly confirmed authorized/defensive scope",
        reliability: 1.0,
        impact: "high",
      });
    }

    // Check what is still unknown
    const activeDims = new Set([
      ...context.existingFacts.map((f) => f.dimension.toLowerCase()),
      ...facts.map((f) => f.dimension.toLowerCase()),
    ]);

    if (!activeDims.has("primary_language")) unknownDimensions.push("primary_language");
    if (!activeDims.has("target_domain")) unknownDimensions.push("target_domain");
    if (!activeDims.has("architecture_preference")) unknownDimensions.push("architecture_preference");
    if (!activeDims.has("hours_per_week")) unknownDimensions.push("hours_per_week");

    return {
      facts,
      detectedGoal,
      targetRoleHint,
      unknownDimensions,
      contradictions: [],
      clarificationNeeded: unknownDimensions.length > 0,
    };
  }

  /**
   * Deterministically proposes candidate clarification questions based on missing dimensions.
   */
  public async proposeQuestions(context: QuestionContext): Promise<QuestionProposalResult> {
    const candidates: QuestionProposalResult["candidates"] = [];
    const knownDimensions = new Set(
      context.existingFacts
        .filter((f) => f.status === "active" && !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || "")))
        .map((f) => f.dimension.toLowerCase())
    );
    const unknown = context.unknownDimensions
      .map((d) => d.toLowerCase())
      .filter((d) => !knownDimensions.has(d));

    if (unknown.length === 0) {
      return { candidates: [] };
    }

    const isSecurityTrack = context.currentHypotheses.some(
      (h) => h.pathId === "cybersecurity_defensive_redteam" && h.posteriorProbability > 0.4
    );

    if (isSecurityTrack) {
      if (unknown.includes("ethical_scope_confirmed") || !knownDimensions.has("ethical_scope_confirmed")) {
        candidates.push({
          dimension: "ethical_scope_confirmed",
          question:
            "Do you confirm that all hands-on exercises and vulnerability assessments will strictly take place within authorized, isolated sandbox labs?",
          answerType: "single_choice",
          options: [
            "Yes, I confirm all practice will be in authorized defensive labs",
            "I need more information about lab requirements",
          ],
          why: "Safety and ethics compliance: We mandate isolated sandbox environments for all security training.",
          predictedAnswerBuckets: ["confirmed", "unconfirmed"],
        });
      }
      if (unknown.includes("prior_technical_experience")) {
        candidates.push({
          dimension: "prior_technical_experience",
          question: "What is your current background in Linux and computer networking?",
          answerType: "single_choice",
          options: [
            "Strong Linux and TCP/IP networking foundation",
            "Basic Linux command line, intermediate networking",
            "Beginner in both Linux and networking",
          ],
          why: "Determines whether foundational networking and packet inspection modules must precede threat modeling.",
          predictedAnswerBuckets: ["strong", "intermediate", "beginner"],
        });
      }
    }

    const goalLower = context.goalText.toLowerCase();

    const isMLTrack =
      goalLower.includes("ml") ||
      goalLower.includes("machine learning") ||
      goalLower.includes("ai") ||
      goalLower.includes("artificial intelligence") ||
      goalLower.includes("deep learning") ||
      goalLower.includes("computer vision") ||
      goalLower.includes("nlp") ||
      context.existingFacts.some((f) => f.dimension === "declared_goal" && String(f.rawValue).toLowerCase().includes("ml"));

    const isDataTrack =
      !isMLTrack &&
      (goalLower.includes("data scientist") ||
        goalLower.includes("data science") ||
        goalLower.includes("data engineer") ||
        context.existingFacts.some((f) => f.dimension === "declared_goal" && String(f.rawValue).toLowerCase().includes("data")));

    const isMobileTrack =
      goalLower.includes("mobile") ||
      goalLower.includes("ios") ||
      goalLower.includes("android") ||
      goalLower.includes("flutter") ||
      goalLower.includes("react native") ||
      context.existingFacts.some((f) => f.dimension === "declared_goal" && String(f.rawValue).toLowerCase().includes("mobile"));

    const isGamingTrack =
      goalLower.includes("game") ||
      goalLower.includes("gaming") ||
      goalLower.includes("unreal") ||
      goalLower.includes("unity") ||
      context.existingFacts.some((f) => f.dimension === "declared_goal" && String(f.rawValue).toLowerCase().includes("game"));

    const isHardwareTrack =
      !isMLTrack &&
      !isDataTrack &&
      (context.currentHypotheses.some(
        (h) => h.pathId === "vlsi_design_engineer" && h.posteriorProbability > 0.3
      ) ||
        goalLower.includes("vlsi") ||
        goalLower.includes("chip") ||
        goalLower.includes("asic") ||
        goalLower.includes("fpga") ||
        goalLower.includes("hardware") ||
        goalLower.includes("verilog") ||
        goalLower.includes("systemverilog") ||
        context.existingFacts.some(
          (f) =>
            f.dimension === "declared_goal" &&
            (String(f.rawValue).toLowerCase().includes("vlsi") ||
              String(f.rawValue).toLowerCase().includes("chip") ||
              String(f.rawValue).toLowerCase().includes("hardware"))
        ));

    const isWebTrack =
      !isHardwareTrack &&
      !isMLTrack &&
      !isDataTrack &&
      !isMobileTrack &&
      !isGamingTrack &&
      (context.currentHypotheses.some(
        (h) => h.pathId === "fullstack_software_engineer" && h.posteriorProbability > 0.3
      ) ||
        goalLower.includes("front") ||
        goalLower.includes("web") ||
        goalLower.includes("ui") ||
        goalLower.includes("react"));

    const isSystemsTrack =
      !isHardwareTrack &&
      !isWebTrack &&
      !isMLTrack &&
      !isDataTrack &&
      !isMobileTrack &&
      !isGamingTrack &&
      (context.currentHypotheses.some(
        (h) => h.pathId === "systems_cpp_engineer" && h.posteriorProbability > 0.3
      ) ||
        goalLower.includes("systems") ||
        goalLower.includes("low-level") ||
        goalLower.includes("c++"));

    if (unknown.includes("primary_language")) {
      if (isMLTrack || isDataTrack) {
        candidates.push({
          dimension: "primary_language",
          question: "Which programming language do you want to use for your Machine Learning / Data workflows?",
          answerType: "single_choice",
          options: [
            "Python (PyTorch, Hugging Face, Scikit-Learn)",
            "C++ (High-Performance Inference & TensorRT)",
            "SQL & Python Data Tooling",
            "Not sure yet / Open to suggestions",
          ],
          why: "Language choice defines your machine learning framework ecosystem and runtime execution environment.",
          predictedAnswerBuckets: ["python", "cpp", "sql", "unknown"],
        });
      } else if (isMobileTrack) {
        candidates.push({
          dimension: "primary_language",
          question: "Which programming language do you want to focus on for mobile development?",
          answerType: "single_choice",
          options: [
            "Kotlin (Modern Native Android)",
            "Swift (Modern Native iOS)",
            "TypeScript (React Native)",
            "Dart (Flutter)",
            "Not sure yet / Open to suggestions",
          ],
          why: "Language defines the primary mobile platform SDK and reactive framework.",
          predictedAnswerBuckets: ["kotlin", "swift", "typescript", "dart", "unknown"],
        });
      } else if (isGamingTrack) {
        candidates.push({
          dimension: "primary_language",
          question: "Which language do you want to use for game development?",
          answerType: "single_choice",
          options: [
            "Modern C++ (Unreal Engine & Custom Engine Architecture)",
            "C# (Unity Engine Development)",
            "Rust (Modern Systems & Bevy)",
            "Not sure yet / Open to suggestions",
          ],
          why: "Language selection dictates whether you target Unreal Engine (C++), Unity (C#), or custom engines.",
          predictedAnswerBuckets: ["cpp", "csharp", "rust", "unknown"],
        });
      } else if (isHardwareTrack) {
        candidates.push({
          dimension: "primary_language",
          question: "Which Hardware Description Language (HDL) or verification language do you want to build on?",
          answerType: "single_choice",
          options: [
            "SystemVerilog / Verilog (Industry Standard RTL)",
            "VHDL (FPGA & High-Reliability Systems)",
            "C / C++ (Hardware Interfacing & Embedded)",
            "Python (Cocotb & Verification Scripting)",
            "Not sure yet / Open to suggestions",
          ],
          why: "HDL choice defines your synthesis toolchain, simulation environment, and verification workflow.",
          predictedAnswerBuckets: ["systemverilog", "vhdl", "cpp", "python", "unknown"],
        });
      } else if (isWebTrack) {
        candidates.push({
          dimension: "primary_language",
          question: "Which programming languages or web technologies are you already comfortable with?",
          answerType: "single_choice",
          options: [
            "TypeScript / JavaScript (React, Next.js, Node.js)",
            "HTML5, Modern CSS & Responsive Layouts",
            "Python (Full-stack / web frameworks)",
            "Java (Spring Boot + Web UIs)",
            "Not sure yet / Open to suggestions",
          ],
          why: "Language proficiency is the primary branching factor for full-stack and web roadmaps.",
          predictedAnswerBuckets: ["typescript", "html_css", "python", "java", "unknown"],
        });
      } else if (isSystemsTrack) {
        candidates.push({
          dimension: "primary_language",
          question: "Which systems programming language do you want to focus on?",
          answerType: "single_choice",
          options: [
            "Modern C++ (C++17/C++20)",
            "C (Low-Level Systems & OS)",
            "Rust (Safe Concurrency & Systems)",
            "Not sure yet / Open to suggestions",
          ],
          why: "Language choice determines low-level memory model, concurrency primitives, and compilation toolchains.",
          predictedAnswerBuckets: ["cpp", "c", "rust", "unknown"],
        });
      } else {
        candidates.push({
          dimension: "primary_language",
          question: "Which programming languages are you already comfortable with?",
          answerType: "single_choice",
          options: [
            "Java (OOP, Streams, Collections)",
            "TypeScript / JavaScript (Node.js)",
            "Python (Modern async / type hints)",
            "C# / .NET",
            "Go (Golang)",
            "Not sure yet / Open to suggestions",
          ],
          why: "Language proficiency is the primary branching factor for engineering roadmaps.",
          predictedAnswerBuckets: ["java", "typescript", "python", "dotnet", "go", "unknown"],
        });
      }
    }

    if (unknown.includes("target_domain")) {
      if (isMLTrack) {
        candidates.push({
          dimension: "target_domain",
          question: "Which area of Machine Learning / AI do you want to specialize in?",
          answerType: "single_choice",
          options: [
            "NLP & Large Language Models (Fine-Tuning, LoRA & RAG)",
            "Computer Vision & Multimodal Deep Learning",
            "MLOps & Production Model Deployment",
            "Deep Learning Architectures & Neural Systems",
            "Not sure yet / Explore AI options",
          ],
          why: "ML specialization defines the model architectures, training toolchains, and dataset domains in your curriculum.",
          predictedAnswerBuckets: ["nlp", "vision", "mlops", "deep_learning", "unknown"],
        });
      } else if (isDataTrack) {
        candidates.push({
          dimension: "target_domain",
          question: "Which area of Data Science & Engineering interests you most?",
          answerType: "single_choice",
          options: [
            "Modern Data Stack & Analytics Engineering (PySpark, SQL)",
            "Predictive Modeling & Statistical Machine Learning",
            "Real-Time Stream Processing & Feature Pipelines",
            "Not sure yet / Explore data options",
          ],
          why: "Data specialization determines whether your curriculum focuses on statistical modeling or big-data engineering pipelines.",
          predictedAnswerBuckets: ["analytics", "modeling", "streaming", "unknown"],
        });
      } else if (isMobileTrack) {
        candidates.push({
          dimension: "target_domain",
          question: "Which mobile ecosystem or focus area do you want to pursue?",
          answerType: "single_choice",
          options: [
            "Native Android (Kotlin, Jetpack Compose, Coroutines)",
            "Native iOS (Swift, SwiftUI, Combine)",
            "Cross-Platform Apps (Flutter & React Native)",
            "Not sure yet / Explore mobile options",
          ],
          why: "Mobile platform determines whether you focus on Apple iOS, Google Android, or multi-platform architectures.",
          predictedAnswerBuckets: ["android", "ios", "cross_platform", "unknown"],
        });
      } else if (isGamingTrack) {
        candidates.push({
          dimension: "target_domain",
          question: "Which area of game development appeals to you most?",
          answerType: "single_choice",
          options: [
            "Unreal Engine & High-Performance 3D Systems",
            "Unity Multi-Platform Game Development",
            "Custom Engine Architecture & Real-Time Rendering",
            "Not sure yet / Explore gaming options",
          ],
          why: "Gaming focus dictates the game engine toolchains, rendering pipelines, and physics modules in your curriculum.",
          predictedAnswerBuckets: ["unreal", "unity", "engine_dev", "unknown"],
        });
      } else if (isHardwareTrack) {
        candidates.push({
          dimension: "target_domain",
          question: "Which semiconductor or hardware engineering domain interests you most?",
          answerType: "single_choice",
          options: [
            "RTL & Digital Microarchitecture (RISC-V / Processor Design)",
            "FPGA Emulation & Hardware Acceleration",
            "ASIC Physical Design & Tapeout Flow",
            "UVM Functional Verification & Coverage",
            "Not sure yet / Explore hardware options",
          ],
          why: "Hardware specialization dictates whether you focus on front-end RTL, back-end physical layout, or testbench verification.",
          predictedAnswerBuckets: ["rtl", "fpga", "asic", "uvm", "unknown"],
        });
      } else if (isWebTrack) {
        candidates.push({
          dimension: "target_domain",
          question: "Which area of modern web application development appeals to you most?",
          answerType: "single_choice",
          options: [
            "Modern SaaS Web Products & Consumer Platforms (Fast iteration)",
            "Full-Stack Web Applications with TypeScript & React",
            "Enterprise Systems & Scalable Transactional Backends",
            "Not sure yet / Explore web options",
          ],
          why: "Specialization determines whether your roadmap focuses on frontend component architecture, web apps, or backend APIs.",
          predictedAnswerBuckets: ["saas_web", "fullstack", "enterprise_erp", "unknown"],
        });
      } else {
        candidates.push({
          dimension: "target_domain",
          question: "Which industry or domain of software engineering appeals to you most?",
          answerType: "single_choice",
          options: [
            "Enterprise Systems, ERP & Financial Workflows (High reliability & consistency)",
            "Modern SaaS Web Products & Consumer Platforms (Fast iteration)",
            "Cloud Data Pipelines, AI Backends & Async Services",
            "Infrastructure & Developer Tooling",
            "Not sure yet / Explore options",
          ],
          why: "Specialization determines which technical modules and capstone projects compose your roadmap.",
          predictedAnswerBuckets: ["enterprise_erp", "saas_web", "cloud_data", "infra", "unknown"],
        });
      }
    }

    if (unknown.includes("architecture_preference")) {
      if (isHardwareTrack) {
        candidates.push({
          dimension: "architecture_preference",
          question: "What design methodology or architecture style do you prefer to target?",
          answerType: "single_choice",
          options: [
            "Pipelined Processor Microarchitecture (RISC-V RV32I)",
            "Bus-Interconnect SoC Architecture (AXI4-Lite & Peripherals)",
            "FPGA Hardware Accelerators & DSP Blocks",
            "Open-Source ASIC Flow (OpenROAD & SkyWater 130nm)",
            "Not sure yet / Open to suggestions",
          ],
          why: "Architecture style determines your capstone hardware project and timing closure targets.",
          predictedAnswerBuckets: ["riscv", "axi_soc", "fpga_accel", "openroad", "unknown"],
        });
      } else {
        candidates.push({
          dimension: "architecture_preference",
          question: "What style of system architecture would you like to master?",
          answerType: "single_choice",
          options: [
            "Modular Monoliths & Robust Transactional Domain Models",
            "Microservices, Event Streams & Asynchronous Queues",
            "Cloud-Native Serverless & Managed Infrastructure",
            "Not sure yet / Open to suggestions",
          ],
          why: "Architecture preference dictates database transaction isolation, messaging middleware, and deployment complexity.",
          predictedAnswerBuckets: ["monolith", "microservices", "serverless", "unknown"],
        });
      }
    }

    if (unknown.includes("hours_per_week")) {
      candidates.push({
        dimension: "hours_per_week",
        question: "How many hours per week can you consistently commit to learning?",
        answerType: "single_choice",
        options: [
          "4-6 hours/week (Paced learning)",
          "8-12 hours/week (Standard recommendation)",
          "15-20+ hours/week (Accelerated bootcamp pace)",
          "Not sure yet / Flexible schedule",
        ],
        why: "Calibrates realistic milestone timelines and weekly deliverable pacing.",
        predictedAnswerBuckets: ["4_6_hours", "8_12_hours", "15_20_hours", "unknown"],
      });
    }

    if (unknown.includes("prior_technical_experience") && !isSecurityTrack) {
      candidates.push({
        dimension: "prior_technical_experience",
        question: "What is your current technical background and experience level?",
        answerType: "single_choice",
        options: [
          "Computer Science degree or professional developer experience",
          "Self-taught with several completed projects and basic git/CLI",
          "Complete beginner to programming and backend systems",
          "Not sure yet / Mixed background",
        ],
        why: "Determines whether foundational CS, data structures, and terminal concepts must precede framework learning.",
        predictedAnswerBuckets: ["professional", "intermediate", "beginner", "unknown"],
      });
    }

    if (unknown.includes("learning_mode")) {
      candidates.push({
        dimension: "learning_mode",
        question: "What style of learning material do you prefer?",
        answerType: "single_choice",
        options: [
          "Hands-on guided projects & coding labs",
          "Official documentation & in-depth technical specifications",
          "Structured video courses & tutorials",
          "Not sure yet / Open to suggestions",
        ],
        why: "Selects the most effective learning resources and milestone formats for your study style.",
        predictedAnswerBuckets: ["hands_on_projects", "docs", "video_series", "unknown"],
      });
    }

    if (unknown.includes("resource_budget")) {
      candidates.push({
        dimension: "resource_budget",
        question: "What is your preference regarding paid vs free learning resources?",
        answerType: "single_choice",
        options: [
          "Free open-source and community resources only",
          "Moderate budget for high-quality verified courses/books",
          "Unconstrained (include paid labs, exams, or platforms)",
          "Not sure yet / Open to suggestions",
        ],
        why: "Filters curated milestone resource recommendations by cost tier.",
        predictedAnswerBuckets: ["free_only", "moderate", "unconstrained", "unknown"],
      });
    }

    if (unknown.includes("deadline_months")) {
      candidates.push({
        dimension: "deadline_months",
        question: "What is your target timeline to reach milestone readiness for this path?",
        answerType: "single_choice",
        options: [
          "3 months (Intensive pace)",
          "6 months (Standard pace)",
          "12 months (Comprehensive pace)",
          "Flexible / No strict deadline",
        ],
        why: "Calibrates milestone scoping, project complexity, and target completion schedule.",
        predictedAnswerBuckets: ["3_months", "6_months", "12_months", "flexible"],
      });
    }

    return { candidates };
  }

  /**
   * Generates a clear, explainable summary for the generated roadmap.
   */
  public async explainRoadmap(context: ExplanationContext): Promise<RoadmapExplanationResult> {
    const { roadmap } = context;
    return {
      selectedPathId: roadmap.targetPathId,
      assumptions: roadmap.assumptions,
      milestoneExplanations: roadmap.milestones.map((m) => ({
        skillId: m.skillIds[0] || "general",
        why: m.explanation,
      })),
      warnings: roadmap.warnings,
    };
  }

  /**
   * Deterministic fallback for competency assessment generation.
   * Generates structurally valid, skill-specific questions without requiring an LLM.
   * Question counts follow the readiness policy:
   *   basic       → 2 single_choice
   *   intermediate → 2 single_choice + 1 free_text
   *   advanced    → 1 single_choice + 2 free_text
   */
  public async generateAssessment(context: AssessmentContext): Promise<AssessmentGenerationResult> {
    const level = context.claimedLevel.toLowerCase();
    const skill = context.skillTitle;
    const skillId = context.skillId;
    const ts = Date.now();
    const questions: AssessmentGenerationResult["questions"] = [];

    if (level === "basic" || level === "novice" || level === "beginner" || level === "none") {
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_0`,
        question: `Which of the following best describes the primary purpose of ${skill}?`,
        questionType: "single_choice",
        options: [
          `${skill} provides a structured way to solve a specific class of technical problem`,
          `${skill} is primarily a project management framework`,
          `${skill} replaces all other tools in its category`,
          `Not sure yet`,
        ],
        targetSkillId: skillId,
        difficulty: "basic",
        rationale: `Tests foundational understanding of what ${skill} is and does.`,
      });
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_1`,
        question: `Which statement about ${skill} is most accurate for a beginner?`,
        questionType: "single_choice",
        options: [
          `${skill} is used for foundational tasks in its domain`,
          `${skill} is only relevant for very large enterprise systems`,
          `${skill} replaces the need to understand core language fundamentals`,
          `Not sure yet`,
        ],
        targetSkillId: skillId,
        difficulty: "basic",
        rationale: `Assesses basic familiarity with the scope and role of ${skill}.`,
      });
    } else if (level === "intermediate" || level === "working" || level === "proficient") {
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_0`,
        question: `In a realistic project context, when is ${skill} the most appropriate choice? Select the best scenario.`,
        questionType: "single_choice",
        options: [
          `When building systems that specifically benefit from what ${skill} provides`,
          `As a default for every new project regardless of requirements`,
          `Only for rapid prototyping — never for production use`,
          `Not sure yet`,
        ],
        targetSkillId: skillId,
        difficulty: "intermediate",
        rationale: `Tests applied judgment about appropriate use of ${skill}.`,
      });
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_1`,
        question: `Which trade-off is most commonly associated with ${skill} in production systems?`,
        questionType: "single_choice",
        options: [
          `Additional setup or complexity cost in exchange for a specific benefit`,
          `Zero trade-offs — it is always superior to alternatives`,
          `Significantly reduced performance with no compensating advantage`,
          `Not sure yet`,
        ],
        targetSkillId: skillId,
        difficulty: "intermediate",
        rationale: `Assesses awareness of real-world trade-offs when using ${skill}.`,
      });
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_2`,
        question: `Describe a scenario where you applied ${skill} to solve a real problem. What approach did you take and what was the outcome?`,
        questionType: "free_text",
        targetSkillId: skillId,
        difficulty: "intermediate",
        rationale: `Evaluates practical experience and problem-solving with ${skill}.`,
      });
    } else {
      // advanced / expert / senior
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_0`,
        question: `Which advanced pattern or optimization strategy for ${skill} is most appropriate when operating at scale?`,
        questionType: "single_choice",
        options: [
          `A pattern that specifically addresses performance, consistency, or extensibility in ${skill}`,
          `Using ${skill} identically regardless of system scale`,
          `Replacing ${skill} with a completely different tool at scale`,
          `Not sure yet`,
        ],
        targetSkillId: skillId,
        difficulty: "advanced",
        rationale: `Tests advanced knowledge of scaling ${skill} in production environments.`,
      });
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_1`,
        question: `Design a system component that relies heavily on ${skill}. Explain your design decisions, how you handle failure cases, and what observability you would add.`,
        questionType: "free_text",
        targetSkillId: skillId,
        difficulty: "advanced",
        rationale: `Assesses architectural-level reasoning about ${skill}.`,
      });
      questions.push({
        id: `assess_fallback_${skillId}_${ts}_2`,
        question: `What are the most common misuses or antipatterns with ${skill}, and how would you identify and address them during a code review?`,
        questionType: "free_text",
        targetSkillId: skillId,
        difficulty: "advanced",
        rationale: `Tests expert-level critical understanding and mentoring ability for ${skill}.`,
      });
    }

    return {
      skillId,
      claimedLevel: context.claimedLevel,
      questions,
    };
  }

  public async assessCurriculumCapability(
    goal: string,
    context?: { existingFacts?: ProfileFact[]; learnerBackground?: string }
  ): Promise<CapabilityAssessmentResult> {
    const raw = (goal || "").trim().toLowerCase();
    if (!raw) {
      return {
        supported: false,
        confidence: 0,
        rationale: "No career goal was provided.",
        requiredDimensions: ["declared_goal"],
      };
    }

    // Check for impossible / nonsensical / non-technical keywords
    const impossibleKeywords = [
      "unicorn",
      "wizard",
      "magic",
      "cook pasta",
      "lottery",
      "get rich quick",
      "astronaut rockstar",
      "time travel",
      "billionaire",
      "nothing",
      "asdf",
      "qwerty",
      "underwater marine archaeology",
      "marine archaeology",
      "archaeology",
    ];

    if (impossibleKeywords.some((k) => raw.includes(k))) {
      return {
        supported: false,
        confidence: 0.05,
        rationale: `The requested intent '${goal}' cannot be structured into a valid software or technical engineering curriculum.`,
        requiredDimensions: [],
      };
    }

    // Technical / software / engineering / computing keywords
    const isTechnical =
      raw.includes("engineer") ||
      raw.includes("developer") ||
      raw.includes("programmer") ||
      raw.includes("coder") ||
      raw.includes("architect") ||
      raw.includes("scientist") ||
      raw.includes("analyst") ||
      raw.includes("ml") ||
      raw.includes("ai") ||
      raw.includes("data") ||
      raw.includes("robot") ||
      raw.includes("mobile") ||
      raw.includes("web") ||
      raw.includes("cloud") ||
      raw.includes("security") ||
      raw.includes("hardware") ||
      raw.includes("software") ||
      raw.includes("game") ||
      raw.includes("embedded") ||
      raw.includes("network") ||
      raw.includes("devops") ||
      raw.includes("sysadmin") ||
      raw.includes("systems") ||
      raw.includes("vision") ||
      raw.includes("nlp") ||
      raw.includes("firmware") ||
      raw.includes("ic") ||
      raw.includes("design");

    if (isTechnical) {
      return {
        supported: true,
        confidence: 0.92,
        rationale: `Valid technical engineering track ('${goal}') with well-defined pedagogical milestones and industry toolchains.`,
        recommendedTrack: goal,
        requiredDimensions: ["primary_language", "target_domain", "hours_per_week"],
      };
    }

    if (raw.length >= 3 && !/^[0-9]+$/.test(raw)) {
      return {
        supported: true,
        confidence: 0.8,
        rationale: `Career direction '${goal}' is evaluated as constructible for technical curriculum discovery.`,
        recommendedTrack: goal,
        requiredDimensions: ["primary_language", "target_domain", "hours_per_week"],
      };
    }

    return {
      supported: false,
      confidence: 0.1,
      rationale: `The requested career intent '${goal}' is not recognized as a structured technical engineering domain.`,
      requiredDimensions: [],
    };
  }

  public async proposeCurriculum(
    context: CurriculumDiscoveryContext
  ): Promise<CurriculumProposal | null> {
    const target = `${context.targetRole} ${context.targetDomain || ""} ${context.specialization || ""}`.toLowerCase();

    // 1. Machine Learning & AI Engineering Track
    if (
      target.includes("ml") ||
      target.includes("machine learning") ||
      target.includes("ai") ||
      target.includes("artificial intelligence") ||
      target.includes("deep learning") ||
      target.includes("computer vision") ||
      target.includes("nlp") ||
      target.includes("large language model") ||
      target.includes("llm")
    ) {
      return {
        targetRole: context.targetRole || "Machine Learning Engineer",
        domain: context.targetDomain || "Machine Learning & Applied AI",
        specialization: context.specialization || "Deep Learning & MLOps Infrastructure",
        description: "Comprehensive technical curriculum for mastering mathematical foundations, deep learning frameworks, neural architectures, and production MLOps deployment.",
        proposedSkills: [
          {
            id: "ml_math_statistical_foundations",
            title: "Applied Mathematics, Probability & Statistical Foundations",
            domain: "Machine Learning & Applied AI",
            level: 1,
            category: "Foundational Math",
            description: "Matrix algebra, multivariate calculus, gradient optimization, probability distributions, hypothesis testing, and maximum likelihood estimation.",
            evidenceCriteria: ["Compute matrix derivatives and gradients analytically", "Perform statistical significance tests on model evaluation metrics"],
            tags: ["ml", "math", "statistics", "calculus", "linear-algebra"],
          },
          {
            id: "ml_pytorch_deep_learning_models",
            title: "PyTorch Tensor Computation & Deep Neural Architectures",
            domain: "Machine Learning & Applied AI",
            level: 2,
            category: "Deep Learning",
            description: "PyTorch autograd, custom Dataset/DataLoader pipelines, convolutional networks, recurrent architectures, transformer attention layers, and loss functions.",
            evidenceCriteria: ["Implement multi-head self-attention module in raw PyTorch", "Train CNN/Transformer architecture with custom training loop and learning rate scheduler"],
            tags: ["ml", "pytorch", "deep-learning", "neural-networks"],
          },
          {
            id: "ml_nlp_llm_fine_tuning_rag",
            title: "LLM Fine-Tuning, LoRA & Retrieval-Augmented Generation (RAG)",
            domain: "Machine Learning & Applied AI",
            level: 3,
            category: "Applied Generative AI",
            description: "Hugging Face Transformers ecosystem, tokenizer pipelines, Parameter-Efficient Fine-Tuning (PEFT/LoRA), vector embeddings, and production RAG retrieval.",
            evidenceCriteria: ["Fine-tune open-weights LLM using QLoRA with validation checkpointing", "Build hybrid dense/sparse vector search pipeline with reranking"],
            tags: ["ml", "llm", "rag", "nlp", "transformers"],
          },
          {
            id: "ml_mlops_production_deployment",
            title: "MLOps, High-Throughput Inference & Model Governance",
            domain: "Machine Learning & Applied AI",
            level: 4,
            category: "Production Engineering",
            description: "Model containerization with Docker, ONNX Runtime/TensorRT optimization, FastAPI model serving, Prometheus latency telemetry, and drift monitoring.",
            evidenceCriteria: ["Export PyTorch model to optimized ONNX engine with FP16 quantization", "Deploy containerized inference service with <20ms p99 latency"],
            tags: ["ml", "mlops", "deployment", "onnx", "fastapi", "docker"],
          },
        ],
        proposedEdges: [
          {
            id: "e_ml_1",
            fromSkillId: "ml_math_statistical_foundations",
            toSkillId: "ml_pytorch_deep_learning_models",
            type: "required",
            minimumLevel: "working",
            rationale: "Mathematical gradients and matrix operations are foundational prerequisites for implementing PyTorch neural networks.",
          },
          {
            id: "e_ml_2",
            fromSkillId: "ml_pytorch_deep_learning_models",
            toSkillId: "ml_nlp_llm_fine_tuning_rag",
            type: "required",
            minimumLevel: "working",
            rationale: "Deep learning fundamentals and PyTorch training loops are necessary before fine-tuning transformer models.",
          },
          {
            id: "e_ml_3",
            fromSkillId: "ml_nlp_llm_fine_tuning_rag",
            toSkillId: "ml_mlops_production_deployment",
            type: "required",
            minimumLevel: "working",
            rationale: "Trained neural architectures must be established before building high-throughput production deployment pipelines.",
          },
        ],
        proposedResources: [
          {
            id: "res_ml_1",
            skillId: "ml_math_statistical_foundations",
            title: "Mathematics for Machine Learning: Complete Foundations",
            provider: "Cambridge University Press / Deisenroth",
            url: "https://mml-book.github.io",
            format: "book",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.96,
            description: "Rigorous treatment of linear algebra, analytic geometry, matrix decompositions, vector calculus, and probability.",
          },
          {
            id: "res_ml_2",
            skillId: "ml_pytorch_deep_learning_models",
            title: "Official PyTorch Deep Learning Tutorials & Reference",
            provider: "PyTorch Foundation",
            url: "https://pytorch.org/tutorials",
            format: "documentation",
            costType: "free",
            durationHours: 30,
            qualityScore: 0.95,
            description: "Complete hands-on guide to PyTorch tensors, autograd mechanics, neural network modules, and GPU acceleration.",
          },
          {
            id: "res_ml_3",
            skillId: "ml_nlp_llm_fine_tuning_rag",
            title: "Hugging Face NLP Course & Transformer Architecture Guide",
            provider: "Hugging Face",
            url: "https://huggingface.co/learn/nlp-course",
            format: "interactive_course",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.94,
            description: "In-depth guide to modern NLP, tokenization, transfer learning, parameter-efficient fine-tuning, and datasets.",
          },
          {
            id: "res_ml_4",
            skillId: "ml_mlops_production_deployment",
            title: "Full Stack Deep Learning: Production MLOps Course",
            provider: "Full Stack Deep Learning (UC Berkeley)",
            url: "https://fullstackdeeplearning.com",
            format: "video_series",
            costType: "free",
            durationHours: 40,
            qualityScore: 0.93,
            description: "End-to-end engineering practices for packaging, serving, monitoring, and scaling deep learning systems.",
          },
        ],
        proposedProjects: [
          {
            id: "proj_ml_1",
            title: "End-to-End Enterprise Document Intelligence & Semantic RAG Engine",
            description: "Build a multimodal retrieval-augmented generation engine that ingests technical PDFs, generates dense vector embeddings, performs hybrid search, and executes QLoRA-adapted inference with citation grounding.",
            targetSkillIds: ["ml_pytorch_deep_learning_models", "ml_nlp_llm_fine_tuning_rag"],
            deliverables: [
              "Vector ingestion and chunking pipeline with Milvus/Qdrant integration",
              "Fine-tuned domain-specific PEFT adapter with evaluation benchmark scripts",
              "Evaluation test suite measuring context recall, precision, and faithfulness",
            ],
            verificationChecklist: [
              "Ingestion pipeline achieves >90% precision on gold-standard domain queries",
              "Fine-tuned model achieves <1.5 perplexity on domain evaluation set",
              "RAG engine returns grounded answers with exact source citations",
            ],
            estimatedHours: 40,
            domainContext: "Enterprise Knowledge Retrieval & Generative AI",
          },
          {
            id: "proj_ml_2",
            title: "Production Low-Latency Model Serving & Drift Telemetry Microservice",
            description: "Deploy an optimized PyTorch/ONNX inference server in Docker with GPU batching, FastAPI endpoint contracts, Prometheus metrics, and automated data drift detection.",
            targetSkillIds: ["ml_nlp_llm_fine_tuning_rag", "ml_mlops_production_deployment"],
            deliverables: [
              "Optimized TensorRT/ONNX runtime container with dynamic batching",
              "FastAPI asynchronous REST/gRPC API with input validation and rate limiting",
              "Prometheus/Grafana observability dashboard monitoring p95/p99 latency and KS-statistic data drift",
            ],
            verificationChecklist: [
              "Inference service maintains sub-25ms p99 latency under concurrent load (100 req/s)",
              "Telemetry dashboard reports real-time throughput, error rates, and GPU memory utilization",
              "Automated alert fires when test dataset induces KS-test distribution drift >0.05",
            ],
            estimatedHours: 45,
            domainContext: "Production ML Infrastructure & Real-Time Serving",
          },
        ],
        targetSkillWeights: {
          ml_math_statistical_foundations: 0.25,
          ml_pytorch_deep_learning_models: 0.25,
          ml_nlp_llm_fine_tuning_rag: 0.25,
          ml_mlops_production_deployment: 0.25,
        },
        estimatedLearningHours: 150,
        defaultAssumptions: [
          "Learner has foundational programming proficiency in Python.",
          "Curriculum synthesized via deterministic controlled discovery port.",
        ],
      };
    }

    // 2. Data Science & Big Data Engineering Track
    if (
      target.includes("data scientist") ||
      target.includes("data science") ||
      target.includes("data engineer") ||
      target.includes("analytics engineer")
    ) {
      return {
        targetRole: context.targetRole || "Data Scientist",
        domain: context.targetDomain || "Data Science & Advanced Analytics",
        specialization: context.specialization || "Statistical Modeling & Big Data Engineering",
        description: "Comprehensive curriculum covering statistical data exploration, feature engineering, predictive modeling with Scikit-Learn, and scalable distributed data processing with PySpark.",
        proposedSkills: [
          {
            id: "data_wrangling_exploratory_analysis",
            title: "Exploratory Data Analysis, Pandas & Polars Performance",
            domain: "Data Science & Advanced Analytics",
            level: 1,
            category: "Data Processing",
            description: "Tabular data transformation, vectorized operations, missing value imputation, out-of-core data processing with Polars, and statistical visualization.",
            evidenceCriteria: ["Process 10GB+ dataset using lazy Polars execution plans", "Perform multivariate hypothesis tests and statistical correlation analyses"],
            tags: ["data", "pandas", "polars", "python", "eda"],
          },
          {
            id: "data_statistical_predictive_modeling",
            title: "Statistical Machine Learning & Scikit-Learn Modeling",
            domain: "Data Science & Advanced Analytics",
            level: 2,
            category: "Machine Learning",
            description: "Supervised and unsupervised learning, cross-validation, regularization (L1/L2), gradient boosting (XGBoost/LightGBM), and hyperparameter tuning.",
            evidenceCriteria: ["Build production Scikit-Learn pipeline with custom transformers", "Optimize ensemble models with Optuna Bayesian search"],
            tags: ["data", "scikit-learn", "xgboost", "statistics"],
          },
          {
            id: "data_distributed_pyspark_lakehouse",
            title: "Distributed Data Processing with PySpark & Lakehouse Architecture",
            domain: "Data Science & Advanced Analytics",
            level: 3,
            category: "Big Data Systems",
            description: "PySpark DataFrames, Catalyst query optimization, partitioned Parquet/Delta Lake storage, distributed joins, and medallion lakehouse patterns.",
            evidenceCriteria: ["Execute distributed data transformations with zero shuffle skew", "Implement Delta Lake ACID transactional upserts and time travel"],
            tags: ["data", "pyspark", "spark", "delta-lake", "big-data"],
          },
          {
            id: "data_analytics_engineering_dbt_sql",
            title: "Analytics Engineering, dbt & Production Data Pipelines",
            domain: "Data Science & Advanced Analytics",
            level: 4,
            category: "Data Engineering",
            description: "Advanced SQL modeling, dbt transformation frameworks, dimensional data modeling (Kimball), data lineage, and automated quality testing.",
            evidenceCriteria: ["Construct modular dbt project with automated schema tests and documentation", "Design star schema data warehouse with incremental materializations"],
            tags: ["data", "dbt", "sql", "data-warehouse", "analytics"],
          },
        ],
        proposedEdges: [
          {
            id: "e_ds_1",
            fromSkillId: "data_wrangling_exploratory_analysis",
            toSkillId: "data_statistical_predictive_modeling",
            type: "required",
            minimumLevel: "working",
            rationale: "Clean data preparation and exploratory analysis are prerequisites for building statistical predictive models.",
          },
          {
            id: "e_ds_2",
            fromSkillId: "data_statistical_predictive_modeling",
            toSkillId: "data_distributed_pyspark_lakehouse",
            type: "required",
            minimumLevel: "working",
            rationale: "Understanding algorithmic modeling is required before scaling computations to distributed PySpark clusters.",
          },
          {
            id: "e_ds_3",
            fromSkillId: "data_distributed_pyspark_lakehouse",
            toSkillId: "data_analytics_engineering_dbt_sql",
            type: "required",
            minimumLevel: "working",
            rationale: "Distributed storage architectures establish the foundation for modular analytics engineering and dimensional warehouse pipelines.",
          },
        ],
        proposedResources: [
          {
            id: "res_ds_1",
            skillId: "data_wrangling_exploratory_analysis",
            title: "Python for Data Analysis: Data Wrangling with Pandas and NumPy",
            provider: "O'Reilly / Wes McKinney",
            url: "https://wesmckinney.com/book",
            format: "book",
            costType: "free",
            durationHours: 30,
            qualityScore: 0.95,
            description: "Authoritative reference for modern Python data manipulation, cleaning, and exploratory statistics.",
          },
          {
            id: "res_ds_2",
            skillId: "data_statistical_predictive_modeling",
            title: "Scikit-Learn Machine Learning User Guide & API Reference",
            provider: "Scikit-Learn Consortium",
            url: "https://scikit-learn.org/stable/user_guide.html",
            format: "documentation",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.96,
            description: "Comprehensive documentation covering classification, regression, clustering, model evaluation, and cross-validation.",
          },
          {
            id: "res_ds_3",
            skillId: "data_distributed_pyspark_lakehouse",
            title: "Apache Spark & PySpark Programming Guide",
            provider: "Apache Software Foundation",
            url: "https://spark.apache.org/docs/latest/api/python",
            format: "documentation",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.94,
            description: "Official guide to PySpark distributed RDDs, DataFrames, Spark SQL execution, and cluster tuning.",
          },
          {
            id: "res_ds_4",
            skillId: "data_analytics_engineering_dbt_sql",
            title: "dbt Fundamentals & Analytics Engineering Best Practices",
            provider: "dbt Labs",
            url: "https://docs.getdbt.com/docs/build/documentation",
            format: "documentation",
            costType: "free",
            durationHours: 30,
            qualityScore: 0.93,
            description: "Industry guide to modeling data, writing modular SQL transformations, and orchestrating data warehouse pipelines.",
          },
        ],
        proposedProjects: [
          {
            id: "proj_ds_1",
            title: "Predictive Customer Churn Modeling & Feature Store Pipeline",
            description: "Build an end-to-end predictive modeling pipeline that aggregates historical transaction data, engineers informative behavioral features, trains regularized XGBoost models, and generates interpretable SHAP explanations.",
            targetSkillIds: ["data_wrangling_exploratory_analysis", "data_statistical_predictive_modeling"],
            deliverables: [
              "Feature engineering script with automated leakage prevention and validation tests",
              "Tuned XGBoost/LightGBM model pipeline with cross-validated ROC-AUC benchmarks",
              "SHAP feature importance report explaining individual prediction drivers",
            ],
            verificationChecklist: [
              "Model achieves >0.85 ROC-AUC on unseen out-of-time test partition",
              "Feature pipeline executes without data leakage or forward-looking bias",
              "Automated unit tests verify data shape and null-value constraints",
            ],
            estimatedHours: 35,
            domainContext: "Customer Analytics & Predictive Modeling",
          },
          {
            id: "proj_ds_2",
            title: "Distributed Lakehouse Ingestion & Dimensional Warehouse Pipeline",
            description: "Construct a scalable Delta Lake pipeline using PySpark and dbt that processes multi-million row log streams into a dimensional warehouse with automated quality assertions.",
            targetSkillIds: ["data_distributed_pyspark_lakehouse", "data_analytics_engineering_dbt_sql"],
            deliverables: [
              "PySpark medallion architecture job ingesting raw bronze logs to curated gold tables",
              "dbt data transformation models with tests for uniqueness and referential integrity",
              "Data lineage documentation and execution pipeline monitoring scripts",
            ],
            verificationChecklist: [
              "PySpark job executes 10M record batch with zero task failures or memory spills",
              "dbt test suite passes 100% of data quality and constraint checks",
              "Dimensional star schema enables sub-second analytical aggregation queries",
            ],
            estimatedHours: 40,
            domainContext: "Big Data Engineering & Lakehouse Architecture",
          },
        ],
        targetSkillWeights: {
          data_wrangling_exploratory_analysis: 0.25,
          data_statistical_predictive_modeling: 0.25,
          data_distributed_pyspark_lakehouse: 0.25,
          data_analytics_engineering_dbt_sql: 0.25,
        },
        estimatedLearningHours: 140,
        defaultAssumptions: [
          "Learner has foundational Python and SQL experience.",
          "Curriculum synthesized via deterministic controlled discovery port.",
        ],
      };
    }

    // 3. Mobile App Developer Track (Android / iOS / Cross-Platform)
    if (
      target.includes("mobile") ||
      target.includes("ios") ||
      target.includes("android") ||
      target.includes("flutter") ||
      target.includes("react native")
    ) {
      return {
        targetRole: context.targetRole || "Mobile Application Developer",
        domain: context.targetDomain || "Mobile Platform Engineering",
        specialization: context.specialization || "Modern Reactive Mobile Architecture",
        description: "Comprehensive curriculum for building high-performance native and reactive mobile applications with state management, offline persistence, and secure cloud API integration.",
        proposedSkills: [
          {
            id: "mobile_ui_declarative_components",
            title: "Declarative UI Architecture & Component Layouts",
            domain: "Mobile Platform Engineering",
            level: 1,
            category: "UI Engineering",
            description: "Modern declarative mobile UI patterns (Jetpack Compose / SwiftUI), layout hierarchy, animations, dynamic theming, and accessibility.",
            evidenceCriteria: ["Build responsive multi-screen layout with fluid transitions", "Implement dynamic dark/light theme switching and accessibility labels"],
            tags: ["mobile", "ui", "compose", "swiftui", "declarative"],
          },
          {
            id: "mobile_state_management_reactive_flows",
            title: "Reactive State Management & Asynchronous Concurrency",
            domain: "Mobile Platform Engineering",
            level: 2,
            category: "App Architecture",
            description: "Unidirectional data flow (UDF / MVI / MVVM), coroutines/Combine asynchronous streaming, state hoisting, and side-effect management.",
            evidenceCriteria: ["Implement unidirectional state flow with immutable UI state models", "Manage background task concurrency with cancellation and error propagation"],
            tags: ["mobile", "concurrency", "coroutines", "reactive", "mvvm"],
          },
          {
            id: "mobile_offline_first_storage_networking",
            title: "Offline-First Data Synchronization & Networking",
            domain: "Mobile Platform Engineering",
            level: 3,
            category: "Data Layer",
            description: "Local relational database persistence (Room / SQLite / CoreData), network client interceptors, token caching, conflict resolution, and background sync.",
            evidenceCriteria: ["Design offline-first caching layer with automatic sync retry policies", "Implement secure encrypted credential and JWT token storage"],
            tags: ["mobile", "sqlite", "room", "networking", "offline-first"],
          },
          {
            id: "mobile_cicd_performance_release",
            title: "Mobile App Performance, Security & Automated CI/CD",
            domain: "Mobile Platform Engineering",
            level: 4,
            category: "Release & Performance",
            description: "App startup profiling, memory leak detection (LeakCanary/Instruments), secure keystore integration, app bundle optimization, and Fastlane CI/CD automation.",
            evidenceCriteria: ["Profile and optimize app frame rendering to steady 60fps", "Automate build signing and release deployment using Fastlane"],
            tags: ["mobile", "performance", "security", "cicd", "fastlane"],
          },
        ],
        proposedEdges: [
          {
            id: "e_mob_1",
            fromSkillId: "mobile_ui_declarative_components",
            toSkillId: "mobile_state_management_reactive_flows",
            type: "required",
            minimumLevel: "working",
            rationale: "UI component hierarchy must be understood before wiring complex unidirectional state management and reactive streams.",
          },
          {
            id: "e_mob_2",
            fromSkillId: "mobile_state_management_reactive_flows",
            toSkillId: "mobile_offline_first_storage_networking",
            type: "required",
            minimumLevel: "working",
            rationale: "Reactive state flows are required to bind local database changes and network responses to the view layer.",
          },
          {
            id: "e_mob_3",
            fromSkillId: "mobile_offline_first_storage_networking",
            toSkillId: "mobile_cicd_performance_release",
            type: "required",
            minimumLevel: "working",
            rationale: "A functioning data layer and network integration are required prior to running profiling tools and release automation pipelines.",
          },
        ],
        proposedResources: [
          {
            id: "res_mob_1",
            skillId: "mobile_ui_declarative_components",
            title: "Modern Mobile UI Development Guide",
            provider: "Google Developer / Apple Developer Documentation",
            url: "https://developer.android.com/develop/ui/compose",
            format: "documentation",
            costType: "free",
            durationHours: 25,
            qualityScore: 0.95,
            description: "Official guide to declarative UI architecture, layouts, styling, and navigation.",
          },
          {
            id: "res_mob_2",
            skillId: "mobile_state_management_reactive_flows",
            title: "Guide to App Architecture & Asynchronous Concurrency",
            provider: "Android Developers / Swift.org",
            url: "https://developer.android.com/topic/architecture",
            format: "documentation",
            costType: "free",
            durationHours: 30,
            qualityScore: 0.96,
            description: "Architectural guidelines for separation of concerns, repository patterns, and reactive streaming.",
          },
          {
            id: "res_mob_3",
            skillId: "mobile_offline_first_storage_networking",
            title: "Offline-First Mobile Architecture with Local Persistence",
            provider: "Ray Wenderlich / Kodeco Tutorials",
            url: "https://www.kodeco.com/mobile",
            format: "interactive_course",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.92,
            description: "Practical guide to SQLite/Room database design, migrations, and network synchronization.",
          },
          {
            id: "res_mob_4",
            skillId: "mobile_cicd_performance_release",
            title: "Fastlane Mobile Automation & App Store Deployment Docs",
            provider: "Fastlane Community",
            url: "https://docs.fastlane.tools",
            format: "documentation",
            costType: "free",
            durationHours: 25,
            qualityScore: 0.91,
            description: "Complete guide to automating app store screenshots, code signing, and continuous delivery builds.",
          },
        ],
        proposedProjects: [
          {
            id: "proj_mob_1",
            title: "Offline-First Task & Habit Management Mobile Application",
            description: "Develop a production-ready mobile application featuring declarative UI screens, reactive state flows, local encrypted SQLite caching, and bidirectional background cloud sync.",
            targetSkillIds: ["mobile_ui_declarative_components", "mobile_state_management_reactive_flows", "mobile_offline_first_storage_networking"],
            deliverables: [
              "Responsive mobile app with smooth list animations and custom theme support",
              "Local database schema with migrations and automated sync queue manager",
              "End-to-end UI tests validating offline creation and online reconciliation",
            ],
            verificationChecklist: [
              "App operates seamlessly in airplane mode and queues changes for sync",
              "Sync engine reconciles remote and local conflicts without data loss",
              "UI tests pass with 100% reliability across multiple simulated device screens",
            ],
            estimatedHours: 40,
            domainContext: "Consumer Productivity & Mobile Architecture",
          },
        ],
        targetSkillWeights: {
          mobile_ui_declarative_components: 0.25,
          mobile_state_management_reactive_flows: 0.25,
          mobile_offline_first_storage_networking: 0.25,
          mobile_cicd_performance_release: 0.25,
        },
        estimatedLearningHours: 120,
        defaultAssumptions: [
          "Learner has foundational programming knowledge in Kotlin, Swift, or TypeScript.",
          "Curriculum synthesized via deterministic controlled discovery port.",
        ],
      };
    }

    // 4. Game Developer Track (Unreal / Unity / Game Engine)
    if (
      target.includes("game") ||
      target.includes("gaming") ||
      target.includes("unreal") ||
      target.includes("unity")
    ) {
      return {
        targetRole: context.targetRole || "Game Developer & Systems Engineer",
        domain: context.targetDomain || "Game Engine Architecture & Real-Time Graphics",
        specialization: context.specialization || "C++ Game Systems & Engine Architecture",
        description: "Rigorous curriculum for game development focusing on 3D math, game engine systems architecture, real-time shaders, and physics simulation.",
        proposedSkills: [
          {
            id: "game_3d_math_graphics_foundations",
            title: "3D Mathematics, Vectors, Quaternions & Coordinate Spaces",
            domain: "Game Engine Architecture & Real-Time Graphics",
            level: 1,
            category: "Core Math",
            description: "Vector algebra, transformation matrices, quaternion rotations, projection math, and camera frustum calculation.",
            evidenceCriteria: ["Implement custom quaternion rotation module in C++", "Compute view-projection matrices for perspective camera"],
            tags: ["game", "math", "graphics", "vectors", "cpp"],
          },
          {
            id: "game_engine_systems_architecture",
            title: "Game Loop, Entity Component Systems (ECS) & Memory Management",
            domain: "Game Engine Architecture & Real-Time Graphics",
            level: 2,
            category: "Engine Architecture",
            description: "High-performance game loops, custom memory pool allocators, cache-friendly Entity Component Systems, and spatial partitioning.",
            evidenceCriteria: ["Build custom linear and pool allocator for game objects", "Implement archetype-based ECS with sub-millisecond query performance"],
            tags: ["game", "ecs", "architecture", "memory", "performance"],
          },
          {
            id: "game_realtime_rendering_shaders",
            title: "Real-Time Rendering Pipelines & Shader Programming",
            domain: "Game Engine Architecture & Real-Time Graphics",
            level: 3,
            category: "Graphics Programming",
            description: "Modern graphics APIs (DirectX 12 / Vulkan / Metal), forward vs deferred rendering, HLSL/GLSL shader programming, lighting models, and shadows.",
            evidenceCriteria: ["Write PBR (Physically Based Rendering) shader in HLSL/GLSL", "Implement shadow mapping pass with cascaded shadow maps"],
            tags: ["game", "graphics", "shaders", "vulkan", "directx"],
          },
          {
            id: "game_physics_gameplay_systems",
            title: "Physics Simulation, Collision Detection & Gameplay Mechanics",
            domain: "Game Engine Architecture & Real-Time Graphics",
            level: 4,
            category: "Gameplay & Physics",
            description: "Rigid body dynamics, GJK collision detection, raycasting, character controllers, state machines, and networked replication.",
            evidenceCriteria: ["Implement GJK/EPA narrow-phase collision detection algorithm", "Construct responsive character controller with state machine physics"],
            tags: ["game", "physics", "collision", "gameplay", "ai"],
          },
        ],
        proposedEdges: [
          {
            id: "e_game_1",
            fromSkillId: "game_3d_math_graphics_foundations",
            toSkillId: "game_engine_systems_architecture",
            type: "required",
            minimumLevel: "working",
            rationale: "Matrix and vector math are necessary prerequisites for implementing transform hierarchies in game engine loops.",
          },
          {
            id: "e_game_2",
            fromSkillId: "game_engine_systems_architecture",
            toSkillId: "game_realtime_rendering_shaders",
            type: "required",
            minimumLevel: "working",
            rationale: "Engine ECS and memory management must be in place to stream mesh vertices and uniform buffers to GPU shaders.",
          },
          {
            id: "e_game_3",
            fromSkillId: "game_realtime_rendering_shaders",
            toSkillId: "game_physics_gameplay_systems",
            type: "required",
            minimumLevel: "working",
            rationale: "Rendering pipelines and scene graph synchronization are needed to visualize physics collision manifolds and gameplay debug overlays.",
          },
        ],
        proposedResources: [
          {
            id: "res_game_1",
            skillId: "game_3d_math_graphics_foundations",
            title: "3D Math Primer for Graphics and Games Development",
            provider: "CRC Press / Fletcher Dunn",
            url: "https://gamemath.com/book",
            format: "book",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.96,
            description: "Classic foundational text covering coordinate spaces, vector math, quaternions, and geometric primitives.",
          },
          {
            id: "res_game_2",
            skillId: "game_engine_systems_architecture",
            title: "Game Engine Architecture (3rd Edition)",
            provider: "Jason Gregory / Naughty Dog",
            url: "https://www.gameenginebook.com",
            format: "book",
            costType: "free",
            durationHours: 40,
            qualityScore: 0.95,
            description: "Industry-standard breakdown of commercial game engine subsystems, memory architectures, and concurrency.",
          },
          {
            id: "res_game_3",
            skillId: "game_realtime_rendering_shaders",
            title: "LearnOpenGL & Modern Graphics Pipeline Guide",
            provider: "Joey de Vries",
            url: "https://learnopengl.com",
            format: "interactive_course",
            costType: "free",
            durationHours: 40,
            qualityScore: 0.97,
            description: "Hands-on guide to modern rendering, lighting models, framebuffers, and PBR shading.",
          },
          {
            id: "res_game_4",
            skillId: "game_physics_gameplay_systems",
            title: "Real-Time Collision Detection Documentation",
            provider: "Christer Ericson / Morgan Kaufmann",
            url: "https://realtimecollisiondetection.net",
            format: "book",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.92,
            description: "Algorithms and mathematical techniques for high-performance collision detection and bounding volume hierarchies.",
          },
        ],
        proposedProjects: [
          {
            id: "proj_game_1",
            title: "Custom 3D Game Engine with PBR Shading & Physics Sandbox",
            description: "Build a custom C++ real-time 3D game engine featuring an archetype ECS, forward+ PBR renderer with shadow mapping, and rigid-body collision physics.",
            targetSkillIds: ["game_engine_systems_architecture", "game_realtime_rendering_shaders", "game_physics_gameplay_systems"],
            deliverables: [
              "C++ game engine executable with ECS entity viewer and memory profiler",
              "HLSL/GLSL shader pipeline rendering complex 3D scenes with directional lighting",
              "Physics simulation scene demonstrating rigid-body dynamics and collision response",
            ],
            verificationChecklist: [
              "Engine renders 10,000 active entities at >60fps with zero memory leaks",
              "PBR shader accurately computes metallic and roughness surface reflections",
              "Rigid bodies collide and settle realistically without penetration or tunneling",
            ],
            estimatedHours: 50,
            domainContext: "Game Engine Architecture & Real-Time 3D Simulation",
          },
        ],
        targetSkillWeights: {
          game_3d_math_graphics_foundations: 0.25,
          game_engine_systems_architecture: 0.25,
          game_realtime_rendering_shaders: 0.25,
          game_physics_gameplay_systems: 0.25,
        },
        estimatedLearningHours: 150,
        defaultAssumptions: [
          "Learner has strong C++ or C# programming background.",
          "Curriculum synthesized via deterministic controlled discovery port.",
        ],
      };
    }

    // 5. Robotics Engineer Track (Existing high-quality fixture)
    if (
      target.includes("robotics") ||
      target.includes("robotic") ||
      target.includes("ros 2") ||
      target.includes("ros2") ||
      /\bros\b/i.test(target) ||
      target.includes("mechanical") ||
      target.includes("drone")
    ) {
      return {
        targetRole: context.targetRole || "Mechanical Engineer specializing in Robotics",
        domain: context.targetDomain || "Robotics & Autonomous Systems",
        specialization: context.specialization || "Robotics Control & Autonomous Navigation",
        description: "Comprehensive curriculum for mechanical engineers transitioning to autonomous robotics systems.",
        proposedSkills: [
          {
            id: "robotics_kinematics_dynamics",
            title: "Robot Kinematics, Dynamics & Coordinate Transforms",
            domain: "Robotics & Autonomous Systems",
            level: 2,
            category: "Core Robotics",
            description: "Forward and inverse kinematics, DH parameters, rigid body transformations, and dynamics equations.",
            evidenceCriteria: ["Compute transformation matrices", "Solve inverse kinematics for 6-DOF arm"],
            tags: ["robotics", "kinematics", "dynamics", "math"],
          },
          {
            id: "robotics_ros2_middleware",
            title: "ROS 2 Architecture, Nodes & Middleware Integration",
            domain: "Robotics & Autonomous Systems",
            level: 2,
            category: "Software Architecture",
            description: "ROS 2 computational graph, pub/sub topics, services, actions, custom message types, and DDS QoS policies.",
            evidenceCriteria: ["Implement multi-threaded ROS 2 executor node", "Configure QoS profiles for sensor streams"],
            tags: ["robotics", "ros2", "middleware", "cpp"],
          },
          {
            id: "robotics_sensor_fusion_slam",
            title: "Sensor Fusion, State Estimation & 2D/3D SLAM",
            domain: "Robotics & Autonomous Systems",
            level: 3,
            category: "Perception & State Estimation",
            description: "Extended Kalman Filters (EKF), LiDAR odometry, Visual SLAM, and occupancy grid mapping.",
            evidenceCriteria: ["Run robot_localization with IMU and wheel odometry", "Generate 2D occupancy grid map from LiDAR"],
            tags: ["robotics", "slam", "lidar", "state-estimation"],
          },
          {
            id: "robotics_nav2_motion_planning",
            title: "Autonomous Navigation & Nav2 Motion Planning",
            domain: "Robotics & Autonomous Systems",
            level: 4,
            category: "Autonomous Systems",
            description: "Nav2 stack configuration, global and local costmaps, DWB local planner, behavior trees, and collision avoidance.",
            evidenceCriteria: ["Configure Nav2 stack for differential drive robot", "Execute waypoint navigation with dynamic obstacle avoidance"],
            tags: ["robotics", "nav2", "motion-planning", "navigation"],
          },
        ],
        proposedEdges: [
          {
            id: "e_rob_1",
            fromSkillId: "robotics_kinematics_dynamics",
            toSkillId: "robotics_ros2_middleware",
            type: "required",
            minimumLevel: "working",
            rationale: "Kinematic understanding is necessary before modeling robots in URDF and ROS 2",
          },
          {
            id: "e_rob_2",
            fromSkillId: "robotics_ros2_middleware",
            toSkillId: "robotics_sensor_fusion_slam",
            type: "required",
            minimumLevel: "working",
            rationale: "ROS 2 node architecture is required to stream and fuse sensor topics",
          },
          {
            id: "e_rob_3",
            fromSkillId: "robotics_sensor_fusion_slam",
            toSkillId: "robotics_nav2_motion_planning",
            type: "required",
            minimumLevel: "working",
            rationale: "Accurate state estimation and map generation are prerequisites for autonomous path planning",
          },
        ],
        proposedResources: [
          {
            id: "res_rob_1",
            skillId: "robotics_kinematics_dynamics",
            title: "Modern Robotics: Mechanics, Planning, and Control",
            provider: "Northwestern Robotics / Kevin Lynch",
            url: "https://modernrobotics.northwestern.edu",
            format: "book",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.9,
            description: "Rigorous treatment of rigid-body motions, kinematics, and trajectory generation.",
          },
          {
            id: "res_rob_2",
            skillId: "robotics_ros2_middleware",
            title: "ROS 2 Official Documentation & Core Tutorials",
            provider: "Open Source Robotics Foundation (OSRF)",
            url: "https://docs.ros.org/en/jazzy",
            format: "documentation",
            costType: "free",
            durationHours: 30,
            qualityScore: 0.95,
            description: "Hands-on guide to writing C++ and Python ROS 2 nodes, publishers, subscribers, and launch files.",
          },
          {
            id: "res_rob_3",
            skillId: "robotics_sensor_fusion_slam",
            title: "Probabilistic Robotics & State Estimation",
            provider: "MIT Press & Open Courseware",
            url: "https://probabilistic-robotics.org",
            format: "interactive_course",
            costType: "free",
            durationHours: 40,
            qualityScore: 0.88,
            description: "Kalman filtering, particle filters, and simultaneous localization and mapping.",
          },
          {
            id: "res_rob_4",
            skillId: "robotics_nav2_motion_planning",
            title: "Nav2 Navigation Stack Documentation and Configuration",
            provider: "Nav2 Project Community",
            url: "https://nav2.org",
            format: "documentation",
            costType: "free",
            durationHours: 35,
            qualityScore: 0.9,
            description: "Complete guide to tuning costmaps, planners, recovery behaviors, and simulation testing.",
          },
        ],
        proposedProjects: [
          {
            id: "proj_rob_1",
            title: "Autonomous Mobile Robot Navigation in Simulated Warehouse",
            description: "Develop a simulated differential-drive autonomous mobile robot in Gazebo that maps an unknown warehouse and navigates between delivery stations autonomously.",
            targetSkillIds: ["robotics_ros2_middleware", "robotics_sensor_fusion_slam", "robotics_nav2_motion_planning"],
            deliverables: [
              "Gazebo simulation environment and URDF robot model with LiDAR and IMU sensors",
              "ROS 2 navigation launch architecture with tuned costmaps and Nav2 recovery behaviors",
              "Automated mission control script executing autonomous delivery runs with dynamic obstacle avoidance",
            ],
            verificationChecklist: [
              "Robot successfully localizes using LiDAR and odometry fusion with <5cm error",
              "Robot completes 5 consecutive delivery waypoint missions without collision",
              "Dynamic obstacle avoidance smoothly re-plans trajectories in real-time",
            ],
            estimatedHours: 45,
            domainContext: "Autonomous Robotics & Warehouse Automation",
          },
        ],
        targetSkillWeights: {
          robotics_kinematics_dynamics: 0.25,
          robotics_ros2_middleware: 0.25,
          robotics_sensor_fusion_slam: 0.25,
          robotics_nav2_motion_planning: 0.25,
        },
        estimatedLearningHours: 140,
        defaultAssumptions: [
          "Learner has foundational mechanical engineering background and basic programming skills.",
          "Curriculum synthesized via deterministic controlled discovery port.",
        ],
      };
    }

    // 6. Generic Constructible Track Fallback
    const roleSlug = (context.targetRole || "technical_specialist")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return {
      targetRole: context.targetRole,
      domain: context.targetDomain || "Software & Systems Engineering",
      specialization: context.specialization || "Specialized Technical Engineering",
      description: `Structured technical learning path constructed for '${context.targetRole}'.`,
      proposedSkills: [
        {
          id: `${roleSlug}_foundations`,
          title: `Core Fundamentals of ${context.targetRole}`,
          domain: context.targetDomain || "Software & Systems Engineering",
          level: 1,
          category: "Foundations",
          description: `Foundational principles, core syntax, and essential mental models for ${context.targetRole}.`,
          evidenceCriteria: [`Demonstrate core competency in foundational concepts of ${context.targetRole}`, `Solve practical introductory technical exercises`],
          tags: [roleSlug, "foundations", "core"],
        },
        {
          id: `${roleSlug}_intermediate_architecture`,
          title: `Architecture & Toolchain Integration for ${context.targetRole}`,
          domain: context.targetDomain || "Software & Systems Engineering",
          level: 2,
          category: "Architecture",
          description: `Design patterns, toolchain workflows, and component architecture for ${context.targetRole}.`,
          evidenceCriteria: [`Construct modular components following domain best practices`, `Integrate standard toolchain and testing frameworks`],
          tags: [roleSlug, "architecture", "toolchain"],
        },
        {
          id: `${roleSlug}_advanced_systems`,
          title: `Advanced Systems Engineering in ${context.targetRole}`,
          domain: context.targetDomain || "Software & Systems Engineering",
          level: 3,
          category: "Advanced Systems",
          description: `Performance optimization, scaling strategies, and deep domain capabilities for ${context.targetRole}.`,
          evidenceCriteria: [`Optimize performance bottlenecks and profile execution`, `Design resilient fault-tolerant subsystems`],
          tags: [roleSlug, "advanced", "performance"],
        },
        {
          id: `${roleSlug}_production_mastery`,
          title: `Production Deployment & Capstone Execution in ${context.targetRole}`,
          domain: context.targetDomain || "Software & Systems Engineering",
          level: 4,
          category: "Production",
          description: `End-to-end production operations, monitoring, CI/CD, and real-world system delivery.`,
          evidenceCriteria: [`Deliver production-ready system with automated tests and CI/CD`, `Implement monitoring telemetry and observability`],
          tags: [roleSlug, "production", "capstone"],
        },
      ],
      proposedEdges: [
        {
          id: `e_${roleSlug}_1`,
          fromSkillId: `${roleSlug}_foundations`,
          toSkillId: `${roleSlug}_intermediate_architecture`,
          type: "required",
          minimumLevel: "working",
          rationale: "Core fundamentals must be mastered before architectural integration.",
        },
        {
          id: `e_${roleSlug}_2`,
          fromSkillId: `${roleSlug}_intermediate_architecture`,
          toSkillId: `${roleSlug}_advanced_systems`,
          type: "required",
          minimumLevel: "working",
          rationale: "Architectural patterns are required to scale advanced systems.",
        },
        {
          id: `e_${roleSlug}_3`,
          fromSkillId: `${roleSlug}_advanced_systems`,
          toSkillId: `${roleSlug}_production_mastery`,
          type: "required",
          minimumLevel: "working",
          rationale: "Advanced systems understanding is required for production deployment mastery.",
        },
      ],
      proposedResources: [
        {
          id: `res_${roleSlug}_1`,
          skillId: `${roleSlug}_foundations`,
          title: `Official Documentation & Getting Started Guide for ${context.targetRole}`,
          provider: "Open Technical Documentation",
          url: "https://docs.github.com",
          format: "documentation",
          costType: "free",
          durationHours: 25,
          qualityScore: 0.9,
          description: `Complete foundational reference and tutorials for ${context.targetRole}.`,
        },
        {
          id: `res_${roleSlug}_2`,
          skillId: `${roleSlug}_intermediate_architecture`,
          title: `Applied Engineering & Architecture for ${context.targetRole}`,
          provider: "O'Reilly & IEEE Xplore",
          url: "https://learning.oreilly.com",
          format: "book",
          costType: "free",
          durationHours: 30,
          qualityScore: 0.92,
          description: `Architectural design patterns and implementation guidelines.`,
        },
        {
          id: `res_${roleSlug}_3`,
          skillId: `${roleSlug}_advanced_systems`,
          title: `Advanced Performance & Systems Design Guide`,
          provider: "ACM Digital Library",
          url: "https://dl.acm.org",
          format: "documentation",
          costType: "free",
          durationHours: 35,
          qualityScore: 0.91,
          description: `In-depth analysis of scaling, concurrency, and performance tuning.`,
        },
        {
          id: `res_${roleSlug}_4`,
          skillId: `${roleSlug}_production_mastery`,
          title: `Production Engineering & Operational Excellence`,
          provider: "Usenix SRE & Production Engineering",
          url: "https://www.usenix.org",
          format: "documentation",
          costType: "free",
          durationHours: 30,
          qualityScore: 0.93,
          description: `Production deployment, observability, and lifecycle engineering.`,
        },
      ],
      proposedProjects: [
        {
          id: `proj_${roleSlug}_1`,
          title: `End-to-End Practical Capstone for ${context.targetRole}`,
          description: `Design and implement a complete, robust project applying core and advanced concepts of ${context.targetRole}.`,
          targetSkillIds: [`${roleSlug}_intermediate_architecture`, `${roleSlug}_advanced_systems`, `${roleSlug}_production_mastery`],
          deliverables: [
            "Complete source code repository with comprehensive test suite",
            "Technical architecture documentation with subsystem diagrams",
            "Automated deployment pipeline with observability checks",
          ],
          verificationChecklist: [
            "Project builds and executes successfully with 100% test pass rate",
            "System meets target performance and correctness specifications",
            "Deployment workflow passes all automated security and quality gates",
          ],
          estimatedHours: 40,
          domainContext: context.targetDomain || "Software Engineering",
        },
      ],
      targetSkillWeights: {
        [`${roleSlug}_foundations`]: 0.25,
        [`${roleSlug}_intermediate_architecture`]: 0.25,
        [`${roleSlug}_advanced_systems`]: 0.25,
        [`${roleSlug}_production_mastery`]: 0.25,
      },
      estimatedLearningHours: 120,
      defaultAssumptions: [
        "Learner has foundational programming knowledge.",
        "Curriculum synthesized via deterministic controlled discovery port.",
      ],
    };
  }

  public getLastExecutionMetadata() {
    return {
      provider: "deterministic" as const,
      modelName: "rule-engine-v1",
      fallbackUsed: false,
      latencyMs: 1,
      requestId: `req_det_${Date.now()}`,
    };
  }
}
