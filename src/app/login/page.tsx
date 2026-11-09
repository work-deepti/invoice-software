import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh grid-rows-[1fr_auto] bg-canvas">
      <div className="grid place-items-center px-4 py-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="pb-6 text-center text-[12.5px] text-faint">Gold &amp; Silver Billing</p>
    </main>
  );
}
