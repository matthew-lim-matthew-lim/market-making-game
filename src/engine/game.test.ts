import { describe, expect, test } from "vitest";
import { GameEngine } from "./game";

describe("GameEngine (round lifecycle)", () => {
  test("deals private values and settles to trueValue=sum(values)", () => {
    const g = new GameEngine({
      tickSize: 1,
      roundDurationMs: 1000,
      seed: 123,
      participants: [
        { id: "YOU", displayName: "You", isHuman: true },
        { id: "BOT_A", displayName: "Bot A", isHuman: false },
        { id: "BOT_B", displayName: "Bot B", isHuman: false }
      ],
      valueDistribution: { minInclusive: 1, maxInclusive: 13 }
    });

    g.startRound(0);
    const s0 = g.getState(0);
    expect(s0.phase).toBe("running");
    for (const v of Object.values(s0.privateValues)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(13);
    }

    g.tick(1001);
    const s1 = g.getState(1001);
    expect(s1.phase).toBe("review");
    expect(s1.trueValue).toBe(Object.values(s0.privateValues).reduce((a, b) => a + b, 0));
  });

  test("records directionful fills and computes EV at settlement", () => {
    const g = new GameEngine({
      tickSize: 1,
      roundDurationMs: 10,
      seed: 1,
      participants: [
        { id: "YOU", displayName: "You", isHuman: true },
        { id: "BOT", displayName: "Bot", isHuman: false }
      ],
      valueDistribution: { minInclusive: 1, maxInclusive: 13 }
    });

    g.startRound(0);

    // Bot posts an ask @ 60, you lift it for qty=1.
    g.act(1, { type: "place_limit", ownerId: "BOT", side: "sell", price: 60, qty: 1 });
    g.act(2, { type: "lift", ownerId: "YOU", qty: 1 });

    g.tick(11);
    const s = g.getState(11);
    expect(s.phase).toBe("review");
    const tv = s.trueValue!;
    const yourFill = s.fills.find((f) => f.ownerId === "YOU")!;
    expect(yourFill.side).toBe("buy");
    expect(yourFill.price).toBe(60);
    expect(yourFill.ev).toBe((tv - 60) * 1);
    expect(yourFill.pnl).toBe((tv - 60) * 1);
  });
});

