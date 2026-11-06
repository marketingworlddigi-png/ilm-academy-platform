"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

type Quiz = { id: string; title: string; pass_percent: number; questions: { id: string; prompt: string; options: { id: string; label: string }[] }[] };
type Review = { question_id: string; picked: string; correct: string; is_correct: boolean; explanation: string | null };
type Result = { score: number; total: number; percent: number; passed: boolean; pass_percent: number; review: Review[] };
export type LastAttempt = { score: number; total: number; percent: number; passed: boolean } | null;

// Marking happens in the database (submit_quiz_attempt). The answer key is not in this page until after you submit.
export function QuizPlayer({ quiz, last }: { quiz: Quiz; last: LastAttempt }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = quiz.questions.filter((q) => !picked[q.id]).length;

  if (quiz.questions.length === 0) return <p className="text-muted">This quiz has no questions yet.</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing > 0) { setError(`Answer every question first (${missing} left).`); return; }
    setBusy(true); setError(null);
    const { data, error: rpcError } = await createClient().rpc("submit_quiz_attempt", { p_quiz: quiz.id, p_answers: picked });
    setBusy(false);
    if (rpcError) { setError(rpcError.code === "54000" ? rpcError.message : "Could not mark your answers. Please try again."); return; }
    setResult(data as Result);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function retry() { setPicked({}); setResult(null); setError(null); }

  return (
    <form onSubmit={submit} aria-label={quiz.title}>
      <h2 className="text-xl font-bold">{quiz.title}</h2>
      <p className="mt-1 text-sm text-muted">{quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"} · pass mark {quiz.pass_percent}%
        {last && !result && <> · last try: {last.score}/{last.total} ({last.passed ? "passed" : "not passed"})</>}</p>

      {result && (
        <div role="status" className={`mt-5 rounded-[14px] border p-4 ${result.passed ? "border-primary bg-surface" : "border-line bg-sheet"}`}>
          <p className="text-lg font-bold">{result.passed ? "Passed" : "Not passed yet"}: {result.score} of {result.total} ({result.percent}%)</p>
          <p className="mt-1 text-sm text-muted">{result.passed ? "Well done." : `You need ${result.pass_percent}% to pass. Check the answers below and try again.`}</p>
          <div className="mt-3"><Button type="button" variant="outline" onClick={retry}>Try again</Button></div>
        </div>
      )}

      <ol className="mt-6 space-y-6">
        {quiz.questions.map((q, qi) => {
          const rev = result?.review.find((r) => r.question_id === q.id);
          return (
            <li key={q.id}>
              <fieldset disabled={!!result}>
                <legend className="font-semibold">{qi + 1}. {q.prompt}</legend>
                <div className="mt-2 space-y-2">
                  {q.options.map((o) => {
                    const isRight = rev && o.id === rev.correct;
                    const isWrongPick = rev && o.id === rev.picked && !rev.is_correct;
                    return (
                      <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 text-sm ${isRight ? "border-primary bg-surface font-semibold" : isWrongPick ? "border-danger" : "border-line hover:bg-surface"}`}>
                        <input type="radio" name={`q-${q.id}`} value={o.id} checked={picked[q.id] === o.id} onChange={() => setPicked((p) => ({ ...p, [q.id]: o.id }))} className="mt-1" />
                        <span>{o.label}{isRight ? " (correct answer)" : isWrongPick ? " (your answer)" : ""}</span>
                      </label>
                    );
                  })}
                </div>
                {rev?.explanation && <p className="mt-2 text-sm text-muted">{rev.explanation}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="mt-4 text-sm font-semibold text-danger">{error}</p>}
      {!result && <div className="mt-6"><Button type="submit" disabled={busy}>{busy ? "Marking..." : "Submit answers"}</Button></div>}
    </form>
  );
}
