export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatDelta(
  current: number,
  previous: number,
  delta: number | null,
): { text: string; tone: string } {
  if (current === 0 && previous === 0) {
    return { text: "No previous data", tone: "neutral" };
  }

  if (delta === null) {
    return { text: "New vs previous", tone: "new" };
  }

  if (delta === 0) {
    return { text: "No change", tone: "neutral" };
  }

  return {
    text: `${delta > 0 ? "+" : ""}${delta}% vs previous`,
    tone: delta > 0 ? "up" : "down",
  };
}

export function formatAttemptTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

export function reasonLabel(reason: string): string {
  return (
    {
      accepted: "accepted",
      host_not_allowed: "origin",
      ingest_token_required: "token",
      invalid_event_name: "event name",
      invalid_kind: "kind",
      privacy_signal: "privacy signal",
      unknown_site: "site",
    }[reason] ?? reason.replace(/_/g, " ")
  );
}

export function slugSegment(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "site";
}
