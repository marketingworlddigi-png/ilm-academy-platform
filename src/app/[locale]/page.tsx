import Link from "next/link";
import { href, isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { alternates: alternatesFor(locale, "/") } : {};
}

// English copy only for now: Urdu and Arabic text will be added from human-reviewed translations, not machine output.
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">Darse Nizami and beyond</p>
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
          A trustworthy home for Islamic and academic learning.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-soft">
          Books, notes and courses from independent academies and teachers, organised by board, level and subject.
          Every resource is published only after its distribution permission has been verified.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={href(locale, "/signup")} className="btn btn-primary">Create a free account</Link>
          <Link href={href(locale, "/login")} className="btn btn-ghost">Sign in</Link>
        </div>
      </section>

      <section className="border-y border-line bg-paper-2">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Organised by curriculum</h2>
            <p className="mt-2 text-ink-soft">Boards, levels and subjects are managed by administrators, so the library follows how students actually study.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Permission first</h2>
            <p className="mt-2 text-ink-soft">Downloads and online reading are off by default and enabled only where copyright holders have given permission.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Academies and teachers</h2>
            <p className="mt-2 text-ink-soft">Academies run their own courses and students on one platform, each isolated from the others.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
