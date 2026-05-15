import { useState } from "react";

export function GroupSetupScreen({
  userName,
  onCreate,
  onJoin,
}: {
  userName: string;
  onCreate: (name: string) => void;
  onJoin: (code: string) => void;
}) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [gname, setGname] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="entry">
      <div className="entry-top fade-up">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <span className="eyebrow">
          Welcome, <b>{userName}</b>
        </span>
      </div>

      <div className="entry-mid">
        <h1 className="entry-hed fade-up d1">
          Start a <span className="underline">squad</span>.
        </h1>
        <p className="entry-dek fade-up d2">
          Make a private group with friends, or drop in with a code someone sent you.
        </p>

        <div className="fade-up d3" style={{ maxWidth: 460 }}>
          <div className="seg">
            <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
              Create
            </button>
            <span className="seg-dot">/</span>
            <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
              Join with code
            </button>
          </div>

          {mode === "create" ? (
            <>
              <label className="field">
                <span className="field-label">
                  <span>Squad name</span>
                  <span className="hint">You&apos;ll be admin</span>
                </span>
                <input
                  className="field-input"
                  placeholder="The Goon Squad"
                  value={gname}
                  maxLength={22}
                  onChange={(e) => setGname(e.target.value)}
                />
              </label>
              <div style={{ marginTop: 28 }}>
                <button className="btn-primary" disabled={!gname.trim()} onClick={() => onCreate(gname)}>
                  Open lobby<span className="arrow">→</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">
                  <span>Invite code</span>
                  <span className="hint">6 characters</span>
                </span>
                <input
                  className="field-input mono-input"
                  placeholder="ABC123"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                />
              </label>
              <div style={{ marginTop: 28 }}>
                <button className="btn-primary" disabled={code.length !== 6} onClick={() => onJoin(code)}>
                  Join squad<span className="arrow">→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="entry-foot fade-up d4">
        <span className="eyebrow">
          Step <b>2 / 2</b>
        </span>
        <span className="eyebrow">Private group · no public discovery</span>
      </div>
    </div>
  );
}
