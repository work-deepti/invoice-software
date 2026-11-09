import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "dock" | "soft" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 active:bg-ink-3 disabled:bg-ink/30 disabled:shadow-none shadow-[0_6px_16px_-8px_rgba(28,27,34,0.6)]",
  secondary: "bg-sunken text-ink hover:bg-line active:bg-line-strong/70 disabled:text-faint",
  outline: "bg-surface text-ink shadow-hair hover:bg-sunken disabled:text-faint",
  ghost: "text-ink-3 hover:bg-sunken hover:text-ink active:bg-line disabled:text-faint",
  danger: "bg-danger text-white hover:bg-danger-deep disabled:bg-danger/40",
  gold: "bg-gold text-ink hover:brightness-95 disabled:opacity-50",
  soft: "bg-lav-fill text-lav-deep hover:bg-[#e3ddfb] disabled:opacity-50",
  dock: "bg-white/10 text-white hover:bg-white/16 active:bg-white/22 disabled:text-white/40",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
  icon: "size-10 justify-center",
  "icon-sm": "size-8 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Pill buttons. Primary is the ink pill; secondary the soft grey pill. */
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
        "inline-flex shrink-0 select-none items-center rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform,filter] active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
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
