import { describe, expect, it } from "vitest";
import { MODULE_CATEGORIES, MODULES, REGIONS } from "./kinetic-data";

describe("MODULES", () => {
  it("has unique module ids", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses declared categories", () => {
    for (const m of MODULES) {
      expect(MODULE_CATEGORIES).toContain(m.category);
    }
  });

  it("has non-negative load and latency costs", () => {
    for (const m of MODULES) {
      expect(m.loadMb).toBeGreaterThanOrEqual(0);
      expect(m.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("has a non-empty name and description for every module", () => {
    for (const m of MODULES) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it("includes the tunnel module, since the console assumes it exists", () => {
    expect(MODULES.some((m) => m.id === "tunnel")).toBe(true);
  });
});

describe("REGIONS", () => {
  it("has unique region codes", () => {
    const codes = REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has non-negative ping values", () => {
    for (const r of REGIONS) {
      expect(r.ping).toBeGreaterThanOrEqual(0);
    }
  });

  it("has at least one region", () => {
    expect(REGIONS.length).toBeGreaterThan(0);
  });
});
