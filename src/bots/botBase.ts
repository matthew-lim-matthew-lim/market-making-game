import type { GameState, PlayerAction } from "../engine/game";
import type { ParticipantId } from "../engine/types";
import { createRng, type Rng } from "../engine/rng";

export interface BotContext {
  nowMs: number;
  state: GameState;
  botId: ParticipantId;
  botPrivateValue: number;
  rng: Rng;
}

export interface Bot {
  readonly kind: string;
  onRoundStart(ctx: { roundId: string; rng: Rng }): void;
  decide(ctx: BotContext): PlayerAction | null;
}

export function createBotRng(baseSeed: number, botId: string): Rng {
  return createRng(hashSeed(baseSeed, botId));
}

function hashSeed(seed: number, s: string): number {
  // Simple deterministic hash into 32-bit int.
  let h = seed | 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

