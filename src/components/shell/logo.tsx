import { cn } from "@/lib/cn";

/**
 * Coin B — the letter B for Billing; its bowls are a gold and a silver coin.
 * Master artwork: design/logo/mark.svg (same geometry).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="40 16 176 224" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="56" y="24" width="42" height="208" rx="21" fill="#1C1B22" />
      <path fill="#E9A23B" fillRule="evenodd" d="M138 24 a53 53 0 1 1 0 106 a53 53 0 1 1 0 -106 Z M138 57 a20 20 0 1 0 0 40 a20 20 0 1 0 0 -40 Z" />
      <path fill="#A3B1C6" fillRule="evenodd" d="M144 114 a59 59 0 1 1 0 118 a59 59 0 1 1 0 -118 Z M144 149 a24 24 0 1 0 0 48 a24 24 0 1 0 0 -48 Z" />
    </svg>
  );
}

/** Mark + product name; the shop's name sits underneath when given. */
export function LogoLockup({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <LogoMark className="h-10 w-8" />
      <span className="min-w-0 leading-tight">
        <span className="tight block text-[16px] font-extrabold text-ink">Gold &amp; Silver</span>
        <span className="block truncate text-[12.5px] font-semibold text-muted">{subtitle ? subtitle : "Billing"}</span>
      </span>
    </span>
  );
}
