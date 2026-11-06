"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

// A private note per lesson, stored under row-level security: only its author can read it.
export function NotesPanel({ lessonId, userId }: { lessonId: string; userId: string }) {
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    createClient().from("lesson_notes").select("body").eq("lesson_id", lessonId).eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (live) { setBody(data?.body ?? ""); setLoaded(true); } });
    return () => { live = false; };
  }, [lessonId, userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const db = createClient();
    const text = body.trim();
    const { error } = text
      ? await db.from("lesson_notes").upsert({ user_id: userId, lesson_id: lessonId, body: text, updated_at: new Date().toISOString() })
      : await db.from("lesson_notes").delete().eq("lesson_id", lessonId).eq("user_id", userId);
    setBusy(false);
    setMsg(error ? { ok: false, text: "We could not save your note. You may need to enroll in this course first." } : { ok: true, text: text ? "Note saved." : "Note cleared." });
  }

  if (!loaded) return <p className="text-muted" role="status">Loading your note...</p>;
  return (
    <form onSubmit={save}>
      <h2 className="text-xl font-bold">My notes</h2>
      <p className="mt-1 text-sm text-muted">Only you can see this note.</p>
      <label htmlFor="note-body" className="sr-only">Your note for this lesson</label>
      <textarea id="note-body" className="field mt-3 min-h-48" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
      <div className="mt-2 flex items-center gap-4">
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save note"}</Button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
