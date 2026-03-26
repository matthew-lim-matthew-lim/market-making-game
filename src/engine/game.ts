import { OrderBook } from "./orderBook";
import { createRng } from "./rng";
import type { GameEvent } from "./events";
import { computeTrueValue, evForFill, pnlForFill } from "./scoring";
import type { AddOrderRequest, OrderBookSnapshotLevel, OrderBookTop } from "./orderBook";
import type { OrderId, ParticipantId, Price, Side, Trade } from "./types";

export type GamePhase = "lobby" | "running" | "review";

export interface Participant {
  id: ParticipantId;
  displayName: string;
  isHuman: boolean;
}

export interface GameConfig {
  tickSize: number;
  roundDurationMs: number;
  seed: number;
  participants: Participant[];
  valueDistribution: { minInclusive: number; maxInclusive: number };
}

export interface Fill {
  tradeId: string;
  ts: number;
  ownerId: ParticipantId;
  side: "buy" | "sell";
  price: number;
  qty: number;
  ev?: number;
  pnl?: number;
}

export interface GameState {
  phase: GamePhase;
  roundId: string | null;
  startedAtMs: number | null;
  endsAtMs: number | null;
  nowMs: number;

  config: {
    tickSize: number;
    roundDurationMs: number;
    seed: number;
    valueDistribution: { minInclusive: number; maxInclusive: number };
  };

  participants: Participant[];
  // Private per participant; UI should only reveal the current human's value.
  privateValues: Record<ParticipantId, number>;

  orderBook: {
    top: OrderBookTop;
    ladder: OrderBookSnapshotLevel[];
  };

  trades: Trade[];
  fills: Fill[];
  events: GameEvent[];

  trueValue: number | null;
}

export type PlayerAction =
  | { type: "join"; ownerId: ParticipantId; side: Side; qty: number }
  | { type: "improve"; ownerId: ParticipantId; side: Side; qty: number }
  | { type: "lift"; ownerId: ParticipantId; qty: number }
  | { type: "hit"; ownerId: ParticipantId; qty: number }
  | { type: "place_limit"; ownerId: ParticipantId; side: Side; price: Price; qty: number }
  | { type: "cancel_order"; ownerId: ParticipantId; orderId: OrderId }
  | { type: "pull_all"; ownerId: ParticipantId };

export class GameEngine {
  private readonly cfg: GameConfig;
  private readonly rng: ReturnType<typeof createRng>;
  private readonly ob = new OrderBook();
  private roundSeq = 0;
  private events: GameEvent[] = [];
  private trades: Trade[] = [];
  private fills: Fill[] = [];

