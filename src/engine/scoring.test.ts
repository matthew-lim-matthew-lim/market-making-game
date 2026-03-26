import { describe, expect, test } from "vitest";
import { evForFill, pnlForFill } from "./scoring";

describe("scoring", () => {
  test("EV and PnL formulas for buy/sell fills", () => {
    const buyEv = evForFill({ side: "buy", price: 90, qty: 2, trueValue: 100 });
    const buyPnl = pnlForFill({ side: "buy", price: 90, qty: 2, trueValue: 100 });
    expect(buyEv).toBe(20);
    expect(buyPnl).toBe(20);

    const sellEv = evForFill({ side: "sell", price: 110, qty: 3, trueValue: 100 });
    const sellPnl = pnlForFill({ side: "sell", price: 110, qty: 3, trueValue: 100 });
    expect(sellEv).toBe(30);
    expect(sellPnl).toBe(30);
  });
});

