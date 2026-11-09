"use client";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "error";
interface Toast {
  id: number;
  tone: Tone;
  text: ReactNode;
}

const Ctx = createContext<(text: ReactNode, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** UX-07: in-page messages that auto-hide after about 3 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: ReactNode, tone: Tone = "ok") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 5000 : 3000);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[60] flex flex-col items-center gap-2 tab:inset-x-auto tab:right-5 tab:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-toast items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-[13.5px] text-ink shadow-pop tab:w-auto",
              t.tone === "ok" && "border-line",
              t.tone === "warn" && "border-gold/40",
              t.tone === "error" && "border-danger/40",
            )}
          >
            {t.tone === "ok" ? <CheckCircle2 className="mt-px size-4 shrink-0 text-ok" aria-hidden /> : null}
            {t.tone === "warn" ? <AlertTriangle className="mt-px size-4 shrink-0 text-gold" aria-hidden /> : null}
            {t.tone === "error" ? <XCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden /> : null}
            <div className="min-w-0">{t.text}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
