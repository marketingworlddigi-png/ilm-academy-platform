"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

type Answer = { id: string; author: string; teacher: boolean; body: string; created_at: string; hidden: boolean; mine: boolean };
type Item = { id: string; author: string; body: string; created_at: string; hidden: boolean; mine: boolean; answers: Answer[] };
type Data = { can_post: boolean; can_moderate: boolean; items: Item[] };
type Failure = { code?: string; message?: string } | null;

const when = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const friendly = (e: NonNullable<Failure>) => (["22023", "42501", "54000"].includes(e.code ?? "") ? e.message : null) ?? "Something went wrong. Please try again.";

// All reads and writes go through database functions (lesson_qa, ask_question, post_answer, set_qa_hidden) that check who you are.
export function QaPanel({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const { data: d } = await createClient().rpc("lesson_qa", { p_lesson: lessonId });
    setData((d as Data | null) ?? null);
  }, [lessonId]);
  useEffect(() => {
    let live = true;
    createClient().rpc("lesson_qa", { p_lesson: lessonId }).then(({ data: d }) => { if (live) setData((d as Data | null) ?? null); });
    return () => { live = false; };
  }, [lessonId]);

  async function run(fn: () => PromiseLike<{ error: Failure }>, after: () => void) {
    setBusy(true); setError(null);
    const { error: e } = await fn();
    setBusy(false);
    if (e) { setError(friendly(e)); return; }
    after(); await load();
  }
  const ask = (e: React.FormEvent) => { e.preventDefault(); void run(() => createClient().rpc("ask_question", { p_lesson: lessonId, p_body: question }), () => setQuestion("")); };
  const answer = (e: React.FormEvent, id: string) => { e.preventDefault(); void run(() => createClient().rpc("post_answer", { p_question: id, p_body: reply }), () => { setReply(""); setReplying(null); }); };
  const hide = (kind: "question" | "answer", id: string, hidden: boolean) => void run(() => createClient().rpc("set_qa_hidden", { p_kind: kind, p_id: id, p_hidden: hidden }), () => {});

  if (data === undefined) return <p className="text-muted" role="status">Loading questions...</p>;
  if (data === null) return <p className="text-muted">Questions are open to learners of this course.</p>;

  return (
    <div>
      <h2 className="text-xl font-bold">Questions about this lesson</h2>
      {data.can_post ? (
        <form onSubmit={ask} className="mt-4">
          <label htmlFor="qa-new" className="text-sm font-semibold">Ask your teacher or classmates</label>
          <textarea id="qa-new" className="field mt-1 min-h-24" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} required minLength={3} />
          <div className="mt-2"><Button type="submit" disabled={busy}>{busy ? "Posting..." : "Post question"}</Button></div>
        </form>
      ) : <p className="mt-3 text-sm text-muted">Enroll in this course to ask a question.</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}

      {data.items.length === 0 && <p className="mt-6 text-muted">No questions yet. Be the first to ask.</p>}
      <ul className="mt-6 space-y-5">
        {data.items.map((it) => (
          <li key={it.id} className={`rounded-[14px] border p-4 ${it.hidden ? "border-dashed border-danger" : "border-line"}`}>
            <p className="text-sm text-muted"><strong className="text-ink">{it.author}</strong> · {when(it.created_at)}{it.hidden && " · hidden from learners"}</p>
            <p className="mt-1 whitespace-pre-line">{it.body}</p>
            {it.answers.length > 0 && (
              <ul className="mt-3 space-y-3 border-s-2 border-line ps-4">
                {it.answers.map((a) => (
                  <li key={a.id} className={a.hidden ? "opacity-60" : ""}>
                    <p className="text-sm text-muted"><strong className="text-ink">{a.author}</strong>{a.teacher && <span className="ms-2 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-ink">Teacher</span>} · {when(a.created_at)}{a.hidden && " · hidden"}</p>
                    <p className="whitespace-pre-line">{a.body}</p>
                    {data.can_moderate && <button type="button" className="mt-1 text-xs font-semibold text-primary underline" onClick={() => hide("answer", a.id, !a.hidden)}>{a.hidden ? "Show again" : "Hide answer"}</button>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
              {data.can_post && replying !== it.id && <button type="button" className="text-primary underline" onClick={() => { setReplying(it.id); setReply(""); }}>Answer</button>}
              {data.can_moderate && <button type="button" className="text-primary underline" onClick={() => hide("question", it.id, !it.hidden)}>{it.hidden ? "Show question again" : "Hide question"}</button>}
            </div>
            {replying === it.id && (
              <form onSubmit={(e) => answer(e, it.id)} className="mt-3">
                <label htmlFor={`qa-r-${it.id}`} className="sr-only">Your answer</label>
                <textarea id={`qa-r-${it.id}`} className="field min-h-20" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} required minLength={2} autoFocus />
                <div className="mt-2 flex gap-2"><Button type="submit" disabled={busy}>Post answer</Button><Button type="button" variant="ghost" onClick={() => setReplying(null)}>Cancel</Button></div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
