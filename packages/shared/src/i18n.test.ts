import { describe, expect, it } from "vitest";
import { formatDate, relativeDays, unitLabel } from "./dates.ts";
import { bi, DEFAULT_LANG, localize, pick, toLang } from "./i18n.ts";

describe("i18n", () => {
  it("defaults to Thai", () => {
    expect(DEFAULT_LANG).toBe("th");
    expect(toLang(undefined)).toBe("th");
    expect(toLang("both")).toBe("th");
    expect(toLang("en")).toBe("en");
  });

  it("picks the language", () => {
    expect(pick("en", "Save", "บันทึก")).toBe("Save");
    expect(pick("th", "Save", "บันทึก")).toBe("บันทึก");
  });

  it("packs and unpacks API messages", () => {
    const m = bi("Not found", "ไม่พบข้อมูล");
    expect(localize(m, "en")).toBe("Not found");
    expect(localize(m, "th")).toBe("ไม่พบข้อมูล");
    expect(localize("plain", "th")).toBe("plain");
  });

  it("formats dates and relative days per language", () => {
    expect(formatDate("2026-10-02", "en")).toBe("2 Oct 26");
    expect(formatDate("2026-10-02", "th")).toContain("ต.ค.");
    expect(relativeDays("2026-10-02", "2026-10-05", "en")).toBe("in 3 days");
    expect(relativeDays("2026-10-02", "2026-10-01", "th")).toBe("เมื่อวาน");
    expect(unitLabel("workday", "en", 1)).toBe("workday");
    expect(unitLabel("workday", "th")).toBe("วันทำงาน");
  });
});
