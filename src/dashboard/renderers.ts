import { requireElement } from "./dom.js";
import { formatAttemptTime, formatDelta, formatNumber, reasonLabel } from "./format.js";
import type { CampaignBucket, CollectAttempt, CountBucket, Site } from "./model.js";

export function setText(id: string, value: string): void {
  requireElement(id).textContent = value;
}

export function setMetricDelta(
  id: string,
  current: number,
  previous: number,
  delta: number | null,
): void {
  const element = requireElement(id);
  const formatted = formatDelta(current, previous, delta);
  element.textContent = formatted.text;
  element.title = `Current period: ${formatNumber(current)}. Previous period: ${formatNumber(previous)}.`;
  element.className = `metric-delta ${formatted.tone}`;
}

export function renderBuckets(id: string, buckets: CountBucket[], emptyText = "No data"): void {
  const element = requireElement(id);
  if (!buckets.length) {
    element.replaceChildren(emptyElement(emptyText));
    return;
  }

  element.replaceChildren(
    ...buckets.map((bucket) => rowElement(bucket.name || "Unknown", bucket.count)),
  );
}

export function renderCampaigns(buckets: CampaignBucket[]): void {
  const element = requireElement("campaigns");
  if (!buckets.length) {
    element.replaceChildren(emptyElement("No campaigns yet"));
    return;
  }

  element.replaceChildren(
    ...buckets.map((bucket) =>
      rowElement(
        [bucket.source, bucket.medium, bucket.campaign].filter(Boolean).join(" / ") || "Campaign",
        bucket.count,
      ),
    ),
  );
}

export function renderInstallCheck(
  attempts: CollectAttempt[],
  site: Site | null,
  installState: HTMLElement,
  attemptListElement: HTMLElement,
): void {
  installState.className = "";

  if (!site) {
    installState.textContent = "No site";
    attemptListElement.replaceChildren(emptyElement("Create a site first"));
    return;
  }

  if (!attempts.length) {
    installState.textContent = "Waiting";
    attemptListElement.replaceChildren(emptyElement("No requests seen yet"));
    return;
  }

  const latestAttempt = attempts[0];
  const hasAcceptedAttempt = attempts.some((attempt) => attempt.accepted);
  installState.textContent = latestAttempt.accepted
    ? "Receiving data"
    : hasAcceptedAttempt
      ? "Receiving with ignored requests"
      : `Ignored: ${reasonLabel(latestAttempt.reason)}`;
  installState.className =
    latestAttempt.accepted || hasAcceptedAttempt ? "state-good" : "state-warning";
  attemptListElement.replaceChildren(...attempts.map(attemptElement));
}

export function emptyElement(text = "No data"): HTMLElement {
  const element = document.createElement("p");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function rowElement(name: string, count: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";

  const nameElement = document.createElement("span");
  nameElement.className = "row-name";
  nameElement.textContent = name;
  nameElement.title = name;

  const countElement = document.createElement("span");
  countElement.className = "row-count";
  countElement.textContent = formatNumber(count);

  row.append(nameElement, countElement);
  return row;
}

function attemptElement(attempt: CollectAttempt): HTMLElement {
  const row = document.createElement("div");
  row.className = attempt.accepted ? "attempt-row accepted" : "attempt-row ignored";

  const status = document.createElement("span");
  status.className = "attempt-status";
  status.textContent = attempt.accepted ? "Accepted" : "Ignored";

  const details = document.createElement("span");
  details.className = "attempt-details";

  const name = document.createElement("strong");
  name.textContent =
    attempt.kind === "event" ? attempt.eventName || "Event" : attempt.kind || "Pageview";

  const meta = document.createElement("span");
  meta.textContent = [attempt.host, attempt.path].filter(Boolean).join(" ");
  meta.title = meta.textContent;

  details.append(name, meta);

  const reason = document.createElement("span");
  reason.className = "attempt-reason";
  reason.textContent = attempt.accepted
    ? formatAttemptTime(attempt.timestamp)
    : reasonLabel(attempt.reason);

  row.append(status, details, reason);
  return row;
}
