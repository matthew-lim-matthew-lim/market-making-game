export function ControlsPanel(props: {
  disabled: boolean;
  onJoinBid(): void;
  onImproveBid(): void;
  onHitBid(): void;
  onJoinAsk(): void;
  onImproveAsk(): void;
  onLiftOffer(): void;
  onPullAll(): void;
}) {
  const buttons: { group: string; label: string; hint: string; onClick: () => void }[] = [
    {
      group: "Take theirs",
      label: "Lift offer (buy theirs)",
      hint: "Take THEIR ask immediately",
      onClick: props.onLiftOffer
    },
    {
      group: "Take theirs",
      label: "Hit bid (sell yours)",
      hint: "Take THEIR bid immediately",
      onClick: props.onHitBid
    },
    {
      group: "Post mine",
      label: "Join bid",
      hint: "Post MINE at existing best bid",
      onClick: props.onJoinBid
    },
    {
      group: "Post mine",
      label: "Improve bid",
      hint: "Post MINE as better best bid",
      onClick: props.onImproveBid
    },
    {
      group: "Post mine",
      label: "Join ask",
      hint: "Post MINE at existing best ask",
      onClick: props.onJoinAsk
    },
    {
      group: "Post mine",
      label: "Improve ask",
      hint: "Post MINE as better best ask",
      onClick: props.onImproveAsk
    },
    {
      group: "Manage mine",
      label: "Pull all",
      hint: "Cancel MY resting orders",
      onClick: props.onPullAll
    }
  ];
  const take = buttons.filter((b) => b.group === "Take theirs");
  const post = buttons.filter((b) => b.group === "Post mine");
  const manage = buttons.filter((b) => b.group === "Manage mine");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ActionGroup disabled={props.disabled} title="Take theirs now" buttons={take} />
      <ActionGroup disabled={props.disabled} title="Post mine in book" buttons={post} />
      <ActionGroup disabled={props.disabled} title="Manage mine" buttons={manage} />
      <div style={{ fontSize: 12, color: "rgba(233,236,241,0.65)" }}>
        “Mine” means your resting orders. “Theirs” means opposite-side liquidity in the book.
      </div>
    </div>
  );
}

function ActionGroup(props: {
  disabled: boolean;
  title: string;
  buttons: { label: string; hint: string; onClick: () => void }[];
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{props.title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {props.buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.hint}
            onClick={() => {
              if (props.disabled) return;
              b.onClick();
            }}
            disabled={props.disabled}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(233,236,241,0.92)",
              cursor: props.disabled ? "not-allowed" : "pointer",
              textAlign: "left"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{b.label}</div>
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>{b.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

