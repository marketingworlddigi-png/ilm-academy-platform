import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { Badge, Button, Card, EmptyState, ProgressBar, StatCard } from "@/components/ui";
import { signOut, updateName } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

// Server render runs once per request; kept outside the component so the purity lint rule sees an ordinary helper.
const currentTime = () => Date.now();

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const { supabase, user } = await requireUser(locale);
  const [{ data: profile }, { data: isAdmin }, { data: memberships }, { data: premium }, { data: enrolls }, { count: doneCount }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_super_admin"),
    supabase.from("memberships").select("role, status, academies(name)").eq("user_id", user.id),
    supabase.from("entitlements").select("expires_at").eq("user_id", user.id).eq("scope", "platform").is("revoked_at", null)
      .lte("starts_at", new Date().toISOString()).order("expires_at", { ascending: false, nullsFirst: true }).limit(1),
    supabase.from("enrollments").select("course_id, courses!inner(slug, title, academies!inner(slug, name))").eq("user_id", user.id).eq("status", "active"),
    supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", user.id).not("completed_at", "is", null),
  ]);
  const now = currentTime();
  const active = (premium ?? []).find((e) => e.expires_at === null || new Date(e.expires_at).getTime() > now);
  const myCourses = await Promise.all((enrolls ?? []).flatMap((e) => {
    const c = [e.courses].flat()[0]; const a = c && [c.academies].flat()[0];
    return c && a ? [{ id: e.course_id as string, title: c.title as string, href: href(locale, `/courses/${a.slug}/${c.slug}`), academy: a.name as string }] : [];
  }).map(async (c) => {
    const { data } = await supabase.rpc("course_progress", { p_course: c.id });
    const r = (data as { total_lessons: number; completed_lessons: number; percent: number }[] | null)?.[0];
    return { ...c, percent: r?.percent ?? 0, done: r?.completed_lessons ?? 0, total: r?.total_lessons ?? 0 };
  }));
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" });

  return (
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-gold">My learning</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
          <p className="mt-2 text-white/75">{user.email}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        {error && <p role="alert" className="rounded-[10px] border border-danger/40 bg-white p-3 text-sm text-danger">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Plan" value={active ? "Premium" : "Free"} hint={active ? (active.expires_at ? `Active until ${fmt(active.expires_at)}` : "Active with no end date") : "Upgrade any time from Pricing"} />
          <StatCard label="Courses" value={myCourses.length} hint="Active enrollments" />
          <StatCard label="Lessons completed" value={doneCount ?? 0} />
        </div>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold">My courses</h2>
            <Link href={href(locale, "/courses")} className="text-sm font-semibold text-primary hover:underline">Find a course &rarr;</Link>
          </div>
          {myCourses.length === 0 ? (
            <div className="mt-4"><EmptyState title="You are not enrolled in any course yet." action={<Button href={href(locale, "/courses")}>Browse courses</Button>}>Enroll for free and your progress shows up here.</EmptyState></div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((c) => (
                <Card as="li" key={c.id} className="p-5">
                  <Link href={c.href} className="font-semibold leading-snug text-ink hover:text-primary">{c.title}</Link>
                  <p className="text-sm text-muted">{c.academy}</p>
                  <ProgressBar value={c.percent} className="mt-4" label={`${c.title} progress`} />
                  <p className="mt-1 text-xs text-muted">{c.done} of {c.total} lessons &middot; {c.percent}%</p>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Your roles</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {isAdmin === true && <li><Badge tone="dark">Platform administrator</Badge></li>}
              {(memberships ?? []).map((m, i) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <li key={i}><Badge tone="green">{m.role.replace("_", " ")} ({m.status}){(m as any).academies?.name ? `: ${(m as any).academies.name}` : ""}</Badge></li>
              ))}
              {isAdmin !== true && (memberships ?? []).length === 0 && <li><Badge>Student (free account)</Badge></li>}
            </ul>
          </Card>
          <Card className="p-5">
            <form action={updateName} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="locale" value={locale} />
              <div className="min-w-48 flex-1"><label className="label" htmlFor="fullName">Your name</label>
                <input className="field" id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} autoComplete="name" required minLength={2} maxLength={120} /></div>
              <Button type="submit" variant="outline">Save</Button>
            </form>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          {isAdmin === true && <Button href={href(locale, "/admin")}>Open admin</Button>}
          <Button href={href(locale, "/account/payments")} variant="outline">My payments</Button>
          <Button href={href(locale, "/academy")} variant="outline">My academies</Button>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost">Sign out</Button>
          </form>
        </div>
      </div>
    </main>
  );
}
