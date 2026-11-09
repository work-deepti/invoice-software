"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { isBlockedNumberKey, roundOnBlur, sanitizeDecimalText, type FieldKind } from "@/lib/calc-engine";
import { cn } from "@/lib/cn";
import { controlBase } from "./field";

export interface NumInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (v: string) => void;
  kind: FieldKind;
}

/**
 * Number field (VAL-01/04/05/06):
 *  - text input with a decimal keypad, so there are no spin arrows and the mouse wheel never changes it
 *  - "-", "+", "e" are blocked; pasted text is cleaned (a pasted negative becomes positive)
 *  - on leaving: weights → 3 dp, money / rates / % → 2 dp, pieces → whole number
 *  - ArrowUp / ArrowDown step by 1 and stop at 0
 */
export const NumInput = forwardRef<HTMLInputElement, NumInputProps>(function NumInput(
  { value, onValueChange, kind, className, onBlur, onKeyDown, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode={kind === "pcs" ? "numeric" : "decimal"}
      autoComplete="off"
      spellCheck={false}
      value={value}
      onKeyDown={(e) => {
        if (isBlockedNumberKey(e.key)) {
          e.preventDefault();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const n = Number(value || "0") + (e.key === "ArrowUp" ? 1 : -1);
          const next = Math.max(0, n);
          onValueChange(kind === "pcs" ? String(Math.round(next)) : roundOnBlur(String(next), kind));
        }
        onKeyDown?.(e);
      }}
      onChange={(e) => onValueChange(sanitizeDecimalText(e.target.value, false))}
      onBlur={(e) => {
        const r = roundOnBlur(value, kind);
        if (r !== value) onValueChange(r);
        onBlur?.(e);
      }}
      className={cn(
        controlBase,
        // number placeholders (0.000, Full: ₹…) stay mono so they line up with typed values
        "num h-11 text-right",
        className,
        // long values step down a size in the dense one-row table instead of clipping
        value.length >= 10 && "desk:text-[11.5px]",
        value.length >= 12 && "desk:text-[10.5px]",
      )}
      {...rest}
    />
  );
});
