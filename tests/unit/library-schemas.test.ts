import { describe, expect, it } from "vitest";
import { copyrightSchema, expiryToTimestamp, resourceSchema } from "@/modules/library/schemas";
import { isExpectedObjectName, objectNameFor } from "@/modules/library/uploads";

const base = { permission_status: "not_reviewed", license_type: "unknown" };
const id = "3f1c2a5e-8b1d-4c7a-9d0e-1a2b3c4d5e6f";
const other = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("copyrightSchema", () => {
  it("accepts a plain not-reviewed record", () => {
    expect(copyrightSchema.safeParse(base).success).toBe(true);
  });
  it("rejects grants unless approved", () => {
    expect(copyrightSchema.safeParse({ ...base, allow_online_view: "on" }).success).toBe(false);
  });
  it("approved needs a known license and a grant", () => {
    expect(copyrightSchema.safeParse({ permission_status: "approved", license_type: "unknown", allow_online_view: "on" }).success).toBe(false);
    expect(copyrightSchema.safeParse({ permission_status: "approved", license_type: "public_domain" }).success).toBe(false);
    expect(copyrightSchema.safeParse({ permission_status: "approved", license_type: "public_domain", allow_online_view: "on" }).success).toBe(true);
  });
  it("download needs online view", () => {
    expect(copyrightSchema.safeParse({ permission_status: "approved", license_type: "public_domain", allow_download: "on" }).success).toBe(false);
  });
  it("turns empty strings into null and validates the expiry date", () => {
    const ok = copyrightSchema.parse({ ...base, copyright_owner: "", expires_on: "" });
    expect(ok.copyright_owner).toBeNull();
    expect(ok.expires_on).toBeNull();
    expect(copyrightSchema.safeParse({ ...base, expires_on: "31/01/2027" }).success).toBe(false);
  });
});

describe("resourceSchema", () => {
  it("requires a title and normalises empty placement to null", () => {
    expect(resourceSchema.safeParse({ title: "x", kind: "book", access_tier: "free" }).success).toBe(false);
    const r = resourceSchema.parse({ title: "Al-Ajrumiyyah", kind: "book", access_tier: "free", board_id: "", level_id: "", subject_id: "", publication_year: "" });
    expect(r.board_id).toBeNull();
    expect(r.publication_year).toBeNull();
  });
  it("rejects an unknown tier or non-uuid placement", () => {
    expect(resourceSchema.safeParse({ title: "Book", kind: "book", access_tier: "gold" }).success).toBe(false);
    expect(resourceSchema.safeParse({ title: "Book", kind: "book", access_tier: "free", level_id: "nope" }).success).toBe(false);
  });
});

describe("expiryToTimestamp", () => {
  it("keeps the whole chosen day valid", () => {
    expect(expiryToTimestamp("2027-01-31")).toBe("2027-01-31T23:59:59.999Z");
    expect(expiryToTimestamp(null)).toBeNull();
  });
});

describe("upload object names", () => {
  it("builds a fixed name per resource and kind", () => {
    expect(objectNameFor("main", id, "application/pdf")).toBe(`${id}/file.pdf`);
    expect(objectNameFor("cover", id, "image/webp")).toBe(`${id}/cover.webp`);
  });
  it("refuses types the bucket does not allow", () => {
    expect(objectNameFor("main", id, "text/html")).toBeNull();
    expect(objectNameFor("cover", id, "application/pdf")).toBeNull();
  });
  it("accepts only paths we would have generated for this resource", () => {
    expect(isExpectedObjectName("main", id, `${id}/file.pdf`)).toBe(true);
    expect(isExpectedObjectName("main", id, `${other}/file.pdf`)).toBe(false);
    expect(isExpectedObjectName("main", id, `${id}/../${other}/file.pdf`)).toBe(false);
    expect(isExpectedObjectName("main", id, `${id}/file.exe`)).toBe(false);
    expect(isExpectedObjectName("cover", id, `${id}/file.pdf`)).toBe(false);
  });
});
