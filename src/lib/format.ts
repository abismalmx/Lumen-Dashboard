export const fmtCount = (n: number) => n.toLocaleString("en-US");
/** The sign goes before the currency symbol: -$5.00, never $-5.00. */
export const fmtMoney = (n: number, dp = 2) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const fmtMoney0 = (n: number) => fmtMoney(Math.sign(n) * Math.round(Math.abs(n)), 0); // symmetric rounding
export const fmtSigned0 = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtMoney0(Math.abs(n))}`;
export const fmtPct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
export const fmtDateShort = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /^[\p{L}\p{N}]/u.test(part)) // "Hollis & Park" -> HP, not H&
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

