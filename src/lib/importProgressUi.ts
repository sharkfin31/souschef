import type { ImportJobSnapshot } from '@/services/api/recipeApi';

export type StageTrailEntry = { stage: string; label: string };

/**
 * Build a short history of server stages: append when `stage` changes,
 * otherwise refresh the label for the current stage (e.g. percent-only tweaks).
 */
export function mergeStageTrail(
  prev: StageTrailEntry[],
  job: ImportJobSnapshot
): StageTrailEntry[] {
  const next = [...prev];
  const last = next[next.length - 1];
  if (last && last.stage === job.stage) {
    next[next.length - 1] = { stage: job.stage, label: job.stage_label };
  } else {
    next.push({ stage: job.stage, label: job.stage_label });
  }
  return next.slice(-12);
}
