// Lesson videos: https links from YouTube, Vimeo or Bunny Stream only. The page never embeds the pasted address as-is;
// it rebuilds a fixed embed address from the video id, so nothing else a user types can reach an iframe.

export type VideoEmbed = { provider: "youtube" | "vimeo" | "bunny"; embedUrl: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const NUM_ID = /^\d{1,12}$/;
const GUID = /^[A-Za-z0-9-]{8,64}$/;

export function parseVideoUrl(input: string | null | undefined): VideoEmbed | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > 500) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = parts[0] === "watch" && host === "youtube.com" ? u.searchParams.get("v")
      : ["embed", "shorts", "live"].includes(parts[0] ?? "") ? parts[1] : null;
    return id && YT_ID.test(id) ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "youtu.be") {
    return parts[0] && YT_ID.test(parts[0]) ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${parts[0]}` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = host === "player.vimeo.com" ? (parts[0] === "video" ? parts[1] : null) : parts[0];
    return id && NUM_ID.test(id) ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}?dnt=1` } : null;
  }
  if (host === "iframe.mediadelivery.net" || host === "player.mediadelivery.net") {
    // Bunny Stream: /embed/{libraryId}/{videoGuid} or /play/{libraryId}/{videoGuid}
    const [kind, lib, guid] = parts;
    return (kind === "embed" || kind === "play") && lib && guid && NUM_ID.test(lib) && GUID.test(guid)
      ? { provider: "bunny", embedUrl: `https://iframe.mediadelivery.net/embed/${lib}/${guid}` } : null;
  }
  return null;
}

export const VIDEO_HELP = "Paste a YouTube, Vimeo or Bunny Stream link (https only).";
