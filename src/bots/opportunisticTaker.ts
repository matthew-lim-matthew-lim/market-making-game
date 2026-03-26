import type { Bot, BotContext } from "./botBase";
import type { PlayerAction } from "../engine/game";

export class OpportunisticTakerBot implements Bot {
  readonly kind = "opportunistic_taker";
  private lastActionMs = -Infinity;
  private cadenceMs = 1400;

  onRoundStart(_ctx: { roundId: string; rng: import("../engine/rng").Rng }): void {
    this.lastActionMs = -Infinity;
  }

  decide(ctx: BotContext): PlayerAction | null {
    if (ctx.state.phase !== "running") return null;
    if (ctx.nowMs - this.lastActionMs < this.cadenceMs) return null;
    this.lastActionMs = ctx.nowMs;

    const participants = ctx.state.participants.length;
    const { minInclusive, maxInclusive } = ctx.state.config.valueDistribution;
    const fallbackMean = (minInclusive + maxInclusive) / 2;
    const estimate = ctx.botPrivateValue + fallbackMean * Math.max(0, participants - 1);

    const top = ctx.state.orderBook.top;
    const edge = ctx.rng.int(1, 3);

    if (top.bestAsk && top.bestAsk.price <= estimate - edge) {
      return { type: "lift", ownerId: ctx.botId, qty: 1 };
    }
    if (top.bestBid && top.bestBid.price >= estimate + edge) {
      return { type: "hit", ownerId: ctx.botId, qty: 1 };
    }

    // If no liquidity, seed it lightly near estimate.
    if (!top.bestBid && !top.bestAsk) {
      return ctx.rng.int(0, 1) === 0
        ? { type: "place_limit", ownerId: ctx.botId, side: "buy", price: Math.floor(estimate - 1), qty: 1 }
        : { type: "place_limit", ownerId: ctx.botId, side: "sell", price: Math.ceil(estimate + 1), qty: 1 };
    }

    // Otherwise do nothing most of the time.
    return ctx.rng.int(0, 99) < 20
      ? { type: "join", ownerId: ctx.botId, side: ctx.rng.int(0, 1) === 0 ? "buy" : "sell", qty: 1 }
      : null;
  }
}

