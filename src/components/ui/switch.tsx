"use client";
import { Switch as S } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 select-none", disabled && "cursor-not-allowed opacity-50", className)}>
      <span className="min-w-0 text-[14px] font-medium text-ink">
        {label}
        {hint ? <span className="mt-0.5 block text-[12.5px] text-muted">{hint}</span> : null}
      </span>
      <S.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-ink"
      >
        <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white data-[state=checked]:bg-canvas shadow-[0_1px_3px_rgba(28,27,34,0.3)] transition-transform data-[state=checked]:translate-x-[22px]" />
      </S.Root>
    </label>
  );
}
