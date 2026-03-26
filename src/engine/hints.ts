import type { GameState } from "./game";
import type { Side } from "./types";

export interface HintRecommendation {
  action:
    | "Lift offer"
    | "Hit bid"
    | "Improve bid"
    | "Improve ask"
    | "Join bid"
    | "Join ask"
    | "Pull all";
  reason: string;
}

export function getHint(params: { state: GameState; ownerId: string }): HintRecommendation | null {
  const { state, ownerId } = params;
  if (state.phase !== "running") return null;

  const myCard = state.privateValues[ownerId];
  if (typeof myCard !== "number") return null;

  const n = state.participants.length;
  const { minInclusive, maxInclusive } = state.config.valueDistribution;
  const priorMean = (minInclusive + maxInclusive) / 2;
  const estimate = myCard + priorMean * Math.max(0, n - 1);

  const top = state.orderBook.top;
  const bestBid = top.bestBid?.price;
  const bestAsk = top.bestAsk?.price;

  if (bestAsk !== undefined && bestAsk <= estimate - 1) {
    return {
      action: "Lift offer",
      reason: `Best ask ${bestAsk} is below your estimate ${round2(estimate)}.`
    };
  }

  if (bestBid !== undefined && bestBid >= estimate + 1) {
    return {
      action: "Hit bid",
      reason: `Best bid ${bestBid} is above your estimate ${round2(estimate)}.`
    };
  }

  if (bestBid === undefined && bestAsk === undefined) {
    return {
      action: "Improve bid",
      reason: "No liquidity on either side; seed the market with a bid."
    };
  }

  if (bestBid !== undefined && bestAsk !== undefined) {
    const spread = bestAsk - bestBid;
    if (spread >= 3) {
      const side: Side = estimate >= (bestBid + bestAsk) / 2 ? "buy" : "sell";
      return side === "buy"
        ? { action: "Improve bid", reason: `Wide spread (${spread}); tighten bid side.` }
        : { action: "Improve ask", reason: `Wide spread (${spread}); tighten ask side.` };
    }
  }

  if (bestBid !== undefined && estimate >= bestBid) {
    return { action: "Join bid", reason: "Estimate supports buying near current best bid." };
  }
  if (bestAsk !== undefined && estimate <= bestAsk) {
    return { action: "Join ask", reason: "Estimate supports selling near current best ask." };
  }

  return { action: "Pull all", reason: "No clear edge right now; reduce exposure." };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

