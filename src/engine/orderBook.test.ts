import { describe, expect, test } from "vitest";
import { OrderBook } from "./orderBook";

describe("OrderBook (price-time priority)", () => {
  test("best price fills first, then oldest at that price", () => {
    const ob = new OrderBook();

    // Resting sells at same price: A is older than B
    const a = ob.add({ ownerId: "A", side: "sell", price: 100, qty: 1 });
    const b = ob.add({ ownerId: "B", side: "sell", price: 100, qty: 1 });
    expect(a.order?.id).toBeDefined();
    expect(b.order?.id).toBeDefined();

    // Better price sell should fill before 100
    ob.add({ ownerId: "C", side: "sell", price: 99, qty: 1 });

    const res = ob.add({ ownerId: "YOU", side: "buy", price: 100, qty: 3 });
    expect(res.trades.map((t) => t.price)).toEqual([99, 100, 100]);
    expect(res.trades[1]?.makerOwnerId).toBe("A");
    expect(res.trades[2]?.makerOwnerId).toBe("B");
  });

  test("partial fills preserve remaining qty at front of queue", () => {
    const ob = new OrderBook();
    ob.add({ ownerId: "A", side: "buy", price: 10, qty: 5 });
    const sell1 = ob.add({ ownerId: "S1", side: "sell", price: 10, qty: 2 });
    expect(sell1.trades).toHaveLength(1);

    // Remaining bid should still be best bid with qty=3
    const top = ob.top();
    expect(top.bestBid?.price).toBe(10);
    expect(top.bestBid?.qty).toBe(3);
  });

  test("cancel removes order and price level when empty", () => {
    const ob = new OrderBook();
    const r = ob.add({ ownerId: "A", side: "buy", price: 50, qty: 1 });
    const id = r.order!.id;
    expect(ob.top().bestBid?.price).toBe(50);
    expect(ob.cancel(id)).toBe(true);
    expect(ob.top().bestBid).toBeUndefined();
  });
});

