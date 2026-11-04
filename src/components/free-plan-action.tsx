"use client";
import { Button } from "@/components/ui";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The pricing page is cached for everyone, so who you are is read here in the browser with your own session.
// Guests see "Create account"; signed-in visitors never do.
type State = "guest" | "free" | "premium";

export function FreePlanAction({ signupHref, learnHref }: { signupHref: string; learnHref: string }) {
  const [state, setState] = useState<State>("guest");

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      if (alive) setState("free");
      const { data: ent } = await supabase.from("entitlements").select("expires_at").eq("user_id", data.user.id).eq("scope", "platform")
        .is("revoked_at", null).lte("starts_at", new Date().toISOString());
      const now = Date.now();
      if (alive && (ent ?? []).some((e) => e.expires_at === null || new Date(e.expires_at).getTime() > now)) setState("premium");
    })();
    return () => { alive = false; };
  }, []);

  if (state === "guest") return <Button href={signupHref} variant="outline" className="mt-6">Create account</Button>;
  return (
    <>
      {state === "free" && <p className="mt-6 text-sm font-semibold text-primary">Your current plan</p>}
      <Button href={learnHref} variant="outline" className={state === "free" ? "mt-3" : "mt-6"}>Go to My learning</Button>
    </>
  );
}
