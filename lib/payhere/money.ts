// Converts an integer number of cents to a two-decimal-place string.
// e.g. 715545 → "7155.45"
export function centsToDecimal(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const pence = abs % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${whole}.${String(pence).padStart(2, "0")}`;
}

// Strictly parses a decimal string with one or two decimal places into cents.
// Throws for any other format.
export function parseCentsStrict(s: string): number {
  if (!/^\d+\.\d{1,2}$/.test(s)) {
    throw new Error(`parseCentsStrict: invalid format "${s}"`);
  }
  const [wholePart, fracPart] = s.split(".");
  const whole = parseInt(wholePart, 10) * 100;
  const pence = fracPart.length === 1
    ? parseInt(fracPart, 10) * 10
    : parseInt(fracPart, 10);
  return whole + pence;
}
