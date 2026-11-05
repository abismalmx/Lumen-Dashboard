import { fmtDate } from "./format";
import { PLAN_PRICE, type PlanId } from "./ledger";

export type Status = "paid" | "processing" | "refunded" | "failed";
export type Transaction = {
  id: string;
  customer: string;
  email: string;
  plan: PlanId;
  amount: number;
  method: string;
  status: Status;
  date: string;
  tint: string;
};

export const TRANSACTIONS: Transaction[] = [
  {
    id: "in_8Qd2",
    customer: "Elena Márquez",
    email: "elena.marquez@meridian-labs.example",
    plan: "pro",
    amount: 79,
    method: "Visa ···· 4242",
    status: "paid",
    date: "2026-11-05",
    tint: "bg-amber-400/15 text-amber-200",
  },
  {
    id: "in_5Kx1",
    customer: "Northwind Labs",
    email: "finance@northwindlabs.example",
    plan: "enterprise",
    amount: 249,
    method: "Amex ···· 1005",
    status: "paid",
    date: "2026-11-05",
    tint: "bg-emerald-400/15 text-emerald-200",
  },
  {
    id: "in_9Pr7",
    customer: "Kestrel Health",
    email: "billing@kestrelhealth.example",
    plan: "starter",
    amount: 29,
    method: "Mastercard ···· 8810",
    status: "processing",
    date: "2026-11-04",
    tint: "bg-fuchsia-400/15 text-fuchsia-200",
  },
  {
    id: "in_2Tb4",
    customer: "Tomás Herrera",
    email: "tomas@halcyon.example",
    plan: "pro",
    amount: 79,
    method: "Visa ···· 7391",
    status: "paid",
    date: "2026-11-03",
    tint: "bg-cyan-400/15 text-cyan-200",
  },
  {
    id: "in_4Vz6",
    customer: "Radian Systems",
    email: "ap@radiansystems.example",
    plan: "enterprise",
    amount: -249,
    method: "Amex ···· 1005",
    status: "refunded",
    date: "2026-11-02",
    tint: "bg-stone-400/15 text-stone-200",
  },
  {
    id: "in_7Lc3",
    customer: "Priya Raman",
    email: "priya.raman@vertex-labs.example",
    plan: "starter",
    amount: 29,
    method: "Mastercard ···· 2255",
    status: "paid",
    date: "2026-10-29",
    tint: "bg-lime-400/15 text-lime-200",
  },
];

export const TODAY = "2026-11-05";

export type CustomerStatus = "active" | "trialing" | "past_due" | "churned";
export type Invoice = { id: string; date: string; amount: number; status: Status | "failed" };
export type Customer = {
  id: string;
  name: string;
  email: string;
  plan: PlanId;
  status: CustomerStatus;
  seats: number;
  /** Tokens used this billing period, in thousands. */
  tokens: number;
  joined: string;
  lastActive: string;
  location: string;
  tint: string;
  invoices: Invoice[];
};

/** Monthly token allowance per plan, in thousands. Enterprise is metered, not capped. */
export const TOKEN_QUOTA: Record<PlanId, number | null> = { starter: 50, pro: 1000, enterprise: null };

export const mk = (
  name: string,
  email: string,
  plan: PlanId,
  status: CustomerStatus,
  seats: number,
  tokens: number,
  joined: string,
  lastActive: string,
  location: string,
  tint: string,
  invoices: [string, string, number, Invoice["status"]][],
): Customer => ({
  id: email,
  name,
  email,
  plan,
  status,
  seats,
  tokens,
  joined,
  lastActive,
  location,
  tint,
  invoices: invoices.map(([id, date, amount, state]) => ({ id, date, amount, status: state })),
});

