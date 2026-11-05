import { describe, expect, it } from "vitest";
import {
  ARPU,
  CHURNED_REVENUE,
  CURRENT,
  DAYS,
  MRR,
  MRR_CHANGE,
  MRR_PRIOR,
  NEW_REVENUE,
  OPENING_PLAN,
  OVERAGE_REVENUE,
  PAID,
  PAID_PRIOR,
  PLAN_MIX,
  PLAN_PRICE,
  PRIOR,
  sum,
} from "./ledger";

const dayMs = 86_400_000;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe("DAYS", () => {
  it("cubre 90 días", () => {
    expect(DAYS).toHaveLength(90);
  });

  it("son días consecutivos, sin huecos ni repeticiones", () => {
    for (let i = 1; i < DAYS.length; i += 1) {
      const previous = toUtc(DAYS[i - 1].date);
      const current = toUtc(DAYS[i].date);
      expect(current - previous).toBe(dayMs);
    }
  });

  it("empieza el 2026-08-08 y termina el 2026-11-05", () => {
    expect(DAYS[0].date).toBe("2026-08-08");
    expect(DAYS[DAYS.length - 1].date).toBe("2026-11-05");
  });

  it("mantiene el plan acumulado coherente con altas y bajas de cada día", () => {
    const plan = { ...OPENING_PLAN };
    for (const day of DAYS) {
      plan.starter += day.added.starter - day.churned.starter;
      plan.pro += day.added.pro - day.churned.pro;
      plan.enterprise += day.added.enterprise - day.churned.enterprise;
      expect(day.plan.starter).toBe(plan.starter);
      expect(day.plan.pro).toBe(plan.pro);
      expect(day.plan.enterprise).toBe(plan.enterprise);
      expect(day.accounts).toBe(plan.starter + plan.pro + plan.enterprise);
    }
  });
});

describe("MRR", () => {
  it("MRR - MRR_PRIOR === MRR_CHANGE", () => {
    expect(MRR - MRR_PRIOR).toBe(MRR_CHANGE);
  });

  it("compara dos ventanas de 30 días disjuntas", () => {
    expect(CURRENT).toHaveLength(30);
    expect(PRIOR).toHaveLength(30);
    expect(CURRENT[0].date).toBe("2026-10-07");
    expect(PRIOR[0].date).toBe("2026-09-07");
    expect(PRIOR[PRIOR.length - 1].date).toBe("2026-10-06");
  });

  it("NEW_REVENUE - CHURNED_REVENUE + OVERAGE_REVENUE cuadra con MRR_CHANGE", () => {
    // Equivalente al console.assert que se retiró: el movimiento del mes
    // (altas - bajas + uso) tiene que explicar el cambio de MRR.
    const movement = NEW_REVENUE - CHURNED_REVENUE + OVERAGE_REVENUE;
    expect(Math.round(movement)).toBe(Math.round(MRR_CHANGE));
    expect(Math.abs(movement - MRR_CHANGE)).toBeLessThanOrEqual(1);
  });
});

describe("ARPU", () => {
  it("ARPU * 100 redondeado da 6820", () => {
    expect(Math.round(ARPU * 100)).toBe(6820);
  });

  it("es el MRR dividido por las cuentas de pago", () => {
    expect(ARPU).toBe(MRR / PAID);
    expect(PAID).toBe(CURRENT[CURRENT.length - 1].accounts);
    expect(PAID_PRIOR).toBe(PRIOR[PRIOR.length - 1].accounts);
  });
});

describe("PLAN_MIX", () => {
  it("la suma de cuentas por plan coincide con PAID", () => {
    expect(sum(PLAN_MIX, (p) => p.accounts)).toBe(PAID);
  });

  it("cubre los tres planes del catálogo", () => {
    expect(PLAN_MIX.map((p) => p.id)).toEqual(["starter", "pro", "enterprise"]);
  });

  it("los porcentajes suman ~100", () => {
    const total = sum(PLAN_MIX, (p) => p.share);
    expect(total).toBeCloseTo(100, 10);
  });

  it("el reparto de cuentas y de ingresos es consistente con los precios", () => {
    for (const plan of PLAN_MIX) {
      expect(plan.price).toBe(PLAN_PRICE[plan.id]);
      expect(plan.share).toBeCloseTo((plan.accounts / PAID) * 100, 10);
      // Solo Enterprise arrastra el uso: su ingreso incluye el overage del mes.
      const expected = plan.accounts * PLAN_PRICE[plan.id];
      expect(plan.revenue).toBe(plan.id === "enterprise" ? expected + OVERAGE_REVENUE : expected);
    }
  });
});
