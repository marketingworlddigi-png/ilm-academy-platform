import { describe, expect, it } from "vitest";
import { forgotSchema, resetSchema } from "@/lib/auth/schemas";

describe("password reset schemas", () => {
  it("forgot: accepts a valid email, rejects junk", () => {
    expect(forgotSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(forgotSchema.safeParse({}).success).toBe(false);
  });

  it("reset: needs 10+ chars and a matching confirmation", () => {
    expect(resetSchema.safeParse({ password: "correct-horse-1", confirm: "correct-horse-1" }).success).toBe(true);
    expect(resetSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    const mismatch = resetSchema.safeParse({ password: "correct-horse-1", confirm: "correct-horse-2" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues[0].message).toMatch(/do not match/);
  });

  it("reset: rejects passwords over the 72-character limit", () => {
    const long = "x".repeat(73);
    expect(resetSchema.safeParse({ password: long, confirm: long }).success).toBe(false);
  });
});
