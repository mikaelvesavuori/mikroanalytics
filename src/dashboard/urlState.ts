import type { DateRange } from "./model.js";
import { normalizeDateRange } from "./period.js";

export interface DashboardUrlState {
  days: string | null;
  range: DateRange | null;
  siteId: string;
  trendIds: string[];
}

export interface DashboardUrlSyncInput {
  days: string;
  range: DateRange | null;
  siteId: string;
  trendIds: string[];
}

export function readDashboardUrlState(href = window.location.href): DashboardUrlState {
  const url = new URL(href);
  const trendIds = [
    ...url.searchParams.getAll("trend"),
    ...(url.searchParams.get("metrics")?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    days: url.searchParams.get("days"),
    range: normalizeDateRange(url.searchParams.get("start"), url.searchParams.get("end")),
    siteId: url.searchParams.get("site")?.trim() ?? "",
    trendIds,
  };
}

export function syncDashboardUrlState(
  input: DashboardUrlSyncInput,
  href = window.location.href,
): string {
  const nextHref = buildDashboardUrl(input, href);
  const url = new URL(nextHref);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    history.replaceState(null, "", nextUrl);
  }

  return nextHref;
}

export function buildDashboardUrl(input: DashboardUrlSyncInput, href: string): string {
  const url = new URL(href);

  url.searchParams.delete("token");
  url.searchParams.delete("email");
  url.searchParams.delete("view");
  url.searchParams.delete("metrics");
  url.searchParams.delete("trend");
  if (input.range) {
    url.searchParams.set("start", input.range.start);
    url.searchParams.set("end", input.range.end);
    url.searchParams.delete("days");
  } else {
    url.searchParams.set("days", input.days);
    url.searchParams.delete("start");
    url.searchParams.delete("end");
  }
  if (input.siteId) {
    url.searchParams.set("site", input.siteId);
  } else {
    url.searchParams.delete("site");
  }
  for (const trendId of input.trendIds) {
    url.searchParams.append("trend", trendId);
  }

  return url.href;
}
