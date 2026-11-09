"use client";
import { DropdownMenu } from "radix-ui";
import { AlertTriangle, ChevronDown, Cloud, CloudOff, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatDateDMY, formatIndianNumber, toDec } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useSession } from "./session";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function shortPurity(label: string) {
  return label.replace(/^(gold|silver|platinum)\s+/i, "");
}

function rateText(rate: string) {
  const d = toDec(rate);
  return `₹${formatIndianNumber(d, d.isInteger() ? 0 : 2)}`;
}

/** UX-01 top bar + RATE-08 rate chips. */
export function TopBar() {
  const { user, capabilities, settings, rates } = useSession();
  const pathname = usePathname();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const tabs = [
    { href: "/invoices/new", label: "New invoice", match: (p: string) => p.startsWith("/invoices"), show: capabilities.canBill },
    { href: "/transactions", label: "Transactions", match: (p: string) => p.startsWith("/transactions"), show: true },
    { href: "/dashboard", label: "Dashboard", match: (p: string) => p.startsWith("/dashboard"), show: capabilities.canSeeDashboard },
    { href: "/rates", label: "Rate master", match: (p: string) => p.startsWith("/rates"), show: true },
    { href: "/settings", label: "Shop settings", match: (p: string) => p.startsWith("/settings"), show: capabilities.isOwner },
  ].filter((t) => t.show);

  const priced = rates.rows.filter((r) => r.rate !== "");

  return (
    <header className="z-40 bg-ink text-white tab:sticky tab:top-0">
      <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 pt-3 tab:px-6">
        <Link href="/invoices/new" className="flex min-w-0 shrink items-center gap-2.5 rounded-md">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md bg-gradient-to-b from-[#f5c45e] to-gold-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
            <span className="size-2.5 rounded-[3px] bg-ink/85" />
          </span>
          <span className="tight truncate text-[15px] font-semibold">{settings.name || "Gold & Silver Billing"}</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2 py-1 text-[12px] tab:inline-flex",
              online ? "text-white/60" : "bg-danger/20 text-red-200",
            )}
            title={online ? "Every bill is saved to the cloud database." : "No connection — bills can't be saved until you're back online."}
          >
            {online ? <Cloud className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
            {online ? "Saved to cloud" : "Offline"}
          </span>
          <UserMenu name={user.name} role={user.role} />
        </div>
      </div>

      {/* RATE-08 chips — one row; scrolls inside its own strip on phones */}
      <div className="mx-auto max-w-[1680px] px-4 tab:px-6">
        <div className="-mx-1 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {rates.status === "none" ? (
            <Link
              href="/rates"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold-deep px-3 py-1 text-[12.5px] font-medium text-white transition-colors hover:bg-gold"
            >
              Set today&apos;s rates →
            </Link>
          ) : (
            <>
              {rates.status === "stale" && rates.effectiveDate ? (
                <Link
                  href="/rates"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold-fill px-2.5 py-1 text-[12.5px] font-medium text-gold-deep transition-colors hover:bg-white"
                >
                  <AlertTriangle className="size-3.5" aria-hidden />
                  Rates from {formatDateDMY(rates.effectiveDate)} — update
                </Link>
              ) : null}
              {priced.map((r) => (
                <span
                  key={r.id}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[12.5px]",
                    rates.status === "stale" ? "border-white/10 text-white/55" : "border-white/12 text-white/90",
                  )}
                  title={`${r.label}: ₹${formatIndianNumber(r.rate, 2)} per gram`}
                >
                  <span aria-hidden className={cn("size-1.5 rounded-full", r.metal === "Gold" ? "bg-[#f5c45e]" : r.metal === "Silver" ? "bg-slate-300" : "bg-white/60")} />
                  <span className="text-white/60">{shortPurity(r.label)}</span>
                  <span className="num font-medium">{rateText(r.rate)}</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <Tabs tabs={tabs} pathname={pathname} />
    </header>
  );
}

function Tabs({ tabs, pathname }: { tabs: { href: string; label: string; match: (p: string) => boolean }[]; pathname: string }) {
  const navRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = tabs.findIndex((t) => t.match(pathname));

  useLayoutEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>(`[data-tab-index="${activeIndex}"]`);
    if (!nav || !el) {
      setBar(null);
      return;
    }
    const measure = () => setBar({ left: el.offsetLeft, width: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [activeIndex, tabs.length]);

  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>(`[data-tab-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  return (
    <nav aria-label="Main" className="mx-auto mt-2 max-w-[1680px] px-4 tab:px-6">
      <div ref={navRef} className="relative -mx-1 flex overflow-x-auto px-1 [scrollbar-width:none]">
        {tabs.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            data-tab-index={i}
            aria-current={i === activeIndex ? "page" : undefined}
            className={cn(
              "relative shrink-0 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              i === activeIndex ? "text-white" : "text-white/55 hover:text-white/85",
            )}
          >
            {t.label}
          </Link>
        ))}
        {bar ? (
          <span
            aria-hidden
            className="absolute bottom-0 h-[2px] rounded-full bg-gold transition-[left,width] duration-150 ease-out-expo"
            style={{ left: bar.left + 12, width: Math.max(0, bar.width - 24) }}
          />
        ) : null}
      </div>
    </nav>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 text-[13px] text-white/85 transition-colors hover:bg-white/10 data-[state=open]:bg-white/10">
        <span className="grid size-7 place-items-center rounded-full bg-white/12 text-[12px] font-semibold uppercase">{name.slice(0, 1)}</span>
        <span className="hidden max-w-32 truncate tab:inline">{name}</span>
        <ChevronDown className="size-3.5 text-white/50" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 animate-enter rounded-xl border border-line bg-surface p-1 text-ink shadow-pop">
          <div className="px-2.5 py-2">
            <p className="text-[13.5px] font-medium">{name}</p>
            <p className="text-[12.5px] text-muted capitalize">{role === "staff" ? "Billing staff" : role}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            disabled={busy}
            onSelect={async () => {
              setBusy(true);
              await api("/api/auth/logout", { method: "POST" });
              // Full reload on purpose: drops every piece of in-memory session state.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/login");
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] outline-none data-[highlighted]:bg-sunken"
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
