import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <ComingNext
      title="Dashboards"
      text="Sales, metal sold, GST, dues and payments for any period arrive in the next build step. Every saved invoice already feeds the daily summary they read from."
    />
  );
}
