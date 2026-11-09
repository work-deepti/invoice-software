"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { RatesDTO } from "@/server/rates";
import type { SettingsDTO } from "@/server/settings";

export interface SessionUser {
  id: string;
  name: string;
  login: string;
  role: "owner" | "staff" | "viewer";
}
export interface Capabilities {
  canBill: boolean;
  isOwner: boolean;
  canSeeDashboard: boolean;
}

interface SessionValue {
  user: SessionUser;
  capabilities: Capabilities;
  settings: SettingsDTO;
  rates: RatesDTO;
  setRates: (r: RatesDTO) => void;
  setSettings: (s: SettingsDTO) => void;
  reloadRates: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; user: SessionUser; capabilities: Capabilities; settings: SettingsDTO; rates: RatesDTO };

export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async () => {
    const [me, settings, rates] = await Promise.all([
      api<{ user: SessionUser; capabilities: Capabilities }>("/api/auth/me"),
      api<{ settings: SettingsDTO }>("/api/settings"),
      api<RatesDTO>("/api/rates"),
    ]);
    if (!me.ok || !settings.ok || !rates.ok) {
      const failed = [me, settings, rates].find((r) => !r.ok);
      if (failed && !failed.ok && failed.status !== 401) setState({ phase: "error", message: failed.error.message });
      return;
    }
    setState({ phase: "ready", ...me.data, settings: settings.data.settings, rates: rates.data });
  }, []);

  useEffect(() => {
    // Initial fetch of the signed-in session; state is set once the requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reloadRates = useCallback(async () => {
    const r = await api<RatesDTO>("/api/rates");
    if (r.ok) setState((s) => (s.phase === "ready" ? { ...s, rates: r.data } : s));
  }, []);

  if (state.phase === "loading") return <>{fallback}</>;
  if (state.phase === "error")
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-[15px] font-semibold text-ink">Couldn&apos;t load the app</p>
          <p className="mt-1 text-sm text-muted">{state.message}</p>
          <button className="mt-4 text-sm font-medium text-ink underline" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );

  return (
    <Ctx.Provider
      value={{
        user: state.user,
        capabilities: state.capabilities,
        settings: state.settings,
        rates: state.rates,
        setRates: (rates) => setState((s) => (s.phase === "ready" ? { ...s, rates } : s)),
        setSettings: (settings) => setState((s) => (s.phase === "ready" ? { ...s, settings } : s)),
        reloadRates,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
