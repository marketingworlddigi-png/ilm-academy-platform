import { describe, expect, it } from "vitest";
import { loginUrl, postLoginPath } from "@/lib/auth/return-path";
import { readAction } from "@/modules/library/read-action";

describe("loginUrl", () => {
  it("encodes the return path", () => {
    expect(loginUrl("en-pk")).toBe("/en-pk/login");
    expect(loginUrl("en-pk", "/en-pk/books/abc/read")).toBe("/en-pk/login?next=%2Fen-pk%2Fbooks%2Fabc%2Fread");
  });
});

describe("postLoginPath", () => {
  it("returns same-site paths", () => {
    expect(postLoginPath("en-pk", "/en-pk/books/abc/read")).toBe("/en-pk/books/abc/read");
  });
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined, 42])("falls back to the account page for %j", (v) => {
    expect(postLoginPath("ur-pk", v)).toBe("/ur-pk/account");
  });
});

describe("readAction", () => {
  it("free books show Read online to everyone when reading is permitted", () => {
    expect(readAction({ accessTier: "free", allowOnlineView: true, canView: null })).toBe("read");
  });
  it("premium shows Read online only when the database says the user may view", () => {
    expect(readAction({ accessTier: "premium", allowOnlineView: true, canView: true })).toBe("read");
    expect(readAction({ accessTier: "premium", allowOnlineView: true, canView: false })).toBe("premium");
    expect(readAction({ accessTier: "premium", allowOnlineView: true, canView: null })).toBe("premium");
    expect(readAction({ accessTier: "academy", allowOnlineView: true, canView: false })).toBe("premium");
  });
  it("shows nothing when the rights holder does not permit online reading", () => {
    expect(readAction({ accessTier: "free", allowOnlineView: false, canView: true })).toBe("none");
    expect(readAction({ accessTier: "premium", allowOnlineView: false, canView: true })).toBe("none");
  });
});
