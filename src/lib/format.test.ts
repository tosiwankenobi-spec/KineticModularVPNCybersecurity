import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  const now = 1_000_000_000; // fixed reference point, ms

  it("formats sub-minute deltas in seconds", () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe("5s ago");
    expect(formatRelativeTime(now - 59_000, now)).toBe("59s ago");
  });

  it("formats sub-hour deltas in minutes", () => {
    expect(formatRelativeTime(now - 60_000, now)).toBe("1m ago");
    expect(formatRelativeTime(now - 59 * 60_000, now)).toBe("59m ago");
  });

  it("formats deltas of an hour or more in hours", () => {
    expect(formatRelativeTime(now - 60 * 60_000, now)).toBe("1h ago");
    expect(formatRelativeTime(now - 5 * 60 * 60_000, now)).toBe("5h ago");
  });

  it("never returns a negative duration for timestamps at or after now", () => {
    expect(formatRelativeTime(now, now)).toBe("0s ago");
    expect(formatRelativeTime(now + 10_000, now)).toBe("0s ago");
  });
});
