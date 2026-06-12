import { useState } from "react";

// A friendlier numeric field: tapping it selects the current value so typing
// replaces it (no more "0200"), it never force-fills a 0 while you're
// editing, and leading zeros are stripped as you type.
export function TargetInput({
  value,
  onCommit,
  className,
  maxDigits = 4,
  label = "Target score",
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  maxDigits?: number;
  label?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        const el = e.target;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        const digits = e.target.value
          .replace(/\D/g, "")
          .replace(/^0+(?=\d)/, "")
          .slice(0, maxDigits);
        setDraft(digits);
        if (digits !== "") onCommit(parseInt(digits, 10));
      }}
      onBlur={() => setDraft(null)}
      aria-label={label}
      className={className}
    />
  );
}

// Select-on-focus handler for score cells: tap a filled cell and the next
// keystroke replaces it instead of appending.
export function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  const el = e.target;
  requestAnimationFrame(() => el.select());
}
