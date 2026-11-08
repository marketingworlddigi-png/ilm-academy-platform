import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { PageHero } from "@/components/page-hero";
import { Article } from "@/components/article";
import { CtaBand } from "@/components/cta-band";
import type { GuideSection } from "@/content/guides";

export async function generateMetadata({ params }: PageProps<"/[locale]/copyright">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Copyright and permissions: how books reach the library",
    description: "Every book in the Ilm Academy library is published only after its licence or publisher permission is recorded. How we check, what the access levels mean and how to raise a concern.",
    alternates: alternatesFor(locale, "/copyright"),
  };
}

const SECTIONS: GuideSection[] = [
  {
    id: "rule", h: "The rule we work by",
    p: [
      "A book is published in the library only when a licence or publisher permission for it is recorded. If the permission is missing, the book stays out of public view, however useful it might be.",
      "This is enforced in the database, not just in editorial practice: the library queries return only those titles that carry a valid permission record.",
    ],
    callout: { title: "In one line", text: "If we cannot show the permission, we do not publish the book." },
  },
  {
    id: "types", h: "Kinds of permission",
    p: ["Classical texts and modern books stand on different footing, and the record reflects that."],
    list: [
      "Public domain works, such as classical texts whose authors died long ago and whose edition is itself free to share.",
      "Works released under an open licence by their author or publisher.",
      "Works shared with the written permission of the rights holder.",
      "Works uploaded by an academy that confirms it holds the right to share them.",
    ],
  },
  {
    id: "levels", h: "What the access levels mean",
    list: [
      "Free: open to any signed-in student.",
      "Academy: open to students enrolled with the academy that provided it.",
      "Premium: open to students with an active Premium plan.",
    ],
  },
  {
    id: "reading", h: "How books are served",
    p: [
      "Books are read in the browser reader rather than offered as open file links. The reader receives a short-lived link to the file that expires, so a copied address stops working.",
      "This protects the rights of authors and publishers, and it lets us honour the terms of each permission.",
    ],
  },
  {
    id: "concern", h: "If you are a rights holder",
    p: [
      "If you believe a title is listed without your permission, or in a way your permission does not allow, please tell us which book and what you would like done. We will review it promptly and take the book out of public view while we do.",
      "If you are an author or publisher and would like your book included, we welcome the conversation. Free, open and paid arrangements are all possible, and your terms are recorded against the title.",
    ],
  },
  {
    id: "students", h: "What students should do",
    list: [
      "Use books for your own study.",
      "Do not copy or redistribute books from the reader.",
      "Buy a printed copy of a book when you can; many authors and publishers depend on it.",
    ],
  },
];

export default async function CopyrightPage({ params }: PageProps<"/[locale]/copyright">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Copyright", path: href(locale, "/copyright") }]}
        eyebrow="Trust" title={<>Copyright and <em className="gold-shimmer pe-2">permissions.</em></>}
        blurb="How a book reaches the library, what the access levels mean, and what to do if you have a concern."
      />
      <Article intro="Scholarly work depends on the people who write, edit and publish books. A library that ignores their rights does not serve students for long. This page explains the standard we hold the library to." sections={SECTIONS} />
      <CtaBand eyebrow="Browse with confidence" title={<>Every title <em className="gold-shimmer">carries its permission.</em></>} text="Open the library and see the access level on each book."
        primary={{ label: "Open the library", href: href(locale, "/library") }} secondary={{ label: "Read the FAQ", href: href(locale, "/faq") }} />
    </main>
  );
}
