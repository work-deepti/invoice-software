import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoLockup, LogoMark } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  { tone: "bg-gold-fill text-gold-deep", title: "Today's rates, every bill", text: "Set gold and silver once in the morning." },
  { tone: "bg-lav-fill text-lav-deep", title: "GST done for you", text: "CGST, SGST or IGST worked out as you type." },
  { tone: "bg-mint-fill text-ok-deep", title: "Old gold, made simple", text: "Exchange is taken off after GST, the right way." },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* brand panel — computers only */}
      <section aria-hidden className="relative m-3 hidden flex-col justify-between overflow-hidden rounded-[32px] bg-surface p-10 shadow-card lg:flex">
        <LogoLockup />
        <div>
          <LogoMark className="h-40 w-32" />
          <p className="tight mt-8 max-w-sm text-[34px] leading-[1.1] font-extrabold text-ink">Billing that knows gold and silver.</p>
          <ul className="mt-8 grid max-w-md gap-3">
            {POINTS.map((p) => (
              <li key={p.title} className={`rounded-[20px] px-5 py-4 ${p.tone}`}>
                <p className="text-[15px] font-bold">{p.title}</p>
                <p className="mt-0.5 text-[13.5px] text-ink-3">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-faint">Gold &amp; Silver Billing</p>
      </section>
      <div className="grid place-items-center px-4 py-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
