import { describe, it, expect } from "vitest";
import { toCSV } from "../csv";

describe("toCSV", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCSV(["a", "b"], [[1, 2], [3, 4]])).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes fields containing a comma", () => {
    expect(toCSV(["name"], [["Bennani, Ahmed"]])).toBe('name\r\n"Bennani, Ahmed"');
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(toCSV(["x"], [['he said "hi"']])).toBe('x\r\n"he said ""hi"""');
  });

  it("quotes fields with newlines", () => {
    expect(toCSV(["x"], [["line1\nline2"]])).toBe('x\r\n"line1\nline2"');
  });

  it("quotes fields with leading/trailing spaces", () => {
    expect(toCSV(["x"], [[" pad "]])).toBe('x\r\n" pad "');
  });

  it("renders null/undefined as empty fields", () => {
    expect(toCSV(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });

  it("leaves Arabic text unquoted (no special chars)", () => {
    expect(toCSV(["الاسم"], [["أحمد"]])).toBe("الاسم\r\nأحمد");
  });
});
