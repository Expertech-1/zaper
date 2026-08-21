import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

const CONTROL_CLASSES = [
  "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm",
  "text-zinc-900 placeholder:text-zinc-400",
  "focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500",
].join(" ");

interface FieldProps {
  label: string;
  /** Short explanation rendered under the control. */
  hint?: ReactNode;
  children: (controlProps: {
    id: string;
    className: string;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/**
 * Label + control + hint, wired together with matching `id`/`aria-describedby`
 * so every control is properly labelled without repeating the plumbing.
 */
export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children({ id, className: CONTROL_CLASSES, "aria-describedby": hintId })}
      {hint ? (
        <p id={hintId} className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = { label: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, hint, ...props }: TextFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(controlProps) => <input {...controlProps} {...props} />}
    </Field>
  );
}

type TextAreaFieldProps = {
  label: string;
  hint?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({ label, hint, rows = 3, ...props }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(controlProps) => <textarea rows={rows} {...controlProps} {...props} />}
    </Field>
  );
}

type SelectFieldProps = {
  label: string;
  hint?: ReactNode;
  options: readonly { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ label, hint, options, ...props }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(controlProps) => (
        <select {...controlProps} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface ToggleFieldProps {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** Checkbox with the label to its right — used for all boolean preferences. */
export function ToggleField({ label, hint, checked, disabled, onChange }: ToggleFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-zinc-800 dark:text-zinc-200">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Comma-separated editor for a string list (skills, technologies, tags).
 *
 * Keeps the raw text the user typed so a trailing comma does not disappear
 * mid-keystroke; normalization happens in Rust on save.
 */
interface TagsFieldProps {
  label: string;
  hint?: ReactNode;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TagsField({ label, hint, value, disabled, placeholder, onChange }: TagsFieldProps) {
  return (
    <TextField
      label={label}
      hint={hint ?? "Separate entries with commas."}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
