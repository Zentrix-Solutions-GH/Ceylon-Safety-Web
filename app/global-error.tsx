"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html><body><button onClick={reset}>Try again</button></body></html>
  );
}