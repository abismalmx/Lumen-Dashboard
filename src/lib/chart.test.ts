import { describe, expect, it } from "vitest";
import { monotonePath, niceCeil } from "./chart";

type Point = readonly [number, number];

/** Convierte el path SVG en segmentos de Bézier cúbica para poder muestrearlos. */
function parseSegments(d: string) {
  const chunks = d.match(/[MC][^MC]*/g) ?? [];
  const segments: { p0: Point; c1: Point; c2: Point; p3: Point }[] = [];
  let current: Point = [0, 0];
  for (const chunk of chunks) {
    const n = chunk
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (chunk.startsWith("M")) {
      current = [n[0], n[1]];
    } else {
      segments.push({
        p0: current,
        c1: [n[0], n[1]],
        c2: [n[2], n[3]],
        p3: [n[4], n[5]],
      });
      current = [n[4], n[5]];
    }
  }
  return segments;
}

/** Recorre la curva y devuelve el rango vertical realmente dibujado. */
function verticalRange(pts: readonly Point[]) {
  const segments = parseSegments(monotonePath(pts));
  let min = Infinity;
  let max = -Infinity;
  for (const s of segments) {
    for (let i = 0; i <= 200; i += 1) {
      const u = i / 200;
      const v = 1 - u;
      const y =
        v * v * v * s.p0[1] +
        3 * v * v * u * s.c1[1] +
        3 * v * u * u * s.c2[1] +
        u * u * u * s.p3[1];
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  return { min, max };
}

describe("monotonePath", () => {
  it("devuelve cadena vacía sin puntos", () => {
    expect(monotonePath([])).toBe("");
  });

  it("dibuja un único punto como move", () => {
    expect(monotonePath([[3, 42]])).toBe("M3.0,42.0");
  });

  it("empieza siempre con M", () => {
    expect(monotonePath([]).startsWith("M")).toBe(false);
    expect(monotonePath([[0, 0]]).startsWith("M")).toBe(true);
    expect(
      monotonePath([
        [0, 10],
        [1, 20],
        [2, 15],
      ]).startsWith("M"),
    ).toBe(true);
  });

  it("emite un segmento cúbico por cada par de puntos consecutivos", () => {
    const d = monotonePath([
      [0, 10],
      [1, 20],
      [2, 15],
      [3, 30],
    ]);
    expect(d.match(/C/g)).toHaveLength(3);
    expect(d.startsWith("M0.0,10.0")).toBe(true);
  });

  it("no baja del mínimo de las muestras cuando hay un 0 entre valores altos", () => {
    const pts: Point[] = [
      [0, 120],
      [1, 180],
      [2, 0],
      [3, 210],
      [4, 150],
      [5, 90],
    ];
    const sampleMin = Math.min(...pts.map((p) => p[1]));
    const sampleMax = Math.max(...pts.map((p) => p[1]));
    expect(sampleMin).toBe(0);

    const { min, max } = verticalRange(pts);
    expect(min).toBeGreaterThanOrEqual(sampleMin - 1e-9);
    expect(max).toBeLessThanOrEqual(sampleMax + 1e-9);
  });

  it("no sobrepasa los límites de los samples en ninguna serie", () => {
    const series: Point[][] = [
      [
        [0, 100],
        [1, 50],
        [2, 0],
        [3, 80],
        [4, 100],
      ],
      [
        [0, 0],
        [1, 100],
        [2, 0],
        [3, 0],
        [4, 50],
      ],
      [
        [0, 10],
        [1, 10],
        [2, 10],
        [3, 10],
      ],
      [
        [0, 300],
        [1, 310],
        [2, 320],
        [3, 330],
      ],
    ];
    for (const pts of series) {
      const sampleMin = Math.min(...pts.map((p) => p[1]));
      const sampleMax = Math.max(...pts.map((p) => p[1]));
      const { min, max } = verticalRange(pts);
      expect(min).toBeGreaterThanOrEqual(sampleMin - 1e-9);
      expect(max).toBeLessThanOrEqual(sampleMax + 1e-9);
    }
  });

  it("mantiene la forma monótona creciente sin overshoot", () => {
    const pts: Point[] = [
      [0, 10],
      [1, 40],
      [2, 70],
      [3, 100],
    ];
    const { min, max } = verticalRange(pts);
    expect(min).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(max).toBeLessThanOrEqual(100 + 1e-9);
  });
});

describe("niceCeil", () => {
  it("redondea a un valor de eje bonito igual o superior al original", () => {
    expect(niceCeil(0)).toBe(0);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(10)).toBe(10);
    expect(niceCeil(12)).toBe(15);
    expect(niceCeil(25)).toBe(30);
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(250)).toBe(300);
    expect(niceCeil(1000)).toBe(1000);
  });

  it("usa pasos de 5000 por encima de 5000", () => {
    expect(niceCeil(5000)).toBe(5000);
    expect(niceCeil(34850)).toBe(35000);
    expect(niceCeil(120000)).toBe(120000);
  });

  it("nunca devuelve un valor menor que el original", () => {
    for (const value of [0, 1, 7, 12, 33, 99, 101, 499, 999, 4321, 34850, 987654]) {
      expect(niceCeil(value)).toBeGreaterThanOrEqual(value);
    }
  });

  it("mantiene el eje dentro de un margen razonable sobre el máximo real", () => {
    for (const value of [10, 120, 900, 2500, 34850]) {
      const axis = niceCeil(value);
      expect(axis).toBeGreaterThanOrEqual(value);
      expect(axis).toBeLessThanOrEqual(value * 1.5);
    }
  });
});
