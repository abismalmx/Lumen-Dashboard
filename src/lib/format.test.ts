import { describe, expect, it } from "vitest";
import {
  fmtCount,
  fmtDate,
  fmtDateShort,
  fmtMoney,
  fmtMoney0,
  fmtPct,
  fmtSigned0,
  initials,
} from "./format";

/** Signo menos tipográfico (U+2212), no el guion ASCII. */
const MINUS = "−";

describe("fmtMoney", () => {
  it("formatea con dos decimales por defecto", () => {
    expect(fmtMoney(1234.5)).toBe("$1,234.50");
    expect(fmtMoney(0)).toBe("$0.00");
    expect(fmtMoney(999)).toBe("$999.00");
  });

  it("usa separador de miles en-US", () => {
    expect(fmtMoney(1234567.891)).toBe("$1,234,567.89");
  });

  it("permite cambiar los decimales", () => {
    expect(fmtMoney(1234.56, 0)).toBe("$1,235");
    expect(fmtMoney(1234.56, 2)).toBe("$1,234.56");
  });
});

describe("importes negativos", () => {
  it("pone el signo antes del símbolo de moneda", () => {
    expect(fmtMoney(-5)).toBe("-$5.00");
    expect(fmtMoney0(-1234.5)).toBe("-$1,235");
  });
});

describe("fmtMoney0", () => {
  it("redondea a entero y prefija el signo dólar", () => {
    expect(fmtMoney0(1234.5)).toBe("$1,235");
    expect(fmtMoney0(1234.4)).toBe("$1,234");
    expect(fmtMoney0(0)).toBe("$0");
  });

  it("agrupa los millares", () => {
    expect(fmtMoney0(9876543)).toBe("$9,876,543");
  });
});

describe("fmtSigned0", () => {
  it("antepone + a los valores positivos", () => {
    expect(fmtSigned0(5)).toBe("+$5");
    expect(fmtSigned0(1234.6)).toBe("+$1,235");
  });

  it("usa el signo menos tipográfico en los valores negativos", () => {
    expect(fmtSigned0(-5)).toBe(`${MINUS}$5`);
    expect(fmtSigned0(-1234.6)).toBe(`${MINUS}$1,235`);
    expect(fmtSigned0(-5)).not.toContain("-");
  });

  it("deja el cero sin signo", () => {
    expect(fmtSigned0(0)).toBe("$0");
  });
});

describe("fmtPct", () => {
  it("formatea porcentajes con un decimal por defecto", () => {
    expect(fmtPct(12.34)).toBe("12.3%");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(-4.5)).toBe("-4.5%");
  });

  it("permite cambiar los decimales", () => {
    expect(fmtPct(12.345, 2)).toBe("12.35%");
    expect(fmtPct(12.345, 0)).toBe("12%");
  });
});

describe("fmtDate", () => {
  it("formatea una fecha ISO como Mes día, año", () => {
    expect(fmtDate("2026-11-05")).toBe("Nov 5, 2026");
    expect(fmtDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(fmtDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});

describe("fmtDateShort", () => {
  it("omite el año", () => {
    expect(fmtDateShort("2026-11-05")).toBe("Nov 5");
    expect(fmtDateShort("2026-08-08")).toBe("Aug 8");
  });
});

describe("initials", () => {
  it("toma las iniciales de nombre y apellido", () => {
    expect(initials("Elena Márquez")).toBe("EM");
    expect(initials("Northwind Labs")).toBe("NL");
  });

  it("usa solo la primera inicial en nombres de una sola palabra", () => {
    expect(initials("Sana Okafor")).toBe("SO");
    expect(initials("Ledgerly")).toBe("L");
  });

  it("ignora símbolos sueltos como '&' al calcular las iniciales", () => {
    expect(initials("Hollis & Park")).toBe("HP");
  });

  it("devuelve cadena vacía para un nombre vacío", () => {
    expect(initials("")).toBe("");
  });
});

describe("fmtCount", () => {
  it("agrupa los millares en en-US", () => {
    expect(fmtCount(1234567)).toBe("1,234,567");
    expect(fmtCount(999)).toBe("999");
    expect(fmtCount(0)).toBe("0");
  });
});
