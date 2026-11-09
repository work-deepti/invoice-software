"use client";
import { Checkbox as C } from "radix-ui";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  hint,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-2.5 select-none", disabled && "cursor-not-allowed opacity-50", className)}>
      <C.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-line-strong bg-surface transition-[background-color,border-color] group-hover:border-ink-3 data-[state=checked]:border-ink data-[state=checked]:bg-ink"
      >
        <C.Indicator className="text-white">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </C.Indicator>
      </C.Root>
      <span className="text-[13.5px] leading-[18px] text-ink">
        {label}
        {hint ? <span className="mt-0.5 block text-[12.5px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
