import type { MikroAnalyticsConfig, MikroAnalyticsPrivacyConfig } from "./config.js";
import { type ClientDimensions, parseUserAgent } from "./dimensions.js";
import type { MikroAnalyticsSite } from "./sites.js";

export type AnalyticsEventKind = "event" | "pageview";

export interface CollectPayload {
  campaign?: Record<string, unknown>;
  event?: string;
  host?: string;
  kind?: AnalyticsEventKind;
  path?: string;
  properties?: Record<string, unknown>;
  referrer?: string;
  site?: string;
  timestamp?: string;
  title?: string;
  type?: AnalyticsEventKind;
  url?: string;
}

export interface RequestMetadata {
  headers: HeadersLike;
  originHost?: string;
  remoteAddress?: string;
  userAgent: string;
}

export interface HeadersLike {
  get(name: string): string | null;
}

export interface SanitizedAnalyticsEvent {
  browser: string;
  campaign: {
    campaign: string;
    content: string;
    medium: string;
    source: string;
    term: string;
  };
  country: string;
  date: string;
  device: string;
  eventName: string;
  host: string;
  kind: AnalyticsEventKind;
  os: string;
  path: string;
  properties: Record<string, string | number | boolean>;
  referrer: string;
  siteId: string;
  timestamp: string;
  uniqueKey?: string;
}

export type SanitizedResult =
  | { event: SanitizedAnalyticsEvent; ignored: false; site: MikroAnalyticsSite }
  | { ignored: true; reason: string };

export function sanitizeCollectPayload(
  config: MikroAnalyticsConfig,
  site: MikroAnalyticsSite,
  payload: CollectPayload,
  metadata: RequestMetadata,
  uniqueKey?: string,
): SanitizedResult {
  if (isPrivacySignalEnabled(config.privacy, metadata.headers)) {
    return { ignored: true, reason: "privacy_signal" };
  }

  const parsedUrl = parseReportedUrl(payload, metadata.originHost);
  const host = normalizeHost(payload.host ?? parsedUrl?.hostname ?? metadata.originHost ?? "");
  if (!isAllowedHost(site, host)) {
    return { ignored: true, reason: "host_not_allowed" };
  }

  const kind = payload.kind ?? payload.type ?? (payload.event ? "event" : "pageview");
  if (kind !== "pageview" && kind !== "event") {
    return { ignored: true, reason: "invalid_kind" };
  }

  const path = sanitizePath(payload.path ?? parsedUrl?.pathname ?? "/");
  const eventName = kind === "event" ? sanitizeEventName(payload.event) : "";
  if (kind === "event" && !eventName) {
    return { ignored: true, reason: "invalid_event_name" };
  }

  const timestamp = sanitizeTimestamp(payload.timestamp);
  const dimensions = parseUserAgent(metadata.userAgent);

  return {
    event: {
      ...dimensions,
      campaign: sanitizeCampaign(payload.campaign, config.privacy),
      country: sanitizeCountry(metadata.headers, config.privacy),
      date: timestamp.slice(0, 10),
      eventName,
      host,
      kind,
      path,
      properties: sanitizeProperties(payload.properties, site, config.privacy),
      referrer: sanitizeReferrer(payload.referrer, host, config.privacy),
      siteId: site.id,
      timestamp,
      uniqueKey,
    },
    ignored: false,
    site,
  };
}

