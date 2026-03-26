import { OrderBookPanel } from "./ui/OrderBookPanel";
import { ControlsPanel } from "./ui/ControlsPanel";
import { TradeTapePanel } from "./ui/TradeTapePanel";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "./engine/game";
import { createBotRng, type Bot } from "./bots/botBase";
import { FairValueQuoterBot } from "./bots/fairValueQuoter";
import { OpportunisticTakerBot } from "./bots/opportunisticTaker";
import { RoundReviewPanel } from "./ui/RoundReviewPanel";
import { getHint } from "./engine/hints";

export function App() {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine({
      tickSize: 1,
      roundDurationMs: 90_000,
      seed: 42,
      participants: [
        { id: "YOU", displayName: "You", isHuman: true },
        { id: "BOT_A", displayName: "Bot A", isHuman: false },
        { id: "BOT_B", displayName: "Bot B", isHuman: false }
      ],
      // Retained for bot prior assumptions; actual deal now comes from a 52-card deck ranks (Ace=1..King=13).
      valueDistribution: { minInclusive: 1, maxInclusive: 13 }
    });
  }

  const engine = engineRef.current;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hintEnabled, setHintEnabled] = useState(false);

  const botsRef = useRef<
    { botId: string; bot: Bot; rng: ReturnType<typeof createBotRng>; lastRoundId: string | null }[]
  >([]);
  if (botsRef.current.length === 0) {
    botsRef.current = [
      { botId: "BOT_A", bot: new FairValueQuoterBot(), rng: createBotRng(engine.getConfig().seed, "BOT_A"), lastRoundId: null },
      { botId: "BOT_B", bot: new OpportunisticTakerBot(), rng: createBotRng(engine.getConfig().seed, "BOT_B"), lastRoundId: null }
    ];
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      engine.tick(now);
      const s = engine.getState(now);
      if (s.phase === "running" && s.roundId) {
        for (const b of botsRef.current) {
          if (b.lastRoundId !== s.roundId) {
            b.lastRoundId = s.roundId;
            b.rng = createBotRng(s.config.seed, `${b.botId}:${s.roundId}`);
            b.bot.onRoundStart({ roundId: s.roundId, rng: b.rng });
          }
          const pv = s.privateValues[b.botId];
          if (typeof pv !== "number") continue;
          const act = b.bot.decide({ nowMs: now, state: s, botId: b.botId, botPrivateValue: pv, rng: b.rng });
          if (act) engine.act(now, act);
        }
      }
      setNowMs(now);
    }, 100);
    return () => window.clearInterval(id);
  }, [engine]);

  const state = useMemo(() => engine.getState(nowMs), [engine, nowMs]);
  const hint = useMemo(
    () => (hintEnabled ? getHint({ state, ownerId: "YOU" }) : null),
    [hintEnabled, state]
  );
  const youValue = state.privateValues["YOU"];
  const remainingMs =
    state.phase === "running" && state.endsAtMs !== null ? Math.max(0, state.endsAtMs - nowMs) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const canAct = state.phase === "running";
  const yourFills = state.fills.filter((f) => f.ownerId === "YOU");
  const totalEv = round2(yourFills.reduce((acc, f) => acc + (f.ev ?? 0), 0));
  const totalPnl = round2(yourFills.reduce((acc, f) => acc + (f.pnl ?? 0), 0));
  const botCount = state.participants.filter((p) => !p.isHuman).length;

  return (
    <div className="app">
      <div className="titleRow">
        <div>
          <h1 className="title">Market Making Practice</h1>
          <p className="subtitle">
            Lift · Hit · Improve · Join · Pull — price-time priority, bots, and EV review.
          </p>
        </div>
        <div className="pill mono">
          {state.phase === "lobby" ? (
            <span>Ready</span>
          ) : state.phase === "running" ? (
            <span>Running · {remainingSec}s</span>
          ) : (
            <span>Review</span>
          )}
        </div>
      </div>
      <div className="subtitle" style={{ marginBottom: 12 }}>
        EV: {fmtSigned(totalEv)} · PnL: {fmtSigned(totalPnl)} · Bots: {botCount} · Deck: 52 cards
        (A=1)
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panelHeader">
            <h2>Order book</h2>
            <span className="pill mono">
              {state.phase === "running" ? `your card: ${youValue}` : "your card: —"}
            </span>
          </div>
          <div className="panelBody">
            <OrderBookPanel top={state.orderBook.top} ladder={state.orderBook.ladder} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div className="panel">
            <div className="panelHeader">
              <h2>{state.phase === "review" ? "Review" : "Controls"}</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label className="pill mono" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hintEnabled}
                    onChange={(e) => setHintEnabled(e.target.checked)}
                    style={{ marginRight: 6 }}
                  />
                  Hint
                </label>
                <button
                  type="button"
                  className="pill mono"
                  onClick={() => {
                    const now = Date.now();
                    engine.startRound(now);
                    setNowMs(now);
                  }}
                  style={{
                    cursor: "pointer",
                    background: "rgba(124,243,192,0.10)",
                    border: "1px solid rgba(124,243,192,0.25)"
                  }}
                >
                  New round
                </button>
              </div>
            </div>
            <div className="panelBody">
              {hintEnabled && hint ? (
                <div
                  className="mono"
                  style={{
                    marginBottom: 10,
                    border: "1px solid rgba(124,243,192,0.35)",
                    background: "rgba(124,243,192,0.08)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: 12
                  }}
                >
                  Hint: <strong>{hint.action}</strong> — {hint.reason}
                </div>
              ) : null}
              {state.phase === "review" ? (
                <RoundReviewPanel state={state} ownerId="YOU" />
              ) : (
                <ControlsPanel
                  disabled={!canAct}
                  onJoinBid={() =>
                    engine.act(Date.now(), { type: "join", ownerId: "YOU", side: "buy", qty: 1 })
                  }
                  onImproveBid={() =>
                    engine.act(Date.now(), { type: "improve", ownerId: "YOU", side: "buy", qty: 1 })
                  }
                  onHitBid={() => engine.act(Date.now(), { type: "hit", ownerId: "YOU", qty: 1 })}
                  onJoinAsk={() =>
                    engine.act(Date.now(), { type: "join", ownerId: "YOU", side: "sell", qty: 1 })
                  }
                  onImproveAsk={() =>
                    engine.act(Date.now(), { type: "improve", ownerId: "YOU", side: "sell", qty: 1 })
                  }
                  onLiftOffer={() => engine.act(Date.now(), { type: "lift", ownerId: "YOU", qty: 1 })}
                  onPullAll={() => engine.act(Date.now(), { type: "pull_all", ownerId: "YOU" })}
                />
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>Trade tape</h2>
              <span className="pill mono">{state.roundId ?? "—"}</span>
            </div>
            <div className="panelBody">
              <TradeTapePanel events={state.events} nowMs={nowMs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function fmtSigned(x: number): string {
  return x >= 0 ? `+${x}` : `${x}`;
}

