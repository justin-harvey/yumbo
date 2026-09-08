import { describe, expect, it } from "vitest";
import { InvalidGtinError, normaliseToGtin14 } from "@/lib/gtin";

describe("normaliseToGtin14", () => {
  it("left-pads UPC-A (12 digits) to 14, preserving leading zeros", () => {
    // Justin's organic-banana UPC. The leading zero is significant and must
    // survive: text, never numeric (CLAUDE.md invariant #1).
    const gtin = normaliseToGtin14("074904100012");
    expect(gtin).toBe("00074904100012");
    expect(gtin).toHaveLength(14);
  });

  it("keeps a UPC-A that itself starts with zero", () => {
    // 036000291452 is a valid UPC-A whose first digit is already 0.
    const gtin = normaliseToGtin14("036000291452");
    expect(gtin).toBe("00036000291452");
    expect(gtin.startsWith("000")).toBe(true);
  });

  it("left-pads EAN-13 (13 digits) to 14", () => {
    expect(normaliseToGtin14("4006381333931")).toBe("04006381333931");
  });

  it("left-pads EAN-8 (8 digits) to 14", () => {
    expect(normaliseToGtin14("96385074")).toBe("00000096385074");
  });

  it("accepts an already-14-digit GTIN unchanged", () => {
    expect(normaliseToGtin14("00074904100012")).toBe("00074904100012");
  });

  it("tolerates surrounding whitespace", () => {
    expect(normaliseToGtin14("  074904100012 ")).toBe("00074904100012");
  });

  it("rejects a wrong check digit", () => {
    // 074904100012 is valid; flipping the check digit to 3 must fail.
    expect(() => normaliseToGtin14("074904100013")).toThrowError(
      InvalidGtinError,
    );
    try {
      normaliseToGtin14("074904100013");
    } catch (err) {
      expect((err as InvalidGtinError).reason).toBe("bad-check-digit");
    }
  });

  it("rejects non-numeric input", () => {
    try {
      normaliseToGtin14("07490410001X");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidGtinError);
      expect((err as InvalidGtinError).reason).toBe("non-numeric");
    }
  });

  it("rejects an unsupported length", () => {
    try {
      normaliseToGtin14("12345");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidGtinError);
      expect((err as InvalidGtinError).reason).toBe("bad-length");
    }
  });
});
