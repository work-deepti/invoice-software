"use client";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** In-page dialog (UX-07). Esc closes it (UX-08). Full width on phones (UX-04). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-overlay" />
        <D.Content
          // no description → tell Radix explicitly instead of repeating the title to screen readers
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop outline-none data-[state=open]:animate-sheet tab:data-[state=open]:animate-enter",
            "tab:inset-x-auto tab:top-1/2 tab:bottom-auto tab:left-1/2 tab:w-[min(560px,calc(100vw-32px))] tab:-translate-x-1/2 tab:-translate-y-1/2 tab:rounded-[28px] tab:pb-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
            <div className="min-w-0">
              <D.Title className="tight text-[19px] font-bold text-ink">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-[14px] leading-relaxed text-muted">{description}</D.Description> : null}
            </div>
            <D.Close className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-3 transition-colors hover:bg-line hover:text-ink" aria-label="Close">
              <X className="size-4" aria-hidden />
            </D.Close>
          </div>
          {children ? <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-3", bodyClassName)}>{children}</div> : null}
          {footer ? <div className="flex flex-wrap justify-end gap-2 px-6 pt-3 pb-6">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
