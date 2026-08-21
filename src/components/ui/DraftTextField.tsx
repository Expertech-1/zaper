import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextField } from "./Field";

/**
 * Text input for a persisted value, committed on blur or Enter.
 *
 * Settings and other backend-owned fields must not be written on every
 * keystroke: each write is validated by Rust, so an intermediate value (an empty
 * box mid-edit, a half-typed language tag) would flash a spurious error and
 * hammer the database. This keeps a local draft and commits once the user is
 * done, reverting on Escape.
 */
interface DraftTextFieldProps {
  label: string;
  hint?: ReactNode;
  /** The persisted value. Changes to it re-seed the draft. */
  value: string;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "password" | "number" | "url";
  onCommit: (value: string) => void;
}

export function DraftTextField({
  label,
  hint,
  value,
  disabled,
  placeholder,
  type = "text",
  onCommit,
}: DraftTextFieldProps) {
  const [draft, setDraft] = useState(value);

  // Track the last persisted value we synced from, so an external change (a
  // reset to defaults, a reload) replaces the draft, while our own commit does
  // not clobber further typing.
  const lastSynced = useRef(value);

  useEffect(() => {
    if (value !== lastSynced.current) {
      lastSynced.current = value;
      setDraft(value);
    }
  }, [value]);

  const commit = () => {
    if (draft === value) return;
    lastSynced.current = draft;
    onCommit(draft);
  };

  return (
    <TextField
      label={label}
      hint={hint}
      type={type}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          setDraft(value);
        }
      }}
    />
  );
}
