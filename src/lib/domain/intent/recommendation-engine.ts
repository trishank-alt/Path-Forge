import {
  PathDefinition,
  SEEDED_PATHS,
} from "../../persistence/seed-data";
import {
  MarketDemandSignal,
  RecommendationCategory,
  RecommendationDecision,
  RecommendedOption,
  TechnologyEcosystem,
} from "../../contracts";

export interface ExplorationContext {
  dimension: string; // "target_domain" | "primary_language" | "architecture_preference"
  eligiblePaths: PathDefinition[];
  declaredTargetRole?: string | null;
  existingFacts?: any[];
}

export interface ExplorationProvider {
  getOptions(context: ExplorationContext): Promise<RecommendedOption[]>;
}

export class CatalogExplorationProvider implements ExplorationProvider {
  private paths: PathDefinition[];

  constructor(paths: PathDefinition[] = SEEDED_PATHS) {
    this.paths = paths;
  }

  public async getOptions(context: ExplorationContext): Promise<RecommendedOption[]> {
    const { dimension, eligiblePaths, declaredTargetRole } = context;
    const roleLower = (declaredTargetRole || "").toLowerCase();

    // Support uncatalogued career directions when eligible catalog paths are empty
    if (eligiblePaths.length === 0 && roleLower) {
      if (dimension === "target_domain" || dimension === "domain" || dimension === "specialization_focus") {
        const uncataloguedDomainOpts = this.deriveUncataloguedDomainOptions(roleLower);
        if (uncataloguedDomainOpts.length > 0) return uncataloguedDomainOpts;
      }
      if (dimension === "primary_language" || dimension === "language") {
        const uncataloguedLangOpts = this.deriveUncataloguedLanguageOptions(roleLower);
        if (uncataloguedLangOpts.length > 0) return uncataloguedLangOpts;
      }
    }

    const paths = eligiblePaths.length > 0 ? eligiblePaths : this.paths;
    const pathIds = new Set(paths.map((p) => p.id));

    if (dimension === "target_domain" || dimension === "domain" || dimension === "specialization_focus") {
      return this.deriveDomainOptions(pathIds);
    }

    if (dimension === "primary_language" || dimension === "language") {
      return this.deriveLanguageOptions(pathIds);
    }

    if (dimension === "architecture_preference" || dimension === "architecture") {
      return this.deriveArchitectureOptions(pathIds);
    }

    return [];
  }

  private deriveUncataloguedDomainOptions(roleLower: string): RecommendedOption[] {
    const options: RecommendedOption[] = [];

    if (roleLower.includes("ml") || roleLower.includes("machine learning") || roleLower.includes("ai") || roleLower.includes("deep learning")) {
      options.push({
        id: "nlp_llm_rag",
        dimension: "target_domain",
        title: "NLP, LLM Fine-Tuning & RAG Architecture",
        description: "Fine-tune open-weights models (LoRA/PEFT), build hybrid retrieval-augmented generation pipelines, and vectorize enterprise knowledge.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Global AI Workforce Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.96,
          score: 96,
          tier: "very_high",
          explanation: "Highest growth category across enterprise technology seeking generative AI integration.",
        },
        rationale: "Rapidly expanding specialization with direct enterprise production applications.",
      });

      options.push({
        id: "computer_vision_multimodal",
        dimension: "target_domain",
        title: "Computer Vision & Multimodal Deep Learning",
        description: "Build convolutional and transformer visual models for object detection, segmentation, and multimodal image/video understanding.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Global AI Workforce Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.94,
          score: 94,
          tier: "very_high",
          explanation: "Strong market demand in autonomous systems, medical imaging, and visual inspection.",
        },
        rationale: "Fundamental deep learning domain with mature production deployment pipelines.",
      });

