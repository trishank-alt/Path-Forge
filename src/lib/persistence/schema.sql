-- ====================================================================
-- PathForge Evidence-Driven Adaptive Planning System — PostgreSQL Schema
-- ====================================================================
-- Enables full reconstruction of reasoning history:
-- What did we know? When did we know it? Why did we believe it?
-- What happened afterward? How did that change the next decision?
-- ====================================================================

-- 1. Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    goal_text TEXT NOT NULL DEFAULT '',
    declared_target_role VARCHAR(255),
    selected_path_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Evidence (The Authoritative Historical Source of Truth)
CREATE TABLE IF NOT EXISTS evidence (
    id VARCHAR(64) PRIMARY KEY,
    profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    dimension VARCHAR(128) NOT NULL,
    signal JSONB NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(64) NOT NULL, -- user_correction, user_answer, assessment_evidence, experiment_observation, reflection, linked_artifact, self_report, llm_inference
    quality NUMERIC(4, 3) NOT NULL CHECK (quality >= 0 AND quality <= 1),
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, weakening, contradicted, superseded, revoked
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb, -- sourceEventId, originalText, extractedBy, priorEvidenceId, derivationRule
    supported_target_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    contradicted_target_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_profile_dim ON evidence(profile_id, dimension);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence(created_at);

-- 3. Decisions (Planning Decisions & Provenance)
CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(64) PRIMARY KEY,
    profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    mode VARCHAR(32) NOT NULL, -- commit, disambiguate, explore
    phase_disposition VARCHAR(32) NOT NULL DEFAULT 'continue', -- continue, complete, supersede
    primary_objective TEXT NOT NULL,
    target_candidate_direction VARCHAR(255),
    previous_active_phase_id VARCHAR(64),
    created_phase_id VARCHAR(64),
    active_question JSONB,
    active_experiment JSONB,
    rationale TEXT NOT NULL,
    evidence_considered JSONB NOT NULL DEFAULT '[]'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_profile ON decisions(profile_id, timestamp DESC);

-- 4. Phases (Adaptive Roadmap Phases — Next-Phase-Only Generation)
CREATE TABLE IF NOT EXISTS phases (
    id VARCHAR(64) PRIMARY KEY,
    profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    phase_number INT NOT NULL CHECK (phase_number >= 1),
    objective TEXT NOT NULL,
    duration_weeks INT NOT NULL,
    total_hours INT NOT NULL,
    weekly_hours INT NOT NULL,
    capability_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    activity_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    characteristic_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    activities JSONB NOT NULL DEFAULT '[]'::jsonb,
    project JSONB,
    evidence_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision_point JSONB NOT NULL DEFAULT '{}'::jsonb,
    resources JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, superseded, planned, adapted
    explanation TEXT,
    created_by_decision_id VARCHAR(64),
    superseded_by_decision_id VARCHAR(64),
    superseded_at TIMESTAMPTZ,
    supersession_reason TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_profile ON phases(profile_id, phase_number);

-- 5. User Work Models (Materialized/Rebuildable Derived State)
CREATE TABLE IF NOT EXISTS user_work_models (
    profile_id VARCHAR(64) PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    activities JSONB NOT NULL DEFAULT '{}'::jsonb,
    work_characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    uncertainties JSONB NOT NULL DEFAULT '[]'::jsonb,
    negative_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Domain Relationships (Graph Data Model in Relational Storage)
CREATE TABLE IF NOT EXISTS domain_relationships (
    id VARCHAR(64) PRIMARY KEY,
    source_id VARCHAR(128) NOT NULL,
    source_type VARCHAR(64) NOT NULL, -- role, capability, activity, experiment, phase, evidence
    target_id VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL, -- role, capability, activity, experiment, phase, evidence
    relationship_type VARCHAR(64) NOT NULL, -- requires, involves, depends_on, supports, contradicts, produces, targets
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON domain_relationships(source_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON domain_relationships(target_id, relationship_type);
