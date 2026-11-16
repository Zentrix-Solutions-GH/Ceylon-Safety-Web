// Returns the error message string from an unknown thrown value.
// Does NOT scrub PII — DB constraint errors may embed field values.
// Never log the result alongside payment data or personal fields.
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
