/** Rows returned by the plan_purchase_preview database function (migration 14). Dates are ISO strings. */
export type PurchasePreview = {
  current_plan_id: string | null;
  current_plan_name: string | null;
  current_ends_at: string | null;
  same_plan_ends_at: string | null;
  renew_from: string | null;
  blocked: boolean;
  period_starts_at: string;
  period_ends_at: string;
};

/** A calendar day in Pakistan time, written out ("5 December 2026"). Matches the dates the database puts in its messages. */
export const formatDay = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(iso));

type PlanLite = { id: string; name: string; duration_months: number };

export type PlanCardState =
  | { kind: "buy" }
  | { kind: "current"; note: string }
  | { kind: "renew"; note: string }
  | { kind: "held"; note: string }
  | { kind: "switch"; label: string; note: string };

const switchLabel = (p: PlanLite) => (p.duration_months === 12 ? "Switch to yearly" : p.duration_months === 1 ? "Switch to monthly" : `Switch to ${p.name}`);

/**
 * What a plan card on the pricing page should offer a signed-in user. Display only: create_payment enforces the same
 * rules in the database, so a stale or tampered screen cannot buy what the rules forbid.
 */
export function planCardState(plan: PlanLite, pv: PurchasePreview | null): PlanCardState {
  if (!pv || (!pv.current_plan_id && !pv.same_plan_ends_at)) return { kind: "buy" };
  if (pv.same_plan_ends_at) {
    const until = formatDay(pv.same_plan_ends_at);
    const own = pv.current_plan_id === plan.id;
    if (pv.blocked) return own ? { kind: "current", note: `Your current plan, active until ${until}` } : { kind: "held", note: `Already booked, active until ${until}` };
    return { kind: "renew", note: `Your current plan, active until ${until}. Renewing starts on ${formatDay(pv.period_starts_at)}, so you don't lose any days.` };
  }
  return { kind: "switch", label: switchLabel(plan), note: `Starts on ${formatDay(pv.period_starts_at)}, so you don't lose any days.` };
}
