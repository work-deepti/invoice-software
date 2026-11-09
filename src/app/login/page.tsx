import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* brand panel — computers only */}
      <section aria-hidden className="m-3 hidden flex-col justify-center rounded-[32px] bg-surface p-12 shadow-card lg:flex">
        <LogoMark className="h-40 w-32" />
        <p className="tight mt-10 text-[34px] leading-[1.1] font-extrabold text-ink">Gold &amp; Silver Billing</p>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">GST invoices from today&apos;s rates, with old gold and silver exchange worked out for you.</p>
      </section>
      <div className="grid place-items-center px-4 py-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
