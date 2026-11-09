"use client";
import { useRouter, useSearchParams } from "next/navigation";
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

  if (mode === "checking") return <div className="h-80 w-full max-w-[380px] animate-pulse rounded-2xl bg-line/50" />;

  return (
    <form onSubmit={submit} className="w-full max-w-[380px] animate-enter">
      <div className="mb-7 flex items-center gap-3">
        <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-ink shadow-hair">
          <span className="grid size-5 place-items-center rounded-[5px] bg-gold">
            <span className="size-1.5 rounded-[2px] bg-ink/85" />
          </span>
        </span>
        <div>
          <h1 className="tight text-[20px] font-semibold text-ink">{mode === "setup" ? "Set up your shop" : "Sign in"}</h1>
          <p className="text-[13.5px] text-muted">
            {mode === "setup" ? "Create the owner account. You can add staff later." : "Gold & Silver Billing"}
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-hair">
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
          <p role="alert" className="animate-enter rounded-lg bg-danger-fill px-3 py-2 text-[13px] text-danger-deep">
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
