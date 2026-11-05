/* Data model: one daily ledger drives every figure on the dashboard. */

export const PLAN_PRICE = { starter: 29, pro: 79, enterprise: 249 } as const;
export type PlanId = keyof typeof PLAN_PRICE;

export const PLAN_META: Record<PlanId, { label: string; blurb: string }> = {
  starter: { label: "Starter", blurb: "1 seat, 50k tokens" },
  pro: { label: "Pro", blurb: "5 seats, 1M tokens" },
  enterprise: { label: "Enterprise", blurb: "Unlimited seats, SSO" },
};

/** Paid plan mix on 2026-08-07, before the ledger starts. */
export const OPENING_PLAN = { starter: 262, pro: 72, enterprise: 60 };

/**
 * One row per day: [date, renewals, +starter, +pro, +enterprise,
 *                    -starter, -pro, -enterprise, usage overage]
 */
export const LEDGER: [string, number, number, number, number, number, number, number, number][] = [
  ["2026-08-08", 760, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-09", 794, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-10", 957, 0, 2, 1, 0, 0, 0, 0],
  ["2026-08-11", 998, 0, 1, 0, 0, 0, 0, 0],
  ["2026-08-12", 983, 0, 1, 0, 0, 0, 0, 0],
  ["2026-08-13", 1010, 0, 1, 0, 1, 0, 0, 0],
  ["2026-08-14", 1040, 0, 1, 0, 0, 0, 0, 0],
  ["2026-08-15", 775, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-16", 773, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-17", 1023, 1, 1, 0, 0, 0, 0, 0],
  ["2026-08-18", 988, 0, 1, 0, 0, 0, 0, 0],
  ["2026-08-19", 988, 1, 0, 0, 0, 0, 0, 0],
  ["2026-08-20", 1011, 3, 0, 0, 0, 0, 0, 0],
  ["2026-08-21", 1034, 2, 0, 0, 0, 0, 0, 0],
  ["2026-08-22", 792, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-23", 776, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-24", 982, 1, 0, 0, 0, 0, 0, 0],
  ["2026-08-25", 1011, 3, 0, 0, 0, 1, 0, 0],
  ["2026-08-26", 1047, 2, 0, 0, 0, 0, 0, 0],
  ["2026-08-27", 1033, 2, 0, 0, 0, 0, 0, 0],
  ["2026-08-28", 1054, 1, 0, 0, 0, 0, 0, 0],
  ["2026-08-29", 830, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-30", 810, 0, 0, 0, 0, 0, 0, 0],
  ["2026-08-31", 1012, 1, 0, 0, 0, 0, 0, 0],
  ["2026-09-01", 1012, 1, 0, 0, 0, 0, 0, 0],
  ["2026-09-02", 1011, 1, 0, 0, 0, 0, 0, 0],
  ["2026-09-03", 1068, 1, 0, 0, 0, 0, 1, 0],
  ["2026-09-04", 1068, 2, 0, 0, 0, 0, 0, 0],
  ["2026-09-05", 798, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-06", 788, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-07", 993, 0, 1, 0, 0, 0, 0, 0],
  ["2026-09-08", 978, 0, 2, 0, 0, 0, 0, 0],
  ["2026-09-09", 993, 0, 2, 1, 0, 0, 0, 0],
  ["2026-09-10", 1053, 1, 1, 0, 2, 0, 0, 0],
  ["2026-09-11", 994, 0, 1, 0, 0, 0, 0, 0],
  ["2026-09-12", 800, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-13", 794, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-14", 1057, 2, 1, 0, 0, 0, 0, 0],
  ["2026-09-15", 1021, 0, 1, 0, 0, 0, 0, 0],
  ["2026-09-16", 1057, 0, 1, 0, 0, 0, 0, 0],
  ["2026-09-17", 1047, 1, 1, 0, 0, 0, 0, 0],
  ["2026-09-18", 1015, 1, 0, 0, 2, 0, 0, 0],
  ["2026-09-19", 803, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-20", 774, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-21", 1060, 2, 0, 0, 0, 0, 0, 0],
  ["2026-09-22", 1014, 2, 0, 0, 0, 0, 0, 0],
  ["2026-09-23", 1040, 0, 0, 1, 0, 0, 0, 0],
  ["2026-09-24", 1074, 3, 0, 0, 0, 0, 0, 0],
  ["2026-09-25", 1057, 1, 0, 0, 0, 0, 0, 0],
  ["2026-09-26", 812, 0, 0, 0, 0, 1, 0, 0],
  ["2026-09-27", 834, 0, 0, 0, 0, 0, 0, 0],
  ["2026-09-28", 1082, 1, 0, 0, 0, 0, 0, 0],
  ["2026-09-29", 1067, 3, 0, 0, 0, 0, 0, 0],
  ["2026-09-30", 1055, 1, 0, 0, 0, 0, 0, 0],
  ["2026-10-01", 1035, 2, 0, 0, 0, 0, 0, 0],
  ["2026-10-02", 1021, 1, 0, 0, 0, 0, 0, 0],
  ["2026-10-03", 853, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-04", 826, 0, 0, 0, 2, 0, 1, 0],
  ["2026-10-05", 1075, 2, 0, 0, 0, 0, 0, 0],
  ["2026-10-06", 1104, 2, 0, 0, 0, 0, 0, 0],
  ["2026-10-07", 1088, 0, 3, 0, 0, 0, 0, 0],
  ["2026-10-08", 1057, 0, 2, 0, 0, 0, 0, 0],
  ["2026-10-09", 1046, 0, 5, 0, 0, 0, 0, 0],
  ["2026-10-10", 814, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-11", 830, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-12", 1092, 0, 2, 0, 0, 0, 0, 0],
  ["2026-10-13", 1081, 0, 2, 0, 0, 1, 0, 0],
  ["2026-10-14", 1115, 1, 3, 0, 0, 0, 0, 0],
  ["2026-10-15", 1100, 0, 3, 0, 0, 0, 0, 0],
  ["2026-10-16", 1089, 1, 2, 0, 0, 0, 0, 0],
  ["2026-10-17", 846, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-18", 826, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-19", 1093, 3, 2, 0, 2, 0, 0, 0],
  ["2026-10-20", 1114, 0, 2, 0, 0, 0, 0, 0],
  ["2026-10-21", 1113, 0, 0, 3, 0, 0, 0, 1],
  ["2026-10-22", 1062, 2, 1, 0, 0, 0, 0, 0],
  ["2026-10-23", 1105, 1, 1, 0, 0, 0, 0, 0],
  ["2026-10-24", 836, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-25", 876, 0, 0, 0, 0, 0, 0, 0],
  ["2026-10-26", 1117, 1, 1, 0, 0, 0, 0, 0],
  ["2026-10-27", 1138, 2, 1, 0, 2, 0, 0, 0],
  ["2026-10-28", 1085, 1, 1, 0, 0, 0, 0, 0],
  ["2026-10-29", 1128, 5, 0, 0, 0, 0, 0, 0],
  ["2026-10-30", 1144, 3, 0, 0, 0, 0, 0, 0],
  ["2026-10-31", 824, 0, 0, 0, 0, 0, 0, 0],
  ["2026-11-01", 839, 0, 0, 0, 0, 0, 0, 0],
  ["2026-11-02", 1136, 3, 0, 0, 2, 0, 0, 0],
  ["2026-11-03", 1111, 5, 0, 0, 0, 0, 0, 0],
  ["2026-11-04", 1134, 1, 0, 0, 0, 0, 0, 0],
  ["2026-11-05", 1139, 3, 0, 0, 0, 0, 0, 0],
];

export type LedgerDay = {
  date: string;
  renewals: number;
  added: Record<PlanId, number>;
  churned: Record<PlanId, number>;
  overage: number;
  revenue: number;
  plan: Record<PlanId, number>;
  accounts: number;
  mrr: number;
  arpu: number;
};

export function buildLedger(): LedgerDay[] {
  const plan = { ...OPENING_PLAN };
  let overageTotal = 0;
  return LEDGER.map(([date, renewals, as, ap, ae, cs, cp, ce, overage]) => {
    plan.starter += as - cs;
    plan.pro += ap - cp;
    plan.enterprise += ae - ce;
    overageTotal += overage;
    const added = { starter: as, pro: ap, enterprise: ae };
    const churned = { starter: cs, pro: cp, enterprise: ce };
    const addedRevenue = as * PLAN_PRICE.starter + ap * PLAN_PRICE.pro + ae * PLAN_PRICE.enterprise;
    const churnedRevenue =
      cs * PLAN_PRICE.starter + cp * PLAN_PRICE.pro + ce * PLAN_PRICE.enterprise;
    const revenue = renewals + addedRevenue - churnedRevenue + overage;
    const mrr =
      plan.starter * PLAN_PRICE.starter +
      plan.pro * PLAN_PRICE.pro +
      plan.enterprise * PLAN_PRICE.enterprise +
      overageTotal;
    const accounts = plan.starter + plan.pro + plan.enterprise;
    return { date, renewals, added, churned, overage, revenue, plan: { ...plan }, accounts, mrr, arpu: mrr / accounts };
  });
}

export const DAYS = buildLedger();

export const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

export const windowOf = (days: number) => DAYS.slice(DAYS.length - days);
export const addedRevenue = (day: LedgerDay) =>
  day.added.starter * PLAN_PRICE.starter + day.added.pro * PLAN_PRICE.pro + day.added.enterprise * PLAN_PRICE.enterprise;
export const churnedRevenue = (day: LedgerDay) =>
  day.churned.starter * PLAN_PRICE.starter +
  day.churned.pro * PLAN_PRICE.pro +
  day.churned.enterprise * PLAN_PRICE.enterprise;
export const newAccounts = (day: LedgerDay) => day.added.starter + day.added.pro + day.added.enterprise;
export const churnedAccounts = (day: LedgerDay) => day.churned.starter + day.churned.pro + day.churned.enterprise;

export const CURRENT = windowOf(30);

/** Trailing 7-day churn rate (%) for each day of the current window. */
export const CHURN_TREND = CURRENT.map((_, i) => {
  const end = DAYS.length - CURRENT.length + i;
  const span = DAYS.slice(Math.max(0, end - 6), end + 1);
  return (sum(span, churnedAccounts) / DAYS[end].accounts) * 100;
});
export const PRIOR = DAYS.slice(DAYS.length - 60, DAYS.length - 30);

/* Headline figures — every one of them read off the ledger above. */
export const MRR = sum(CURRENT, (d) => d.revenue);
export const MRR_PRIOR = sum(PRIOR, (d) => d.revenue);
export const MRR_CHANGE = MRR - MRR_PRIOR;
export const MRR_CHANGE_PCT = (MRR_CHANGE / MRR_PRIOR) * 100;

export const PAID = CURRENT[CURRENT.length - 1].accounts;
export const PAID_PRIOR = PRIOR[PRIOR.length - 1].accounts;
/** Accounts on the free tier or in a trial — not billed, but active. */
export const FREE = 737;
export const FREE_PRIOR = 703;
export const ACTIVE = PAID + FREE;
export const ACTIVE_PRIOR = PAID_PRIOR + FREE_PRIOR;
export const ACTIVE_CHANGE_PCT = ((ACTIVE - ACTIVE_PRIOR) / ACTIVE_PRIOR) * 100;

export const ARPU = MRR / PAID;
export const ARPU_PRIOR = MRR_PRIOR / PAID_PRIOR;
export const ARPU_CHANGE_PCT = ((ARPU - ARPU_PRIOR) / ARPU_PRIOR) * 100;

export const CHURNED = sum(CURRENT, churnedAccounts);
export const CHURNED_PRIOR = sum(PRIOR, churnedAccounts);
export const CHURN = (CHURNED / PAID) * 100;
export const CHURN_PRIOR = (CHURNED_PRIOR / PAID_PRIOR) * 100;

export const NEW_ACCOUNTS = sum(CURRENT, newAccounts);
export const NEW_REVENUE = sum(CURRENT, addedRevenue);
export const CHURNED_REVENUE = sum(CURRENT, churnedRevenue);
export const OVERAGE_REVENUE = sum(CURRENT, (d) => d.overage);
export const PRO_UPGRADE_REVENUE = sum(CURRENT, (d) => d.added.pro * PLAN_PRICE.pro);


/* Plan mix on the last day of the current window. */
export const PLAN_MIX = (["starter", "pro", "enterprise"] as PlanId[]).map((id) => {
  const accounts = CURRENT[CURRENT.length - 1].plan[id];
  const revenue =
    accounts * PLAN_PRICE[id] + (id === "enterprise" ? OVERAGE_REVENUE : 0);
  return {
    id,
    label: PLAN_META[id].label,
    price: PLAN_PRICE[id],
    blurb: PLAN_META[id].blurb,
    accounts,
    revenue,
    share: (accounts / PAID) * 100,
  };
});

/**
 * Charges in a window: renewals + first payments + usage charges.
 * Every account bills once per 30 days, so a 30-day window bills the accounts
 * alive at its start; a longer window bills one block per 30 days.
 */
export const chargesIn = (days: number) => {
  const slice = windowOf(days);
  const startIndex = DAYS.length - days;
  const opening = OPENING_PLAN.starter + OPENING_PLAN.pro + OPENING_PLAN.enterprise;
  let renewals = 0;
  const blocks = Math.floor(days / 30);
  for (let block = 0; block < blocks; block += 1) {
    const index = startIndex + block * 30;
    renewals += index === 0 ? opening : DAYS[index - 1].accounts;
  }
  const remainder = days % 30;
  if (remainder > 0) {
    const index = Math.max(0, startIndex + blocks * 30 - 1);
    const base = index === 0 ? opening : DAYS[index].accounts;
    renewals += Math.round((base * remainder) / 30);
  }
  return renewals + sum(slice, newAccounts) + sum(slice, (d) => d.overage);
};
