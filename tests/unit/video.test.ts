import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "@/modules/courses/video";
import { lessonSchema } from "@/modules/courses/schemas";

describe("parseVideoUrl", () => {
  it("turns every YouTube form into a privacy-enhanced embed", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=5"]) {
      expect(parseVideoUrl(u)?.embedUrl, u).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });
  it("handles Vimeo and Bunny Stream", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")?.embedUrl).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871")?.provider).toBe("vimeo");
    expect(parseVideoUrl("https://iframe.mediadelivery.net/play/1234/0a1b2c3d-4e5f")?.embedUrl).toBe("https://iframe.mediadelivery.net/embed/1234/0a1b2c3d-4e5f");
  });
  it("rejects http, other hosts, look-alike hosts, credentials and bad ids", () => {
    for (const u of ["http://youtu.be/dQw4w9WgXcQ", "https://evil.example/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://user:pw@youtu.be/dQw4w9WgXcQ", "https://youtu.be/short", "javascript:alert(1)", "https://vimeo.com/abc", "", "not a url"]) {
      expect(parseVideoUrl(u), u).toBeNull();
    }
  });
});

describe("lessonSchema video_url", () => {
  const base = { title: "Lesson one", is_preview: "", resource_id: "" };
  it("empty becomes null, a valid link is kept, an unsupported one is rejected with a clear message", () => {
    expect(lessonSchema.parse({ ...base, video_url: "" }).video_url).toBeNull();
    expect(lessonSchema.parse({ ...base, video_url: " https://youtu.be/dQw4w9WgXcQ " }).video_url).toBe("https://youtu.be/dQw4w9WgXcQ");
    const r = lessonSchema.safeParse({ ...base, video_url: "http://youtu.be/dQw4w9WgXcQ" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/not supported/);
  });
});
