import Link from "next/link";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireSuperAdmin(locale); // pages re-check too: layouts are not re-run on client navigation
  const items = [["/admin", "Overview"], ["/admin/boards", "Boards and levels"], ["/admin/subjects", "Subjects"], ["/admin/resources", "Resources"], ["/admin/academies", "Academies"], ["/admin/payments", "Payments"], ["/admin/plans", "Plans"], ["/admin/payment-methods", "Payment methods"]] as const;
  return (
    <>
      <nav aria-label="Admin" className="border-b border-line bg-paper-2">
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-5 px-5 py-3 text-sm">
          {items.map(([p, label]) => (
            <li key={p}><Link className="font-medium text-ink-soft hover:text-ink" href={href(locale, p)}>{label}</Link></li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
