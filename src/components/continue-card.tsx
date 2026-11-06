"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Resume = { title: string; academy: string; href: string; percent: number; done: number; total: number };

// The homepage is cached and shared, so this card is filled in the browser from the learner's own progress rows
// (row-level security returns only their own). Visitors who are not signed in see the sign-up prompt instead.
export function ContinueCard({ locale, signupHref, libraryHref }: { locale: string; signupHref: string; libraryHref: string }) {
  const [state, setState] = useState<"loading" | "guest" | "empty" | Resume>("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = createClient();
      const { data: s } = await db.auth.getSession();
      if (!s.session) return alive && setState("guest");
      const { data: last } = await db.from("lesson_progress").select("course_id, lesson_id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (!last) return alive && setState("empty");
      const [{ data: c }, { data: p }] = await Promise.all([
        db.from("courses").select("slug, title, academies!inner(slug, name)").eq("id", last.course_id).maybeSingle(),
        db.rpc("course_progress", { p_course: last.course_id }),
      ]);
      const a = c && [c.academies].flat()[0];
      if (!c || !a) return alive && setState("empty");
      const row = (p as { total_lessons: number; completed_lessons: number; percent: number }[] | null)?.[0];
      const prefix = locale === "en-pk" ? "/en-pk" : `/${locale}`;
      if (alive) setState({ title: c.title, academy: a.name, href: `${prefix}/courses/${a.slug}/${c.slug}/lessons/${last.lesson_id}`, percent: row?.percent ?? 0, done: row?.completed_lessons ?? 0, total: row?.total_lessons ?? 0 });
    })().catch(() => alive && setState("empty"));
    return () => { alive = false; };
  }, [locale]);

  const shell = "rounded-[14px] bg-sheet p-5 text-ink shadow-sm";
  if (state === "loading") return <div aria-hidden="true" className={`${shell} h-44`} />;
  if (state === "guest" || state === "empty") {
    return (
      <div className={shell}>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{state === "guest" ? "Free with an account" : "Start your first lesson"}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          <li>Every book and course marked Free</li>
          <li>Your progress saved on every device</li>
          <li>Premium whenever you are ready</li>
        </ul>
        <Link href={state === "guest" ? signupHref : libraryHref} className="btn btn-primary mt-4 w-full">{state === "guest" ? "Create free account" : "Browse the library"}</Link>
      </div>
    );
  }
  return (
    <div className={shell}>
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Continue learning</p>
      <p className="mt-2 font-semibold leading-snug">{state.title}</p>
      <p className="text-sm text-muted">{state.academy}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent} aria-label="Course progress" className="mt-4 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-primary" style={{ width: `${state.percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{state.done} of {state.total} lessons · {state.percent}%</p>
      <Link href={state.href} className="btn btn-primary mt-4 w-full">Resume</Link>
    </div>
  );
}
