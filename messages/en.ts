const en = {
  // --- auth flows ---
  // auth.code_sent has an {email} parameter — used by t() parameter tests.
  "auth.code_sent": "We sent a code to {email}. Check your inbox.",
  "auth.already_registered":
    "If this email can be registered, we have sent a code. Already registered? Sign in or reset your password",

  // --- error codes: common (auth design §17, M19) ---
  "errors.validation_failed": "This value is not valid.",
  "errors.validation_failed.already_done": "This has already been done.",
  "errors.validation_failed.files_missing": "One or more required files are missing.",
  "errors.validation_failed.confirm_large_change":
    "Please confirm you want to make this large change.",
  "errors.validation_failed.confirm_mismatch": "The confirmation does not match.",
  "errors.validation_failed.too_many_rows": "Too many rows selected.",
  "errors.not_allowed": "You do not have permission to do this.",
  "errors.not_found": "The item you are looking for does not exist.",
  "errors.rate_limited": "Too many requests. Please wait and try again.",
  "errors.rate_limited.hourly": "You have reached the hourly limit. Please try again later.",
  "errors.rate_limited.pending_cap":
    "You have too many pending items. Please wait for them to be processed.",
  "errors.version_conflict":
    "Someone else changed this while you were editing. Reload to see their changes. Your text is kept.",
  "errors.upload_failed": "The file could not be uploaded. Please try again.",
  "errors.purge_failed":
    "Saved, but the cache could not be cleared. It will expire on its own.",
  "errors.reauth_required": "Please sign in again to continue.",
  "errors.mfa_required": "A second factor is required. Please check your authenticator.",
  "errors.unknown": "Something went wrong. Please try again.",

  // --- error codes: auth-only (auth design §17) ---
  "errors.invalid_credentials": "Email or password is not correct",
  "errors.email_not_verified": "Please verify your email address before signing in.",
  "errors.code_invalid": "That code is not right",
  "errors.code_expired": "That code has expired. Please request a new one.",
  "errors.code_attempts_exceeded": "Too many wrong attempts — request a new code",
  "errors.weak_password": "Please choose a stronger password.",
  "errors.captcha_failed": "Security check failed. Please try again.",
  "errors.account_suspended": "This account has been suspended. Contact support",

  // --- navigation and site chrome (S-025) ---
  "nav.home": "Home",
  "nav.articles": "Articles",
  "nav.documents": "Documents",
  "nav.courses": "Courses",
  "nav.jobs": "Jobs",
  "nav.contact_coach": "Contact Coach",
  "nav.cart": "Cart",
  "nav.sign_in": "Sign In",
  "nav.sign_up": "Sign Up",
  "nav.account": "Account",
  "nav.profile": "Profile",
  "nav.my_purchases": "My Purchases",
  "nav.sign_out": "Sign out",
  "nav.open_menu": "Open menu",
  "nav.close_menu": "Close menu",
  "site.wordmark": "CeylonSafety",
} as const;

export type MessageKey = keyof typeof en;

// AC1: typed key — unknown keys are compile errors.
// EC1: one pass of replacement per param key; no recursion, no HTML interpretation.
export function t(key: MessageKey, params?: Record<string, string>): string {
  let text: string = en[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

// AC3: looks up errors.{code}.{reason} then errors.{code} then errors.unknown.
// EC2: unknown reason falls back to code default.
export function errorMessage(code: string, reason?: string): string {
  if (reason) {
    const specificKey = `errors.${code}.${reason}` as MessageKey;
    if (specificKey in en) return en[specificKey];
  }
  const defaultKey = `errors.${code}` as MessageKey;
  if (defaultKey in en) return en[defaultKey];
  return en["errors.unknown"];
}
