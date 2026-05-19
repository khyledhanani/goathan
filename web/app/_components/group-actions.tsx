"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { DatePicker } from "./date-picker";
import {
  GROUP_STARTER_PACKS,
  tasksForStarterPack,
} from "@/lib/task-templates";

type GroupActionCallbacks = {
  onSuccess: (msg: string, groupId?: Id<"groups">) => void;
  onError: (msg: string) => void;
};

type StakeKind = "PENALTY" | "REWARD";
const STAKE_TEXT_MAX = 140;

function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  mono,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="cust-dropdown" ref={ref}>
      <button
        type="button"
        className={`cust-dropdown-trigger ${mono ? "mono" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{selected?.label ?? ""}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="cust-dropdown-menu">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`cust-dropdown-item ${opt.value === value ? "active" : ""} ${mono ? "mono" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FixedEndDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const parts = value ? value.split("-") : ["", "", ""];
  const mm = parts[1] ?? "";
  const dd = parts[2] ?? "";
  const yyyy = parts[0] ?? "";

  const update = (m: string, d: string, y: string) => {
    if (m || d || y) {
      onChange(
        `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
      );
    } else {
      onChange("");
    }
  };

  return (
    <>
      <span className="field-label" style={{ marginBottom: 6 }}>
        <span>Ends on</span>
        <span className="hint">Type or pick a date</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          className="field-input mono-input"
          type="text"
          inputMode="numeric"
          placeholder="MM"
          maxLength={2}
          value={mm.replace(/^0+(\d)/, "$1")}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
            update(v, dd, yyyy);
          }}
          style={{ width: 52, textAlign: "center", fontSize: 18 }}
        />
        <span style={{ fontSize: 20, color: "var(--fog)" }}>/</span>
        <input
          className="field-input mono-input"
          type="text"
          inputMode="numeric"
          placeholder="DD"
          maxLength={2}
          value={dd.replace(/^0+(\d)/, "$1")}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
            update(mm, v, yyyy);
          }}
          style={{ width: 52, textAlign: "center", fontSize: 18 }}
        />
        <span style={{ fontSize: 20, color: "var(--fog)" }}>/</span>
        <input
          className="field-input mono-input"
          type="text"
          inputMode="numeric"
          placeholder="YYYY"
          maxLength={4}
          value={yyyy === "0000" ? "" : yyyy.replace(/^0+(\d+)/, "$1")}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            update(mm, dd, v);
          }}
          style={{ width: 68, textAlign: "center", fontSize: 18 }}
        />
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setOpen((o) => !o)}
          style={{ padding: "6px 10px", marginLeft: 4 }}
          aria-label="Open calendar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <DatePicker
            value={value}
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}

function StakeFields({
  stakeKind,
  stakeText,
  onStakeKindChange,
  onStakeTextChange,
}: {
  stakeKind: StakeKind;
  stakeText: string;
  onStakeKindChange: (kind: StakeKind) => void;
  onStakeTextChange: (text: string) => void;
}) {
  return (
    <div className="field">
      <div className="stake-control-head">
        <div
          className="seg stake-toggle"
          role="group"
          aria-label="Penalty or reward type"
        >
          {(
            [
              { key: "PENALTY", label: "Penalty" },
              { key: "REWARD", label: "Reward" },
            ] as const
          ).map((opt, i) => (
            <span key={opt.key} style={{ display: "contents" }}>
              {i > 0 && <span className="seg-dot">/</span>}
              <button
                type="button"
                className={stakeKind === opt.key ? "active" : ""}
                onClick={() => onStakeKindChange(opt.key)}
              >
                {opt.label}
              </button>
            </span>
          ))}
        </div>
        <span className="stake-optional-hint">Optional</span>
      </div>
      <textarea
        className="stake-textarea"
        aria-label="Penalty or reward details"
        placeholder={
          stakeKind === "PENALTY"
            ? "Loser buys coffee for the group"
            : "Winner picks next week's workout"
        }
        value={stakeText}
        maxLength={STAKE_TEXT_MAX}
        rows={3}
        onChange={(e) => onStakeTextChange(e.target.value)}
      />
      <span className="stake-char-count mono">
        {stakeText.length}/{STAKE_TEXT_MAX}
      </span>
    </div>
  );
}

export function GroupCreateForm({ onSuccess, onError }: GroupActionCallbacks) {
  const [name, setName] = useState("");
  const [starterPackId, setStarterPackId] = useState("the-cut");
  const [resetMode, setResetMode] = useState<
    "weekly" | "monthly" | "custom" | "fixed"
  >("weekly");
  const [resetDays, setResetDays] = useState("14");
  const [resetWeekday, setResetWeekday] = useState(() => new Date().getDay());
  const [resetDayOfMonth, setResetDayOfMonth] = useState(() =>
    new Date().getDate(),
  );
  const [endDate, setEndDate] = useState("");
  const [stakeKind, setStakeKind] = useState<StakeKind>("PENALTY");
  const [stakeText, setStakeText] = useState("");
  const [busy, setBusy] = useState(false);

  const createGroup = useMutation(api.groups.create);

  const starterPack =
    GROUP_STARTER_PACKS.find((pack) => pack.id === starterPackId) ??
    GROUP_STARTER_PACKS[0];
  const starterTasks = tasksForStarterPack(starterPack);
  const canCreate =
    name.trim().length > 0 && stakeText.length <= STAKE_TEXT_MAX && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      let durationDays: number | undefined;
      let repeat = true;
      let cadence: "monthly" | undefined;
      let anchorDate: number | undefined;

      const now = new Date();
      const todayMs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );

      if (resetMode === "weekly") {
        durationDays = 7;
        const todayDay = new Date(todayMs).getUTCDay();
        const diff = ((todayDay - resetWeekday) % 7 + 7) % 7;
        anchorDate = todayMs - diff * 86_400_000;
      } else if (resetMode === "monthly") {
        cadence = "monthly";
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        const maxDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const day = Math.min(resetDayOfMonth, maxDay);
        let anchor = Date.UTC(y, m, day);
        if (anchor > todayMs) {
          const pm = m - 1;
          const py = pm < 0 ? y - 1 : y;
          const pmn = ((pm % 12) + 12) % 12;
          const pmMax = new Date(Date.UTC(py, pmn + 1, 0)).getUTCDate();
          anchor = Date.UTC(py, pmn, Math.min(resetDayOfMonth, pmMax));
        }
        anchorDate = anchor;
      } else if (resetMode === "fixed") {
        const [yyyy, mm, dd] = endDate.split("-").map((s) => parseInt(s, 10));
        if (yyyy && mm && dd) {
          const end = Date.UTC(yyyy, mm - 1, dd);
          durationDays = Math.max(1, Math.round((end - todayMs) / 86_400_000));
        } else {
          durationDays = 30;
        }
        repeat = false;
      } else {
        durationDays = parseInt(resetDays, 10) || 7;
      }

      const result = await createGroup({
        name: name.trim(),
        tasks: starterTasks,
        durationDays,
        repeat,
        cadence,
        anchorDate,
        anchorDayOfMonth: cadence === "monthly" ? resetDayOfMonth : undefined,
        stakeKind: stakeText.trim() ? stakeKind : undefined,
        stakeText: stakeText.trim() || undefined,
      });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onSuccess(`Created ${name.trim()}`, result.groupId);
      setName("");
      setStakeText("");
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group-create-layout">
      <div className="group-create-main">
        <label className="field">
          <span className="field-label">
            <span>Group name</span>
            <span className="hint">You&apos;ll be admin</span>
          </span>
          <input
            className="field-input"
            placeholder="The Sunday Crew"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) void submit();
            }}
          />
        </label>

        <div className="field">
          <span className="field-label">
            <span>Starter pack</span>
            <span className="hint">Can change later</span>
          </span>
          <div className="starter-pack-grid">
            {GROUP_STARTER_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={`starter-pack-card ${
                  starterPackId === pack.id ? "active" : ""
                }`}
                onClick={() => setStarterPackId(pack.id)}
              >
                <span className="starter-pack-name">{pack.label}</span>
                <span className="starter-pack-count mono">
                  {pack.taskIds.length === 0
                    ? "Blank slate"
                    : `${pack.taskIds.length} tasks`}
                </span>
              </button>
            ))}
          </div>
        </div>

        <StakeFields
          stakeKind={stakeKind}
          stakeText={stakeText}
          onStakeKindChange={setStakeKind}
          onStakeTextChange={setStakeText}
        />

        <div className="field">
          <span className="field-label">
            <span>Competition reset</span>
          </span>
          <div className="seg" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            {(
              [
                { key: "weekly", label: "Weekly" },
                { key: "monthly", label: "Monthly" },
                { key: "custom", label: "Custom" },
                { key: "fixed", label: "Fixed end" },
              ] as const
            ).map((opt, i) => (
              <span key={opt.key} style={{ display: "contents" }}>
                {i > 0 && <span className="seg-dot">/</span>}
                <button
                  className={resetMode === opt.key ? "active" : ""}
                  onClick={() => setResetMode(opt.key)}
                >
                  {opt.label}
                </button>
              </span>
            ))}
          </div>
          {resetMode === "weekly" && (
            <div className="reset-detail">
              <span className="field-label" style={{ margin: 0 }}>
                Resets every
              </span>
              <Dropdown
                value={resetWeekday}
                options={[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((day, i) => ({ value: i, label: day }))}
                onChange={setResetWeekday}
              />
            </div>
          )}
          {resetMode === "monthly" && (
            <>
              <div className="reset-detail">
                <span className="field-label" style={{ margin: 0 }}>
                  Resets every
                </span>
                <Dropdown
                  mono
                  value={resetDayOfMonth}
                  options={Array.from({ length: 31 }, (_, i) => {
                    const d = i + 1;
                    const suffix =
                      d === 1 || d === 21 || d === 31
                        ? "st"
                        : d === 2 || d === 22
                          ? "nd"
                          : d === 3 || d === 23
                            ? "rd"
                            : "th";
                    return { value: d, label: `${d}${suffix}` };
                  })}
                  onChange={setResetDayOfMonth}
                />
                <span className="field-label" style={{ margin: 0 }}>
                  of each month
                </span>
              </div>
              {resetDayOfMonth > 28 && (
                <p className="muted-line" style={{ margin: "6px 0 0", fontSize: 12 }}>
                  In shorter months, resets on the last day instead.
                </p>
              )}
            </>
          )}
          {resetMode === "custom" && (
            <div className="reset-detail">
              <span className="field-label" style={{ margin: 0 }}>
                Resets every
              </span>
              <input
                className="field-input mono-input"
                type="number"
                min={1}
                max={365}
                value={resetDays}
                onChange={(e) => setResetDays(e.target.value)}
                style={{ width: 64, textAlign: "center" }}
              />
              <span className="field-label" style={{ margin: 0 }}>
                days
              </span>
            </div>
          )}
          {resetMode === "fixed" && (
            <FixedEndDateInput value={endDate} onChange={setEndDate} />
          )}
        </div>

        <button className="btn-primary" disabled={!canCreate} onClick={submit}>
          {busy ? "Creating…" : "Create group"}
          <span className="arrow">→</span>
        </button>
      </div>

      <aside className="group-create-sidebar">
        <span className="field-label">
          <span>Starting slate</span>
          <span className="hint">
            {starterTasks.length === 0 ? "Blank" : `${starterTasks.length} tasks`}
          </span>
        </span>
        {starterTasks.length === 0 ? (
          <p className="starter-preview-empty">
            No starter tasks. Add your own once the group is created.
          </p>
        ) : (
          <ul className="starter-task-list">
            {starterTasks.map((task) => (
              <li
                key={`${task.name}:${task.frequency}`}
                className="starter-task-row"
              >
                <span className="starter-task-name">{task.name}</span>
                <span className="starter-task-meta mono">
                  {task.category} · {task.frequency} · {task.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export function GroupEditModal({
  groupId,
  initialName,
  initialStakeKind,
  initialStakeText,
  onClose,
  onSaved,
}: {
  groupId: Id<"groups">;
  initialName: string;
  initialStakeKind: StakeKind | null;
  initialStakeText: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [stakeKind, setStakeKind] = useState<StakeKind>(
    initialStakeKind ?? "PENALTY",
  );
  const [stakeText, setStakeText] = useState(initialStakeText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateSettings = useMutation(api.groups.updateSettings);

  const canSave =
    name.trim().length > 0 && stakeText.length <= STAKE_TEXT_MAX && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateSettings({
        groupId,
        name: name.trim(),
        stakeKind: stakeText.trim() ? stakeKind : undefined,
        stakeText: stakeText.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved("Group updated");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      onClick={busy ? undefined : onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <span className="eyebrow">Group settings</span>
          <h2 className="modal-title">
            Edit group<span className="roman">.</span>
          </h2>
        </header>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">
              <span>Group name</span>
              <span className="hint">Required</span>
            </span>
            <input
              className="field-input"
              value={name}
              maxLength={40}
              placeholder="The Sunday Crew"
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) void submit();
              }}
            />
          </label>

          <StakeFields
            stakeKind={stakeKind}
            stakeText={stakeText}
            onStakeKindChange={setStakeKind}
            onStakeTextChange={setStakeText}
          />
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
          <button className="btn-primary" disabled={!canSave} onClick={submit}>
            {busy ? "Saving…" : "Save changes"}
            <span className="arrow">→</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

export function GroupJoinForm({ onSuccess, onError }: GroupActionCallbacks) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const joinByCode = useMutation(api.groups.joinByCode);
  const canJoin = /^[A-Z0-9]{6}$/.test(code) && !busy;

  const submit = async () => {
    if (!canJoin) return;
    setBusy(true);
    try {
      const result = await joinByCode({ inviteCode: code });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onSuccess("You're in the group");
      setCode("");
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group-actions group-actions-join">
      <label className="field">
        <span className="field-label">
          <span>Invite code</span>
          <span className="hint">6 characters</span>
        </span>
        <input
          className="field-input mono-input"
          placeholder="ABC123"
          value={code}
          maxLength={6}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && canJoin) void submit();
          }}
        />
      </label>

      <div style={{ marginTop: 22 }}>
        <button className="btn-primary" disabled={!canJoin} onClick={submit}>
          {busy ? "Joining…" : "Join group"}
          <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}

export function CreateOrJoinGroups({
  onSuccess,
  onError,
}: GroupActionCallbacks) {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="group-entry-row">
      <Link href="/groups/create" className="btn-primary">
        Create a new group
      </Link>
      <button
        className="btn-ghost"
        onClick={() => setJoinOpen((o) => !o)}
      >
        {joinOpen ? "Cancel" : "Join a group with code"}
      </button>
      {joinOpen && (
        <div className="group-entry-join-inline">
          <GroupJoinForm onSuccess={onSuccess} onError={onError} />
        </div>
      )}
    </div>
  );
}
