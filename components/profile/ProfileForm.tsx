"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { updateProfile } from "@/lib/auth/actions/update-profile";
import { changePassword } from "@/lib/auth/actions/change-password";
import { deleteAccount } from "@/lib/auth/actions/delete-account";
import { requestReverification } from "@/lib/auth/actions/request-reverification";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { t, errorMessage } from "@/messages/en";
import type { BillingAddress } from "@/types/user";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileData {
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  phone: string | null;
  companyName: string | null;
  billingAddress: BillingAddress | null;
}

export interface ProfileFormProps {
  profile: ProfileData;
  isGoogleOnly: boolean;
  isStaff: boolean;
}

// ─── ProfileForm ──────────────────────────────────────────────────────────────

export function ProfileForm({ profile, isGoogleOnly, isStaff }: ProfileFormProps) {
  return (
    <div className="max-w-xl space-y-10">
      <h1 className="text-2xl font-semibold">{t("profile.heading")}</h1>
      <DetailsSection profile={profile} />
      <AddressSection billingAddress={profile.billingAddress} />
      <PasswordSection isGoogleOnly={isGoogleOnly} />
      {!isStaff && <DeleteSection />}
    </div>
  );
}

// ─── Your details ─────────────────────────────────────────────────────────────

function DetailsSection({ profile }: { profile: ProfileData }) {
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);
    setTopError(null);
    setSaved(false);
    setPending(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const result = await updateProfile({
        firstName: (data.get("firstName") as string) || undefined,
        lastName: (data.get("lastName") as string) || undefined,
        displayName: (data.get("displayName") as string) || undefined,
        phone: (data.get("phone") as string) || undefined,
        companyName: (data.get("companyName") as string) || undefined,
      });

      if (!result.ok) {
        const msg = errorMessage(result.code);
        if (result.field) {
          setFieldError({ field: result.field, message: msg });
        } else {
          setTopError(msg);
        }
        return;
      }

      setSaved(true);
    } finally {
      setPending(false);
    }
  }

  function fieldErr(name: string): string | undefined {
    return fieldError?.field === name ? fieldError.message : undefined;
  }

  return (
    <section aria-labelledby="details-heading">
      <h2 id="details-heading" className="text-lg font-medium mb-4">
        {t("profile.details.heading")}
      </h2>

      {topError && (
        <p role="alert" className="mb-3 text-sm text-destructive">{topError}</p>
      )}
      {saved && (
        <p role="status" className="mb-3 text-sm text-green-600">{t("profile.details.saved")}</p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField id="firstName" label={t("profile.details.first_name")} error={fieldErr("firstName")}>
          <Input name="firstName" defaultValue={profile.firstName ?? ""} autoComplete="given-name" />
        </FormField>

        <FormField id="lastName" label={t("profile.details.last_name")} error={fieldErr("lastName")}>
          <Input name="lastName" defaultValue={profile.lastName ?? ""} autoComplete="family-name" />
        </FormField>

        <FormField id="displayName" label={t("profile.details.display_name")} error={fieldErr("displayName")}>
          <Input name="displayName" defaultValue={profile.displayName} autoComplete="nickname" />
        </FormField>

        <FormField id="phone" label={t("profile.details.phone")} error={fieldErr("phone")}>
          <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />
        </FormField>

        <FormField id="companyName" label={t("profile.details.company")} error={fieldErr("companyName")}>
          <Input name="companyName" defaultValue={profile.companyName ?? ""} autoComplete="organization" />
        </FormField>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? t("profile.details.saving") : t("profile.details.save")}
        </button>
      </form>
    </section>
  );
}

// ─── Saved address ────────────────────────────────────────────────────────────

