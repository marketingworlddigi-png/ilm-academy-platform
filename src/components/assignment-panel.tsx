"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export type AssignmentData = {
  id: string; title: string; instructions: string; max_points: number; can_submit: boolean;
  submission: { body: string; submitted_at: string; score: number | null; feedback: string | null; graded_at: string | null } | null;
};

const when = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Hand-in goes through submit_assignment(), which checks enrollment and refuses changes once the work is marked.
export function AssignmentPanel({ assignment }: { assignment: AssignmentData }) {
  const [sub, setSub] = useState(assignment.submission);
  const [body, setBody] = useState(assignment.submission?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const marked = !!sub?.graded_at;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    const { error: err } = await createClient().rpc("submit_assignment", { p_assignment: assignment.id, p_body: body });
    setBusy(false);
    if (err) { setError(["22023", "42501"].includes(err.code ?? "") ? err.message : "Something went wrong. Please try again."); return; }
    setSub({ body: body.trim(), submitted_at: new Date().toISOString(), score: null, feedback: null, graded_at: null });
    setSaved(true);
  }

  return (
    <div>
      <h2 className="text-xl font-bold">{assignment.title}</h2>
      <p className="mt-1 text-sm text-muted">Worth {assignment.max_points} points</p>
      <p className="mt-3 whitespace-pre-line">{assignment.instructions}</p>

      {marked && sub && (
        <div className="mt-6 rounded-[14px] border border-gold bg-surface p-4" role="status">
          <p className="font-bold">Marked: {sub.score} / {assignment.max_points}</p>
          {sub.feedback && <p className="mt-1 whitespace-pre-line">{sub.feedback}</p>}
        </div>
      )}

      {assignment.can_submit ? (
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="asg-body" className="text-sm font-semibold">Your work</label>
          <textarea id="asg-body" className="field mt-1 min-h-40" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required minLength={2} readOnly={marked} />
          {sub && !marked && <p className="mt-1 text-sm text-muted">Handed in {when(sub.submitted_at)}. You can change it until it is marked.</p>}
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
          {saved && <p role="status" className="mt-2 text-sm font-semibold text-primary">Handed in.</p>}
          {!marked && <div className="mt-3"><Button type="submit" disabled={busy}>{busy ? "Saving..." : sub ? "Update hand-in" : "Hand in"}</Button></div>}
        </form>
      ) : <p className="mt-6 text-sm text-muted">Enroll in this course to hand in work.</p>}
    </div>
  );
}
