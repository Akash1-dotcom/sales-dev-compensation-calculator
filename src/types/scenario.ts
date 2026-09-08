import type { ScenarioInputs } from '../engine/planEngine';

/** A user-named "what-if" scenario saved for later side-by-side comparison. */
export interface SavedScenario {
  id: string;
  name: string;
  planId: string;
  inputs: ScenarioInputs;
  createdAt: string;
}