      options.push({
        id: "mlops_infrastructure",
        dimension: "target_domain",
        title: "MLOps & Production Model Deployment",
        description: "Containerize model inference engines, optimize runtime execution (ONNX / TensorRT), and monitor data drift.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Global AI Workforce Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.95,
          score: 95,
          tier: "very_high",
          explanation: "Critical industry bottleneck for teams moving prototypes to scalable production.",
        },
        rationale: "High-leverage engineering discipline connecting data science to scalable infrastructure.",
      });

      options.push({
        id: "tabular_predictive_ml",
        dimension: "target_domain",
        title: "Classical Machine Learning & Predictive Analytics",
        description: "Master feature engineering, gradient boosted trees (XGBoost/LightGBM), and statistical modeling on structured data.",
        category: "supported_track",
        matchingPathIds: [],
        demandSignal: {
          source: "Global AI Workforce Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.88,
          score: 86,
          tier: "high",
          explanation: "Steady, foundational enterprise demand across finance, insurance, and marketing analytics.",
        },
        rationale: "High explainability and reliability for structured enterprise data.",
      });
    } else if (roleLower.includes("mobile") || roleLower.includes("ios") || roleLower.includes("android")) {
      options.push({
        id: "native_android",
        dimension: "target_domain",
        title: "Native Android Engineering (Kotlin & Jetpack Compose)",
        description: "Build modern, reactive Android apps using declarative Compose UI, Kotlin Coroutines, Room persistence, and Material 3.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Mobile Developer Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.92,
          score: 92,
          tier: "very_high",
          explanation: "Industry-standard modern Android development framework with broad ecosystem adoption.",
        },
        rationale: "Fastest path to modern native Android mastery.",
      });

      options.push({
        id: "native_ios",
        dimension: "target_domain",
        title: "Native iOS Engineering (Swift & SwiftUI)",
        description: "Construct elegant Apple ecosystem apps with SwiftUI, Combine, Swift Concurrency, and Core Data persistence.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Mobile Developer Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.93,
          score: 93,
          tier: "very_high",
          explanation: "High monetization and strong demand across consumer app startups and digital agencies.",
        },
        rationale: "Native Apple platform experience with modern declarative Swift patterns.",
      });

      options.push({
        id: "cross_platform_mobile",
        dimension: "target_domain",
        title: "Cross-Platform Mobile Apps (Flutter & React Native)",
        description: "Ship multi-platform mobile applications from a single codebase with native performance bridges and responsive UI.",
        category: "strong_option",
        matchingPathIds: [],
        demandSignal: {
          source: "Mobile Developer Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.89,
          score: 89,
          tier: "high",
          explanation: "High velocity for startups needing simultaneous iOS and Android launches.",
        },
        rationale: "Maximum developer velocity for multi-platform delivery.",
      });
    } else if (roleLower.includes("game") || roleLower.includes("gaming")) {
      options.push({
        id: "unreal_3d_systems",
        dimension: "target_domain",
        title: "Unreal Engine & High-Performance 3D Systems",
        description: "Master C++ gameplay programming, Niagara visual effects, physics subsystems, and custom engine extensions in Unreal Engine 5.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Interactive Media & Games Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.92,
          score: 92,
          tier: "very_high",
          explanation: "Standard for AAA games, virtual production, and high-fidelity 3D simulation.",
        },
        rationale: "Unmatched fidelity and industry prominence for high-end 3D graphics.",
      });

      options.push({
        id: "unity_multiplatform",
        dimension: "target_domain",
        title: "Unity Multi-Platform Game Development",
        description: "Develop 2D and 3D games in C# using Unity's Universal Render Pipeline, DOTS entity component system, and multiplatform packaging.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Interactive Media & Games Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.9,
          score: 90,
          tier: "very_high",
          explanation: "Dominant engine for indie game studios, mobile games, and cross-platform publishing.",
        },
        rationale: "Rapid prototyping and comprehensive multiplatform support.",
      });
    } else if (roleLower.includes("data scientist") || roleLower.includes("data engineer")) {
      options.push({
        id: "lakehouse_pyspark",
        dimension: "target_domain",
        title: "Modern Data Stack & Lakehouse Engineering",
        description: "Architect distributed big-data pipelines using PySpark, Delta Lake ACID tables, and dbt data transformations.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Data Engineering Benchmark 2026",
          observedAt: "2026-Q1",
          confidence: 0.95,
          score: 95,
          tier: "very_high",
          explanation: "Core architecture standard across modern data-driven enterprises.",
        },
        rationale: "Scalable big data processing with unified batch and streaming capabilities.",
      });

      options.push({
        id: "predictive_statistical_modeling",
        dimension: "target_domain",
        title: "Statistical Modeling & Predictive Data Science",
        description: "Design hypothesis tests, build regularized predictive models, perform causal inference, and evaluate algorithmic fairness.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Data Engineering Benchmark 2026",
          observedAt: "2026-Q1",
          confidence: 0.91,
          score: 91,
          tier: "very_high",
          explanation: "High value for quantitative decision-making, pricing engines, and risk modeling.",
        },
        rationale: "Rigorous mathematical foundation for data-backed business strategy.",
      });
    }

    return options;
  }

  private deriveUncataloguedLanguageOptions(roleLower: string): RecommendedOption[] {
    const options: RecommendedOption[] = [];

    if (roleLower.includes("ml") || roleLower.includes("machine learning") || roleLower.includes("ai") || roleLower.includes("data")) {
      options.push({
        id: "python_ml",
        dimension: "primary_language",
        title: "Python (PyTorch, Hugging Face & Scikit-Learn)",
        description: "The universal programming language and ecosystem for modern machine learning, deep learning research, and data science.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Developer Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.98,
          score: 98,
          tier: "very_high",
          explanation: "Dominant lingua franca for all state-of-the-art AI frameworks and data tooling.",
        },
        rationale: "Essential primary language for machine learning and data engineering.",
      });

      options.push({
        id: "cpp_ml",
        dimension: "primary_language",
        title: "C++ (High-Performance Inference & TensorRT)",
        description: "Systems programming language for optimizing model inference runtimes, CUDA kernels, and low-latency deployment.",
        category: "strong_option",
        matchingPathIds: [],
        demandSignal: {
          source: "Developer Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.89,
          score: 89,
          tier: "high",
          explanation: "Required for high-throughput model serving engines and edge AI devices.",
        },
        rationale: "Maximum runtime performance for production deployment and GPU acceleration.",
      });
    } else if (roleLower.includes("mobile") || roleLower.includes("ios") || roleLower.includes("android")) {
      options.push({
        id: "kotlin",
        dimension: "primary_language",
        title: "Kotlin (Modern Android Development)",
        description: "Official, expressive language for Android engineering with first-class coroutines and multiplatform capabilities.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Developer Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.94,
          score: 94,
          tier: "very_high",
          explanation: "Preferred language for modern native Android applications.",
        },
        rationale: "First-class Google support with concise, safe syntax.",
      });

      options.push({
        id: "swift",
        dimension: "primary_language",
        title: "Swift (Modern Apple Platform Development)",
        description: "Fast, safe, and modern language for developing apps across iOS, iPadOS, macOS, and watchOS.",
        category: "high_demand",
        matchingPathIds: [],
        demandSignal: {
          source: "Developer Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.93,
          score: 93,
          tier: "very_high",
          explanation: "Native language of choice for the entire Apple hardware and software ecosystem.",
        },
        rationale: "Native performance and deep integration with Apple frameworks.",
      });
    }

    return options;
  }

  private deriveDomainOptions(pathIds: Set<string>): RecommendedOption[] {
    const options: RecommendedOption[] = [];

    // Backend options
    if (
      pathIds.has("backend_web_product_node") ||
      pathIds.has("backend_enterprise_java") ||
      pathIds.has("backend_python_cloud") ||
      pathIds.has("fullstack_software_engineer")
    ) {
      if (pathIds.has("backend_web_product_node") || pathIds.has("fullstack_software_engineer")) {
        options.push({
          id: "saas_web_products",
          dimension: "target_domain",
          title: "Cloud-native SaaS & Web Products",
          description:
            "Design fast-iterating consumer platforms, cloud APIs, microservices, and modern web application backends.",
          category: "high_demand",
          matchingPathIds: ["backend_web_product_node", "fullstack_software_engineer"],
          ecosystem: "typescript_node",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.95,
            score: 95,
            tier: "very_high",
            explanation: "Extremely high market demand for TypeScript/Node.js microservices and cloud SaaS backends.",
          },
          rationale: "Fastest path to shipping modern web products with high developer velocity.",
        });
      }

      if (pathIds.has("backend_python_cloud")) {
        options.push({
          id: "cloud_data_services",
          dimension: "target_domain",
          title: "AI Backends, Async APIs & Data Pipelines",
          description:
            "Architect high-throughput asynchronous services, data streaming backends, and AI/ML model serving pipelines.",
          category: "high_demand",
          matchingPathIds: ["backend_python_cloud"],
          ecosystem: "python_fastapi",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.93,
            score: 93,
            tier: "very_high",
            explanation: "Surging industry demand for Python FastAPI backends supporting AI/ML workflows and asynchronous data services.",
          },
          rationale: "Ideal for engineers targeting AI-adjacent engineering, data pipelines, and async cloud architectures.",
        });
      }

      if (pathIds.has("backend_enterprise_java")) {
        options.push({
          id: "enterprise_erp",
          dimension: "target_domain",
          title: "Enterprise Systems, ERP & Financial Workflows",
          description:
            "Build resilient, transactional business systems, modular monoliths, and enterprise data models using Spring Boot.",
          category: "strong_option",
          matchingPathIds: ["backend_enterprise_java"],
          ecosystem: "java_spring",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.9,
            score: 89,
            tier: "high",
            explanation: "Consistently high enterprise and corporate demand for mission-critical transactional platforms.",
          },
          rationale: "Unmatched stability and enterprise job market presence with Java & Spring Boot.",
        });

        options.push({
          id: "fintech_banking",
          dimension: "target_domain",
          title: "FinTech, Payments & Core Banking Systems",
          description:
            "Design ultra-reliable ledger systems, payment rails, reconciliation engines, and secure transaction state machines.",
          category: "strong_option",
          matchingPathIds: ["backend_enterprise_java", "backend_web_product_node"],
          ecosystem: "java_spring",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.88,
            score: 87,
            tier: "high",
            explanation: "Strong hiring across digital banking, payment gateways, and FinTech infrastructure.",
          },
          rationale: "Critical domain focusing on ACID transactions, idempotency, and high compliance standards.",
        });
      }

      if (pathIds.has("fullstack_software_engineer")) {
        options.push({
          id: "fullstack_web",
          dimension: "target_domain",
          title: "Full-Stack Application Engineering",
          description:
            "Span responsive frontends (React / Next.js) and backend persistence APIs to deliver complete user-facing applications.",
          category: "supported_track",
          matchingPathIds: ["fullstack_software_engineer"],
          ecosystem: "typescript_node",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.88,
            score: 85,
            tier: "high",
            explanation: "High demand in startups and scale-ups for engineers who can ship end-to-end features.",
          },
          rationale: "Comprehensive product mastery spanning UI components to SQL relational models.",
        });
      }

      if (pathIds.has("backend_enterprise_java") || pathIds.has("backend_web_product_node")) {
        options.push({
          id: "distributed_event_systems",
          dimension: "target_domain",
          title: "Distributed Systems & Real-Time Event Streams",
          description:
            "Design fault-tolerant event streams, Kafka message queues, consensus protocols, and real-time distributed systems.",
          category: "high_demand",
          matchingPathIds: ["backend_enterprise_java", "backend_web_product_node"],
          ecosystem: "typescript_node",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.94,
            score: 94,
            tier: "very_high",
            explanation: "High market demand for distributed real-time messaging, streaming ETL, and event-driven architectures.",
          },
          rationale: "Mastery of distributed state, partition tolerance, and real-time event-driven data flows.",
        });
      }

      if (pathIds.has("backend_web_product_node") || pathIds.has("backend_python_cloud")) {
        options.push({
          id: "developer_infrastructure_apis",
          dimension: "target_domain",
          title: "Developer Infrastructure & Platform APIs",
          description:
            "Build internal developer platforms, API gateways, automated testing tools, and developer CLI tools.",
          category: "supported_track",
          matchingPathIds: ["backend_web_product_node", "backend_python_cloud"],
          ecosystem: "typescript_node",
          demandSignal: {
            source: "Curated Tech Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.82,
            score: 80,
            tier: "moderate",
            explanation: "Growing specialization in internal developer tooling and platform engineering.",
          },
          rationale: "Deep focus on developer ergonomics, API design standards, and system integrations.",
        });
      }
    }

    // Hardware / VLSI options
    if (pathIds.has("vlsi_design_engineer")) {
      options.push({
        id: "rtl_microarchitecture",
        dimension: "target_domain",
        title: "RTL & Digital Microarchitecture (RISC-V / Compute)",
        description:
          "Design pipelined processors, custom accelerators, and memory controllers in synthesizable SystemVerilog.",
        category: "high_demand",
        matchingPathIds: ["vlsi_design_engineer"],
        ecosystem: "hardware_hdl",
        demandSignal: {
          source: "Semiconductor Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.94,
          score: 94,
          tier: "very_high",
          explanation: "High industry hiring across custom AI silicon, RISC-V cores, and semiconductor front-ends.",
        },
        rationale: "Core front-end IC design discipline with immense industry growth.",
      });

      options.push({
        id: "fpga_acceleration",
        dimension: "target_domain",
        title: "FPGA Emulation & Hardware Acceleration",
        description:
          "Target Xilinx/Intel FPGAs for low-latency trading, compute acceleration, and hardware-in-the-loop verification.",
        category: "strong_option",
        matchingPathIds: ["vlsi_design_engineer"],
        ecosystem: "hardware_hdl",
        demandSignal: {
          source: "Semiconductor Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.88,
          score: 88,
          tier: "high",
          explanation: "Essential for financial trading infrastructure, edge acceleration, and ASIC pre-tapeout validation.",
        },
        rationale: "Fast cycle iteration and immediate physical deployment on programmable logic.",
      });

      options.push({
        id: "asic_physical_design",
        dimension: "target_domain",
        title: "ASIC Physical Design & Tapeout Flow",
        description:
          "Drive RTL through synthesis, static timing analysis (STA), clock tree synthesis, and place & route.",
        category: "strong_option",
        matchingPathIds: ["vlsi_design_engineer"],
        ecosystem: "hardware_hdl",
        demandSignal: {
          source: "Semiconductor Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.85,
          score: 85,
          tier: "high",
          explanation: "Critical for timing closure and physical manufacturing readiness on advanced nodes.",
        },
        rationale: "Translating architectural intent into verified silicon layout.",
      });

      options.push({
        id: "uvm_verification",
        dimension: "target_domain",
        title: "UVM Functional Verification & Testbench Architecture",
        description:
          "Build constraint-random verification environments, functional coverage models, and SystemVerilog assertions.",
        category: "high_demand",
        matchingPathIds: ["vlsi_design_engineer"],
        ecosystem: "hardware_hdl",
        demandSignal: {
          source: "Semiconductor Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.93,
          score: 93,
          tier: "very_high",
          explanation: "Verification engineers represent over 60% of front-end semiconductor engineering headcount.",
        },
        rationale: "Ensuring tapeout silicon is 100% bug-free through rigorous metric-driven verification.",
      });
    }

    // DevOps options
    if (pathIds.has("devops_cloud_engineer")) {
      options.push({
        id: "cloud_platform_infrastructure",
        dimension: "target_domain",
        title: "Cloud Platform & Kubernetes Automation",
        description:
          "Design scalable cloud platforms, Infrastructure as Code with Terraform, and Kubernetes container orchestration.",
        category: "high_demand",
        matchingPathIds: ["devops_cloud_engineer"],
        demandSignal: {
          source: "Cloud Platform Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.96,
          score: 96,
          tier: "very_high",
          explanation: "Continuous high demand across all engineering sectors for cloud infrastructure automation.",
        },
        rationale: "The backbone of modern cloud deployments, automated scaling, and cluster resilience.",
      });

      options.push({
        id: "ci_cd_developer_experience",
        dimension: "target_domain",
        title: "CI/CD & Release Pipeline Engineering",
        description:
          "Build zero-downtime deployment pipelines, automated security scanning, and multi-stage testing workflows.",
        category: "strong_option",
        matchingPathIds: ["devops_cloud_engineer"],
        demandSignal: {
          source: "Cloud Platform Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.89,
          score: 89,
          tier: "high",
          explanation: "Crucial for engineering velocity, compliance checks, and automated artifact publishing.",
        },
        rationale: "Enabling development teams to ship code safely to production hundreds of times per day.",
      });

      options.push({
        id: "sre_observability",
        dimension: "target_domain",
        title: "Site Reliability Engineering (SRE) & Observability",
        description:
          "Architect distributed tracing, Prometheus/Grafana metrics, SLO/SLA error budgets, and automated incident recovery.",
        category: "high_demand",
        matchingPathIds: ["devops_cloud_engineer"],
        demandSignal: {
          source: "Cloud Platform Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.92,
          score: 92,
          tier: "very_high",
          explanation: "High industry demand for SREs guaranteeing high uptime, low latency, and proactive system observability.",
        },
        rationale: "Mission-critical monitoring and resilient fault remediation for cloud services.",
      });

      options.push({
        id: "cloud_security_hardening",
        dimension: "target_domain",
        title: "Cloud Infrastructure Security & CIS Hardening",
        description:
          "Implement CIS benchmarks, IAM least-privilege policies, secret rotation, and automated container image vulnerability scanning.",
        category: "strong_option",
        matchingPathIds: ["devops_cloud_engineer"],
        demandSignal: {
          source: "Cloud Platform Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.9,
          score: 90,
          tier: "high",
          explanation: "Rapid growth in DevSecOps practices integrating automated security into cloud infrastructure.",
        },
        rationale: "Proactive compliance and threat containment across cloud networks.",
      });
    }

    // Cybersecurity options
    if (pathIds.has("cybersecurity_defensive_redteam")) {
      options.push({
        id: "threat_modeling_defensive_hardening",
        dimension: "target_domain",
        title: "Defensive Security, Hardening & Threat Modeling",
        description:
          "Protect enterprise architectures through OWASP threat modeling, defensive controls, and secure code audits.",
        category: "high_demand",
        matchingPathIds: ["cybersecurity_defensive_redteam"],
        demandSignal: {
          source: "Cybersecurity Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.93,
          score: 93,
          tier: "very_high",
          explanation: "Surging demand for proactive defensive engineering and cloud security baselines.",
        },
        rationale: "Essential for safeguarding production environments against critical vulnerabilities.",
      });

      options.push({
        id: "appsec_secure_code",
        dimension: "target_domain",
        title: "Application Security & Secure Code Auditing",
        description:
          "Perform static and dynamic application security testing (SAST/DAST), code vulnerability auditing, and secure SDLC integration.",
        category: "high_demand",
        matchingPathIds: ["cybersecurity_defensive_redteam"],
        demandSignal: {
          source: "Cybersecurity Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.91,
          score: 91,
          tier: "very_high",
          explanation: "High enterprise demand for AppSec specialists reviewing APIs and modern web application codebases.",
        },
        rationale: "Eliminating security flaws early in the software development lifecycle.",
      });

      options.push({
        id: "incident_response_soc",
        dimension: "target_domain",
        title: "Blue Team Incident Response & Network Defense",
        description:
          "Analyze packet traces, configure SIEM detection rules, investigate malware artifacts, and coordinate incident response.",
        category: "strong_option",
        matchingPathIds: ["cybersecurity_defensive_redteam"],
        demandSignal: {
          source: "Cybersecurity Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.88,
          score: 88,
          tier: "high",
          explanation: "Steady requirement for incident handlers and defensive security operations engineers.",
        },
        rationale: "Detecting and containing active network intrusions and security anomalies.",
      });
    }

    // Systems options
    if (pathIds.has("systems_cpp_engineer")) {
      options.push({
        id: "high_performance_systems",
        dimension: "target_domain",
        title: "Low-Latency Systems & High-Performance C++",
        description:
          "Master cache-friendly data structures, concurrent algorithms, and zero-cost abstractions with Modern C++.",
        category: "high_demand",
        matchingPathIds: ["systems_cpp_engineer"],
        ecosystem: "cpp",
        demandSignal: {
          source: "Systems Engineering Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.91,
          score: 91,
          tier: "very_high",
          explanation: "High hiring demand in high-frequency trading, game engines, robotics, and database internals.",
        },
        rationale: "For engineers who demand maximum compute efficiency and direct hardware control.",
      });

      options.push({
        id: "os_systems_programming",
        dimension: "target_domain",
        title: "Operating Systems, Concurrency & Low-Level Toolchains",
        description:
          "Build multi-threaded runtime engines, POSIX system call abstractions, virtual memory allocators, and IPC protocols.",
        category: "strong_option",
        matchingPathIds: ["systems_cpp_engineer"],
        ecosystem: "cpp",
        demandSignal: {
          source: "Systems Engineering Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.87,
          score: 87,
          tier: "high",
          explanation: "Essential foundation for systems infrastructure, container engines, and kernel subsystems.",
        },
        rationale: "Deep mastery of operating system primitives and memory layout.",
      });
    }

    // Sort: high_demand first, then strong_option, then supported_track (within category by demand score)
    const categoryOrder: Record<RecommendationCategory, number> = {
      high_demand: 1,
      strong_option: 2,
      supported_track: 3,
    };

    return options.sort((a, b) => {
      const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
      if (catDiff !== 0) return catDiff;
      return (b.demandSignal?.score || 0) - (a.demandSignal?.score || 0);
    });
  }

  private deriveLanguageOptions(pathIds: Set<string>): RecommendedOption[] {
    const options: RecommendedOption[] = [];

    // Backend / Web candidates
    if (
      pathIds.has("backend_web_product_node") ||
      pathIds.has("fullstack_software_engineer") ||
      pathIds.has("backend_enterprise_java") ||
      pathIds.has("backend_python_cloud")
    ) {
      if (pathIds.has("backend_web_product_node") || pathIds.has("fullstack_software_engineer")) {
        options.push({
          id: "typescript_node",
          dimension: "primary_language",
          title: "TypeScript / Node.js",
          description:
            "Type-safe, modern asynchronous runtime. Universal standard for web APIs, microservices, and full-stack applications.",
          category: "high_demand",
          matchingPathIds: ["backend_web_product_node", "fullstack_software_engineer"],
          ecosystem: "typescript_node",
          demandSignal: {
            source: "Language Ecosystem Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.95,
            score: 95,
            tier: "very_high",
            explanation: "Industry-leading popularity for web backends, serverless functions, and modern product engineering.",
          },
          rationale: "Seamless ecosystem bridging client and server with exceptional developer tooling.",
        });
      }

      if (pathIds.has("backend_python_cloud")) {
        options.push({
          id: "python_fastapi",
          dimension: "primary_language",
          title: "Python (FastAPI / Async)",
          description:
            "Elegant, expressive language with high-performance async frameworks, type hints, and deep AI/data ecosystem support.",
          category: "high_demand",
          matchingPathIds: ["backend_python_cloud"],
          ecosystem: "python_fastapi",
          demandSignal: {
            source: "Language Ecosystem Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.94,
            score: 94,
            tier: "very_high",
            explanation: "Top tier adoption for async web APIs, data streaming, and machine learning infrastructure.",
          },
          rationale: "Rapid API development combined with modern asyncio concurrency primitives.",
        });
      }

      if (pathIds.has("backend_enterprise_java")) {
        options.push({
          id: "java_spring",
          dimension: "primary_language",
          title: "Java (Spring Boot)",
          description:
            "Robust object-oriented language with strict static typing, JVM performance optimizations, and transactional maturity.",
          category: "strong_option",
          matchingPathIds: ["backend_enterprise_java"],
          ecosystem: "java_spring",
          demandSignal: {
            source: "Language Ecosystem Index 2026",
            observedAt: "2026-Q1",
            confidence: 0.9,
            score: 88,
            tier: "high",
            explanation: "Massive global footprint in enterprise, banking, and government software systems.",
          },
          rationale: "Unrivaled ecosystem stability and battle-tested transactional frameworks.",
        });
      }
    }

    // DevOps options
    if (pathIds.has("devops_cloud_engineer")) {
      options.push({
        id: "python_automation",
        dimension: "primary_language",
        title: "Python (Automation & Cloud SDKs)",
        description:
          "Universal language for cloud platform automation, boto3/AWS SDKs, Kubernetes client libraries, and infrastructure scripts.",
        category: "high_demand",
        matchingPathIds: ["devops_cloud_engineer"],
        ecosystem: "python_fastapi",
        demandSignal: {
          source: "Cloud Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.95,
          score: 95,
          tier: "very_high",
          explanation: "Premier scripting and automation language across all major cloud providers and DevOps tooling.",
        },
        rationale: "Expressive scripting with massive ecosystem of cloud and infrastructure libraries.",
      });

      options.push({
        id: "golang_cloud_native",
        dimension: "primary_language",
        title: "Go / Golang (Cloud Native & Kubernetes)",
        description:
          "Fast, compiled language powering Docker, Kubernetes, Terraform, Prometheus, and modern platform tooling.",
        category: "high_demand",
        matchingPathIds: ["devops_cloud_engineer"],
        ecosystem: "agnostic",
        demandSignal: {
          source: "Cloud Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.93,
          score: 93,
          tier: "very_high",
          explanation: "De facto language of cloud-native infrastructure, custom K8s operators, and high-concurrency tooling.",
        },
        rationale: "Simple concurrency model and fast compilation for standalone platform binaries.",
      });

      options.push({
        id: "bash_shell_scripting",
        dimension: "primary_language",
        title: "Bash & Linux Shell Scripting",
        description:
          "Direct OS-level scripting, CI/CD pipeline automation, container entrypoints, and environment provisioning.",
        category: "strong_option",
        matchingPathIds: ["devops_cloud_engineer"],
        ecosystem: "agnostic",
        demandSignal: {
          source: "Cloud Ecosystem Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.88,
          score: 87,
          tier: "high",
          explanation: "Essential core skill for every platform engineer, CI/CD runner, and Linux system administrator.",
        },
        rationale: "Ubiquitous in every Linux terminal, Docker image, and GitHub Actions workflow.",
      });
    }

    // Cybersecurity options
    if (pathIds.has("cybersecurity_defensive_redteam")) {
      options.push({
        id: "python_security",
        dimension: "primary_language",
        title: "Python (Security Tooling & Exploits)",
        description:
          "Build automated vulnerability scanners, network packet injectors with Scapy, and defensive log analysis pipelines.",
        category: "high_demand",
        matchingPathIds: ["cybersecurity_defensive_redteam"],
        ecosystem: "python_fastapi",
        demandSignal: {
          source: "Cybersecurity Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.94,
          score: 94,
          tier: "very_high",
          explanation: "Most popular language for custom security tooling, threat intelligence, and automation.",
        },
        rationale: "Rapid security script development with rich network and cryptography libraries.",
      });

      options.push({
        id: "cpp_security",
        dimension: "primary_language",
        title: "C / C++ (Binary Analysis & Memory Safety)",
        description:
          "Understand memory management, buffer overflows, pointer mechanics, and defensive compiler flags.",
        category: "strong_option",
        matchingPathIds: ["cybersecurity_defensive_redteam"],
        ecosystem: "cpp",
        demandSignal: {
          source: "Cybersecurity Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.89,
          score: 89,
          tier: "high",
          explanation: "Critical for reverse engineering, exploit analysis, and low-level vulnerability research.",
        },
        rationale: "Direct memory model mastery is necessary to identify and remediate memory safety exploits.",
      });

      options.push({
        id: "bash_powershell_security",
        dimension: "primary_language",
        title: "Bash & PowerShell (Host Auditing)",
        description:
          "Automate system auditing, privilege escalation checks, and endpoint compliance verification scripts.",
        category: "strong_option",
        matchingPathIds: ["cybersecurity_defensive_redteam"],
        ecosystem: "agnostic",
        demandSignal: {
          source: "Cybersecurity Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.86,
          score: 86,
          tier: "high",
          explanation: "Essential for Windows Active Directory auditing and Linux security baseline validation.",
        },
        rationale: "Native scriptability on target operating systems without installing external runtimes.",
      });
    }

    // Hardware HDL
    if (pathIds.has("vlsi_design_engineer")) {
      options.push({
        id: "systemverilog",
        dimension: "primary_language",
        title: "SystemVerilog / Verilog",
        description:
          "The global standard Hardware Description Language (HDL) for digital ASIC design, RTL synthesis, and UVM verification.",
        category: "high_demand",
        matchingPathIds: ["vlsi_design_engineer"],
        ecosystem: "hardware_hdl",
        demandSignal: {
          source: "Semiconductor Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.96,
          score: 96,
          tier: "very_high",
          explanation: "Universal prerequisite for commercial ASIC/FPGA design and verification roles.",
        },
        rationale: "Mandatory language for synthesizable RTL and modern testbench methodologies.",
      });

      options.push({
        id: "vhdl",
        dimension: "primary_language",
        title: "VHDL",
        description:
          "Strongly-typed hardware description language extensively used in aerospace, defense, and high-reliability FPGA designs.",
        category: "strong_option",
        matchingPathIds: ["vlsi_design_engineer"],
        ecosystem: "hardware_hdl",
        demandSignal: {
          source: "Semiconductor Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.82,
          score: 82,
          tier: "moderate",
          explanation: "High regional and domain demand in avionics, space systems, and defense contractors.",
        },
        rationale: "Strict typing prevents subtle hardware bugs in mission-critical applications.",
      });
    }

    // Systems C++
    if (pathIds.has("systems_cpp_engineer")) {
      options.push({
        id: "modern_cpp",
        dimension: "primary_language",
        title: "Modern C++ (C++17 / C++20)",
        description:
          "High-performance systems language with RAII, zero-cost abstractions, template metaprogramming, and precise memory control.",
        category: "high_demand",
        matchingPathIds: ["systems_cpp_engineer"],
        ecosystem: "cpp",
        demandSignal: {
          source: "Systems Index 2026",
          observedAt: "2026-Q1",
          confidence: 0.92,
          score: 92,
          tier: "very_high",
          explanation: "Essential for performance-critical backends, robotics, game engines, and OS components.",
        },
        rationale: "Direct memory access with modern language safety features.",
      });
    }

    const categoryOrder: Record<RecommendationCategory, number> = {
      high_demand: 1,
      strong_option: 2,
      supported_track: 3,
    };

    return options.sort((a, b) => {
      const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
      if (catDiff !== 0) return catDiff;
      return (b.demandSignal?.score || 0) - (a.demandSignal?.score || 0);
    });
  }

  private deriveArchitectureOptions(pathIds: Set<string>): RecommendedOption[] {
    const options: RecommendedOption[] = [];

    options.push({
      id: "microservices",
      dimension: "architecture_preference",
      title: "Microservices & Distributed Systems",
      description:
        "Independent deployable services communicating via REST, gRPC, and asynchronous event streams (Redis, Kafka).",
      category: "high_demand",
      matchingPathIds: Array.from(pathIds),
      demandSignal: {
        source: "Architecture Index 2026",
        observedAt: "2026-Q1",
        confidence: 0.92,
        score: 92,
        tier: "very_high",
        explanation: "Standard pattern for high-scale cloud platforms and multi-team engineering organizations.",
      },
      rationale: "High scalability, decoupled deployments, and fault isolation.",
    });

    options.push({
      id: "modular_monolith",
      dimension: "architecture_preference",
      title: "Modular Monolith & Strong Transactional Domains",
      description:
        "Unified codebase with strict internal domain boundaries, relational data integrity, and simplified operations.",
      category: "strong_option",
      matchingPathIds: Array.from(pathIds),
      demandSignal: {
        source: "Architecture Index 2026",
        observedAt: "2026-Q1",
        confidence: 0.88,
        score: 88,
        tier: "high",
        explanation: "Resurgent architecture of choice for high transactional consistency and fast early iteration.",
      },
      rationale: "Simpler deployment with clear architectural boundaries and ACID consistency.",
    });

    return options;
  }
}

