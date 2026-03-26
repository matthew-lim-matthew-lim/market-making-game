import type { OrderId, ParticipantId, Price, Qty, Side, Trade } from "./types";

export type GameEvent =
  | RoundStartedEvent
  | RoundEndedEvent
  | OrderPlacedEvent
  | OrderCancelledEvent
  | TradeEvent;

export interface RoundStartedEvent {
  type: "round_started";
  ts: number;
  roundId: string;
  durationMs: number;
  participants: ParticipantId[];
}

export interface RoundEndedEvent {
  type: "round_ended";
  ts: number;
  roundId: string;
  trueValue: number;
}

export interface OrderPlacedEvent {
  type: "order_placed";
  ts: number;
  ownerId: ParticipantId;
  side: Side;
  price: Price;
  qty: Qty;
  orderId?: OrderId; // undefined if fully filled immediately
}

export interface OrderCancelledEvent {
  type: "order_cancelled";
  ts: number;
  ownerId: ParticipantId;
  orderId: OrderId;
}

export interface TradeEvent {
  type: "trade";
  ts: number;
  trade: Trade;
}

