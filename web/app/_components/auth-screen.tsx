import { useState } from "react";

export function AuthScreen({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="entry">
      <div className="entry-top fade-up">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <span className="eyebrow">
          <b>Private</b> · invite only
        </span>
      </div>

      <div className="entry-mid">
        <h1 className="entry-hed fade-up d1">
          Keep each other<br />
          <span className="underline">honest.</span>
        </h1>
        <p className="entry-dek fade-up d2">
          A private squad. A daily slate. Points for what you actually do — and a way
          to call out the friends who didn&apos;t.
        </p>

        <div className="fade-up d3" style={{ maxWidth: 420 }}>
          <label className="field">
            <span className="field-label">
              <span>Display name</span>
              <span className="hint">Visible to your squad</span>
            </span>
            <input
              className="field-input"
              placeholder="What should we tag you as"
              value={name}
              maxLength={22}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onSubmit(name);
              }}
            />
          </label>

          <div style={{ marginTop: 28, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              className="btn-primary"
              disabled={!name.trim()}
              onClick={() => onSubmit(name)}
            >
              Lock in
              <span className="arrow">→</span>
            </button>
            <span className="eyebrow">No password. No email.</span>
          </div>
        </div>
      </div>

      <div className="entry-foot fade-up d4">
        <span className="eyebrow">© Receipts · keep score</span>
        <div className="lattice">
          <div>
            <span className="k">Squads</span>
            <span className="v">Invite&nbsp;only</span>
          </div>
          <div>
            <span className="k">Scoring</span>
            <span className="v">Pts / week</span>
          </div>
          <div>
            <span className="k">Referee</span>
            <span className="v">Your&nbsp;friends</span>
          </div>
        </div>
      </div>
    </div>
  );
}
