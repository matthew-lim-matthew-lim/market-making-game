import type { ReactNode } from "react";
import type { OrderBookSnapshotLevel, OrderBookTop } from "../engine/orderBook";

export function OrderBookPanel(props: { top: OrderBookTop; ladder: OrderBookSnapshotLevel[] }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        className="mono"
        style={{ color: "rgba(233,236,241,0.85)", fontSize: 12, display: "flex", gap: 10 }}
      >
        <span>
          Best bid:{" "}
          <span style={{ color: "rgba(124,243,192,0.95)" }}>
            {props.top.bestBid ? `${props.top.bestBid.price} (${props.top.bestBid.qty})` : "—"}
          </span>
        </span>
        <span>
          Best ask:{" "}
          <span style={{ color: "rgba(255,107,107,0.95)" }}>
            {props.top.bestAsk ? `${props.top.bestAsk.price} (${props.top.bestAsk.qty})` : "—"}
          </span>
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 1fr",
          gap: 8,
          alignItems: "center"
        }}
      >
        <div className="mono" style={{ fontSize: 12, color: "rgba(233,236,241,0.7)" }}>
          Bid
        </div>
        <div className="mono" style={{ fontSize: 12, color: "rgba(233,236,241,0.7)" }}>
          Px
        </div>
        <div className="mono" style={{ fontSize: 12, color: "rgba(233,236,241,0.7)" }}>
          Ask
        </div>

        {props.ladder.length === 0 ? (
          <EmptyRow />
        ) : (
          props.ladder.map((lvl) => (
            <OrderBookRow
              key={lvl.price}
              price={lvl.price}
              bidSize={lvl.bidQty}
              askSize={lvl.askQty}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyRow() {
  return (
    <>
      <Cell align="right" tone="muted">
        —
      </Cell>
      <Cell align="center" tone="muted">
        (empty)
      </Cell>
      <Cell align="left" tone="muted">
        —
      </Cell>
    </>
  );
}

function OrderBookRow(props: { price: number; bidSize: number; askSize: number }) {
  const { price, bidSize, askSize } = props;
  return (
    <>
      <Cell align="right" tone={bidSize > 0 ? "good" : "muted"}>
        {bidSize > 0 ? bidSize : ""}
      </Cell>
      <Cell align="center" tone="neutral">
        {price}
      </Cell>
      <Cell align="left" tone={askSize > 0 ? "bad" : "muted"}>
        {askSize > 0 ? askSize : ""}
      </Cell>
    </>
  );
}

function Cell(props: {
  align: "left" | "center" | "right";
  tone: "good" | "bad" | "neutral" | "muted";
  children: ReactNode;
}) {
  const toneColor =
    props.tone === "good"
      ? "rgba(124,243,192,0.95)"
      : props.tone === "bad"
        ? "rgba(255,107,107,0.95)"
        : props.tone === "muted"
          ? "rgba(233,236,241,0.55)"
          : "rgba(233,236,241,0.9)";
  const justify =
    props.align === "left" ? "flex-start" : props.align === "right" ? "flex-end" : "center";
  return (
    <div
      className="mono"
      style={{
        display: "flex",
        justifyContent: justify,
        padding: "7px 10px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        color: toneColor,
        fontSize: 12
      }}
    >
      {props.children}
    </div>
  );
}

