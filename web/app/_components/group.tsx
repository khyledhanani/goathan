import type { Member } from "@/lib/types";

export function GroupPage({
  groupName,
  inviteCode,
  members,
  youAdmin,
  onCopy,
}: {
  groupName: string;
  inviteCode: string;
  members: Member[];
  youAdmin?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <span className="eyebrow">
            <b>{members.length}</b> members · private
            {youAdmin && (
              <>
                {" "}· you are <b>admin</b>
              </>
            )}
          </span>
          <h1 className="h-page" style={{ marginTop: 8 }}>
            {groupName}
            <span className="roman">.</span>
          </h1>
        </div>
        <div className="meta-block">
          <span className="eyebrow">Founded</span>
          <span className="v">Week 3 · v0.1</span>
        </div>
      </header>

      <section className="invite-card fade-up d1">
        <div>
          <div className="label">Invite code</div>
          <div className="code">{inviteCode}</div>
        </div>
        <button className="btn-ghost" onClick={onCopy}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
          Copy code
        </button>
      </section>

      <header className="section-head">
        <h2 className="h-section">The roster.</h2>
        <span className="eyebrow">Pts · week</span>
      </header>

      <div className="member-table fade-up d2">
        {[...members]
          .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
          .map((m) => (
            <div key={m.id} className="member-row">
              <div>
                <div className="member-name">
                  {m.name}
                  {m.isYou && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontFamily: "var(--font-mono)",
                        fontStyle: "normal",
                        fontSize: 10,
                        color: "var(--accent)",
                        letterSpacing: "0.14em",
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <div className="member-role">
                  {m.handle} · {m.isAdmin ? "Admin" : "Member"}
                </div>
              </div>
              <div className="member-pts num">{m.weeklyPoints}</div>
            </div>
          ))}
      </div>
    </div>
  );
}
