import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Borderless white card, 24px radius, soft lift. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[24px] bg-surface shadow-card", className)} {...rest} />;
}

export type Tone = "gold" | "silver" | "lav" | "mint" | "peach" | "rose" | "neutral";

export const toneClasses: Record<Tone, { fill: string; icon: string }> = {
  gold: { fill: "bg-gold-fill", icon: "text-gold-deep" },
  silver: { fill: "bg-silver-fill", icon: "text-silver-deep" },
  lav: { fill: "bg-lav-fill", icon: "text-lav-deep" },
  mint: { fill: "bg-mint-fill", icon: "text-ok-deep" },
  peach: { fill: "bg-peach-fill", icon: "text-[#a64b1e]" },
  rose: { fill: "bg-rose-fill", icon: "text-danger-deep" },
  neutral: { fill: "bg-sunken", icon: "text-ink-3" },
};

/** Round pastel icon chip, as in the reference apps. */
export function IconChip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full [&>svg]:size-[18px]", toneClasses[tone].fill, toneClasses[tone].icon, className)}>
      {children}
    </span>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  tone,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-5 tab:px-6", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <IconChip tone={tone}>{icon}</IconChip> : null}
        <div className="min-w-0">
          <h2 className="tight text-[16px] font-bold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
