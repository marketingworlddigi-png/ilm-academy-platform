"use client";
import { useState } from "react";
import { CourseCard } from "@/components/ui";

export type FilterCourse = { id: string; href: string; title: string; summary: string | null; academy: string; premium: boolean };

// Filter chips built only from what the list really contains: access (free/premium) and academy. Plain buttons with aria-pressed.
export function CourseFilter({ courses }: { courses: FilterCourse[] }) {
  const [key, setKey] = useState("all");
  const academies = [...new Set(courses.map((c) => c.academy))].sort();
  const hasPremium = courses.some((c) => c.premium);
  const chips: [string, string][] = [
    ["all", "All"],
    ...(hasPremium ? ([["free", "Free"], ["premium", "Premium"]] as [string, string][]) : []),
    ...(academies.length > 1 ? academies.map((a) => [`a:${a}`, a] as [string, string]) : []),
  ];
  const shown = courses.filter((c) => key === "all" || (key === "free" && !c.premium) || (key === "premium" && c.premium) || key === `a:${c.academy}`);
  return (
    <div>
      {chips.length > 1 && (
        <div role="group" aria-label="Filter courses" className="mt-8 flex gap-2 overflow-x-auto pb-1">
          {chips.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${key === k ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:border-primary hover:text-primary"}`}>{label}</button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{shown.length} {shown.length === 1 ? "course" : "courses"} shown</p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2">
        {shown.map((c) => <CourseCard key={c.id} href={c.href} premium={c.premium} title={c.title} byline={c.academy} meta={c.summary ?? undefined} />)}
      </ul>
    </div>
  );
}
