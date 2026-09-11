"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TextField({
  id,
  label,
  value,
  defaultValue,
  onChange,
  error,
  hint,
  type = "text",
  required = false,
  disabled = false,
  placeholder,
}: {
  id: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className="h-9"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
