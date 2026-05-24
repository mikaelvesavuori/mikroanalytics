import type { DateRange, ParsedPeriodCommand } from "./model.js";

const MONTH_INDEXES = new Map<string, number>([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

export function parsePeriodCommand(input: string): ParsedPeriodCommand | null {
  const value = input.trim();
  const daysMatch = value.match(/^(\d{1,3})\s*(?:d|days?)$/i);
  if (daysMatch?.[1]) {
    const days = Number(daysMatch[1]);
    return Number.isInteger(days) && days >= 1 && days <= 730 ? { days, kind: "days" } : null;
  }

  const parts = value
    .split(/\s+(?:to|through|until)\s+|\s+[–—-]\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  const range = normalizeDateRange(parseCommandDate(parts[0]), parseCommandDate(parts[1]));
  return range ? { kind: "range", range } : null;
}

export function normalizeDateRange(start: string | null, end: string | null): DateRange | null {
  const parsedStart = parseDate(start);
  const parsedEnd = parseDate(end);
  if (!parsedStart || !parsedEnd) {
    return null;
  }

  return parsedStart <= parsedEnd
    ? { end: parsedEnd, start: parsedStart }
    : { end: parsedStart, start: parsedEnd };
}

export function parseDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseCommandDate(value: string): string | null {
  const compactDate = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactDate) {
    return normalizeDateParts(
      Number(compactDate[1]),
      Number(compactDate[2]),
      Number(compactDate[3]),
    );
  }

  const separatedDate = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (separatedDate) {
    return normalizeDateParts(
      Number(separatedDate[1]),
      Number(separatedDate[2]),
      Number(separatedDate[3]),
    );
  }

  const monthFirst = value.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i);
  if (monthFirst) {
    return normalizeMonthDate(monthFirst[1], monthFirst[2], monthFirst[3]);
  }

  const dayFirst = value.match(/^(\d{1,2})\s+([a-z]+)(?:,?\s+(\d{4}))?$/i);
  if (dayFirst) {
    return normalizeMonthDate(dayFirst[2], dayFirst[1], dayFirst[3]);
  }

  return null;
}

function normalizeMonthDate(
  monthName: string | undefined,
  dayValue: string | undefined,
  yearValue: string | undefined,
): string | null {
  const month = monthName ? MONTH_INDEXES.get(monthName.toLowerCase()) : undefined;
  const year = yearValue ? Number(yearValue) : new Date().getFullYear();
  return month && dayValue ? normalizeDateParts(year, month, Number(dayValue)) : null;
}

function normalizeDateParts(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}