export class RecommendationEngine {
  private provider: ExplorationProvider;

  constructor(provider: ExplorationProvider = new CatalogExplorationProvider()) {
    this.provider = provider;
  }

  /**
   * Generates structured exploration options for a delegated learner dimension.
   * Invariant: Demand signals order options but NEVER grant eligibility.
   */
  public async generateRecommendation(
    context: ExplorationContext
  ): Promise<RecommendationDecision | null> {
    const options = await this.provider.getOptions(context);
    if (!options || options.length === 0) {
      return null;
    }

    const mode =
      context.dimension === "primary_language" || context.dimension === "language"
        ? "technology_selection"
        : context.dimension === "architecture_preference" || context.dimension === "architecture"
        ? "architecture_selection"
        : "domain_selection";

    const titlePrefix =
      context.declaredTargetRole && context.declaredTargetRole !== "undefined"
        ? `${this.formatTitle(context.declaredTargetRole)} Directions`
        : "Recommended Directions";

    const promptTitle =
      mode === "technology_selection"
        ? `Choose Your Primary Programming Ecosystem`
        : mode === "architecture_selection"
        ? `Choose Your Preferred Architecture Style`
        : `${titlePrefix}`;

    const promptDescription =
      mode === "technology_selection"
        ? "Here are the supported programming languages and toolchains for your career track, ranked by market demand:"
        : mode === "architecture_selection"
        ? "Here are the supported architectural methodologies for your path, with high-demand patterns highlighted:"
        : "Not sure which domain to focus on? Here are the supported specialization tracks currently available in the PathFinder catalog, highlighted by industry demand:";

    return {
      mode,
      dimension: context.dimension,
      promptTitle,
      promptDescription,
      options,
    };
  }

  private formatTitle(raw: string): string {
    return raw
      .replace(/_/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
}

export const recommendationEngine = new RecommendationEngine();
