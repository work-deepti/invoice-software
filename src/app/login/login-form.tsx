"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/shell/logo";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api-client";

type Mode = "checking" | "setup" | "login";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/invoices/new";
  const [mode, setMode] = useState<Mode>("checking");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ needsSetup: boolean }>("/api/auth/setup").then((r) => setMode(r.ok && r.data.needsSetup ? "setup" : "login"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r =
      mode === "setup"
        ? await api("/api/auth/setup", { method: "POST", body: { name, login, password } })
        : await api("/api/auth/login", { method: "POST", body: { login, password } });
    setBusy(false);
    if (!r.ok) {
      const issues = (r.error as { issues?: { message: string }[] }).issues;
      setError(issues?.[0]?.message ?? r.error.message);
      return;
    }
    router.replace(mode === "setup" ? "/settings" : next.startsWith("/") ? next : "/invoices/new");
  }

  if (mode === "checking") return <div className="h-80 w-full max-w-[380px] animate-pulse rounded-[28px] bg-line/50" />;

  return (
    <form onSubmit={submit} className="w-full max-w-[380px] animate-enter">
      <div className="mb-6">
        <LogoMark className="h-14 w-11 lg:hidden" />
        <h1 className="tight mt-5 text-[28px] font-extrabold text-ink lg:mt-0">{mode === "setup" ? "Set up your shop" : "Welcome back"}</h1>
        <p className="mt-1 text-[14.5px] text-muted">
          {mode === "setup" ? "Create the owner account. You can add staff later." : "Sign in to Gold & Silver Billing."}
        </p>
      </div>

      <div className="space-y-4 rounded-[28px] bg-surface p-6 shadow-card">
        {mode === "setup" ? (
          <Field label="Your name">
            {(p) => <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus />}
          </Field>
        ) : null}
        <Field label="Login" hint={mode === "setup" ? "3–40 letters or numbers, e.g. owner" : undefined}>
          {(p) => (
            <TextInput
              {...p}
              value={login}
              onChange={(e) => setLogin(e.target.value.toLowerCase())}
              autoComplete="username"
              autoCapitalize="none"
              required
              autoFocus={mode === "login"}
            />
          )}
        </Field>
        <Field label="Password" hint={mode === "setup" ? "At least 8 characters" : undefined}>
          {(p) => (
            <TextInput
              {...p}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "setup" ? "new-password" : "current-password"}
              required
            />
          )}
        </Field>
        {error ? (
          <p role="alert" className="animate-enter rounded-[14px] bg-danger-fill px-3.5 py-2.5 text-[13px] text-danger-deep">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full justify-center">
          {mode === "setup" ? "Create owner account" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
