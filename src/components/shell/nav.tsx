"use client";
import { DropdownMenu } from "radix-ui";
import { AlertTriangle, ArrowLeft, ChevronsUpDown, Cloud, CloudOff, Coins, LayoutGrid, LogOut, Plus, ReceiptText, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ComponentType } from "react";
import { formatDateDMY, formatIndianNumber, toDec } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { ThemeSwitch } from "./theme-switch";
import { cn } from "@/lib/cn";
import { LogoLockup, LogoMark } from "./logo";
import { useSession } from "./session";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  match: (p: string) => boolean;
}

function useNavItems() {
  const { capabilities } = useSession();
  const items: (NavItem & { show: boolean })[] = [
    { href: "/transactions", label: "Transactions", short: "Bills", icon: ReceiptText, match: (p) => p.startsWith("/transactions"), show: true },
    { href: "/dashboard", label: "Dashboard", short: "Insights", icon: LayoutGrid, match: (p) => p.startsWith("/dashboard"), show: capabilities.canSeeDashboard },
    { href: "/rates", label: "Rate master", short: "Rates", icon: Coins, match: (p) => p.startsWith("/rates"), show: true },
    { href: "/settings", label: "Shop settings", short: "Shop", icon: Store, match: (p) => p.startsWith("/settings"), show: capabilities.isOwner },
  ];
  return items.filter((i) => i.show);
}

const shortPurity = (label: string) => label.replace(/^(gold|silver|platinum)\s+/i, "");
const rateText = (rate: string) => {
  const d = toDec(rate);
  return `₹${formatIndianNumber(d, d.isInteger() ? 0 : 2)}`;
};
const metalDot = (m: string) => (m === "Gold" ? "bg-gold" : m === "Silver" ? "bg-silver" : "bg-lav");

/* ── desktop: sidebar (≥1440) / icon rail (1024–1439) ──────────────── */

export function Sidebar() {
  const { settings, capabilities } = useSession();
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col bg-surface py-5 shadow-[1px_0_0_var(--color-line)] print:hidden lg:flex wide:w-[264px] wide:px-4">
      <Link href={capabilities.canBill ? "/invoices/new" : "/transactions"} className="mx-auto flex items-center rounded-2xl wide:mx-1 wide:px-1" aria-label="Gold & Silver Billing home">
        <LogoMark className="size-9 wide:hidden" />
        <LogoLockup className="hidden wide:flex" subtitle={settings.name || undefined} />
      </Link>

      {capabilities.canBill ? (
        <Link
          href="/invoices/new"
          title="New invoice"
          className={cn(
            "mx-auto mt-6 flex size-12 items-center justify-center gap-2 rounded-full bg-ink text-[14.5px] font-semibold text-on-ink shadow-[0_10px_24px_-10px_rgba(28,27,34,0.7)] transition-transform hover:bg-ink-2 active:scale-[0.98] wide:mx-0 wide:h-12 wide:w-full",
          )}
        >
          <Plus className="size-5" strokeWidth={2.4} aria-hidden />
          <span className="hidden wide:inline">New invoice</span>
        </Link>
      ) : null}

      <nav aria-label="Main" className="mt-6 flex flex-col gap-1 px-3 wide:px-0">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-12 items-center justify-center gap-3 rounded-2xl text-[14.5px] font-semibold transition-colors wide:justify-start wide:px-3",
                active ? "bg-lav-fill text-ink" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <Icon className={cn("size-[20px] shrink-0", active ? "text-lav-deep" : "text-muted group-hover:text-ink-3")} strokeWidth={2} />
              <span className="hidden wide:inline">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <RatesCard className="mt-6 hidden wide:block" />

      <div className="mt-auto flex flex-col items-center gap-2 wide:items-stretch">
        <OnlineStatus className="hidden wide:flex" />
        <UserMenu compact />
      </div>
    </aside>
  );
}

