"use client";

import { useEffect, useRef } from "react";
import type { PayHereFormFields } from "@/types/payhere";

interface Props {
  fields: PayHereFormFields;
}

export default function PayHereRedirect({ fields }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  const { checkout_url, ...formFields } = fields;

  return (
    <form ref={formRef} action={checkout_url} method="POST" style={{ display: "none" }}>
      {Object.entries(formFields).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={String(val)} />
      ))}
    </form>
  );
}
