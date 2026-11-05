/**
 * Monotone cubic interpolation (Fritsch–Carlson): smooth like a spline but
 * never overshoots between samples, so a $0 day can't dip below the axis.
 */
export function monotonePath(pts: readonly (readonly [number, number])[]) {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M${f(pts[0][0])},${f(pts[0][1])}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * slope[i]) / h;
      m[i + 1] = (3 * b * slope[i]) / h;
    }
  }
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const k = dx[i] / 3;
    d += ` C${f(x0 + k)},${f(y0 + m[i] * k)} ${f(x1 - k)},${f(y1 - m[i + 1] * k)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

export function niceCeil(value: number) {
  const steps = [
    1, 2, 5, 10, 20, 25, 50, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500,
    5000,
  ];
  const step = steps.find((candidate) => candidate >= value / 4) ?? 5000;
  return Math.ceil(value / step) * step;
}
