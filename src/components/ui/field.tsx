"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Base look shared by every text-like control. */
export const controlBase =
  "w-full min-w-0 rounded-lg border bg-surface px-3 text-[14px] text-ink placeholder:font-sans placeholder:text-faint transition-[border-color,box-shadow,background-color] outline-none " +
  "border-line hover:border-line-strong focus:border-ink focus:ring-2 focus:ring-ink/10 " +
  "disabled:bg-sunken disabled:text-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-fill/40 aria-[invalid=true]:focus:ring-danger/15";

export interface FieldProps {
  label: ReactNode;
  /** Dotted path used by error chips to find and focus this field (INV-18). */
  field?: string;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  labelClassName?: string;
  /** e.g. "desk:hidden" inside table rows, where the tooltip carries the message */
  messageClassName?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "data-field"?: string; title?: string }) => ReactNode;
  srLabel?: boolean;
}

/** Label + control + message. The control gets id, aria wiring and data-field. */
export function Field({ label, field, error, hint, className, labelClassName, messageClassName, children, srLabel }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-[12.5px] font-medium text-ink-3", srLabel && "sr-only", labelClassName)}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? msgId : undefined,
        "data-field": field,
        title: error ?? undefined,
      })}
      {error ? (
        <p id={msgId} className={cn("animate-enter text-[12.5px] leading-snug text-danger", messageClassName)}>
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className={cn("text-[12.5px] leading-snug text-muted", messageClassName)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} type="text" className={cn(controlBase, "h-9", className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(controlBase, "min-h-20 resize-y py-2 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        controlBase,
        "select-chevron h-9 cursor-pointer appearance-none pr-8",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
