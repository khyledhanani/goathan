import { useState } from "react";
import type { Category, Frequency, Proof, Task } from "@/lib/types";
import { CATEGORIES, FREQUENCIES, PROOFS } from "@/lib/seed";
import { titleCase } from "@/lib/utils";

export function AddTaskModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: Omit<Task, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState<number>(20);
  const [cat, setCat] = useState<Category>("GYM");
  const [freq, setFreq] = useState<Frequency>("DAILY");
  const [proof, setProof] = useState<Proof>("PHOTO");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      name: titleCase(name.trim()),
      description: desc.trim() || "Mark as done when you complete it.",
      category: cat,
      points: Number.isFinite(points) && points > 0 ? Math.floor(points) : 10,
      frequency: freq,
      proof,
    });
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New line.</h2>
        <div className="sub">Score for the squad · admin only</div>

        <div className="modal-grid">
          <label className="field full">
            <span className="field-label">
              <span>Task name</span>
              <span className="hint">Required</span>
            </span>
            <input
              className="field-input compact"
              placeholder="Leg day check"
              value={name}
              maxLength={36}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field full">
            <span className="field-label">
              <span>Description</span>
              <span className="hint">Optional</span>
            </span>
            <input
              className="field-input compact"
              placeholder="What's the bar to clear"
              value={desc}
              maxLength={90}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">
              <span>Points</span>
            </span>
            <input
              className="field-input compact"
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value, 10))}
            />
          </label>

          <div>
            <span className="field-label">
              <span>Frequency</span>
            </span>
            <div className="option-grid">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={freq === f ? "active" : ""}
                  onClick={() => setFreq(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="full">
            <span className="field-label">
              <span>Category</span>
            </span>
            <div className="option-grid cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cat === c ? "active" : ""}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="full">
            <span className="field-label">
              <span>Proof requirement</span>
            </span>
            <div className="option-grid cols-4">
              {PROOFS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={proof === p ? "active" : ""}
                  onClick={() => setProof(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!name.trim()} onClick={submit}>
            Drop the line<span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
