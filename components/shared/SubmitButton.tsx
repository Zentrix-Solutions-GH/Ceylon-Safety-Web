"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  isPending?: boolean;
  pendingLabel?: string;
}

export function SubmitButton({
  children,
  isPending = false,
  pendingLabel = "Saving...",
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={isPending || disabled}
      aria-busy={isPending || undefined}
      {...props}
    >
      {isPending ? pendingLabel : children}
    </Button>
  );
}
