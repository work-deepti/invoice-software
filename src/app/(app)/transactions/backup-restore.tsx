"use client";
import { DropdownMenu } from "radix-ui";
import { Database, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { formatDateDMY, formatIndianNumber } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

const FORMAT = "gold-silver-billing-backup";
const BATCH = 50;

interface BackupFile {
  format: string;
  version: number;
  exportedAt: string;
  invoices: unknown[];
  [k: string]: unknown;
}

type Stage =
  | { kind: "idle" }
  | { kind: "confirm"; file: BackupFile; name: string }
  | { kind: "running"; done: number; total: number }
  | { kind: "done"; total: number }
  | { kind: "error"; message: string };

/** TXN-13 full backup (download) and TXN-14 restore with progress (owner only). */
export function BackupRestore({ onRestored }: { onRestored: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  async function pick(f: File) {
    try {
      const data = JSON.parse(await f.text()) as BackupFile;
      if (data?.format !== FORMAT || !Array.isArray(data.invoices)) throw new Error("bad");
      setStage({ kind: "confirm", file: data, name: f.name });
    } catch {
      setStage({ kind: "error", message: "This file isn't a Gold & Silver Billing backup. Choose the .json file made by Backup." });
    }
  }

  async function run(file: BackupFile) {
    const total = file.invoices.length;
    setStage({ kind: "running", done: 0, total });
    const start = await api("/api/restore", { method: "POST", body: { phase: "start", meta: file } });
    if (!start.ok) return setStage({ kind: "error", message: start.error.message });
    for (let i = 0; i < total; i += BATCH) {
      const r = await api("/api/restore", { method: "POST", body: { phase: "invoices", invoices: file.invoices.slice(i, i + BATCH) } });
      if (!r.ok)
        return setStage({
          kind: "error",
          message: `Stopped after ${formatIndianNumber(i, 0)} of ${formatIndianNumber(total, 0)} invoices: ${r.error.message} Invoices already restored are kept; running the restore again is safe.`,
        });
      setStage({ kind: "running", done: Math.min(total, i + BATCH), total });
    }
    await api("/api/restore", { method: "POST", body: { phase: "finish", total, exportedAt: file.exportedAt } });
    setStage({ kind: "done", total });
    onRestored();
    toast(`Restored ${formatIndianNumber(total, 0)} invoices`);
  }

  const close = () => {
    if (stage.kind !== "running") setStage({ kind: "idle" });
  };
  const pct = stage.kind === "running" ? Math.round((stage.done / Math.max(1, stage.total)) * 100) : 0;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button>
            <Database className="size-4" aria-hidden />
            Backup
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-72 animate-enter rounded-xl border border-line bg-surface p-1 shadow-pop">
            <DropdownMenu.Item asChild>
              <a href="/api/backup" className="flex flex-col rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-sunken">
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  <Download className="size-4 text-muted" aria-hidden />
                  Download full backup
                </span>
                <span className="pl-6 text-[12.5px] text-muted">Settings, rates, history, numbering and every invoice</span>
              </a>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => input.current?.click()}
              className="flex cursor-pointer flex-col rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-sunken"
            >
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                <Upload className="size-4 text-muted" aria-hidden />
                Restore from a backup…
              </span>
              <span className="pl-6 text-[12.5px] text-muted">Move data between the cloud and this computer</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />

      <Dialog
        open={stage.kind !== "idle"}
        onOpenChange={(v) => !v && close()}
        title={stage.kind === "done" ? "Restore complete" : stage.kind === "error" ? "Can't restore" : "Restore backup"}
        description={
          stage.kind === "confirm"
            ? `${stage.name} · made ${formatDateDMY(stage.file.exportedAt.slice(0, 10))}`
            : undefined
        }
        footer={
          stage.kind === "confirm" ? (
            <>
              <Button onClick={close}>Cancel</Button>
              <Button variant="primary" onClick={() => void run(stage.file)}>
                Restore
              </Button>
            </>
          ) : stage.kind === "running" ? null : (
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          )
        }
      >
        {stage.kind === "confirm" ? (
          <p className="text-[14px] leading-relaxed text-ink">
            It contains <span className="num font-semibold">{formatIndianNumber(stage.file.invoices.length, 0)}</span> invoices plus settings and rates. Invoices with the same number here will be replaced; nothing else is deleted.
          </p>
        ) : stage.kind === "running" ? (
          <div aria-live="polite">
            <p className="text-[14px] text-ink">
              Restoring… <span className="num font-medium">{formatIndianNumber(stage.done, 0)}/{formatIndianNumber(stage.total, 0)}</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="h-full rounded-full bg-ink transition-[width] duration-150 ease-out-expo" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-muted">Keep this page open until it finishes.</p>
          </div>
        ) : stage.kind === "done" ? (
          <p className="text-[14px] text-ink">
            <span className="num font-semibold">{formatIndianNumber(stage.total, 0)}</span> invoices, settings and rates are restored. Numbering continues after the highest number in the backup.
          </p>
        ) : stage.kind === "error" ? (
          <p className="text-[14px] leading-relaxed text-danger-deep">{stage.message}</p>
        ) : null}
      </Dialog>
    </>
  );
}
