"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readAction } from "@/modules/library/read-action";

type Props = { resourceId: string; accessTier: string; allowOnlineView: boolean; readHref: string };

/**
 * The book page itself is public and cached, so the per-visitor part runs in the browser: for non-free books it asks the
 * database (can_access_resource) whether this signed-in user may view. The reader page re-checks on the server regardless.
 */
export function ReadAction({ resourceId, accessTier, allowOnlineView, readHref }: Props) {
  const needsCheck = allowOnlineView && accessTier !== "free";
  const [canView, setCanView] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(!needsCheck);

  useEffect(() => {
    if (!needsCheck) return;
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const ok = data.user ? (await supabase.rpc("can_access_resource", { p_resource: resourceId, p_purpose: "view" })).data === true : false;
      if (live) { setCanView(ok); setChecked(true); }
    })();
    return () => { live = false; };
  }, [needsCheck, resourceId]);

  if (!checked) return <p className="mt-6 h-10" aria-hidden="true" />;
  const action = readAction({ accessTier, allowOnlineView, canView });
  if (action === "read") return <p className="mt-6"><Link className="btn btn-primary" href={readHref}>Read online</Link></p>;
  if (action === "premium") {
    return (
      <p className="mt-6">
        <span className="inline-block rounded-full border border-accent px-3 py-1 text-sm font-semibold text-accent">
          {accessTier === "academy" ? "Academy members" : "Premium"}
        </span>
      </p>
    );
  }
  return null;
}
