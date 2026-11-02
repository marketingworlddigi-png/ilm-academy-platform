"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/[locale]/actions";

// The header lives in the layout and stays static so public pages remain cacheable. Whether someone is signed in is read in
// the browser from the session cookie. This only chooses which links to show; every protected page and action still checks the
// session on the server.
export function HeaderAuth({ locale, accountHref, loginHref, signupHref }: { locale: string; accountHref: string; loginHref: string; signupHref: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setSignedIn(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  // Until the browser has checked, show nothing rather than the wrong buttons.
  if (signedIn === null) return <span aria-hidden="true" className="inline-block h-10 w-40" />;

  if (signedIn) {
    return (
      <>
        <Link href={accountHref} className="btn btn-ghost">Account</Link>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn btn-primary">Sign out</button>
        </form>
      </>
    );
  }
  return (
    <>
      <Link href={loginHref} className="btn btn-ghost">Sign in</Link>
      <Link href={signupHref} className="btn btn-primary">Create account</Link>
    </>
  );
}
