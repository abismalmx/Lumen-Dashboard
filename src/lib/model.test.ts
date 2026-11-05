import { describe, expect, it } from "vitest";
import { PLAN_PRICE } from "./ledger";
import {
  CUSTOMER_SEED,
  TODAY,
  TRANSACTIONS,
  customerMrr,
  daysBetween,
  fmtRelative,
  fmtTokens,
  type Customer,
  type CustomerStatus,
} from "./model";

const customerWith = (status: CustomerStatus, plan: keyof typeof PLAN_PRICE): Customer =>
  ({
    id: "test@example",
    name: "Test",
    email: "test@example",
    plan,
    status,
    seats: 1,
    tokens: 0,
    joined: TODAY,
    lastActive: TODAY,
    location: "Madrid, ES",
    tint: "",
    invoices: [],
  }) satisfies Customer;

describe("customerMrr", () => {
  it("cobra el precio del plan a los clientes activos", () => {
    expect(customerMrr(customerWith("active", "pro"))).toBe(PLAN_PRICE.pro);
    expect(customerMrr(customerWith("active", "enterprise"))).toBe(PLAN_PRICE.enterprise);
    expect(customerMrr(customerWith("active", "starter"))).toBe(PLAN_PRICE.starter);
  });

  it("también cobra a los clientes con pago atrasado", () => {
    expect(customerMrr(customerWith("past_due", "pro"))).toBe(PLAN_PRICE.pro);
    expect(customerMrr(customerWith("past_due", "starter"))).toBe(PLAN_PRICE.starter);
  });

  it("no cobra a los clientes en prueba ni a los que se han dado de baja", () => {
    expect(customerMrr(customerWith("trialing", "pro"))).toBe(0);
    expect(customerMrr(customerWith("churned", "enterprise"))).toBe(0);
  });
});

describe("fmtTokens", () => {
  it("muestra los miles tal cual cuando no llegan a 1000", () => {
    expect(fmtTokens(41)).toBe("41k");
    expect(fmtTokens(0)).toBe("0k");
    expect(fmtTokens(999)).toBe("999k");
  });

  it("pasa a millones a partir de 1000", () => {
    expect(fmtTokens(1000)).toBe("1M");
    expect(fmtTokens(2000)).toBe("2M");
  });

  it("usa un decimal para millones de cinco cifras o más", () => {
    expect(fmtTokens(38400)).toBe("38.4M");
    expect(fmtTokens(21900)).toBe("21.9M");
  });
});

describe("fmtRelative", () => {
  it("etiqueta el día de hoy", () => {
    expect(fmtRelative(TODAY)).toBe("Today");
  });

  it("etiqueta ayer", () => {
    expect(fmtRelative("2026-11-04")).toBe("Yesterday");
  });

  it("cuenta los días restantes", () => {
    expect(fmtRelative("2026-11-02")).toBe("3 days ago");
    expect(fmtRelative("2026-10-30")).toBe("6 days ago");
  });
});

describe("daysBetween", () => {
  it("mide la distancia en días calendario", () => {
    expect(daysBetween("2026-11-05", "2026-11-05")).toBe(0);
    expect(daysBetween("2026-11-04", "2026-11-05")).toBe(1);
    expect(daysBetween("2026-10-29", "2026-11-05")).toBe(7);
  });
});

describe("CUSTOMER_SEED", () => {
  it("no repite ids", () => {
    const ids = CUSTOMER_SEED.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no repite emails", () => {
    const emails = CUSTOMER_SEED.map((c) => c.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("usa el email como id de cliente", () => {
    for (const customer of CUSTOMER_SEED) {
      expect(customer.id).toBe(customer.email);
    }
  });

  it("todos los emails terminan en .example", () => {
    for (const customer of CUSTOMER_SEED) {
      expect(customer.email.endsWith(".example")).toBe(true);
    }
    for (const transaction of TRANSACTIONS) {
      expect(transaction.email.endsWith(".example")).toBe(true);
    }
  });

  it("cubre los cuatro estados de cliente", () => {
    const statuses = new Set(CUSTOMER_SEED.map((c) => c.status));
    expect(statuses).toEqual(new Set(["active", "trialing", "past_due", "churned"]));
  });

  it("los clientes en prueba no tienen facturas", () => {
    for (const customer of CUSTOMER_SEED.filter((c) => c.status === "trialing")) {
      expect(customer.invoices).toHaveLength(0);
    }
  });
});

describe("fmtRelative con fechas futuras", () => {
  it("no las presenta como 'Today'", () => {
    expect(fmtRelative("2026-11-09")).toBe("Nov 9, 2026");
  });
});