export function isPrivacySignalEnabled(
  privacy: MikroAnalyticsPrivacyConfig,
  headers: HeadersLike,
): boolean {
  if (!privacy.honorDoNotTrack) {
    return false;
  }

  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

export function isAllowedHost(site: MikroAnalyticsSite, host: string): boolean {
  if (!site.domains.length) {
    return true;
  }

  const normalizedHost = normalizeHost(host);
  return site.domains.some((domain) => {
    const normalizedDomain = normalizeHost(domain);
    return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
  });
}

export function sanitizeProperties(
  properties: Record<string, unknown> | undefined,
  site: MikroAnalyticsSite,
  privacy: MikroAnalyticsPrivacyConfig,
): Record<string, string | number | boolean> {
  const allowed = new Set(site.allowedEventProperties.map((key) => key.toLowerCase()));
  const output: Record<string, string | number | boolean> = {};

  for (const [rawKey, rawValue] of Object.entries(properties ?? {})) {
    if (Object.keys(output).length >= privacy.maxEventProperties) {
      break;
    }

    const key = sanitizePropertyKey(rawKey);
    if (!key) {
      continue;
    }

    if (allowed.size > 0 && !allowed.has(key.toLowerCase())) {
      continue;
    }

    if (isBlockedPropertyKey(key, privacy.blockedEventProperties)) {
      continue;
    }

    const value = sanitizePropertyValue(rawValue, privacy.maxPropertyLength);
    if (value === undefined) {
      continue;
    }

    output[key] = value;
  }

  return output;
}

export function sanitizePath(path: string): string {
  const trimmed = path.trim().slice(0, 300);
  if (!trimmed) return "/";

  const withoutHash = trimmed.split("#")[0] ?? "/";
  const withoutQuery = withoutHash.split("?")[0] ?? "/";
  const candidate = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return candidate.replace(/\/{2,}/g, "/") || "/";
}

export function sanitizeEventName(name: unknown): string {
  if (typeof name !== "string") {
    return "";
  }

  return name
    .trim()
    .replace(/[^\w .:/-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function summarizeClient(userAgent: string): ClientDimensions {
  return parseUserAgent(userAgent);
}

function parseReportedUrl(payload: CollectPayload, originHost: string | undefined): URL | null {
  const source = payload.url ?? payload.path;
  if (!source || typeof source !== "string") {
    return null;
  }

  try {
    return new URL(source, `https://${originHost ?? payload.host ?? "example.local"}`);
  } catch {
    return null;
  }
}

function sanitizeTimestamp(timestamp: unknown): string {
  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function sanitizeCampaign(
  campaign: Record<string, unknown> | undefined,
  privacy: MikroAnalyticsPrivacyConfig,
): SanitizedAnalyticsEvent["campaign"] {
  return {
    campaign: sanitizeCampaignValue(campaign?.utm_campaign ?? campaign?.campaign, privacy),
    content: sanitizeCampaignValue(campaign?.utm_content ?? campaign?.content, privacy),
    medium: sanitizeCampaignValue(campaign?.utm_medium ?? campaign?.medium, privacy),
    source: sanitizeCampaignValue(campaign?.utm_source ?? campaign?.source, privacy),
    term: sanitizeCampaignValue(campaign?.utm_term ?? campaign?.term, privacy),
  };
}

function sanitizeCampaignValue(value: unknown, privacy: MikroAnalyticsPrivacyConfig): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  const text = String(value).trim().slice(0, privacy.maxPropertyLength);
  return text.replace(/[^\w .:/-]/g, "");
}

function sanitizeCountry(headers: HeadersLike, privacy: MikroAnalyticsPrivacyConfig): string {
  if (!privacy.geo.enabled) {
    return "";
  }

  const value = headers.get(privacy.geo.countryHeader) ?? headers.get("cf-ipcountry") ?? "";
  const country = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : "";
}

function sanitizeReferrer(
  referrer: string | undefined,
  host: string,
  privacy: MikroAnalyticsPrivacyConfig,
): string {
  if (privacy.referrerPolicy === "none" || !referrer) {
    return "";
  }

  try {
    const url = new URL(referrer);
    const referrerHost = normalizeHost(url.hostname);
    if (referrerHost === normalizeHost(host)) {
      return privacy.referrerPolicy === "same-origin-path" ? sanitizePath(url.pathname) : "";
    }

    return url.origin.slice(0, 180);
  } catch {
    return "";
  }
}

function sanitizePropertyKey(key: string): string {
  return key
    .trim()
    .replace(/[^\w-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 48);
}

function sanitizePropertyValue(
  value: unknown,
  maxLength: number,
): string | number | boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(4));
  }

  if (typeof value === "string") {
    const text = value.trim().slice(0, maxLength);
    return text ? text : undefined;
  }

  return undefined;
}

function isBlockedPropertyKey(key: string, blockedKeys: string[]): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]+/g, "");
  return blockedKeys.some((blockedKey) => normalized === blockedKey.toLowerCase());
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}
