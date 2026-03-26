import type { GameEvent } from "../engine/events";

export function TradeTapePanel(props: { events: GameEvent[]; nowMs: number }) {
  const recent = props.events.slice(-18).reverse();
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="mono" style={{ fontSize: 12, color: "rgba(233,236,241,0.7)" }}>
        Recent events
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {recent.length === 0 ? (
          <div className="mono" style={{ opacity: 0.6, fontSize: 12 }}>
            —
          </div>
        ) : (
          recent.map((e, idx) => (
            <TapeRow key={idx} t={fmtDeltaMs(props.nowMs - e.ts)} msg={describeEvent(e)} />
          ))
        )}
      </div>
    </div>
  );
}

function TapeRow(props: { t: string; msg: string }) {
  return (
    <div
      className="mono"
      style={{
        display: "flex",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        fontSize: 12
      }}
    >
      <span style={{ opacity: 0.7, minWidth: 56 }}>{props.t}</span>
      <span style={{ opacity: 0.92 }}>{props.msg}</span>
    </div>
  );
}

function describeEvent(e: GameEvent): string {
  switch (e.type) {
    case "round_started":
      return `round started (${Math.round(e.durationMs / 1000)}s)`;
    case "round_ended":
      return `round ended — true value: ${e.trueValue}`;
    case "order_placed":
      return `${e.ownerId} places ${e.side} @ ${e.price} x${e.qty}${e.orderId ? ` (${e.orderId})` : ""}`;
    case "order_cancelled":
      return `${e.ownerId} cancels ${e.orderId}`;
    case "trade":
      return `trade @ ${e.trade.price} x${e.trade.qty} (maker ${e.trade.makerOwnerId}, taker ${e.trade.takerOwnerId})`;
    default: {
      const _exhaustive: never = e;
      return String(_exhaustive);
    }
  }
}

function fmtDeltaMs(deltaMs: number): string {
  const d = Math.max(0, deltaMs);
  const totalSec = Math.floor(d / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
