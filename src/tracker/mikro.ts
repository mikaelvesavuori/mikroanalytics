type AnalyticsKind = "event" | "pageview";

interface AnalyticsPayload {
  campaign: Record<string, string>;
  event?: string;
  host: string;
  kind: AnalyticsKind;
  path: string;
  properties?: Record<string, string | number | boolean>;
  referrer: string;
  site: string;
  timestamp: string;
}

interface MikroApi {
  event: (name: string, properties?: Record<string, string | number | boolean>) => void;
  pageview: () => void;
  track: (nameOrProperties?: string | Record<string, string | number | boolean>) => void;
  version: string;
}

declare global {
  interface Window {
    mikro?: MikroApi;
  }
}

const script = document.currentScript as HTMLScriptElement | null;
const siteId = script?.dataset.site ?? script?.dataset.websiteId ?? "";
const endpoint = resolveEndpoint(script);
const autoTrack = script?.dataset.auto !== "false";
const spaTrack = script?.dataset.spa !== "false";
const clickTrack = script?.dataset.clicks !== "false";
const honorDoNotTrack = script?.dataset.doNotTrack !== "false";
let lastPath = "";

const api: MikroApi = {
  event: (name, properties) => send("event", name, properties),
  pageview: () => send("pageview"),
  track: (nameOrProperties) => {
    if (typeof nameOrProperties === "string") {
      send("event", nameOrProperties);
      return;
    }

    send("pageview", undefined, nameOrProperties);
  },
  version: "0.1.0",
};

window.mikro = api;

if (siteId && !privacySignalEnabled()) {
  if (autoTrack) {
    queueMicrotask(() => api.pageview());
  }

  if (spaTrack) {
    installNavigationTracking();
  }

  if (clickTrack) {
    installClickTracking();
  }
}

function send(
  kind: AnalyticsKind,
  event?: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!siteId || privacySignalEnabled()) {
    return;
  }

  const path = location.pathname || "/";
  if (kind === "pageview" && path === lastPath) {
    return;
  }
  if (kind === "pageview") {
    lastPath = path;
  }

  const payload: AnalyticsPayload = {
    campaign: readCampaign(),
    event,
    host: location.hostname,
    kind,
    path,
    properties: properties ? sanitizeProperties(properties) : undefined,
    referrer: document.referrer || "",
    site: siteId,
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const accepted = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    if (accepted) {
      return;
    }
  }

  fetch(endpoint, {
    body,
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
    mode: "cors",
  }).catch(() => undefined);
}

function installNavigationTracking(): void {
  const notify = debounce(() => api.pageview(), 40);
  for (const methodName of ["pushState", "replaceState"] as const) {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  }

  window.addEventListener("popstate", notify);
}

function installClickTracking(): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest<HTMLElement>("[data-mikro-event]");
      const name = element?.dataset.mikroEvent;
      if (!name) {
        return;
      }

      api.event(name, readElementProperties(element));
    },
    { capture: true, passive: true },
  );
}

function readElementProperties(element: HTMLElement): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(element.dataset)) {
    if (!key.startsWith("mikroProp") || key === "mikroEvent") {
      continue;
    }

    const propertyKey = key
      .replace(/^mikroProp/, "")
      .replace(/^[A-Z]/, (match) => match.toLowerCase());
    if (propertyKey) {
      properties[propertyKey] = value ?? "";
    }
  }

  return properties;
}

function readCampaign(): Record<string, string> {
  const params = new URLSearchParams(location.search);
  const campaign: Record<string, string> = {};
  for (const key of [
    "ref",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const value = params.get(key);
    if (value) {
      campaign[key] = value.slice(0, 120);
    }
  }
  return campaign;
}

function sanitizeProperties(
  properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(key)) {
      continue;
    }

    if (typeof value === "boolean") {
      output[key] = value;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = value;
      continue;
    }

    if (typeof value === "string") {
      output[key] = value.slice(0, 120);
    }
  }
  return output;
}

function privacySignalEnabled(): boolean {
  if (!honorDoNotTrack) {
    return false;
  }

  const navigatorWithSignals = navigator as Navigator & {
    doNotTrack?: string;
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };

  return (
    navigatorWithSignals.globalPrivacyControl === true ||
    navigatorWithSignals.doNotTrack === "1" ||
    navigatorWithSignals.msDoNotTrack === "1"
  );
}

function resolveEndpoint(currentScript: HTMLScriptElement | null): string {
  const explicitEndpoint = currentScript?.dataset.endpoint;
  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  if (currentScript?.src) {
    return new URL("/api/collect", currentScript.src).toString();
  }

  return "/api/collect";
}

function debounce(callback: () => void, delayMs: number): () => void {
  let timeout: number | undefined;
  return () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(callback, delayMs);
  };
}
