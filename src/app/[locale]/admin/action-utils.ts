import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { defaultLocale, href, isLocale, type Locale } from "@/lib/i18n/config";

// Plain helpers shared by the admin server actions ("use server" files may only export async functions).

export const localeOf = (fd: FormData): Locale => {
  const v = String(fd.get("locale") ?? "");
  return isLocale(v) ? v : defaultLocale;
};

/** Redirects back to a page with a message in the query string (read by Flash). */
export const finish = (l: Locale, path: string, kind: "error" | "notice", msg: string): never => {
  revalidatePath(href(l, path));
  return redirect(`${href(l, path)}?${kind}=${encodeURIComponent(msg)}`);
};

export const raw = (fd: FormData) => Object.fromEntries(fd);
