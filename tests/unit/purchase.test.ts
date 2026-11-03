import { describe, expect, it } from "vitest";
import { formatDay, planCardState, type PurchasePreview } from "@/modules/payments/purchase";

const monthly = { id: "m", name: "Premium monthly", duration_months: 1 };
const yearly = { id: "y", name: "Premium yearly", duration_months: 12 };
const base: PurchasePreview = {
  current_plan_id: "m", current_plan_name: "Premium monthly", current_ends_at: "2026-12-05T10:00:00Z",
  same_plan_ends_at: null, renew_from: null, blocked: false, period_starts_at: "2026-12-05T10:00:00Z", period_ends_at: "2027-12-05T10:00:00Z",
};

describe("formatDay", () => {
  it("writes the Pakistan calendar day", () => {
    expect(formatDay("2026-12-05T10:00:00Z")).toBe("5 December 2026");
    expect(formatDay("2026-12-05T20:30:00Z")).toBe("6 December 2026"); // already the 6th in Karachi
  });
});

describe("pricing card state", () => {
  it("offers a plain purchase to visitors and people without a plan", () => {
    expect(planCardState(monthly, null)).toEqual({ kind: "buy" });
    expect(planCardState(monthly, { ...base, current_plan_id: null, current_plan_name: null, current_ends_at: null })).toEqual({ kind: "buy" });
  });
  it("disables the current plan outside the renewal window", () => {
    const pv = { ...base, same_plan_ends_at: "2026-12-05T10:00:00Z", renew_from: "2026-11-28T10:00:00Z", blocked: true };
    expect(planCardState(monthly, pv)).toEqual({ kind: "current", note: "Your current plan, active until 5 December 2026" });
  });
  it("offers Renew inside the window", () => {
    const pv = { ...base, same_plan_ends_at: "2026-12-05T10:00:00Z", renew_from: "2026-11-28T10:00:00Z", blocked: false };
    expect(planCardState(monthly, pv).kind).toBe("renew");
  });
  it("offers a switch on the other plan, with the start date", () => {
    expect(planCardState(yearly, base)).toEqual({ kind: "switch", label: "Switch to yearly", note: "Starts on 5 December 2026, so you don't lose any days." });
    expect(planCardState(monthly, { ...base, current_plan_id: "y" })).toMatchObject({ kind: "switch", label: "Switch to monthly" });
  });
  it("shows a stacked plan as already booked", () => {
    const pv = { ...base, same_plan_ends_at: "2027-12-05T10:00:00Z", renew_from: "2027-11-28T10:00:00Z", blocked: true };
    expect(planCardState(yearly, pv)).toEqual({ kind: "held", note: "Already booked, active until 5 December 2027" });
  });
});
