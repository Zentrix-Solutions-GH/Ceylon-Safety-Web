"use client";

import { useState, useCallback, useRef } from "react";
import type React from "react";
import type { ZodSchema } from "zod";
import type { ActionResult } from "@/types/api";

type FieldEvent = React.FocusEvent<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
>;

interface UseActionFormOptions<TData, TValues extends Record<string, unknown>> {
  schema: ZodSchema<TValues>;
  action: (values: TValues) => Promise<ActionResult<TData>>;
  mapError: (code: string, reason?: string) => string;
  onSuccess?: (data: TData | undefined) => void;
}

interface UseActionFormReturn {
  fieldErrors: Record<string, string>;
  formError: string | undefined;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleBlur: (e: FieldEvent) => void;
}

function getFormValues(form: HTMLFormElement): Record<string, unknown> {
  return Object.fromEntries(new FormData(form).entries());
}

function focusFirstError(form: HTMLFormElement, errors: Record<string, string>) {
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;
  const el = form.querySelector<HTMLElement>(`[name="${firstKey}"], #${firstKey}`);
  el?.focus();
}

export function useActionForm<TData, TValues extends Record<string, unknown>>({
  schema,
  action,
  mapError,
  onSuccess,
}: UseActionFormOptions<TData, TValues>): UseActionFormReturn {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const inFlight = useRef(false);

  const validate = useCallback(
    (values: Record<string, unknown>): values is TValues => {
      const result = schema.safeParse(values);
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0]?.toString() ?? "_";
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return false;
      }
      setFieldErrors({});
      return true;
    },
    [schema]
  );

  const handleBlur = useCallback(
    (e: FieldEvent) => {
      const form = e.currentTarget.form;
      if (!form) return;
      const name = e.currentTarget.name;
      const values = getFormValues(form);
      const result = schema.safeParse(values);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0]?.toString() === name);
        if (issue) setFieldErrors((prev) => ({ ...prev, [name]: issue.message }));
      } else {
        setFieldErrors((prev) => {
          if (!prev[name]) return prev;
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    },
    [schema]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (inFlight.current) return; // EC1: double-submit guard

      const form = e.currentTarget;
      const values = getFormValues(form);

      if (!validate(values)) {
        // fieldErrors state is set inside validate; grab them from the schema parse
        const parseResult = schema.safeParse(values);
        if (!parseResult.success) {
          const errs: Record<string, string> = {};
          for (const issue of parseResult.error.issues) {
            const key = issue.path[0]?.toString() ?? "_";
            if (!errs[key]) errs[key] = issue.message;
          }
          focusFirstError(form, errs);
        }
        return;
      }

      inFlight.current = true;
      setIsPending(true);
      setFormError(undefined);

      try {
        const result = await action(values as TValues);
        if (result.ok) {
          onSuccess?.(result.data);
        } else {
          const msg = mapError(result.code, result.reason);
          if (result.field) {
            const errs = { [result.field]: msg };
            setFieldErrors(errs);
            focusFirstError(form, errs);
          } else {
            setFormError(msg);
          }
        }
      } catch {
        // EC2: network error or thrown exception → treat as unknown
        setFormError(mapError("unknown", undefined));
      } finally {
        inFlight.current = false;
        setIsPending(false);
      }
    },
    [action, mapError, onSuccess, schema, validate]
  );

  return { fieldErrors, formError, isPending, handleSubmit, handleBlur };
}
