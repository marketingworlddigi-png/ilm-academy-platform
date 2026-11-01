import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-next";

const FALLBACK = "/en-pk/account";

describe("safeNextPath", () => {
  it.each([
    ["/en-pk/account", "/en-pk/account"],
    ["/ur-pk/admin/boards?notice=ok", "/ur-pk/admin/boards?notice=ok"],
    ["/en-pk/library/book#top", "/en-pk/library/book#top"],
  ])("keeps same-site path %s", (input, out) => expect(safeNextPath(input)).toBe(out));

  it.each([
    ["backslash", "/\\evil.com"],
    ["double backslash", "/\\\\evil.com"],
    ["backslash mid-path", "/en-pk\\..\\evil"],
    ["encoded backslash", "/%5Cevil.com"],
    ["protocol-relative", "//evil.com"],
    ["encoded protocol-relative", "/%2F/evil.com"],
    ["tab inside", "/\t/evil.com"],
    ["newline inside", "/\n/evil.com"],
    ["encoded tab", "/%09/evil.com"],
    ["absolute url", "https://evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["no leading slash", "evil.com"],
    ["malformed encoding", "/%E0%A4%A"],
    ["empty", ""],
  ])("rejects %s", (_name, input) => expect(safeNextPath(input)).toBe(FALLBACK));

  it("rejects null/undefined and honours a custom fallback", () => {
    expect(safeNextPath(null)).toBe(FALLBACK);
    expect(safeNextPath(undefined, "/x")).toBe("/x");
    expect(safeNextPath("/\\evil.com", "/x")).toBe("/x");
  });
});
