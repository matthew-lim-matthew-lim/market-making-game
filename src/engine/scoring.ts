import type { ParticipantId } from "./types";

export function computeTrueValue(privateValues: Record<ParticipantId, number>): number {
  let s = 0;
  for (const v of Object.values(privateValues)) s += v;
  return s;
}

export function evForFill(fill: {
  side: "buy" | "sell";
  price: number;
  qty: number;
  trueValue: number;
}): number {
  const { side, price, qty, trueValue } = fill;
  return side === "buy" ? (trueValue - price) * qty : (price - trueValue) * qty;
}

export function pnlForFill(fill: {
  side: "buy" | "sell";
  price: number;
  qty: number;
  trueValue: number;
}): number {
  const { side, price, qty, trueValue } = fill;
  return side === "buy" ? (trueValue - price) * qty : (price - trueValue) * qty;
}

