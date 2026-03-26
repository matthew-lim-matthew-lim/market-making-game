import type { Bot, BotContext } from "./botBase";
import type { PlayerAction } from "../engine/game";

export class FairValueQuoterBot implements Bot {
  readonly kind = "fair_value_quoter";
  private lastActionMs = -Infinity;
  private cadenceMs = 1800;

  onRoundStart(_ctx: { roundId: string; rng: import("../engine/rng").Rng }): void {
    this.lastActionMs = -Infinity;
  }

  decide(ctx: BotContext): PlayerAction | null {
    if (ctx.state.phase !== "running") return null;
    if (ctx.nowMs - this.lastActionMs < this.cadenceMs) return null;
    this.lastActionMs = ctx.nowMs;

    const participants = ctx.state.participants.length;

    // Estimate total true value as own card + mean(other cards).
    const { minInclusive, maxInclusive } = ctx.state.config.valueDistribution;
    const fallbackMean = (minInclusive + maxInclusive) / 2;
    const estimate = ctx.botPrivateValue + fallbackMean * Math.max(0, participants - 1);

    const top = ctx.state.orderBook.top;
    const spread = ctx.rng.int(1, 2);
    const desiredBid = Math.floor(estimate - spread);
    const desiredAsk = Math.ceil(estimate + spread);

    // If market is clearly favorable, take it; otherwise quote.
    if (top.bestAsk && top.bestAsk.price <= desiredBid) {
      return { type: "lift", ownerId: ctx.botId, qty: 1 };
    }
    if (top.bestBid && top.bestBid.price >= desiredAsk) {
      return { type: "hit", ownerId: ctx.botId, qty: 1 };
    }

    // Mostly keep the inside tight: join/improve depending on where we are.
    const coin = ctx.rng.int(0, 99);
    if (coin < 15) return { type: "pull_all", ownerId: ctx.botId };

    if (!top.bestBid || desiredBid > top.bestBid.price) {
      return { type: "place_limit", ownerId: ctx.botId, side: "buy", price: desiredBid, qty: 1 };
    }
    if (!top.bestAsk || desiredAsk < top.bestAsk.price) {
      return { type: "place_limit", ownerId: ctx.botId, side: "sell", price: desiredAsk, qty: 1 };
    }

    // Otherwise, join one side at the top.
    return ctx.rng.int(0, 1) === 0
      ? { type: "join", ownerId: ctx.botId, side: "buy", qty: 1 }
      : { type: "join", ownerId: ctx.botId, side: "sell", qty: 1 };
  }
}