function AddressSection({ billingAddress }: { billingAddress: BillingAddress | null }) {
  const [pending, setPending] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setSaved(false);
    setPending(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const line1 = (data.get("line1") as string).trim();
    const city = (data.get("city") as string).trim();
    const country = (data.get("country") as string).trim();

    try {
      const result = await updateProfile({
        billingAddress: line1 && city && country
          ? {
              line1,
              line2: (data.get("line2") as string).trim() || undefined,
              city,
              state: (data.get("state") as string).trim() || undefined,
              postalCode: (data.get("postalCode") as string).trim() || undefined,
              country,
            }
          : null,
      });

      if (!result.ok) {
        setTopError(errorMessage(result.code));
        return;
      }

      setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="address-heading">
      <h2 id="address-heading" className="text-lg font-medium mb-4">
        {t("profile.address.heading")}
      </h2>

      {topError && (
        <p role="alert" className="mb-3 text-sm text-destructive">{topError}</p>
      )}
      {saved && (
        <p role="status" className="mb-3 text-sm text-green-600">{t("profile.address.saved")}</p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField id="line1" label={t("profile.address.line1")}>
          <Input name="line1" defaultValue={billingAddress?.line1 ?? ""} autoComplete="address-line1" />
        </FormField>

        <FormField id="line2" label={t("profile.address.line2")}>
          <Input name="line2" defaultValue={billingAddress?.line2 ?? ""} autoComplete="address-line2" />
        </FormField>

        <FormField id="city" label={t("profile.address.city")}>
          <Input name="city" defaultValue={billingAddress?.city ?? ""} autoComplete="address-level2" />
        </FormField>

        <FormField id="state" label={t("profile.address.state")}>
          <Input name="state" defaultValue={billingAddress?.state ?? ""} autoComplete="address-level1" />
        </FormField>

        <FormField id="postalCode" label={t("profile.address.postal_code")}>
          <Input name="postalCode" defaultValue={billingAddress?.postalCode ?? ""} autoComplete="postal-code" />
        </FormField>

        <FormField id="country" label={t("profile.address.country")}>
          <Input name="country" defaultValue={billingAddress?.country ?? ""} autoComplete="country-name" />
        </FormField>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? t("profile.address.saving") : t("profile.address.save")}
        </button>
      </form>
    </section>
  );
}

// ─── Change password ──────────────────────────────────────────────────────────

function PasswordSection({ isGoogleOnly }: { isGoogleOnly: boolean }) {
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSendCode() {
    setSendingCode(true);
    setTopError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.reauthenticate();
      if (error) {
        setTopError(errorMessage("unknown"));
        return;
      }
      setCodeSent(true);
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCodeError(null);
    setPasswordError(null);
    setConfirmError(null);
    setTopError(null);
    setSaved(false);

    const form = e.currentTarget;
    const data = new FormData(form);
    const code = (data.get("code") as string).trim();
    const newPassword = data.get("newPassword") as string;
    const confirmPassword = data.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setConfirmError(t("profile.password.confirm_mismatch"));
      return;
    }

    setPending(true);
    try {
      const result = await changePassword({ code, newPassword });

      if (!result.ok) {
        if (result.code === "code_invalid" || result.code === "code_attempts_exceeded") {
          setCodeError(errorMessage(result.code));
        } else if (result.code === "weak_password") {
          setPasswordError(errorMessage(result.code));
        } else {
          setTopError(errorMessage(result.code));
        }
        return;
      }

      setSaved(true);
      setCodeSent(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-lg font-medium mb-4">
        {t("profile.password.heading")}
      </h2>

      {isGoogleOnly ? (
        <p className="text-sm text-muted-foreground">{t("profile.password.google_only")}</p>
      ) : (
        <>
          {topError && (
            <p role="alert" className="mb-3 text-sm text-destructive">{topError}</p>
          )}
          {saved && (
            <p role="status" className="mb-3 text-sm text-green-600">{t("profile.password.saved")}</p>
          )}

          {!codeSent ? (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sendingCode}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
            >
              {t("profile.password.send_code")}
            </button>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("profile.password.code_sent")}</p>

              <FormField id="code" label={t("profile.password.code_label")} error={codeError ?? undefined}>
                <Input name="code" autoComplete="one-time-code" />
              </FormField>

              <FormField id="newPassword" label={t("profile.password.new_password")} error={passwordError ?? undefined}>
                <Input name="newPassword" type="password" autoComplete="new-password" />
              </FormField>

              <FormField id="confirmPassword" label={t("profile.password.confirm_password")} error={confirmError ?? undefined}>
                <Input name="confirmPassword" type="password" autoComplete="new-password" />
              </FormField>

              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? t("profile.password.saving") : t("profile.password.save")}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}

// ─── Delete account ───────────────────────────────────────────────────────────

function DeleteSection() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [topError, setTopError] = useState<string | null>(null);
  const resetTurnstileRef = useRef<(() => void) | null>(null);

  const handleToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleTurnstileRef = useCallback((reset: () => void) => {
    resetTurnstileRef.current = reset;
  }, []);

  function openModal() {
    setCaptchaToken(null);
    setCodeSent(false);
    setCodeValue("");
    setTopError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function handleSendCode() {
    if (!captchaToken) return;
    setSendingCode(true);
    setTopError(null);
    try {
      const result = await requestReverification({ captchaToken });
      resetTurnstileRef.current?.();
      setCaptchaToken(null);

      if (!result.ok) {
        setTopError(errorMessage(result.code));
        return;
      }
      setCodeSent(true);
    } finally {
      setSendingCode(false);
    }
  }

  async function handleConfirmDelete() {
    if (!codeValue.trim()) return;
    setPending(true);
    setTopError(null);
    try {
      const result = await deleteAccount({ code: codeValue.trim() });

      if (!result.ok) {
        if (result.code === "code_attempts_exceeded") {
          setTopError(t("profile.delete.too_many_attempts"));
          setCodeValue("");
          // Keep codeSent=true so the OTP field stays visible; user enters fresh code
        } else if (result.code === "validation_failed") {
          setTopError(t("profile.delete.blocked"));
        } else {
          setTopError(errorMessage(result.code));
        }
        return;
      }

      router.push("/");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="text-lg font-medium mb-2">
          {t("profile.delete.heading")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{t("profile.delete.description")}</p>
        <button
          type="button"
          onClick={openModal}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          {t("profile.delete.button")}
        </button>
      </section>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-background rounded-lg p-6 max-w-sm w-full shadow-lg space-y-4">
            <h2 id="delete-modal-heading" className="text-lg font-semibold">
              {t("profile.delete.modal_heading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("profile.delete.modal_description")}
            </p>

            {topError && (
              <p role="alert" className="text-sm text-destructive">{topError}</p>
            )}

            {!codeSent ? (
              <div className="space-y-3">
                <TurnstileWidget
                  onToken={handleToken}
                  onError={() => setCaptchaToken(null)}
                  onRef={handleTurnstileRef}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || !captchaToken}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {t("profile.delete.send_code")}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {t("profile.delete.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FormField id="deleteCode" label={t("profile.delete.code_label")}>
                  <Input
                    name="deleteCode"
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    autoComplete="one-time-code"
                  />
                </FormField>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={pending || !codeValue.trim()}
                    className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {pending ? t("profile.delete.confirming") : t("profile.delete.confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {t("profile.delete.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
