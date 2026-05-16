"use client";

import { useState } from "react";

type Category = "GYM" | "CARDIO" | "NUTRITION" | "RECOVERY" | "PROGRESS";
type Frequency = "DAILY" | "WEEKLY";
type Proof = "PHOTO" | "SCREENSHOT" | "MANUAL" | "VIDEO";

const CATEGORIES: Category[] = ["GYM", "CARDIO", "NUTRITION", "RECOVERY", "PROGRESS"];
const FREQUENCIES: Frequency[] = ["DAILY", "WEEKLY"];
const PROOFS: Proof[] = ["PHOTO", "SCREENSHOT", "MANUAL", "VIDEO"];

export type AddTaskInput = {
  name: string;
  description?: string;
  category: Category;
  points: number;
  frequency: Frequency;
  proof: Proof;
};

export function AddTaskModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: AddTaskInput) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState<number>(15);
  const [category, setCategory] = useState<Category>("GYM");
  const [frequency, setFrequency] = useState<Frequency>("DAILY");
  const [proof, setProof] = useState<Proof>("MANUAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && points >= 1 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      points,
      frequency,
      proof,
    });
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <span className="eyebrow">New line</span>
          <h2 className="modal-title">Drop a task<span className="roman">.</span></h2>
        </header>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">
              <span>Task name</span>
              <span className="hint">Required</span>
            </span>
            <input
              className="field-input"
              autoFocus
              value={name}
              maxLength={60}
              placeholder="Leg day check"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">
              <span>Description</span>
              <span className="hint">Optional</span>
            </span>
            <input
              className="field-input"
              value={description}
              maxLength={120}
              placeholder="What does it take"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="field">
            <span className="field-label">
              <span>Category</span>
            </span>
            <div className="option-grid">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`option ${category === c ? "active" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              <span>Frequency</span>
            </span>
            <div className="option-grid">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`option ${frequency === f ? "active" : ""}`}
                  onClick={() => setFrequency(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              <span>Proof requirement</span>
            </span>
            <div className="option-grid">
              {PROOFS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`option ${proof === p ? "active" : ""}`}
                  onClick={() => setProof(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">
              <span>Points</span>
              <span className="hint">1–200</span>
            </span>
            <input
              className="field-input mono-input"
              type="number"
              min={1}
              max={200}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </label>
        </div>

        {error && (
          <p className="modal-error" role="alert">
            {error}
          </p>
        )}

        <footer className="modal-foot">
          <button className="btn-link" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
            {busy ? "Adding…" : "Add to slate"}
            <span className="arrow">→</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
