import type { GameEvent } from "./events";
import type { GameConfig } from "./game";

export interface ReplayBundle {
  version: 1;
  config: GameConfig;
  events: GameEvent[];
}

export function toReplayBundle(params: { config: GameConfig; events: GameEvent[] }): ReplayBundle {
  return {
    version: 1,
    config: params.config,
    events: params.events
  };
}

