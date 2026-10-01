# PathForge

> **Evidence-Driven Adaptive Career & Learning Path Navigator**  
> *An AI learning companion that asks before it advises, calculates explicit confidence, and continuously adapts your route as you build real work.*

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Zod Validated](https://img.shields.io/badge/Validation-Zod_Schemas-3E67B1?style=flat)](https://zod.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.txt)

---

## Overview

Most career guidance and learning platforms generate generic, static roadmaps from vague prompts. If someone says *"I want to be a backend developer and know HTTP,"* typical tools dump an undifferentiated Node.js tutorial list—even if the learner has five years of Java experience, wants to work on enterprise financial ledgers, or has only 6 hours a week.

**PathForge** is designed around a fundamental architectural contract:

> **The LLM interprets and explains. Deterministic application services own identity, authorization, stored facts, Bayesian confidence, state gating, skill-graph traversal, workload feasibility, and final recommendations.**

PathForge gathers evidence through natural dialogue, asks the highest-value clarification questions using information gain, computes deterministic confidence across decision dimensions, and only produces a committed path once explicit criteria are met. As the learner completes real projects and shares reflections, PathForge continuously adapts the roadmap.

---

## Core Feature Catalog

### 1. Conversational Intake & Adaptive Clarification
- **Natural Language Goal Intake:** Enter free-text goals, background details, constraints, and past experience in plain English.
- **Information-Gain Question Selection:** Rather than querying randomly, PathForge calculates entropy reduction ($IG(q) = H(P) - \sum P(\text{ans}) H(P|\text{ans})$) and utility scores to ask the single most informative clarification question.
- **Bounded Question Budget:** Limits clarification questions to a maximum budget ($\le 6$ questions) so users never feel trapped in an endless questionnaire.
- **Contextual Suggested Chips:** Automatically generates context-aware, sanitized quick-reply chips for fast interaction on mobile or desktop.
- **Transparent Reasoning Disclosures:** An expandable reasoning panel for every assistant response reveals *why* a question is being asked, which dimensions remain missing, and how confidence was calculated.

### 2. Deterministic Bayesian Intent Confidence & Readiness Gating
- **Bayesian Path Scoring:** Maintains candidate hypotheses with configured priors and applies log-likelihood updates based on extracted evidence reliability, relevance, and polarity.
- **Multifactor Confidence Formula:** Computes overall intent confidence deterministically:
  $$\text{Intent Confidence} = \text{Top Posterior Probability} \times \text{Coverage} \times \text{Consistency} \times \text{Evidence Quality}$$
- **Formal State Gating:**
  - `clarifying`: Missing material decision dimensions, low coverage, or unresolved contradictions.
  - `provisional`: Sufficient preliminary confidence ($\ge 0.55$) or question budget exhausted; delivers a workable draft clearly labeled with default assumptions.
  - `ready`: Meets strict thresholds (top posterior $\ge 0.80$, coverage $\ge 0.75$, consistency $\ge 0.80$, zero missing high-impact dimensions).
  - `confirmed`: Formally acknowledged and locked by the learner.

### 3. Dynamic Evidence Engine & User Work Model
- **Attributable Facts & Provenance Ledger:** Every extracted fact is tagged with its source, timestamp, reliability score, impact level, and status (`active`, `weakening`, `contradicted`, `superseded`, or `revoked`).
- **Strict Source Precedence:**
  $$\text{User Correction (6.0)} > \text{User Answer (5.0)} > \text{Assessment Evidence (4.0)} > \text{Reflection (3.5)} > \text{Artifact (3.0)} > \text{Self-Report (2.0)} > \text{LLM Inference (1.0)}$$
- **Non-Destructive Supersession:** Earlier facts are never silently deleted; superseded facts maintain a traceable audit trail with linked provenance.
- **Contradiction Detection:** Evaluates conflicting signals (e.g., *"I dislike Java"* vs. *"I want enterprise banking"*) and applies automated consistency score penalties until reconciled.
- **Comprehensive User Work Model:** Tracks capabilities, activity affinities, work style characteristics, and negative signals.

### 4. Single-Phase Adaptive Planning & Reflection Lifecycle
- **Anti-Hallucination Phased Planning:** Rather than generating 10 speculative future phases upfront, PathForge generates **Phase 1**—a concrete, focused learning intervention.
- **Practical Projects with Verification Checklists:** Each phase features hands-on project deliverables with tangible criteria, domain context, and verification checklists.
- **Structured Reflection Engine:** Upon project completion, learners submit deliverables and qualitative reflections (engagement, difficulty, energy, pivot desire).
- **Decision Engine (Commit, Disambiguate, Explore):** Analyzes reflection signals and evidence to determine phase disposition:
  - `continue`: Deepen current trajectory.
  - `complete`: Advance to the next sequentially unlocked milestone.
  - `supersede`: Pivot or adapt the learning route when explicit rejection or accumulated friction is detected.
- **Journey History:** A visual history panel displaying all completed, adapted, and superseded phases.

### 5. Goal Divergence Detection & Confirmation
- **Guarded Goal Mutation:** If a learner mentions a new role mid-conversation (e.g., switches from *"Software Engineer"* to *"Mobile App Developer"*), PathForge avoids naive goal overwriting.
- **Goal Confirmation Gate:** Detects the divergence, retains the active profile state, and prompts a `confirm_goal_change` question with structured `pendingGoalChange` tracking.

### 6. Delegated Discovery & Market-Demand Recommendations
- **Exploration for Undecided Learners:** Handles open-ended answers like *"I have no idea what career I want"* or *"Not sure yet / Open to suggestions."*
- **Live Market Demand Signals:** Displays curated role specializations categorized by real-world industry demand (`very_high`, `high`, `moderate`, `niche`), including market confidence and growth rationale.
- **Multi-Track Exploration:** Allows learners to browse and compare domains, technologies, and architectures before locking in a path.

### 7. Interactive Career Map (Visual DAG & Skill Tree)
- **Interactive SVG Canvas:** Smooth pan (drag), zoom (wheel and dedicated controls), and an automated "Center on Current Position" camera.
- **Dynamic Node State Styling:** Nodes visually reflect learner progress:
  - *Foundational* (Level 1-2 core competencies)
  - *In Progress* (Active learning phase)
  - *Unlocked* (Prerequisites satisfied)
  - *Completed* (Verified by project or assessment)
  - *Skipped* (Demonstrated prior proficiency)
  - *Dependent / Locked* (Prerequisites pending)
- **Node Details Slide-Out:** Click any node to inspect descriptions, difficulty levels, target ecosystems, evidence criteria, and prerequisite chains.
- **"Ask AI About This Skill":** Instant one-click button in the node details panel to query how that specific skill connects to the broader career journey.

### 8. Skill Matrix & Competency Diagnostic Quizzes
- **Proficiency Matrix:** Visual inventory of skills categorizing claimed vs. verified capability levels (`novice`, `working`, `proficient`, `advanced`).
- **In-App Diagnostic Quiz Modal:** Interactive assessment engine featuring tailored technical questions.
- **Dynamic Prerequisite Pruning:** Passing a diagnostic assessment automatically updates the skill status to `assessed_diagnostic` and removes redundant beginner milestones from the roadmap.

### 9. Non-Destructive What-If Scenario Studio
- **Branch Without Mutating:** Fork the active roadmap into isolated what-if simulation branches.
- **Parameter Sliders:** Adjust weekly study availability (hours/week), target completion deadlines, or shift technology specializations.
- **Visual Scenario Diffing:** Calculates hours delta, weeks delta, added skills, and removed skills side-by-side against the baseline plan.
- **One-Click Adoption:** Seamlessly promote any simulated scenario to become the primary active roadmap.

### 10. Fact Inspector & Provenance Ledger Modal
- **Inspect Stored Facts:** View all active, superseded, or revoked facts extracted by the system.
- **Live Fact Corrections:** Modify any fact directly within the UI to trigger an immediate recalculation of hypotheses and roadmap recommendations.
- **Fact Revocation:** Revoke incorrectly attributed facts with immediate state re-scoring.

### 11. Multi-Provider LLM Gateway & Resilient Offline Fallback
- **Multi-Model Provider Support:**
  - **Google Gemini** (Gemini 2.5 Flash, 1.5 Pro)
  - **Groq** (Ultra-low latency Llama 3.3 70B Versatile)
  - **OpenAI** (GPT-4o, GPT-4o-mini)
  - **Deterministic Rule Engine** (100% offline, zero external API keys required)
- **Graceful Error Recovery:** Built-in error banners in the chat provide one-click buttons to *"Switch to Deterministic Engine"* or *"Retry Last Action"* in the event of API rate limits or network failures.
- **Strict Schema Enforcement:** All LLM outputs are validated against Zod contracts with automated bounded repair.

### 12. Uncatalogued Curriculum Discovery (10 Validation Gates)
- **Autonomous Curriculum Synthesis:** When a learner declares a role outside the seeded catalog (e.g., Quantum Computing, Bioinformatics, Robotics), PathForge proposes a custom curriculum.
- **10 Deterministic Structural Gates:** Every proposed curriculum must pass 10 strict validation gates before presentation:
  1. *Schema Integrity Gate:* All required fields, metadata, and IDs present.
  2. *Intent Relevance Gate:* Skill tokens match domain objective tokens; rejects generic tool-only lists.
  3. *Skill Distribution Gate:* Enforces between 4 and 25 skills across foundational and advanced levels.
  4. *Edge Referential Integrity Gate:* Zero dangling prerequisite edges.
  5. *DAG Acyclicity Gate:* Strict topological sort ensuring zero circular dependencies.
  6. *Level Inversion Gate:* Prerequisites cannot require a higher difficulty level than their dependent skills.
  7. *Resource Attachment Gate:* Minimum 50% coverage of core skills with valid external resources.
  8. *Practical Verification Gate:* At least one project with verifiable deliverables and validation checklists.
  9. *Workload Bounds Gate:* Realistic total learning effort between 40 and 600 hours.
  10. *Ecosystem Isolation Gate:* Prevents cross-ecosystem contamination (e.g., no Java skills in a pure Python track).

### 13. Multi-Learner Workspaces & Persona Management
- **Instant Workspace Switching:** Switch between different learner profiles (e.g., personal, guest sandbox, sample personas).
- **Custom Profile Creation:** Create new learner profiles stored in browser storage.
- **One-Click Reset:** Clean wipe feature to start fresh with a clean slate.

---

## Supported Seeded Career Tracks

PathForge comes pre-seeded with 8 comprehensive, production-grade technical career tracks:

| Track ID | Track Name | Technology Ecosystem | Key Domains & Specializations |
| :--- | :--- | :--- | :--- |
| `backend_enterprise_java` | **Enterprise Java & ERP Systems Architect** | `java_spring` | Spring Boot, Relational Modeling, Transactional State Machines, ERP Integrations |
| `fullstack_software_engineer` | **Full-Stack Web & Applications Engineer** | `agnostic` | React, TypeScript, Node.js / Java, REST APIs, SQL, Client-Server Architecture |
| `systems_cpp_engineer` | **Systems & High-Performance C++ Engineer** | `cpp` | Modern C++ (17/20), RAII, Smart Pointers, Linux Networking, Low-Level Concurrency |
| `backend_web_product_node` | **Modern Web Product & Node.js Engineer** | `typescript_node` | TypeScript, Node.js Event Loop, Fastify/Express, PostgreSQL, Redis, Realtime WebSockets |
| `backend_python_cloud` | **Python Cloud & Async Services Developer** | `python_fastapi` | Python, FastAPI, AsyncIO, SQLAlchemy, Alembic, Celery, Redis Queues, AWS |
| `devops_cloud_engineer` | **DevOps & Cloud Platform Infrastructure Engineer** | `agnostic` | Linux Fundamentals, Docker, Kubernetes, CI/CD Pipelines, Infrastructure as Code, AWS Hardening |
| `cybersecurity_defensive_redteam` | **Ethical Security & Defensive Red-Team Engineer** | `agnostic` | OWASP Top 10, Threat Modeling, Authorized Lab Ethics, Vulnerability Scanning, Network Analysis |
| `vlsi_design_engineer` | **VLSI & Digital IC Design Engineer** | `hardware_hdl` | SystemVerilog / Verilog, RISC-V Microarchitecture, FPGA Synthesis, Static Timing Analysis (STA), ASIC Flow |

---

## System Architecture

```text
                           +---------------------------------------+
                           |           Next.js 16 Web UI           |
                           |   Career Map · Chat · Matrix · Studio |
                           +-------------------+-------------------+
                                               |
                                     HTTP / REST API (Zod DTOs)
                                               |
                           +-------------------v-------------------+
                           |            API Route Handlers          |
                           |           /api/v1/* Endpoints         |
                           +-------------------+-------------------+
                                               |
                           +-------------------v-------------------+
                           |          Learning Orchestrator        |
                           |   State Machine & Transaction Root    |
                           +---------+-------------------+---------+
                                     |                   |
            +------------------------v----+         +----v------------------------+
            |        Domain Engines       |         |       Infrastructure        |
            |  - FactPrecedenceEngine     |         |  - Repositories (Profile,   |
            |  - HypothesisEngine         |         |    Roadmap, Phase, Scenario)|
            |  - IntentConfidenceService  |         |  - LlmGateway (Gemini,      |
            |  - QuestionSelector         |         |    Groq, OpenAI, Offline)   |
            |  - FeasibilityEvaluator     |         |  - TransactionCoordinator   |
            |  - CurriculumVerifier       |         |  - Audit & Provenance Log   |
            |  - DecisionEngine           |         +-----------------------------+
            |  - EvidenceEngine           |
            +-----------------------------+
```

### Architectural Layering Rules
- **Web (`src/components/`, `app/`):** Presentation, local component state, user interaction. Never contains business logic, scoring formulas, or direct DB queries.
- **Application (`src/lib/application/`):** Use-case orchestration, state machine transitions, global invariant enforcement, transaction coordination.
- **Domain (`src/lib/domain/`):** Pure deterministic business rules. Zero dependencies on external frameworks, databases, HTTP clients, or LLM providers.
- **LLM (`src/lib/llm/`):** Provider adapters (Gemini, Groq, OpenAI, Deterministic) conforming to typed output schemas validated with Zod.
- **Persistence (`src/lib/persistence/`):** Repositories, audit ledgers, and seed datasets.

---

## REST API Reference

All endpoints are versioned under `/api/v1`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/intake/messages` | Processes a chat message or goal declaration through the intake pipeline. |
| `GET` | `/api/v1/profiles/me` | Retrieves the active learner profile, intent state, and active roadmap. |
| `DELETE` | `/api/v1/profiles/me` | Resets the current learner profile back to a clean state. |
| `POST` | `/api/v1/profiles/me/answers` | Submits an answer to a clarification question. |
| `PATCH` | `/api/v1/profiles/me/facts/:factId` | Corrects an existing profile fact and triggers reactive re-scoring. |
| `DELETE` | `/api/v1/profiles/me/facts/:factId` | Revokes a profile fact and recalculates hypotheses. |
| `POST` | `/api/v1/profiles/me/phases/:phaseId/submit` | Submits a completed project deliverable and reflection for adaptive re-planning. |
| `GET` | `/api/v1/profiles/me/roadmaps/history` | Fetches historical and saved roadmaps for the current learner. |
| `GET` | `/api/v1/roadmaps/:roadmapId` | Retrieves full roadmap details by ID. |
| `POST` | `/api/v1/assessments/:assessmentId/attempts` | Submits a diagnostic quiz result to update competency verification. |
| `POST` | `/api/v1/scenarios` | Creates a non-destructive what-if simulation scenario. |
| `GET` | `/api/v1/scenarios` | Retrieves all what-if scenarios for the current learner. |
| `GET` | `/api/v1/audit` | Retrieves the system reasoning history and audit ledger. |

---

## Getting Started

### Prerequisites
- **Node.js:** `v20.x` or higher
- **Package Manager:** `npm`, `pnpm`, or `yarn`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/trishank-alt/Path-Forge.git
   cd Path-Forge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables (Optional):**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your preferred API key:
   ```env
   # Google Gemini (Default Server Provider)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Or Groq (Ultra-fast inference)
   GROQ_API_KEY=your_groq_api_key_here

   # Or OpenAI
   OPENAI_API_KEY=your_openai_api_key_here

   # Optional defaults
   # PATHFINDER_LLM_PROVIDER=gemini
   # PATHFINDER_LLM_MODEL=gemini-2.5-flash
   ```

   > [!NOTE]
   > **Zero Keys Needed for Evaluation:** If no API keys are provided, PathForge automatically defaults to its built-in **Deterministic Rule Engine**. You can explore all UI features, clarification flows, and roadmaps completely offline! You can also enter API keys directly in the in-app **Settings Modal** anytime.

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build and Run for Production:**
   ```bash
   npm run build
   npm start
   ```

---

## Deployment Guide

PathForge is production-ready and can be deployed anywhere Next.js 16 is supported:

### Option 1: Vercel (One-Click Serverless)

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the project into [Vercel](https://vercel.com/new).
3. Under **Environment Variables**, optionally add `GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY`. (If omitted, the app automatically runs its deterministic offline engine).
4. Click **Deploy**. Vercel will build and host your app with global edge CDN routing.

### Option 2: Docker Container (Render, Fly.io, Cloud Run, AWS ECS, Railway)

A multi-stage, hardened, non-root `Dockerfile` and `docker-compose.yml` are included.

1. **Build the container image:**
   ```bash
   docker build -t pathforge:latest .
   ```

2. **Run the container:**
   ```bash
   docker run -d -p 3000:3000 \
     -e NODE_ENV=production \
     -e GEMINI_API_KEY=your_key_here \
     pathforge:latest
   ```

3. **Or launch via Docker Compose:**
   ```bash
   docker compose up -d
   ```

### Option 3: Self-Hosted Node.js / VPS (PM2 or systemd)

1. Clone and install dependencies:
   ```bash
   npm ci
   ```
2. Build the optimized production application:
   ```bash
   npm run build
   ```
3. Start the server (with PM2 for process auto-restart):
   ```bash
   pm2 start npm --name "pathforge" -- start
   ```

### Health Check & Monitoring Probe

PathForge exposes a zero-dependency health check endpoint for container orchestrators (Kubernetes, AWS ALB, GCP Cloud Run, Docker healthchecks):

- **Endpoint:** `GET /api/health`
- **Sample Response:**
  ```json
  {
    "status": "ok",
    "uptime": 1284,
    "timestamp": "2026-10-01T11:13:14.857Z",
    "version": "0.1.0",
    "environment": "production",
    "llm": {
      "activeProvider": "deterministic",
      "isCustomKeyConfigured": false
    }
  }
  ```

---

## Verification & Testing

PathForge includes a comprehensive automated test suite covering state routing, intent classification, curriculum discovery, and runtime invariants:

```bash
# Run the core invariant verification test suite
npm test

# Run the complete end-to-end regression test suite
npm run test:all

# Run linting check
npm run lint
```

### Key Verified Invariants
- **Single-Phase Evolution:** Intake produces strictly one active phase (Phase 1) rather than hallucinated speculative roadmaps.
- **DAG Acyclicity:** All proposed and catalog skill graphs are strictly checked for zero circular dependencies.
- **Goal Invalidation Guard:** Mid-flow goal changes trigger confirmation rather than silent fact destruction.
- **Precedence Integrity:** Lower-precedence inferences never overwrite verified user corrections.

---

## Technology Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server-side API Routes)
- **UI & Components:** [React 19](https://react.dev/), [Vanilla CSS & Tailwind CSS 4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Validation:** [Zod 4](https://zod.dev/)
- **Runtime:** Node.js 20+ with TypeScript 5 (Strict Mode)

---

## License

This project is licensed under the MIT License - see the [LICENSE.txt](./LICENSE.txt) file for details.
