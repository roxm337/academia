import { describe, expect, it } from "vitest";
import { dirOf, localeTag, locales, resolveLocale } from "@/i18n/routing";

describe("dirOf", () => {
  it("only Arabic is right-to-left", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("fr")).toBe("ltr");
    expect(dirOf("en")).toBe("ltr");
  });

  it("an unknown locale is laid out left-to-right rather than throwing", () => {
    expect(dirOf("zz")).toBe("ltr");
  });
});

describe("localeTag", () => {
  it("keeps Moroccan regions for the school's own languages", () => {
    expect(localeTag("ar")).toBe("ar-MA");
    expect(localeTag("fr")).toBe("fr-MA");
  });

  it("does not format English dates as French", () => {
    // The bug this guards: en falling through to fr-MA would print
    // "21 juillet 2026" on a page whose every other word is English.
    expect(localeTag("en")).toBe("en-GB");
  });
});

describe("resolveLocale", () => {
  it("accepts every locale the app actually serves", () => {
    for (const l of locales) expect(resolveLocale(l)).toBe(l);
  });

  it("falls back for absent input", () => {
    expect(resolveLocale(null)).toBe("fr");
    expect(resolveLocale(undefined)).toBe("fr");
    expect(resolveLocale("")).toBe("fr");
  });

  it("refuses anything not on the list", () => {
    // These reach it from query strings and form fields, so the interesting
    // cases are hostile, not merely wrong.
    expect(resolveLocale("es")).toBe("fr");
    expect(resolveLocale("../../etc/passwd")).toBe("fr");
    expect(resolveLocale("EN")).toBe("fr");
    expect(resolveLocale("fr-MA")).toBe("fr");
  });
});
