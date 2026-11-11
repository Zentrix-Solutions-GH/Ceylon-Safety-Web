"use client";

import { useId } from "react";
import { t } from "@/messages/en";

const COLOMBO_TZ = "Asia/Colombo";

function toColomboDT(isoString: string): string {
  // Convert ISO string to local datetime-local value in Colombo time
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function toISOFromColombo(localDT: string): string {
  // Parse datetime-local value as Colombo time and return ISO string
  const [datePart, timePart] = localDT.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  // Colombo is UTC+5:30
  const utcMs = Date.UTC(y, mo - 1, d, h - 5, mi - 30);
  return new Date(utcMs).toISOString();
}

function formatColomboDT(isoString: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: COLOMBO_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function isAlmostImmediate(isoString: string): boolean {
  return new Date(isoString).getTime() - Date.now() < 60_000;
}

interface PublishTimePickerProps {
  value: string | null;
  onChange: (isoString: string | null) => void;
}

export default function PublishTimePicker({ value, onChange }: PublishTimePickerProps) {
  const id = useId();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v ? toISOFromColombo(v) : null);
  }

  return (
    <div>
      <label htmlFor={id}>{t("editor.publish_time.label")}</label>
      <div>{t("editor.publish_time.timezone")}</div>
      <input
        id={id}
        type="datetime-local"
        value={value ? toColomboDT(value) : ""}
        onChange={handleChange}
      />
      {value && (
        <div>
          {isAlmostImmediate(value)
            ? t("editor.publish_time.almost_immediate")
            : t("editor.publish_time.will_go_live").replace("{date}", formatColomboDT(value))}
        </div>
      )}
    </div>
  );
}