export const CUSTOMER_SEED: Customer[] = [
  mk("Northwind Labs", "finance@northwindlabs.example", "enterprise", "active", 84, 38_400, "2025-09-02", "2026-11-05", "Rotterdam, NL", "bg-emerald-400/15 text-emerald-200", [["in_8Qd3", "2026-11-05", 249, "paid"], ["in_7Zc4", "2026-10-06", 249, "paid"], ["in_6Wb1", "2026-09-06", 249, "paid"]]),
  mk("Nimbus Pay", "billing@nimbuspay.example", "enterprise", "active", 41, 21_900, "2026-01-19", "2026-11-05", "Dublin, IE", "bg-cyan-400/15 text-cyan-200", [["in_8Pn2", "2026-11-04", 249, "paid"], ["in_7Pn9", "2026-10-05", 249, "paid"], ["in_6Pn5", "2026-09-05", 249, "paid"]]),
  mk("Orbit Freight", "ops@orbitfreight.example", "enterprise", "active", 27, 14_250, "2026-04-08", "2026-11-04", "Hamburg, DE", "bg-amber-400/15 text-amber-200", [["in_8Of7", "2026-11-03", 249, "paid"], ["in_7Of2", "2026-10-04", 249, "paid"], ["in_6Of8", "2026-09-04", 249, "paid"]]),
  mk("Radian Systems", "ap@radiansystems.example", "enterprise", "churned", 18, 0, "2026-02-11", "2026-10-30", "Lisbon, PT", "bg-stone-400/15 text-stone-200", [["in_8Rs1", "2026-11-02", -249, "refunded"], ["in_7Rs6", "2026-10-03", 249, "paid"], ["in_6Rs3", "2026-09-03", 249, "paid"]]),
  mk("Elena Márquez", "elena.marquez@meridian-labs.example", "pro", "active", 5, 612, "2026-03-14", "2026-11-05", "Austin, US", "bg-amber-400/15 text-amber-200", [["in_8Qd2", "2026-11-05", 79, "paid"], ["in_7Zc1", "2026-10-06", 79, "paid"], ["in_6Wb9", "2026-09-06", 79, "paid"]]),
  mk("Tomás Herrera", "tomas@halcyon.example", "pro", "active", 4, 874, "2026-05-22", "2026-11-04", "Mexico City, MX", "bg-cyan-400/15 text-cyan-200", [["in_8Th4", "2026-11-03", 79, "paid"], ["in_7Th8", "2026-10-03", 79, "paid"], ["in_6Th2", "2026-09-03", 79, "paid"]]),
  mk("Hollis & Park", "accounts@hollispark.example", "pro", "active", 5, 431, "2026-06-30", "2026-11-03", "Toronto, CA", "bg-rose-400/15 text-rose-200", [["in_8Hp5", "2026-11-01", 79, "paid"], ["in_7Hp1", "2026-10-01", 79, "paid"], ["in_6Hp7", "2026-09-01", 79, "paid"]]),
  mk("Sana Okafor", "sana@okafor.example", "pro", "trialing", 1, 96, "2026-10-29", "2026-11-05", "Lagos, NG", "bg-lime-400/15 text-lime-200", []),
  mk("Kestrel Health", "billing@kestrelhealth.example", "starter", "active", 1, 41, "2026-07-17", "2026-11-04", "Denver, US", "bg-fuchsia-400/15 text-fuchsia-200", [["in_8Kh3", "2026-11-04", 29, "processing"], ["in_7Kh9", "2026-10-04", 29, "paid"], ["in_6Kh4", "2026-09-04", 29, "paid"]]),
  mk("Priya Raman", "priya.raman@vertex-labs.example", "starter", "active", 1, 33, "2026-08-12", "2026-11-02", "Bengaluru, IN", "bg-lime-400/15 text-lime-200", [["in_8Pr6", "2026-10-29", 29, "paid"], ["in_7Pr2", "2026-09-29", 29, "paid"], ["in_6Pr8", "2026-08-29", 29, "paid"]]),
  mk("Ledgerly", "team@ledgerly.example", "starter", "past_due", 1, 48, "2026-05-03", "2026-10-21", "Cape Town, ZA", "bg-orange-400/15 text-orange-200", [["in_8Ld1", "2026-11-03", 29, "failed"], ["in_7Ld4", "2026-10-03", 29, "paid"], ["in_6Ld9", "2026-09-03", 29, "paid"]]),
  mk("Juno Studio", "hello@junostudio.example", "starter", "trialing", 1, 12, "2026-11-01", "2026-11-05", "Melbourne, AU", "bg-cyan-400/15 text-cyan-200", []),
];

export const customerMrr = (c: Customer) =>
  c.status === "active" || c.status === "past_due" ? PLAN_PRICE[c.plan] : 0;

export const fmtTokens = (thousands: number) =>
  thousands >= 1000
    ? `${(thousands / 1000).toFixed(thousands >= 10_000 ? 1 : 2).replace(/\.?0+$/, "")}M`
    : `${thousands}k`;

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
export const fmtRelative = (iso: string) => {
  const d = daysBetween(iso, TODAY);
  return d < 0 ? fmtDate(iso) : d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`;
};
