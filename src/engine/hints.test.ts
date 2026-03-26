import { describe, expect, test } from "vitest";
import { GameEngine } from "./game";
import { getHint } from "./hints";

function makeGame() {
  return new GameEngine({
    tickSize: 1,
    roundDurationMs: 60_000,
    seed: 1,
    participants: [
      { id: "YOU", displayName: "You", isHuman: true },
      { id: "BOT_A", displayName: "Bot A", isHuman: false },
      { id: "BOT_B", displayName: "Bot B", isHuman: false }
    ],
    valueDistribution: { minInclusive: 40, maxInclusive: 50 }
  });
}

describe("getHint", () => {
  test("returns actionable hint in running phase", () => {
    const g = makeGame();
    g.startRound(0);
    const s = g.getState(10);
    const hint = getHint({ state: s, ownerId: "YOU" });
    expect(hint).not.toBeNull();
    expect(hint?.action).toBeTypeOf("string");
    expect(hint?.reason.length).toBeGreaterThan(0);
  });

  test("suggests lift when best ask is cheap versus estimate", () => {
    const g = new GameEngine({
      tickSize: 1,
      roundDurationMs: 60_000,
      seed: 2,
      participants: [
        { id: "YOU", displayName: "You", isHuman: true },
        { id: "BOT", displayName: "Bot", isHuman: false }
      ],
      valueDistribution: { minInclusive: 100, maxInclusive: 100 }
    });
    g.startRound(0);
    g.act(1, { type: "place_limit", ownerId: "BOT", side: "sell", price: 80, qty: 1 });
    const s = g.getState(2);
    const hint = getHint({ state: s, ownerId: "YOU" });
    expect(hint?.action).toBe("Lift offer");
  });
});

