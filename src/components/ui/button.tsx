import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "dock";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:bg-ink-2 active:bg-ink-3 disabled:bg-ink/40 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_2px_rgba(15,23,42,0.2)]",
  secondary:
    "bg-surface text-ink border border-line hover:border-line-strong hover:bg-canvas active:bg-sunken disabled:text-faint shadow-hair",
  ghost: "text-ink-3 hover:bg-sunken hover:text-ink active:bg-line/60 disabled:text-faint",
  danger: "bg-danger text-white hover:bg-danger-deep disabled:bg-danger/40",
  gold: "bg-gold-deep text-white hover:bg-[#92400e] disabled:bg-gold-deep/40",
  dock: "bg-white/10 text-white hover:bg-white/15 active:bg-white/20 border border-white/10 disabled:text-white/40",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-lg",
  icon: "h-8 w-8 rounded-md justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 select-none items-center font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
