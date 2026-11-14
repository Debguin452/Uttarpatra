import type { ComponentChildren } from "preact";
import { t } from "@coaching-app/shared/i18n";
import { Sheet } from "./ui";

export function Field({
  id,
  label,
  hint,
  error,
  span,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  span?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div class={span ? "field span" : "field"}>
      <label for={id}>{label}</label>
      {children}
      {error ? <span class="error-text">{error}</span> : hint ? <span class="hint">{hint}</span> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button type="button" role="radio" aria-checked={value === option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet onClose={busy ? undefined : onCancel}>
      <h2 class="subtitle">{title}</h2>
      <p class="muted small">{body}</p>
      <button class={danger ? "btn danger block" : "btn primary block"} onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </button>
      <button class="btn quiet block" onClick={onCancel} disabled={busy}>
        {t("cancel")}
      </button>
    </Sheet>
  );
}
