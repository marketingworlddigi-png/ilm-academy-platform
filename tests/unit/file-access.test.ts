import { describe, expect, it, vi } from "vitest";
import { getProtectedFileUrl } from "@/modules/library/file-access";

function fakeClient({ allowed, path }: { allowed: boolean | null; path?: string | null }) {
  const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null });
  const client: any = {
    rpc: vi.fn().mockResolvedValue({ data: allowed, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: path === undefined ? null : { storage_path: path } }) }) }) }),
    storage: { from: () => ({ createSignedUrl: sign }) },
  };
  return { client, sign };
}

describe("getProtectedFileUrl", () => {
  it("never signs a URL when the database denies access", async () => {
    const { client, sign } = fakeClient({ allowed: false, path: "x/y.pdf" });
    expect(await getProtectedFileUrl(client, "r1", "view")).toEqual({ ok: false, reason: "denied" });
    expect(sign).not.toHaveBeenCalled();
  });
  it("treats a non-true answer as denied", async () => {
    const { client } = fakeClient({ allowed: null, path: "x/y.pdf" });
    expect((await getProtectedFileUrl(client, "r1", "view")).ok).toBe(false);
  });
  it("signs a short-lived URL when allowed; download flag only for download", async () => {
    const { client, sign } = fakeClient({ allowed: true, path: "r1/y.pdf" });
    expect(await getProtectedFileUrl(client, "r1", "view")).toMatchObject({ ok: true, expiresInSeconds: 60 });
    expect(sign).toHaveBeenLastCalledWith("r1/y.pdf", 60, undefined);
    await getProtectedFileUrl(client, "r1", "download");
    expect(sign).toHaveBeenLastCalledWith("r1/y.pdf", 60, { download: true });
  });
  it("reports missing file", async () => {
    const { client } = fakeClient({ allowed: true, path: null });
    expect(await getProtectedFileUrl(client, "r1", "view")).toEqual({ ok: false, reason: "no_file" });
  });
});
