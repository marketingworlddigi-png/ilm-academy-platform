import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { Card, Field, Flash, flashFrom } from "@/components/admin/ui";
import { registerAcademy } from "../../academy-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Register an academy", robots: { index: false, follow: false } };

export default async function RegisterAcademyPage({ params, searchParams }: PageProps<"/[locale]/academy/register">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/academy")}>My academies</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Register an academy</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Tell us the name of your madrasa, institute or teaching group. A platform administrator reviews every academy before it goes live.
        You will be its owner and can invite administrators and teachers later.
      </p>
      <Flash error={error} notice={notice} />
      <Card className="mt-6">
        <form action={registerAcademy} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <Field label="Academy name" name="name" required />
          <Field label="Web address" name="slug" required placeholder="noor-academy"
            hint="3 to 40 lowercase letters, numbers or hyphens. It cannot be changed later without contacting us." />
          <button className="btn btn-primary" type="submit">Submit for review</button>
        </form>
      </Card>
    </main>
  );
}