  private phase: GamePhase = "lobby";
  private roundId: string | null = null;
  private startedAtMs: number | null = null;
  private endsAtMs: number | null = null;
  private privateValues: Record<ParticipantId, number> = {};
  private trueValue: number | null = null;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = createRng(cfg.seed);
  }

  getConfig(): GameConfig {
    return this.cfg;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  startRound(nowMs: number) {
    if (this.phase === "running") throw new Error("round already running");
    this.phase = "running";
    this.roundSeq += 1;
    this.roundId = `R${this.roundSeq}`;
    this.startedAtMs = nowMs;
    this.endsAtMs = nowMs + this.cfg.roundDurationMs;
    this.events = [];
    this.trades = [];
    this.fills = [];
    this.trueValue = null;

    // Deal private values from a standard 52-card rank deck (Ace=1 ... King=13).
    this.privateValues = {};
    const ranks = buildShuffledRankDeck(this.rng);
    for (let i = 0; i < this.cfg.participants.length; i += 1) {
      const p = this.cfg.participants[i]!;
      this.privateValues[p.id] = ranks[i]!;
    }

    this.events.push({
      type: "round_started",
      ts: nowMs,
      roundId: this.roundId,
      durationMs: this.cfg.roundDurationMs,
      participants: this.cfg.participants.map((p) => p.id)
    });
  }

  tick(nowMs: number) {
    if (this.phase === "running" && this.endsAtMs !== null && nowMs >= this.endsAtMs) {
      this.endRound(nowMs);
    }
  }

  endRound(nowMs: number) {
    if (this.phase !== "running") return;
    this.phase = "review";
    this.trueValue = computeTrueValue(this.privateValues);

    // Attach EV to each fill from each owner's perspective at settlement.
    for (const f of this.fills) {
      const payload = { side: f.side, price: f.price, qty: f.qty, trueValue: this.trueValue };
      f.ev = evForFill(payload);
      f.pnl = pnlForFill(payload);
    }

    this.events.push({
      type: "round_ended",
      ts: nowMs,
      roundId: this.roundId!,
      trueValue: this.trueValue
    });
  }

  act(nowMs: number, action: PlayerAction) {
    if (this.phase !== "running") return;

    if (action.type === "pull_all") {
      const cancelled = this.ob.cancelAllForOwner(action.ownerId);
      for (const id of cancelled) {
        this.events.push({ type: "order_cancelled", ts: nowMs, ownerId: action.ownerId, orderId: id });
      }
      return;
    }

    if (action.type === "cancel_order") {
      const ord = this.ob.getOrder(action.orderId);
      if (!ord || ord.ownerId !== action.ownerId) return;
      if (this.ob.cancel(action.orderId)) {
        this.events.push({ type: "order_cancelled", ts: nowMs, ownerId: action.ownerId, orderId: action.orderId });
      }
      return;
    }

    if (action.type === "lift") {
      const top = this.ob.top().bestAsk;
      if (!top) return;
      this.place(nowMs, { ownerId: action.ownerId, side: "buy", price: top.price, qty: action.qty }, "taker_buy");
      return;
    }

    if (action.type === "hit") {
      const top = this.ob.top().bestBid;
      if (!top) return;
      this.place(nowMs, { ownerId: action.ownerId, side: "sell", price: top.price, qty: action.qty }, "taker_sell");
      return;
    }

    if (action.type === "place_limit") {
      this.place(nowMs, {
        ownerId: action.ownerId,
        side: action.side,
        price: action.price,
        qty: action.qty
      }, "resting_or_cross");
      return;
    }

    if (action.type === "join") {
      const top = this.ob.top();
      const px = action.side === "buy" ? top.bestBid?.price : top.bestAsk?.price;
      if (px === undefined) return;
      this.place(nowMs, { ownerId: action.ownerId, side: action.side, price: px, qty: action.qty }, "resting_or_cross");
      return;
    }

    if (action.type === "improve") {
      const top = this.ob.top();
      const tick = this.cfg.tickSize;
      if (tick <= 0) throw new Error("tickSize must be > 0");
      const px =
        action.side === "buy"
          ? top.bestBid
            ? top.bestBid.price + tick
            : this.anchorMid() - tick
          : top.bestAsk
            ? top.bestAsk.price - tick
            : this.anchorMid() + tick;
      this.place(nowMs, { ownerId: action.ownerId, side: action.side, price: px, qty: action.qty }, "resting_or_cross");
      return;
    }
  }

  getState(nowMs: number, depth = 8): GameState {
    const top = this.ob.top();
    return {
      phase: this.phase,
      roundId: this.roundId,
      startedAtMs: this.startedAtMs,
      endsAtMs: this.endsAtMs,
      nowMs,
      config: {
        tickSize: this.cfg.tickSize,
        roundDurationMs: this.cfg.roundDurationMs,
        seed: this.cfg.seed,
        valueDistribution: { ...this.cfg.valueDistribution }
      },
      participants: this.cfg.participants,
      privateValues: { ...this.privateValues },
      orderBook: { top, ladder: this.ob.snapshot(depth) },
      trades: [...this.trades],
      fills: [...this.fills],
      events: [...this.events],
      trueValue: this.trueValue
    };
  }

  private place(nowMs: number, req: AddOrderRequest, intent: "taker_buy" | "taker_sell" | "resting_or_cross") {
    const { order, trades } = this.ob.add(req);
    this.events.push({
      type: "order_placed",
      ts: nowMs,
      ownerId: req.ownerId,
      side: req.side,
      price: req.price,
      qty: req.qty,
      orderId: order?.id
    });

    for (const t of trades) {
      this.trades.push(t);
      this.events.push({ type: "trade", ts: nowMs, trade: t });

      // Record fills directionfully for both parties (so EV is unambiguous).
      // If incoming is buy, then taker buys and maker sells. If incoming is sell, vice versa.
      const takerSide: "buy" | "sell" =
        intent === "taker_buy" ? "buy" : intent === "taker_sell" ? "sell" : req.side;
      const makerSide: "buy" | "sell" = takerSide === "buy" ? "sell" : "buy";

      this.fills.push({
        tradeId: t.id,
        ts: nowMs,
        ownerId: t.takerOwnerId,
        side: takerSide,
        price: t.price,
        qty: t.qty
      });
      this.fills.push({
        tradeId: t.id,
        ts: nowMs,
        ownerId: t.makerOwnerId,
        side: makerSide,
        price: t.price,
        qty: t.qty
      });
    }
  }

  private anchorMid(): number {
    // Used only when book is empty; pick center of distribution as a reasonable anchor.
    const { minInclusive, maxInclusive } = this.cfg.valueDistribution;
    return (minInclusive + maxInclusive) / 2;
  }
}

function buildShuffledRankDeck(rng: ReturnType<typeof createRng>): number[] {
  const deck: number[] = [];
  // Four suits, rank values 1..13 where Ace = 1.
  for (let suit = 0; suit < 4; suit += 1) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push(rank);
    }
  }
  // Fisher-Yates shuffle using deterministic RNG.
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

