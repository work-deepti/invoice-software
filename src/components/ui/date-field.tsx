"use client";
import { CalendarDays } from "lucide-react";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { formatDateDMY, isValidIsoDate } from "@/lib/calc-engine";
import { cn } from "@/lib/cn";
import { controlBase } from "./field";

/** "09112026" / "9-11-2026" → "09-11-2026" while typing. */
function maskDMY(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

function dmyToIso(dmy: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy);
  if (!m) return "";
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidIsoDate(iso) ? iso : "";
}

/**
 * Date field that always reads DD-MM-YYYY (a native date input follows the
 * browser's locale and shows 11/09/2026 for 9 Nov on US-English browsers).
 * The value is ISO YYYY-MM-DD; the calendar button opens the native picker,
 * capped at `max` (VAL-07).
 */
export function DateField({
  value,
  onValueChange,
  max,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "max"> & {
  value: string;
  onValueChange: (iso: string) => void;
  max?: string;
}) {
  const [text, setText] = useState(value ? formatDateDMY(value) : "");
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // external change (picker, load, reset) → show it
    setPrev(value);
    if (value !== dmyToIso(text)) setText(value ? formatDateDMY(value) : "");
  }
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-YYYY"
        value={text}
        onChange={(e) => {
          const t = maskDMY(e.target.value);
          setText(t);
          const iso = dmyToIso(t);
          if (iso || t === "") onValueChange(iso);
          else if (t.length === 10) onValueChange("");
        }}
        onBlur={(e) => {
          if (text && !dmyToIso(text)) onValueChange("");
          rest.onBlur?.(e);
        }}
        className={cn(controlBase, "num h-11 pr-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        max={max}
        value={isValidIsoDate(value) ? value : ""}
        onChange={(e) => e.target.value && onValueChange(e.target.value)}
        className="pointer-events-none absolute right-2 bottom-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
