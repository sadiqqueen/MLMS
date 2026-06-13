// backend/utils/initiativeCheckpoints.js
// Single source of truth for the approval-checkpoint KEYS that belong to each
// initiative stage. The Initiative model stores ONLY these keys (never the
// Arabic/English labels) — the frontend localizes them. Shared by the schema
// and the routes so a checkpoint key can never be set on a stage it doesn't
// belong to.

const STAGE_CHECKPOINTS = {
  under_study: ['conceptDraft', 'execAdvisory'],
  foundational: ['conceptApproved', 'feasibility', 'sgApproval', 'execAdvisory', 'execOffice'],
  final: ['foundingCommittee', 'sgApprovalCommittee', 'guidePrepared', 'guideApproved', 'programAnnounced'],
};

// Ordered list of stages (also the Kanban left→right / RTL order).
const STAGES = Object.keys(STAGE_CHECKPOINTS);

const LEVELS = ['primary', 'subspecialty'];

const CHECKPOINT_STATUSES = ['pending', 'done'];

// Every valid checkpoint key across all stages, deduped (execAdvisory appears
// in two stages but is one logical key).
const ALL_CHECKPOINT_KEYS = [...new Set(Object.values(STAGE_CHECKPOINTS).flat())];

function isValidStage(stage) {
  return STAGES.includes(stage);
}

function isValidCheckpointForStage(stage, key) {
  return Array.isArray(STAGE_CHECKPOINTS[stage]) && STAGE_CHECKPOINTS[stage].includes(key);
}

module.exports = {
  STAGE_CHECKPOINTS,
  STAGES,
  LEVELS,
  CHECKPOINT_STATUSES,
  ALL_CHECKPOINT_KEYS,
  isValidStage,
  isValidCheckpointForStage,
};
