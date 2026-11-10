"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { applyTheme, readChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

/** Segmented Light / Dark / Auto control. Auto follows the device and keeps following it. */
export function ThemeSwitch({ className }: { className?: string }) {
  // Rendered only inside the opened account menu (client-side), so reading storage here is safe.
  const [choice, setChoice] = useState<ThemeChoice>(() => (typeof window === "undefined" ? "system" : readChoice()));
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("grid grid-cols-3 gap-1 rounded-full bg-sunken p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          title={value === "system" ? "Match this device" : `${label} mode`}
          onClick={() => {
            setChoice(value);
            applyTheme(value);
          }}
          className={cn(
            "flex h-8 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold transition-[background-color,color,box-shadow]",
            choice === value ? "bg-surface text-ink shadow-hair" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
