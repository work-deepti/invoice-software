"use client";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { PrintProvider } from "@/components/invoice/print";
import { SessionProvider } from "./session";
import { TopBar } from "./top-bar";

function ShellSkeleton() {
  return (
    <div aria-busy className="min-h-dvh">
      <div className="h-[118px] bg-ink" />
      <div className="mx-auto max-w-[1680px] space-y-4 px-4 py-6 tab:px-6">
        <div className="h-7 w-48 animate-pulse rounded-md bg-line/70" />
        <div className="h-40 animate-pulse rounded-xl bg-line/50" />
        <div className="h-64 animate-pulse rounded-xl bg-line/40" />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider fallback={<ShellSkeleton />}>
      <ToastProvider>
        <PrintProvider>
          <TopBar />
          <main className="mx-auto w-full max-w-[1680px] px-3 pt-5 pb-10 tab:px-6 tab:pt-6">{children}</main>
        </PrintProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
