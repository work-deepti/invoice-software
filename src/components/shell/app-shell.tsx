"use client";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { PrintProvider } from "@/components/invoice/print";
import { BottomBar, MobileHeader, Sidebar } from "./nav";
import { SessionProvider } from "./session";

function ShellSkeleton() {
  return (
    <div aria-busy className="min-h-dvh lg:pl-[76px] wide:pl-[264px]">
      <div className="mx-auto max-w-[1520px] space-y-4 px-4 py-8 tab:px-8">
        <div className="h-9 w-56 animate-pulse rounded-2xl bg-line/70" />
        <div className="h-44 animate-pulse rounded-[24px] bg-line/50" />
        <div className="h-72 animate-pulse rounded-[24px] bg-line/40" />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider fallback={<ShellSkeleton />}>
      <ToastProvider>
        <PrintProvider>
          <Sidebar />
          <div className="min-h-dvh lg:pl-[76px] wide:pl-[264px]">
            <MobileHeader />
            <main className="mx-auto w-full max-w-[1520px] px-3 pt-5 pb-28 tab:px-6 lg:px-6 lg:pt-8 lg:pb-12 wide:px-8">{children}</main>
          </div>
          <BottomBar />
        </PrintProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