/** Today's rates (RATE-08) as a soft cream card. */
function RatesCard({ className }: { className?: string }) {
  const { rates } = useSession();
  const priced = rates.rows.filter((r) => r.rate !== "");
  return (
    <section className={cn("rounded-[20px] bg-gold-soft p-3.5", className)} aria-label="Today's rates">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">Today&apos;s rates</p>
        <Link href="/rates" className="text-[12px] font-semibold text-gold-deep hover:underline">
          {rates.status === "none" ? "Set now" : "Edit"}
        </Link>
      </div>
      {rates.status === "stale" && rates.effectiveDate ? (
        <Link href="/rates" className="mt-2 flex items-center gap-1.5 rounded-xl bg-gold-fill px-2.5 py-1.5 text-[12px] font-semibold text-gold-deep">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Rates from {formatDateDMY(rates.effectiveDate)} — update
        </Link>
      ) : null}
      {rates.status === "none" ? (
        <p className="mt-2 text-[12.5px] text-muted">No rates yet. Set today&apos;s rates before the first bill.</p>
      ) : (
        <ul className={cn("mt-2 space-y-1.5", rates.status === "stale" && "opacity-60")}>
          {priced.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 items-center gap-2 text-ink-3">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", metalDot(r.metal))} />
                <span className="truncate">{r.label}</span>
              </span>
              <span className="num shrink-0 font-semibold text-ink">{rateText(r.rate)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OnlineStatus({ className }: { className?: string }) {
  const online = useOnline();
  return (
    <span
      className={cn("items-center gap-1.5 px-2 text-[12px] font-medium", online ? "text-muted" : "text-danger-deep", className)}
      title={online ? "Every bill is saved to the cloud database." : "No connection — bills can't be saved until you're back online."}
    >
      {online ? <Cloud className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
      {online ? "Saved to cloud" : "Offline"}
    </span>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { user } = useSession();
  const role = user.role === "staff" ? "Billing staff" : user.role === "owner" ? "Owner" : "Viewer";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex items-center gap-2.5 rounded-2xl p-1.5 text-left transition-colors hover:bg-sunken data-[state=open]:bg-sunken",
          compact && "wide:w-full wide:px-2 wide:py-2",
        )}
        aria-label="Account"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lav-fill text-[14px] font-bold text-lav-deep uppercase">{user.name.slice(0, 1)}</span>
        <span className={cn("min-w-0 flex-1", compact ? "hidden wide:block" : "hidden tab:block")}>
          <span className="block truncate text-[13.5px] font-semibold text-ink">{user.name}</span>
          <span className="block text-[12px] text-muted">{role}</span>
        </span>
        <ChevronsUpDown className={cn("size-4 text-faint", compact ? "hidden wide:block" : "hidden")} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side={compact ? "right" : "bottom"} align="end" sideOffset={8} className="z-50 min-w-64 animate-enter rounded-[20px] bg-surface p-1.5 text-ink shadow-pop">
          <div className="px-3 py-2">
            <p className="text-[14px] font-semibold">{user.name}</p>
            <p className="text-[12.5px] text-muted">{role}</p>
          </div>
          <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
          <div className="px-2 pt-1 pb-2">
            <p className="px-1 pb-1.5 text-[12px] font-semibold text-muted">Appearance</p>
            <ThemeSwitch />
          </div>
          <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={async () => {
              await api("/api/auth/logout", { method: "POST" });
              // Full reload on purpose: drops every piece of in-memory session state.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/login");
            }}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-medium outline-none data-[highlighted]:bg-sunken"
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ── phones & tablets: header + floating bottom bar ────────────────── */

export function MobileHeader() {
  const { settings, rates } = useSession();
  const pathname = usePathname();
  const onInvoice = pathname.startsWith("/invoices");
  const priced = rates.rows.filter((r) => r.rate !== "");
  return (
    <header className="print:hidden lg:hidden">
      <div className="flex items-center gap-3 px-4 pt-4 tab:px-6">
        {onInvoice ? (
          // The bottom bar gives way to the totals dock here, so offer the way back.
          <Link href="/transactions" aria-label="Back to transactions" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-hair transition-colors hover:bg-sunken">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        ) : (
          <LogoMark className="size-9 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="tight truncate text-[16px] font-bold text-ink">{settings.name || "Gold & Silver Billing"}</p>
          <OnlineStatus className="flex px-0" />
        </div>
        <UserMenu />
      </div>
      {/* RATE-08 rate chips — one row that scrolls inside itself */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] tab:px-6">
        {rates.status === "none" ? (
          <Link href="/rates" className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-on-ink">
            Set today&apos;s rates →
          </Link>
        ) : (
          <>
            {rates.status === "stale" && rates.effectiveDate ? (
              <Link href="/rates" className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold-fill px-3 py-1.5 text-[13px] font-semibold text-gold-deep">
                <AlertTriangle className="size-3.5" aria-hidden />
                Rates from {formatDateDMY(rates.effectiveDate)} — update
              </Link>
            ) : null}
            {priced.map((r) => (
              <span key={r.id} className={cn("flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] shadow-hair", rates.status === "stale" && "opacity-60")}>
                <span aria-hidden className={cn("size-2 rounded-full", metalDot(r.metal))} />
                <span className="text-muted">{shortPurity(r.label)}</span>
                <span className="num font-semibold text-ink">{rateText(r.rate)}</span>
              </span>
            ))}
          </>
        )}
      </div>
    </header>
  );
}

export function BottomBar() {
  const { capabilities } = useSession();
  const pathname = usePathname();
  const items = useNavItems();
  const left = items.slice(0, Math.ceil(items.length / 2));
  const right = items.slice(Math.ceil(items.length / 2));
  const Item = ({ it }: { it: NavItem }) => {
    const active = it.match(pathname);
    const Icon = it.icon;
    return (
      <Link
        href={it.href}
        aria-current={active ? "page" : undefined}
        aria-label={it.label}
        className={cn(
          "flex h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold transition-colors",
          active ? "bg-white/14 text-white" : "text-white/55 hover:text-white/85",
        )}
      >
        <Icon className="size-[20px]" strokeWidth={2} />
        {it.short}
      </Link>
    );
  };
  // On the invoice screen the totals dock takes the bottom edge instead.
  if (pathname.startsWith("/invoices")) return null;
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] print:hidden lg:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-full bg-inverse p-1.5 shadow-dock">
        {left.map((it) => (
          <Item key={it.href} it={it} />
        ))}
        {capabilities.canBill ? (
          <Link
            href="/invoices/new"
            aria-label="New invoice"
            className={cn(
              "mx-1 grid h-12 w-16 shrink-0 place-items-center rounded-full bg-white text-night shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)] transition-transform active:scale-95",
            )}
          >
            <Plus className="size-6" strokeWidth={2.4} aria-hidden />
          </Link>
        ) : null}
        {right.map((it) => (
          <Item key={it.href} it={it} />
        ))}
      </div>
    </nav>
  );
}
