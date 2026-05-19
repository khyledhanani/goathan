"use client";

import { useState } from "react";
import {
  TASK_CATEGORIES,
  TASK_FREQUENCIES,
  TASK_PROOFS,
  TASK_TEMPLATES,
  taskTemplateById,
  type TaskCategory,
  type TaskFrequency,
  type TaskProof,
} from "@/lib/task-templates";

export type AddTaskInput = {
  name: string;
  description?: string;
  category: TaskCategory;
  points: number;
  frequency: TaskFrequency;
  proof: TaskProof;
};

const BLANK_TEMPLATE_ID = "blank";

export function AddTaskModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: AddTaskInput) => Promise<string | null>;
}) {
  const [templateId, setTemplateId] = useState(BLANK_TEMPLATE_ID);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState<number>(15);
  const [category, setCategory] = useState<TaskCategory>("MOVE");
  const [frequency, setFrequency] = useState<TaskFrequency>("DAILY");
  const [proof, setProof] = useState<TaskProof>("PHOTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && points >= 1 && !busy;

  const onTemplateChange = (nextId: string) => {
    setTemplateId(nextId);
    setTemplateOpen(false);
    if (nextId === BLANK_TEMPLATE_ID) {
      setName("");
      setDescription("");
      setPoints(15);
      setCategory("MOVE");
      setFrequency("DAILY");
      setProof("PHOTO");
      return;
    }

    const template = taskTemplateById(nextId);
    if (!template) return;
    setName(template.name);
    setDescription(template.description ?? "");
    setPoints(template.points);
    setCategory(template.category);
    setFrequency(template.frequency);
    setProof(template.proof);
  };

  const selectedTemplateLabel =
    templateId === BLANK_TEMPLATE_ID
      ? "Blank custom task"
      : (taskTemplateById(templateId)?.label ?? "Blank custom task");

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
          <div className="field template-field">
            <span className="field-label">
              <span>Task template</span>
              <span className="hint">Optional autofill</span>
            </span>
            <div className="template-picker">
              <button
                type="button"
                className="template-trigger"
                autoFocus
                aria-haspopup="listbox"
                aria-expanded={templateOpen}
                onClick={() => setTemplateOpen((open) => !open)}
              >
                <span className="template-trigger-main">
                  {selectedTemplateLabel}
                </span>
                <span className="template-trigger-meta">
                  {templateId === BLANK_TEMPLATE_ID
                    ? "Start from scratch"
                    : "Fields prefilled"}
                </span>
                <span className="template-trigger-arrow" aria-hidden>
                  ↓
                </span>
              </button>

              {templateOpen && (
                <div className="template-menu" role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected={templateId === BLANK_TEMPLATE_ID}
                    className={`template-option ${
                      templateId === BLANK_TEMPLATE_ID ? "active" : ""
                    }`}
                    onClick={() => onTemplateChange(BLANK_TEMPLATE_ID)}
                  >
                    <span className="template-option-name">
                      Blank custom task
                    </span>
                    <span className="template-option-meta">
                      No autofill
                    </span>
                  </button>
                  {TASK_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      role="option"
                      aria-selected={templateId === template.id}
                      className={`template-option ${
                        templateId === template.id ? "active" : ""
                      }`}
                      onClick={() => onTemplateChange(template.id)}
                    >
                      <span className="template-option-name">
                        {template.label}
                      </span>
                      <span className="template-option-meta">
                        {template.category} · {template.frequency} ·{" "}
                        {template.points} pts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="field">
            <span className="field-label">
              <span>Task name</span>
              <span className="hint">Required</span>
            </span>
            <input
              className="field-input"
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
              {TASK_CATEGORIES.map((c) => (
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
              {TASK_FREQUENCIES.map((f) => (
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
              {TASK_PROOFS.map((p) => (
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
