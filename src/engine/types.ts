export type Side = "buy" | "sell";

export type ParticipantId = string;

export type OrderId = string;

export type Price = number;

export type Qty = number;

export interface LimitOrder {
  id: OrderId;
  ownerId: ParticipantId;
  side: Side;
  price: Price;
  qty: Qty; // remaining quantity
  createdAt: number; // monotonic for price-time priority
}

export interface Trade {
  id: string;
  price: Price;
  qty: Qty;
  makerOrderId: OrderId;
  takerOwnerId: ParticipantId;
  makerOwnerId: ParticipantId;
  ts: number;
}

