import { describe, expect, it } from "vitest";
import {
  isIndianMobile,
  normalizeIndianMobile,
  parseSchoolClass,
  PROJECT_DESC_MAX_WORDS,
  wordCount,
} from "./student-rules";

describe("Indian mobile", () => {
  it("accepts 10-digit numbers starting 6-9", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
    expect(isIndianMobile("+91 98765 43210")).toBe(true);
    expect(isIndianMobile("09876543210")).toBe(true);
  });

  it("rejects landlines and short numbers", () => {
    expect(isIndianMobile("1234567890")).toBe(false);
    expect(isIndianMobile("98765")).toBe(false);
    expect(isIndianMobile("")).toBe(false);
  });
});

describe("wordCount", () => {
  it("counts words and respects the description cap", () => {
    expect(wordCount("  hello   world ")).toBe(2);
    expect(wordCount("")).toBe(0);
    expect(PROJECT_DESC_MAX_WORDS).toBe(150);
  });
});

describe("parseSchoolClass", () => {
  it("allows 1 to 12 only", () => {
    expect(parseSchoolClass("1")).toBe(1);
    expect(parseSchoolClass("12")).toBe(12);
    expect(parseSchoolClass("Class 8")).toBe(8);
    expect(parseSchoolClass("13")).toBeNull();
    expect(parseSchoolClass("0")).toBeNull();
  });
});
