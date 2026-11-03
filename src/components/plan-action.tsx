"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { planCardState, type PlanCardState, type PurchasePreview } from "@/modules/payments/purchase";

// The pricing page is cached for everyone. Whether you already have a plan is read here in the browser, with your own
// session, and only changes which button is shown. create_payment re-checks every rule in the database.
export function PlanAction({ plan, checkoutHref }: { plan: { id: string; name: string; duration_months: number }; checkoutHref: string }) {
  const [state, setState] = useState<PlanCardState>({ kind: "buy" });

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: pv } = await supabase.rpc("plan_purchase_preview", { p_user: data.user.id, p_plan: plan.id });
      const row = (Array.isArray(pv) ? pv[0] : pv) as PurchasePreview | undefined;
      if (alive && row) setState(planCardState(plan, row));
    })();
    return () => { alive = false; };
  }, [plan]);

  switch (state.kind) {
    case "buy":
      return <Link className="btn btn-primary mt-6 self-start" href={checkoutHref}>Choose {plan.name}</Link>;
    case "switch":
      return (<>
        <Link className="btn btn-primary mt-6 self-start" href={checkoutHref}>{state.label}</Link>
        <p className="mt-2 text-sm text-ink-soft">{state.note}</p>
      </>);
    case "renew":
      return (<>
        <p className="mt-6 text-sm font-semibold">{state.note}</p>
        <Link className="btn btn-primary mt-3 self-start" href={checkoutHref}>Renew</Link>
      </>);
    default:
      return (<>
        <p className="mt-6 text-sm font-semibold">{state.note}</p>
        <button type="button" className="btn btn-primary mt-3 self-start" disabled aria-disabled="true">{state.kind === "current" ? "Current plan" : "Already booked"}</button>
      </>);
  }
}
