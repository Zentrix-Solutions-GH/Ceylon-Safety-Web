// AC5: date in Asia/Colombo timezone, money from cents as "LKR X,XXX.XX".

const DATE_FORMAT = new Intl.DateTimeFormat("en-LK", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Colombo",
});

// EC4: uses Asia/Colombo, so dates around midnight show the Sri Lanka day.
export function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}

const MONEY_FORMAT = new Intl.NumberFormat("en-LK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// The helper converts cents to rupees and formats — never calculates totals.
export function formatMoney(cents: number): string {
  return `LKR ${MONEY_FORMAT.format(cents / 100)}`;
}
