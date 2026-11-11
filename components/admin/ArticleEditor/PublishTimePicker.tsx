"use client";

import { t } from "@/messages/en";

const COLOMBO_TZ = "Asia/Colombo";
const ONE_MINUTE_MS = 60_000;

interface PublishTimePickerProps {
  value: string | null;
  onChange: (isoValue: string | null) => void;
}

function toColomboDT(isoValue: string): string {
  // Convert ISO string to datetime-local value in Asia/Colombo
  const date = new Date(isoValue);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function toISOFromColombo(localDT: string): string {
  // Parse a datetime-local value as Asia/Colombo and convert to UTC ISO string
  const [datePart, timePart] = localDT.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);

  // Build a fake date in UTC, then adjust by Colombo offset (+05:30)
  const colomboOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - colomboOffsetMs;
  return new Date(utcMs).toISOString();
}

function formatColomboDT(isoValue: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoValue));
}

export default function PublishTimePicker({ value, onChange }: PublishTimePickerProps) {
  const localValue = value ? toColomboDT(value) : "";
  const isAlmostImmediate = value !== null && new Date(value).getTime() - Date.now() < ONE_MINUTE_MS;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v ? toISOFromColombo(v) : null);
  }

  return (
    <div>
      <label htmlFor="publish-time-picker">{t("editor.publish_time.label")}</label>
      <p className="publish-time-picker__timezone">{t("editor.publish_time.timezone")}</p>
      <input
        id="publish-time-picker"
        type="datetime-local"
        value={localValue}
        onChange={handleChange}
      />
      {value && (
        <p className="publish-time-picker__preview">
          {t("editor.publish_time.will_go_live", { date: formatColomboDT(value) })}
        </p>
      )}
      {isAlmostImmediate && (
        <p role="alert" className="publish-time-picker__warning">
          {t("editor.publish_time.almost_immediate")}
        </p>
      )}
    </div>
  );
}
