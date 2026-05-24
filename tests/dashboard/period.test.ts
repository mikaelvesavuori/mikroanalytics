import { describe, expect, it } from "vitest";

import { normalizeDateRange, parsePeriodCommand } from "../../src/dashboard/period.js";

describe("dashboard period parsing", () => {
  it("parses custom day commands", () => {
    expect(parsePeriodCommand("3 days")).toEqual({ days: 3, kind: "days" });
    expect(parsePeriodCommand("730d")).toEqual({ days: 730, kind: "days" });
    expect(parsePeriodCommand("731 days")).toBeNull();
  });

  it("parses compact and separated date ranges", () => {
    expect(parsePeriodCommand("20260301 to 20260601")).toEqual({
      kind: "range",
      range: { end: "2026-06-01", start: "2026-03-01" },
    });
    expect(parsePeriodCommand("2026-06-01 to 2026-03-01")).toEqual({
      kind: "range",
      range: { end: "2026-06-01", start: "2026-03-01" },
    });
  });

  it("parses natural month ranges with the current year", () => {
    const year = new Date().getFullYear();

    expect(parsePeriodCommand("may 1 to may 10")).toEqual({
      kind: "range",
      range: { end: `${year}-05-10`, start: `${year}-05-01` },
    });
  });

  it("normalizes explicit ranges", () => {
    expect(normalizeDateRange("2026-05-22", "2026-05-20")).toEqual({
      end: "2026-05-22",
      start: "2026-05-20",
    });
    expect(normalizeDateRange("not-a-date", "2026-05-20")).toBeNull();
  });
});
