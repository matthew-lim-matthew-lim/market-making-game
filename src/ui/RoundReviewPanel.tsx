import type { Fill, GameState } from "../engine/game";

export function RoundReviewPanel(props: { state: GameState; ownerId: string }) {
  if (props.state.phase !== "review") {
    return (
      <div style={{ fontSize: 12, color: "rgba(233,236,241,0.65)" }}>
        Review appears after the round ends.
      </div>
    );
  }

  const tv = props.state.trueValue ?? 0;
  const fills = props.state.fills.filter((f) => f.ownerId === props.ownerId);
  const totalEv = sum(fills.map((f) => f.ev ?? 0));
  const totalPnl = sum(fills.map((f) => f.pnl ?? 0));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
        True value (sum of cards): <span style={{ color: "rgba(124,243,192,0.95)" }}>{tv}</span>
      </div>
      <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
        Your total EV:{" "}
        <span style={{ color: totalEv >= 0 ? "rgba(124,243,192,0.95)" : "rgba(255,107,107,0.95)" }}>
          {fmtSigned(totalEv)}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
        Your total PnL:{" "}
        <span style={{ color: totalPnl >= 0 ? "rgba(124,243,192,0.95)" : "rgba(255,107,107,0.95)" }}>
          {fmtSigned(totalPnl)}
        </span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {fills.length === 0 ? (
          <div className="mono" style={{ fontSize: 12, opacity: 0.6 }}>
            No fills.
          </div>
        ) : (
          fills.slice().reverse().map((f) => <FillRow key={`${f.tradeId}:${f.ownerId}:${f.ts}`} fill={f} />)
        )}
      </div>
    </div>
  );
}

function FillRow(props: { fill: Fill }) {
  const f = props.fill;
  const ev = f.ev ?? 0;
  const pnl = f.pnl ?? 0;
  const tone = ev >= 0 ? "rgba(124,243,192,0.95)" : "rgba(255,107,107,0.95)";
  const pnlTone = pnl >= 0 ? "rgba(124,243,192,0.95)" : "rgba(255,107,107,0.95)";

  return (
    <div
      className="mono"
      style={{
        display: "grid",
        gridTemplateColumns: "60px 72px 1fr 80px 80px",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        fontSize: 12,
        alignItems: "center"
      }}
    >
      <span style={{ opacity: 0.8 }}>{f.side.toUpperCase()}</span>
      <span style={{ opacity: 0.9 }}>@ {f.price}</span>
      <span style={{ opacity: 0.75 }}>qty {f.qty}</span>
      <span style={{ justifySelf: "end", color: tone }}>EV {fmtSigned(ev)}</span>
      <span style={{ justifySelf: "end", color: pnlTone }}>PnL {fmtSigned(pnl)}</span>
    </div>
  );
}

function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

function fmtSigned(x: number): string {
  const r = Math.round(x * 100) / 100;
  return r >= 0 ? `+${r}` : `${r}`;
}

