import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}

export function FormField({ id, label, hint, error, required, className, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const child = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-required": required ? (true as const) : undefined,
  });

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-muted-foreground text-xs">(required)</span>}
      </Label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {child}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
