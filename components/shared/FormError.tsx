import * as React from "react";

interface FormErrorProps {
  errors: Record<string, string>;
  nonFieldError?: string;
}

export function FormError({ errors, nonFieldError }: FormErrorProps) {
  const fieldErrors = Object.entries(errors).filter(([, msg]) => msg);
  const hasErrors = fieldErrors.length > 0 || Boolean(nonFieldError);

  if (!hasErrors) return null;

  return (
    <div
      role="alert"
      aria-label="Form errors"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <p className="font-medium">Please fix the following:</p>
      <ul className="mt-2 list-disc pl-4 space-y-1">
        {fieldErrors.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`} className="underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring rounded">
              {message}
            </a>
          </li>
        ))}
        {nonFieldError && <li>{nonFieldError}</li>}
      </ul>
    </div>
  );
}
