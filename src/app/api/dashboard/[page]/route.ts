import { requireUser } from "@/server/auth";
import { DASHBOARD_PAGES, parseDashQuery, type DashboardPage } from "@/server/dashboard";
import { forbidden, notFound, ok, route } from "@/server/http";
import { loadSettingsRow } from "@/server/settings";

type Ctx = { params: Promise<{ page: string }> };

/** GET /api/dashboard/{page}?period=&from=&to=&metal=&gst=&mode= — aggregates for each page (§11). */
export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  // DSH-11: owner and viewer see all pages; staff only when the owner allows it (ROLE-03)
  if (user.role === "staff" && !(await loadSettingsRow()).staffCanSeeDashboard) throw forbidden("Dashboards are not enabled for billing staff.");
  const { page } = await params;
  if (!(page in DASHBOARD_PAGES)) throw notFound("No such dashboard page.");
  const url = new URL(req.url);
  const query = parseDashQuery(url);
  const fn = DASHBOARD_PAGES[page as DashboardPage];
  const data =
    page === "customers"
      ? await (fn as typeof DASHBOARD_PAGES.customers)(query, url.searchParams.get("lookup") ?? undefined)
      : await (fn as (q: typeof query) => Promise<unknown>)(query);
  return ok({
    period: { key: query.period.key, current: query.period.current, previous: query.period.previous, label: query.period.label, previousLabel: query.period.previousLabel },
    filters: query.filters,
    data,
  });
});
