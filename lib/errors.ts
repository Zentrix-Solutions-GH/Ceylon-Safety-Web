// Returns the error message string without exposing any personal data or secrets.
// Use this whenever logging an error to ensure no sensitive data leaks into logs.
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "unknown error";
}
