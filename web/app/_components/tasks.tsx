import type { Task } from "@/lib/types";

export function TasksPage({
  tasks,
  isAdmin,
  onAdd,
}: {
  tasks: Task[];
  isAdmin?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <span className="eyebrow">
            {tasks.length} active lines ·{" "}
            {isAdmin ? (
              <>
                you <b>manage</b> this slate
              </>
            ) : (
              <b>admin only</b>
            )}
          </span>
          <h1 className="h-page" style={{ marginTop: 8 }}>
            The slate<span className="roman">.</span>
          </h1>
        </div>
        <div className="meta-block">
          <span className="eyebrow">Frequency mix</span>
          <span className="v">
            {tasks.filter((t) => t.frequency === "DAILY").length} daily ·{" "}
            {tasks.filter((t) => t.frequency === "WEEKLY").length} weekly
          </span>
        </div>
      </header>

      <div className="admin-bar fade-up d1">
        <span className="eyebrow">Daily & weekly props</span>
        {isAdmin && (
          <button className="btn-primary" onClick={onAdd}>
            New line<span className="arrow">+</span>
          </button>
        )}
      </div>

      <div className="admin-table fade-up d2">
        {tasks.map((t) => (
          <div key={t.id} className="admin-row">
            <div className="name">{t.name}</div>
            <div className="pts num">{t.points}</div>
            <div className="meta">
              <span>
                <b>{t.category}</b>
              </span>
              <span className="sep">·</span>
              <span>{t.frequency}</span>
              <span className="sep">·</span>
              <span>
                Proof <b>{t.proof}</b>
              </span>
              <span className="sep">·</span>
              <span style={{ color: "var(--smoke)" }}>{t.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
