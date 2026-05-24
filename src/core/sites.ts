export interface MikroAnalyticsSite {
  allowedEventProperties: string[];
  domains: string[];
  id: string;
  ingestToken: string;
  name: string;
}

export interface SiteInput {
  allowedEventProperties?: unknown;
  domains?: unknown;
  id?: unknown;
  ingestToken?: unknown;
  name?: unknown;
}

export function normalizeSiteInput(input: SiteInput): MikroAnalyticsSite {
  const id = normalizeId(asString(input.id));
  const name = normalizeText(asString(input.name), id || "Untitled site");

  if (!id) {
    throw new Error("Site ID is required.");
  }

  if (!name) {
    throw new Error("Site name is required.");
  }

  return {
    allowedEventProperties: normalizeList(input.allowedEventProperties).map(normalizePropertyName),
    domains: normalizeList(input.domains).map(normalizeSiteDomain).filter(Boolean),
    id,
    ingestToken: asString(input.ingestToken).trim(),
    name,
  };
}

export function toPublicSite(site: MikroAnalyticsSite, appUrl: string) {
  return {
    allowedEventProperties: site.allowedEventProperties,
    domains: site.domains,
    id: site.id,
    name: site.name,
    snippet: `<script defer src="${escapeAttribute(getPublicAssetUrl(appUrl, "/m.js"))}" data-site="${escapeAttribute(site.id)}"></script>`,
  };
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80);
}

function normalizePropertyName(value: string): string {
  return value.trim().slice(0, 80);
}

function normalizeSiteDomain(value: string): string {
  const candidate = value.trim().toLowerCase();
  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname;
  } catch {
    return candidate
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }
}

function normalizeText(value: string, fallback: string): string {
  const text = value.trim();
  return (text || fallback).slice(0, 120);
}

function normalizeList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];

  return Array.from(
    new Set(values.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)),
  ).slice(0, 100);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getPublicAssetUrl(appUrl: string, path: string): string {
  const url = new URL(appUrl);
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
