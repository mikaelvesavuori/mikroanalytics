import { describe, expect, it } from "vitest";

import { formatDelta, reasonLabel, slugSegment } from "../../src/dashboard/format.js";

describe("dashboard format helpers", () => {
  it("formats comparison deltas for metric cards", () => {
    expect(formatDelta(0, 0, 0)).toEqual({ text: "No previous data", tone: "neutral" });
    expect(formatDelta(12, 0, null)).toEqual({ text: "New vs previous", tone: "new" });
    expect(formatDelta(12, 12, 0)).toEqual({ text: "No change", tone: "neutral" });
    expect(formatDelta(18, 12, 50)).toEqual({ text: "+50% vs previous", tone: "up" });
    expect(formatDelta(9, 12, -25)).toEqual({ text: "-25% vs previous", tone: "down" });
  });

  it("maps ingest reason ids to short UI labels", () => {
    expect(reasonLabel("privacy_signal")).toBe("privacy signal");
    expect(reasonLabel("unknown_site")).toBe("site");
    expect(reasonLabel("custom_reason_value")).toBe("custom reason value");
  });

  it("creates filename-safe slug segments", () => {
    expect(slugSegment("Demo: Busy SaaS")).toBe("demo-busy-saas");
    expect(slugSegment("site_demo.example")).toBe("site_demo.example");
    expect(slugSegment("!!!")).toBe("site");
  });
});
