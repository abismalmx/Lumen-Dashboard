/**
 * Lumen — Operations dashboard
 * ---------------------------------------------------------------------------
 * Single-file React component (React + Tailwind CSS + lucide-react).
 *
 * The data model below is one source of truth: the 90-day daily ledger drives
 * every figure on the screen, so the KPI strip, the chart, the plan mix and
 * the transaction table can never disagree.
 *
 *   Ledger rules
 *   - Every account bills once per 30-day window, so a window's recognised
 *     revenue equals MRR at the end of that window.
 *   - MRR(t) = MRR(t-30) + new revenue - churned revenue + usage overage.
 *   - ARPU = MRR / paid accounts.  Churn = churned / paid accounts.
 *
 * Host app requirements: Tailwind (v3+), lucide-react, and the Geist / Geist
 * Mono font families (see tailwind.config.js).
 */

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CornerDownLeft,
  LayoutDashboard,
  CreditCard,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Users,
  Search,
  X,
} from "lucide-react";

import { ACTIVE, ACTIVE_CHANGE_PCT, ARPU, ARPU_CHANGE_PCT, ARPU_PRIOR, CHURN, CHURNED, CHURNED_REVENUE, CHURN_PRIOR, CHURN_TREND, CURRENT, DAYS, FREE, LedgerDay, MRR, MRR_CHANGE, MRR_CHANGE_PCT, MRR_PRIOR, NEW_ACCOUNTS, NEW_REVENUE, OVERAGE_REVENUE, PAID, PLAN_META, PLAN_MIX, PLAN_PRICE, PRO_UPGRADE_REVENUE, PlanId, chargesIn, newAccounts, sum, windowOf } from "./lib/ledger";
import { CUSTOMER_SEED, Customer, CustomerStatus, Status, TODAY, TOKEN_QUOTA, TRANSACTIONS, Transaction, customerMrr, fmtRelative, fmtTokens } from "./lib/model";
import { fmtCount, fmtDate, fmtDateShort, fmtMoney, fmtMoney0, fmtPct, fmtSigned0, initials } from "./lib/format";
import { monotonePath, niceCeil } from "./lib/chart";
import { LocalRepo, newId, type CustomerRepo } from "./lib/repo";
import { cloudEnabled } from "./lib/supabase";
import type { Session } from "./lib/session";

/* ==========================================================================
 * 1. Data model
 * ========================================================================== */


/* --------------------------------------------------------------------------
 * Transactions — the most recent charges. Amounts follow the plan prices.
 * ------------------------------------------------------------------------ */

const WORKSPACES = [
  { id: "prod", name: "Lumen Production", env: "Production" },
  { id: "staging", name: "Lumen Staging", env: "Staging" },
  { id: "sandbox", name: "Lumen Sandbox", env: "Sandbox" },
];

const RANGES = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;

/* ==========================================================================
 * 2. Formatting helpers
 * ========================================================================== */

const PLAN_SHADE: Record<PlanId, string> = {
  starter: "from-amber-800 to-amber-700",
  pro: "from-amber-600 to-amber-500",
  enterprise: "from-amber-400 to-yellow-200",
};

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/** One focus ring for the whole screen. */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

/* ==========================================================================
 * 3. Primitives
 * ========================================================================== */

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    const box = el.getBoundingClientRect();
    setSize({ width: box.width, height: box.height });
    return () => observer.disconnect();
  }, []);
  return { ref, width: size.width, height: size.height };
}

/** Counts up to its value once, on mount. Static under reduced motion. */
function CountUp({
  to,
  format,
  delay = 0,
  duration = 1100,
}: {
  to: number;
  format: (n: number) => string;
  delay?: number;
  duration?: number;
}) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let start = 0;
    setValue(0);
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(to * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, duration]);
  return <>{format(value)}</>;
}

function Avatar({
  name,
  tint = "bg-stone-400/15 text-stone-200",
  size = "md",
}: {
  name: string;
  tint?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-medium",
        size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-[13px]",
        tint,
      )}
    >
      {initials(name)}
    </span>
  );
}

function Delta({
  value,
  label,
  direction,
  good,
  suffix,
}: {
  value: string;
  label: string;
  /** Which way the metric moved — churn falling is good, churn rising is not. */
  direction: "up" | "down";
  good: boolean;
  suffix?: string;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
      <span
        className={cx(
          "inline-flex items-center gap-1 font-medium tabular-nums",
          good ? "text-emerald-300" : "text-rose-300",
        )}
      >
        {direction === "up" ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5" />
        )}
        {value}
        {suffix}
      </span>
      <span className="text-stone-400">{label}</span>
    </p>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string; icon: ReactNode }> = {
    paid: {
      label: "Paid",
      className: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25 shadow-[0_0_12px_-2px_rgba(52,211,153,0.35)]",
      icon: <Check className="h-3 w-3" />,
    },
    processing: {
      label: "Processing",
      className: "bg-white/[0.05] text-stone-300 ring-white/[0.12]",
      icon: <Clock className="h-3 w-3" />,
    },
    failed: {
      label: "Failed",
      className: "bg-rose-500/10 text-rose-300 ring-rose-400/25",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    refunded: {
      label: "Refunded",
      className: "bg-white/[0.05] text-stone-300 ring-white/[0.14]",
      icon: <ArrowDownRight className="h-3 w-3" />,
    },
  };
  const item = map[status];
  return (
    <span
      className={cx(
        "inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none ring-1 ring-inset",
        item.className,
      )}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const id = useId();
  const w = 84;
  const h = 28;
  if (values.length < 2) return null;
  // Downsample to ~14 points so the curve reads as a trend, not noise.
  const step = Math.max(1, Math.floor(values.length / 14));
  const data = values.filter((_, i) => i % step === 0 || i === values.length - 1);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((value, index) => ({
    x: (index / (data.length - 1)) * (w - 4) + 2,
    y: h - 4 - ((value - min) / span) * (h - 8),
  }));
  const d = monotonePath(pts.map((q) => [q.x, q.y] as const));
  const last = pts[pts.length - 1];
  const area = `${d} L${last.x.toFixed(1)},${h} L${pts[0].x.toFixed(1)},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cx("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={4} fill="currentColor" opacity={0.2} />
      <circle cx={last.x} cy={last.y} r={2} fill="currentColor" />
    </svg>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Chart series" className="inline-flex rounded-lg bg-black/30 p-0.5 ring-1 ring-inset ring-white/[0.08]">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.id)}
            className={cx(
              FOCUS,
              "h-9 rounded-[6px] px-3 text-[13px] transition-colors sm:h-8",
              active ? "bg-white/[0.08] text-stone-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]" : "text-stone-400 hover:text-stone-200",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  children,
  className,
  as: Tag = "section",
  style,
  id,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag
      id={id}
      style={style}
      className={cx(
        "relative rounded-xl border border-white/[0.08] bg-stone-900/40",
        "bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(255,255,255,0.045),transparent_60%)]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ==========================================================================
 * 4. Charts
 * ========================================================================== */


function TrendChart({
  rows,
  mode,
}: {
  rows: LedgerDay[];
  mode: "revenue" | "accounts";
}) {
  const { ref, width, height: measuredHeight } = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const height = Math.max(200, measuredHeight);
  const padLeft = 52;
  const padRight = 16;
  const padTop = 26;
  const padBottom = 28;
  const plotWidth = Math.max(0, width - padLeft - padRight);
  const plotHeight = height - padTop - padBottom;

  const values = rows.map((row) => (mode === "revenue" ? row.revenue : newAccounts(row)));
  const max = niceCeil(Math.max(...values, 1));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

  const xAt = (index: number) =>
    rows.length < 2 ? padLeft : padLeft + (plotWidth * index) / (rows.length - 1);
  const yAt = (value: number) => padTop + plotHeight - (value / max) * plotHeight;

  const linePath = monotonePath(values.map((value, index) => [xAt(index), yAt(value)] as const));
  const areaPath =
    rows.length > 1
      ? `${linePath} L${xAt(rows.length - 1).toFixed(1)},${(padTop + plotHeight).toFixed(1)} L${xAt(0).toFixed(1)},${(
          padTop + plotHeight
        ).toFixed(1)} Z`
      : "";

  /* Counts read better as columns: one band per day. */
  const band = rows.length ? plotWidth / rows.length : 0;
  const barWidth = Math.max(2, Math.min(16, band * 0.48));

  const labelIndexes = useMemo(() => {
    const last = rows.length - 1;
    const steps = width < 420 ? 2 : 4;
    if (rows.length <= steps + 1) return rows.map((_, index) => index);
    return Array.from({ length: steps + 1 }, (_, step) => Math.floor((last * step) / steps));
  }, [rows.length, width]);

  const annotationIndex = rows.findIndex((row) => row.added.enterprise >= 3);
  const hovered = hover !== null ? rows[hover] : null;

  const handleMove = (event: ReactMouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const ratio = (x - padLeft) / (plotWidth || 1);
    const index = Math.round(ratio * (rows.length - 1));
    setHover(Math.min(rows.length - 1, Math.max(0, index)));
  };

  return (
    <div ref={ref} className="relative mt-4 min-h-[210px] min-w-0 flex-1 overflow-hidden">
      {width > 0 && measuredHeight > 0 && (
        <svg
          width={width}
          height={height}
          className="block select-none"
          role="img"
          aria-label={
            mode === "revenue"
              ? `Daily recognised revenue over the last ${rows.length} days`
              : `New paid accounts per day over the last ${rows.length} days`
          }
        >
          <defs>
            <linearGradient id="lumen-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
            <filter id="lumen-glow" x="-5%" y="-30%" width="110%" height="160%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="lumen-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke={tick === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "2 5"}
              />
              <text
                x={padLeft - 10}
                y={yAt(tick) + 4}
                textAnchor="end"
                className="fill-stone-400 font-mono text-[11px] tabular-nums"
              >
                {mode === "revenue" ? fmtMoney0(tick) : fmtCount(tick)}
              </text>
            </g>
          ))}

          {mode === "revenue" ? (
            <>
              {areaPath && <path d={areaPath} fill="url(#lumen-area)" className="animate-fade" />}
              <path
                d={linePath}
                pathLength={1}
                className="animate-draw"
                fill="none"
                stroke="#fbbf24"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#lumen-glow)"
              />
            </>
          ) : (
            values.map((value, index) => {
              const x = padLeft + band * index + (band - barWidth) / 2;
              const y = yAt(value);
              const barHeight = padTop + plotHeight - y;
              return (
                <rect
                  key={index}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(0, barHeight)}
                  fill="url(#lumen-bar)"
                  opacity={hover === null || hover === index ? 1 : 0.35}
                  rx={2}
                />
              );
            })
          )}

          {annotationIndex >= 0 && (
            <g>
              <line
                x1={
                  mode === "revenue"
                    ? xAt(annotationIndex)
                    : padLeft + band * annotationIndex + band / 2
                }
                x2={
                  mode === "revenue"
                    ? xAt(annotationIndex)
                    : padLeft + band * annotationIndex + band / 2
                }
                y1={padTop - 6}
                y2={padTop + plotHeight}
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <text
                x={Math.min(xAt(annotationIndex) + 6, padLeft + plotWidth - 4)}
                y={padTop - 10}
                textAnchor={xAt(annotationIndex) > padLeft + plotWidth - 150 ? "end" : "start"}
                className="fill-stone-300 text-[12px] font-medium"
              >
                3 Enterprise accounts joined
              </text>
            </g>
          )}

          {labelIndexes.map((index) => {
            const anchor = index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle";
            const x =
              anchor === "start"
                ? padLeft
                : anchor === "end"
                  ? padLeft + plotWidth
                  : xAt(index);
            return (
              <text
                key={index}
                x={x}
                y={height - 8}
                textAnchor={anchor}
                className="fill-stone-400 font-mono text-[11px] tabular-nums"
              >
                {fmtDateShort(rows[index].date)}
              </text>
            );
          })}

          {hovered && hover !== null && (
            <g>
              {mode === "revenue" ? (
                <>
                  <line
                    x1={xAt(hover)}
                    x2={xAt(hover)}
                    y1={padTop}
                    y2={padTop + plotHeight}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={1}
                  />
                  <circle cx={xAt(hover)} cy={yAt(values[hover])} r={9} fill="#fbbf24" opacity={0.18} />
                  <circle
                    cx={xAt(hover)}
                    cy={yAt(values[hover])}
                    r={4}
                    fill="#fbbf24"
                    stroke="#0c0a09"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <rect
                  x={padLeft + band * hover}
                  y={padTop}
                  width={band}
                  height={plotHeight}
                  fill="#ffffff"
                  opacity={0.04}
                />
              )}
            </g>
          )}

          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-white/[0.12] bg-stone-900/90 px-3 py-2 text-[12px] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] backdrop-blur-md"
          style={{
            left: Math.min(Math.max(xAt(hover), 70), Math.max(width - 70, 70)),
            top: yAt(values[hover]) - 12,
          }}
        >
          <p className="font-mono text-[13px] font-medium tabular-nums tracking-tight text-stone-50">
            {mode === "revenue" ? fmtMoney(hovered.revenue) : `${newAccounts(hovered)} accounts`}
          </p>
          <p className="text-stone-400">{fmtDate(hovered.date)}</p>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
 * 5. Header
 * ========================================================================== */

export function BrandMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-stone-900 ring-1 ring-inset ring-white/[0.08]">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path
          d="M2.75 13.25 6.4 7.1l2.6 3.35L12.6 4.9l2.65 3.1"
          stroke="#fbbf24"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15.25" cy="8" r="1.6" fill="#fbbf24" />
      </svg>
    </span>
  );
}

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "usage", label: "Usage", icon: Activity },
] as const;

function Sidebar({ view, onNavigate, session }: { view: View; onNavigate: (view: View) => void; session: Session }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-white/[0.08] bg-stone-950/60 px-3 py-4 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <BrandMark />
        <span className="text-[15px] font-medium tracking-tight text-stone-50">Lumen</span>
      </div>

      <nav aria-label="Primary" className="mt-6 flex flex-col gap-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = view === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => onNavigate(id)}
              className={cx(
                FOCUS,
                "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                on
                  ? "bg-white/[0.06] text-stone-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "text-stone-400 hover:bg-white/[0.03] hover:text-stone-100",
              )}
            >
              <Icon className={cx("h-4 w-4", on ? "text-amber-300" : "text-stone-400")} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <p className="px-2 pb-2 text-[12px] text-stone-400">
          {session.mode === "cloud" ? "Your workspace · synced" : "Demo environment · sample data"}
        </p>
        <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-300/30 to-amber-500/10 text-[12px] font-medium text-amber-100 ring-1 ring-inset ring-white/[0.12]">
            {initials(session.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-stone-100">{session.name}</p>
            <p className="truncate text-[12px] text-stone-400">{session.mode === "cloud" ? session.email : "Guest session"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Menu({
  open,
  onClose,
  children,
  align = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cx(
        "absolute z-40 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-white/[0.08] bg-stone-900 p-1 shadow-xl shadow-black/50",
        align === "right" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(FOCUS, "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-50")}
    >
      {icon}
      {children}
    </button>
  );
}

function TopBar({
  workspace,
  onWorkspace,
  range,
  onRange,
  onSearch,
  onNewCustomer,
  showRange = true,
  session,
  onSignOut,
  onResetDemo,
}: {
  session: Session;
  onSignOut: () => void;
  onResetDemo: () => void;
  showRange?: boolean;
  workspace: (typeof WORKSPACES)[number];
  onWorkspace: (workspace: (typeof WORKSPACES)[number]) => void;
  range: (typeof RANGES)[number];
  onRange: (range: (typeof RANGES)[number]) => void;
  onSearch: () => void;
  onNewCustomer: () => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-stone-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5 lg:hidden">
          <BrandMark />
          <span className="hidden text-[15px] font-medium tracking-tight text-stone-50 sm:block">
            Lumen
          </span>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setWorkspaceOpen((open) => !open)}
            aria-expanded={workspaceOpen}
            aria-haspopup="menu"
            className={cx(FOCUS, "flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] text-stone-300 transition-colors hover:bg-stone-900 hover:text-stone-100")}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="hidden max-w-[190px] truncate xl:block">{workspace.name}</span>
            <span className="xl:hidden">{workspace.env}</span>
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>
          <Menu open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} align="left">
            {WORKSPACES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onWorkspace(item);
                  setWorkspaceOpen(false);
                }}
                className={cx(FOCUS, "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-50")}
              >
                <span
                  className={cx(
                    "h-1.5 w-1.5 rounded-full",
                    item.env === "Production" ? "bg-emerald-400" : "bg-stone-600",
                  )}
                  aria-hidden
                />
                <span className="flex-1 truncate">{item.name}</span>
                {item.id === workspace.id && <Check className="h-3.5 w-3.5 text-amber-400" />}
              </button>
            ))}
          </Menu>
        </div>

        <button
          type="button"
          onClick={onSearch}
          className={cx(FOCUS, "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-900 hover:text-stone-100 lg:h-9 lg:w-[240px] lg:justify-start lg:gap-2.5 lg:border lg:border-white/[0.08] lg:bg-stone-900/60 lg:px-3 xl:w-[300px]")}
        >
          <Search className="h-4 w-4" />
          <span className="hidden flex-1 truncate text-left text-[13px] text-stone-400 lg:block xl:hidden">
            Search…
          </span>
          <span className="hidden flex-1 truncate text-left text-[13px] text-stone-400 xl:block">
            Search customers, invoices…
          </span>
          <kbd className="hidden rounded border border-white/[0.12] bg-stone-800/80 px-1.5 py-0.5 font-mono text-[12px] text-stone-400 lg:block">
            ⌘K
          </kbd>
        </button>

        <div className={cx("relative hidden shrink-0", showRange && "sm:block")}>
          <button
            type="button"
            onClick={() => setRangeOpen((open) => !open)}
            aria-expanded={rangeOpen}
            aria-haspopup="menu"
            className={cx(FOCUS, "flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-stone-900/60 px-3 text-[13px] text-stone-300 transition-colors hover:border-white/[0.12] hover:text-stone-100")}
          >
            <CalendarDays className="h-4 w-4 text-stone-400" />
            {range.label}
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>
          <Menu open={rangeOpen} onClose={() => setRangeOpen(false)} align="right">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onRange(item);
                  setRangeOpen(false);
                }}
                className={cx(FOCUS, "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-50")}
              >
                <span className="flex-1">{item.label}</span>
                {item.id === range.id && <Check className="h-3.5 w-3.5 text-amber-400" />}
              </button>
            ))}
          </Menu>
        </div>

        <button
          type="button"
          onClick={onNewCustomer}
          className={cx(FOCUS, "flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-300 to-amber-400 px-3 text-[13px] font-semibold text-stone-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_0_0_1px_rgba(251,191,36,0.5),0_4px_14px_-4px_rgba(251,191,36,0.55)] transition-[filter,transform] hover:brightness-110 active:translate-y-px active:brightness-95")}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden xl:inline">New Customer</span>
          <span className="xl:hidden">New</span>
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`Account: ${session.name}`}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((open) => !open)}
            className={cx(FOCUS, "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-800 text-[12px] font-medium text-stone-200 transition-colors hover:bg-stone-700")}
          >
            {initials(session.name)}
          </button>
          <Menu open={accountOpen} onClose={() => setAccountOpen(false)} align="right">
            <div className="border-b border-white/[0.06] px-2.5 pb-2.5 pt-2">
              <p className="truncate text-[13px] text-stone-100">{session.name}</p>
              <p className="truncate text-[12px] text-stone-400">
                {session.mode === "cloud" ? session.email : "Demo · saved in this browser"}
              </p>
            </div>
            {session.mode === "demo" && <MenuItem onClick={() => { setAccountOpen(false); onResetDemo(); }}>Restore sample data</MenuItem>}
            {(session.mode === "cloud" || cloudEnabled) && (
              <MenuItem onClick={() => { setAccountOpen(false); onSignOut(); }}>
                {session.mode === "cloud" ? "Sign out" : "Sign in or create account"}
              </MenuItem>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}

function StripMetric({
  label,
  value,
  unit,
  delta,
  detail,
  series,
  tone,
  badge,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta: ReactNode;
  detail: string;
  series: number[];
  tone: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col p-5 sm:p-6">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="text-[13px] font-medium tracking-tight text-stone-400">{label}</p>
        {badge}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[28px] font-medium leading-8 tabular-nums tracking-[-0.04em] text-stone-50">
            {value}
          </span>
          {unit && <span className="text-[12px] font-medium tracking-wide text-stone-400">{unit}</span>}
        </p>
        <Sparkline values={series} className={tone} />
      </div>
      <div className="mt-3">{delta}</div>
      <p className="mt-3 text-[13px] leading-tight text-stone-400">{detail}</p>
    </div>
  );
}

/* ==========================================================================
 * 6. KPI cards
 * ========================================================================== */

function KpiCard({
  label,
  value,
  unit,
  delta,
  detail,
  badge,
  index = 0,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta: ReactNode;
  detail: string;
  badge?: ReactNode;
  index?: number;
  children?: ReactNode;
}) {
  return (
    <Panel
      className="animate-rise group flex flex-col p-4 sm:p-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="text-[13px] font-medium leading-5 tracking-tight text-stone-400">{label}</p>
        <span className="hidden shrink-0 sm:contents">{badge}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
      <p className="flex items-baseline gap-2">
        <span
          className={cx(
            "font-mono font-medium tabular-nums tracking-[-0.04em] text-stone-50",
            "text-[22px] leading-8 xl:text-[28px]",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[12px] font-medium tracking-wide text-stone-400">{unit}</span>}
      </p>
      {children}
      </div>
      <div className="mt-3">{delta}</div>
      <p className="mt-auto border-t border-white/[0.05] pt-3 text-[13px] leading-tight text-stone-400">{detail}</p>
    </Panel>
  );
}

/* ==========================================================================
 * 7. Views: customers and usage
 * ========================================================================== */

type View = "overview" | "customers" | "usage";
const VIEW_HASH: Record<View, string> = { overview: "#/", customers: "#/customers", usage: "#/usage" };
const viewFromHash = (hash: string): View =>
  hash.startsWith("#/customers") ? "customers" : hash.startsWith("#/usage") ? "usage" : "overview";


function CustomerStatusPill({ status }: { status: CustomerStatus }) {
  const map: Record<CustomerStatus, { label: string; className: string; icon: ReactNode }> = {
    active: {
      label: "Active",
      className: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25 shadow-[0_0_12px_-2px_rgba(52,211,153,0.35)]",
      icon: <Check className="h-3 w-3" />,
    },
    trialing: {
      label: "Trialing",
      className: "bg-cyan-500/10 text-cyan-300 ring-cyan-400/25",
      icon: <Clock className="h-3 w-3" />,
    },
    past_due: {
      label: "Past due",
      className: "bg-rose-500/10 text-rose-300 ring-rose-400/25 shadow-[0_0_12px_-2px_rgba(251,113,133,0.35)]",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    churned: {
      label: "Churned",
      className: "bg-white/[0.05] text-stone-300 ring-white/[0.12]",
      icon: <X className="h-3 w-3" />,
    },
  };
  const item = map[status];
  return (
    <span
      className={cx(
        "inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none ring-1 ring-inset",
        item.className,
      )}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

function TokenMeter({ customer }: { customer: Customer }) {
  const quota = TOKEN_QUOTA[customer.plan];
  if (customer.tokens === 0) return <span className="text-[13px] text-stone-400">—</span>;
  if (quota === null) {
    return (
      <span className="font-mono text-[13px] tabular-nums text-stone-300">
        {fmtTokens(customer.tokens)} <span className="text-stone-400">metered</span>
      </span>
    );
  }
  const pct = Math.min(100, (customer.tokens / quota) * 100);
  const hot = pct >= 80;
  return (
    <div className="flex items-center gap-2.5">
      <div
        role="meter"
        aria-label={`${customer.name} token usage`}
        aria-valuemin={0}
        aria-valuemax={quota}
        aria-valuenow={Math.min(customer.tokens, quota)}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]"
      >
        <div
          className={cx(
            "h-full rounded-full bg-gradient-to-r",
            hot ? "from-rose-500 to-rose-300" : PLAN_SHADE[customer.plan],
          )}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      <span className="font-mono text-[13px] tabular-nums text-stone-300">{Math.round(pct)}%</span>
    </div>
  );
}

function CustomerDrawer({
  customer,
  onClose,
  onCopy,
  onViewCharges,
  onStatus,
  onDelete,
}: {
  customer: Customer;
  onClose: () => void;
  onCopy: () => void;
  onViewCharges: (() => void) | null;
  onStatus: (status: CustomerStatus) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const quota = TOKEN_QUOTA[customer.plan];
  const pct = quota ? Math.min(100, (customer.tokens / quota) * 100) : 0;
  const mrr = customerMrr(customer);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close customer details"
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade absolute inset-0 cursor-default bg-stone-950/70 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${customer.name} details`}
        className="animate-slide relative flex h-full w-full max-w-[440px] flex-col border-l border-white/[0.08] bg-stone-900 bg-[radial-gradient(120%_40%_at_50%_-10%,rgba(255,255,255,0.05),transparent_60%)] shadow-[-24px_0_48px_-12px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={customer.name} tint={customer.tint} />
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-medium tracking-tight text-stone-50">{customer.name}</h2>
              <p className="truncate text-[13px] text-stone-400">{customer.email}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx(FOCUS, "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-white/[0.06] hover:text-stone-100")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="flex items-center gap-2">
            <CustomerStatusPill status={customer.status} />
            <span className="text-[13px] text-stone-400">Last active {fmtRelative(customer.lastActive).toLowerCase()}</span>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            {[
              ["Plan", PLAN_META[customer.plan].label],
              ["MRR", mrr ? fmtMoney0(mrr) : "—"],
              ["Seats", fmtCount(customer.seats)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <dt className="text-[12px] text-stone-400">{label}</dt>
                <dd className="mt-1 font-mono text-[16px] font-medium tabular-nums tracking-tight text-stone-50">{value}</dd>
              </div>
            ))}
          </dl>

          <section>
            <h3 className="text-[13px] font-medium text-stone-200">Token usage this period</h3>
            {quota ? (
              <>
                <div
                  role="meter"
                  aria-label="Token usage"
                  aria-valuemin={0}
                  aria-valuemax={quota}
                  aria-valuenow={Math.min(customer.tokens, quota)}
                  className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]"
                >
                  <div
                    className={cx("h-full rounded-full bg-gradient-to-r", pct >= 80 ? "from-rose-500 to-rose-300" : PLAN_SHADE[customer.plan])}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <p className="mt-2 flex justify-between font-mono text-[13px] tabular-nums text-stone-400">
                  <span>{fmtTokens(customer.tokens)} used</span>
                  <span>{fmtTokens(quota)} included</span>
                </p>
              </>
            ) : (
              <p className="mt-2 font-mono text-[13px] tabular-nums text-stone-300">
                {fmtTokens(customer.tokens)} <span className="text-stone-400">metered, no cap</span>
              </p>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-stone-200">Account</h3>
            <dl className="mt-2.5 divide-y divide-white/[0.05] rounded-lg border border-white/[0.08] text-[13px]">
              {[
                ["Customer since", fmtDate(customer.joined)],
                ["Location", customer.location],
                ["Billing email", customer.email],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-3 py-2.5">
                  <dt className="text-stone-400">{k}</dt>
                  <dd className="truncate text-stone-200">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-stone-200">Recent invoices</h3>
            {customer.invoices.length ? (
              <ul className="mt-2.5 divide-y divide-white/[0.05] rounded-lg border border-white/[0.08]">
                {customer.invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="font-mono text-[12px] tabular-nums text-stone-400">{invoice.id}</span>
                    <span className="flex-1 text-[13px] text-stone-300">{fmtDate(invoice.date)}</span>
                    <span
                      className={cx(
                        "font-mono text-[13px] tabular-nums",
                        invoice.amount < 0 ? "text-rose-300" : "text-stone-100",
                      )}
                    >
                      {invoice.amount < 0 ? `−${fmtMoney(Math.abs(invoice.amount))}` : fmtMoney(invoice.amount)}
                    </span>
                    <StatusPill status={invoice.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 rounded-lg border border-dashed border-white/[0.12] px-3 py-4 text-[13px] text-stone-400">
                No invoices yet. The first charge is created when the trial ends.
              </p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] px-4 pb-3 pt-4">
          <label className="flex items-center gap-2 text-[13px] text-stone-400">
            Status
            <select
              value={customer.status}
              onChange={(event) => onStatus(event.target.value as CustomerStatus)}
              className={cx(FOCUS, "h-9 rounded-lg border border-white/[0.08] bg-stone-950 px-2 text-[13px] text-stone-200")}
            >
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="churned">Churned</option>
            </select>
          </label>
          <span className="flex-1" />
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={onDelete}
                className={cx(FOCUS, "inline-flex h-9 items-center rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 text-[13px] text-rose-200 transition-colors hover:bg-rose-400/20")}
              >
                Delete {customer.name}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={cx(FOCUS, "inline-flex h-9 items-center rounded-lg px-3 text-[13px] text-stone-300 transition-colors hover:bg-white/[0.07]")}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={cx(FOCUS, "inline-flex h-9 items-center rounded-lg px-3 text-[13px] text-stone-400 transition-colors hover:bg-rose-400/10 hover:text-rose-200")}
            >
              Delete…
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onCopy}
            className={cx(FOCUS, "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-stone-200 transition-colors hover:bg-white/[0.07]")}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy email
          </button>
          {onViewCharges && (
            <button
              type="button"
              onClick={onViewCharges}
              className={cx(FOCUS, "inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-300 to-amber-400 px-3.5 text-[13px] font-semibold text-stone-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_0_0_1px_rgba(251,191,36,0.5),0_4px_14px_-4px_rgba(251,191,36,0.55)] transition-[filter,transform] hover:brightness-110 active:translate-y-px")}
            >
              <CreditCard className="h-3.5 w-3.5" />
              View charges
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

type SortKey = "name" | "mrr" | "tokens" | "lastActive";

function CustomersView({
  customers,
  hasCharges,
  onViewCharges,
  onCopy,
  onNewCustomer,
  onStatus,
  onDelete,
  state,
  onRetry,
}: {
  onStatus: (id: string, status: CustomerStatus) => void;
  onDelete: (id: string) => void;
  state: "loading" | "ready" | "error";
  onRetry: () => void;
  customers: Customer[];
  hasCharges: (name: string) => boolean;
  onViewCharges: (name: string) => void;
  onCopy: (email: string) => void;
  onNewCustomer: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomerStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "mrr", dir: -1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { all: customers.length, active: 0, trialing: 0, past_due: 0, churned: 0 };
    customers.forEach((x) => (c[x.status] += 1));
    return c;
  }, [customers]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = customers.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)),
    );
    const value = (c: Customer) =>
      sort.key === "name" ? c.name.toLowerCase() : sort.key === "mrr" ? customerMrr(c) : sort.key === "tokens" ? c.tokens : c.lastActive;
    return [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      return (av < bv ? -1 : av > bv ? 1 : a.name.localeCompare(b.name)) * sort.dir;
    });
  }, [customers, query, filter, sort]);

  const selected = customers.find((c) => c.id === selectedId) ?? null;
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  const SortHead = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th
      scope="col"
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={cx("px-3 py-2.5 font-medium", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cx(
          FOCUS,
          "-mx-2 inline-flex h-8 items-center gap-1 rounded px-2 uppercase tracking-[0.04em] transition-colors hover:text-stone-100",
          sort.key === k && "text-stone-100",
        )}
      >
        {label}
        <ChevronDown
          className={cx(
            "h-3 w-3 transition-transform",
            sort.key === k ? "opacity-100" : "opacity-0",
            sort.key === k && sort.dir === 1 && "rotate-180",
          )}
        />
      </button>
    </th>
  );

  const atRisk = counts.past_due;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] font-normal leading-tight tracking-[-0.01em] text-stone-50">Customers</h1>
          <p className="mt-1.5 text-[14px] text-stone-400">
            The {customers.length} largest and most recently active of {fmtCount(PAID)} paid accounts
            {atRisk > 0 && (
              <>
                {" "}· <span className="text-rose-300">{atRisk} past due</span>
              </>
            )}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={onNewCustomer}
          className={cx(FOCUS, "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-stone-200 transition-colors hover:bg-white/[0.07]")}
        >
          <Plus className="h-4 w-4" />
          Add customer
        </button>
      </div>

      <Panel className="animate-rise mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <label className="relative block w-full sm:w-[280px]">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name or email"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/30 pl-9 pr-3 text-[13px] text-stone-100 outline-none transition-colors placeholder:text-stone-400 focus:border-amber-400/60"
            />
          </label>
          <div role="group" aria-label="Filter by status" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-black/30 p-0.5 ring-1 ring-inset ring-white/[0.08]">
            {(["all", "active", "trialing", "past_due", "churned"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cx(
                  FOCUS,
                  "h-9 shrink-0 whitespace-nowrap rounded-[6px] px-3 text-[13px] transition-colors sm:h-8",
                  filter === id
                    ? "bg-white/[0.08] text-stone-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    : "text-stone-400 hover:text-stone-200",
                )}
              >
                {id === "all" ? "All" : id === "past_due" ? "Past due" : id[0].toUpperCase() + id.slice(1)}
                <span className="ml-1.5 font-mono text-[12px] tabular-nums text-stone-400">{counts[id]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <ul className="sm:hidden">
          {list.map((c) => (
            <li key={c.id} className="border-t border-white/[0.05]">
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cx(FOCUS, "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]")}
              >
                <Avatar name={c.name} tint={c.tint} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-stone-100">{c.name}</p>
                  <p className="mt-1 flex items-center gap-2 text-[13px] text-stone-400">
                    <CustomerStatusPill status={c.status} />
                    <span>{PLAN_META[c.plan].label}</span>
                  </p>
                </div>
                <span className="font-mono text-[13px] tabular-nums text-stone-100">
                  {customerMrr(c) ? fmtMoney0(customerMrr(c)) : "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Tablet and desktop */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-y border-white/[0.08] bg-white/[0.02] text-[12px] uppercase tracking-[0.04em] text-stone-400">
                <SortHead k="name" label="Customer" />
                <th scope="col" className="px-3 py-2.5 font-medium">Plan</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <SortHead k="mrr" label="MRR" align="right" />
                <SortHead k="tokens" label="Token usage" />
                <SortHead k="lastActive" label="Last active" align="right" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="cursor-pointer border-b border-white/[0.05] transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cx(FOCUS, "flex items-center gap-3 rounded text-left")}
                    >
                      <Avatar name={c.name} tint={c.tint} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-stone-100">{c.name}</span>
                        <span className="block truncate text-[13px] text-stone-400">{c.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-stone-300">{PLAN_META[c.plan].label}</td>
                  <td className="px-3 py-3">
                    <CustomerStatusPill status={c.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-[13px] tabular-nums text-stone-100">
                    {customerMrr(c) ? fmtMoney0(customerMrr(c)) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <TokenMeter customer={c} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] text-stone-400">
                    {fmtRelative(c.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {state === "loading" && (
          <p role="status" className="border-t border-white/[0.08] px-5 py-12 text-center text-[14px] text-stone-400">
            Loading customers…
          </p>
        )}
        {state === "error" && (
          <div role="alert" className="border-t border-white/[0.08] px-5 py-12 text-center">
            <p className="text-[14px] text-stone-200">Couldn’t load your customers.</p>
            <p className="mt-1 text-[13px] text-stone-400">Check your connection and try again.</p>
            <button
              type="button"
              onClick={onRetry}
              className={cx(FOCUS, "mt-3 inline-flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-stone-200 transition-colors hover:bg-white/[0.07]")}
            >
              Try again
            </button>
          </div>
        )}
        {state === "ready" && list.length === 0 && (
          <div className="border-t border-white/[0.08] px-5 py-12 text-center">
            <p className="text-[14px] text-stone-200">
              {customers.length === 0 ? "No customers yet." : "No customers match these filters."}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className={cx(FOCUS, "mt-3 inline-flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-stone-200 transition-colors hover:bg-white/[0.07]")}
            >
              Clear filters
            </button>
          </div>
        )}
      </Panel>

      {selected && (
        <CustomerDrawer
          customer={selected}
          onClose={closeDrawer}
          onCopy={() => onCopy(selected.email)}
          onViewCharges={hasCharges(selected.name) ? () => onViewCharges(selected.name) : null}
          onStatus={(status) => onStatus(selected.id, status)}
          onDelete={() => {
            onDelete(selected.id);
            closeDrawer();
          }}
        />
      )}
    </>
  );
}

/* ---- Usage ---------------------------------------------------------------- */

/** Deterministic pseudo-noise so the demo data is identical on every load. */
const noise = (i: number, seed: number) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const USAGE = DAYS.slice(DAYS.length - 60).map((day, i) => {
  const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
  const weekday = dow === 0 || dow === 6 ? 0.62 : 1;
  const tokensM = (120 + i * 1.4) * weekday * (0.94 + noise(i, 1) * 0.12);
  const tokensPerRequest = 148 + noise(i, 2) * 14;
  return {
    date: day.date,
    tokensM,
    requestsM: tokensM / tokensPerRequest,
    p95: 436 - i * 0.9 + noise(i, 3) * 38,
    errors: 0.3 + noise(i, 4) * 0.14 - i * 0.0009,
  };
});
const USAGE_NOW = USAGE.slice(30);
const USAGE_PRIOR = USAGE.slice(0, 30);
const mean = (rows: typeof USAGE, pick: (r: (typeof USAGE)[number]) => number) => sum(rows, pick) / rows.length;
const pctChange = (now: number, before: number) => ((now - before) / before) * 100;

const HEAT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT = HEAT_DAYS.map((_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const work = d < 5 ? 1 : 0.42;
    const peak = Math.exp(-Math.pow((h - 14) / 5.2, 2));
    return work * (0.07 + 0.93 * peak) * (0.88 + noise(d * 24 + h, 5) * 0.24);
  }),
);
const HEAT_MAX = Math.max(...HEAT.flat());
const HEAT_REQUESTS_PER_UNIT = 96; // thousand requests per hour at the busiest cell

const MODELS = [
  { name: "Lumen Flash", share: 0.58, p95: 214, price: 0.25 },
  { name: "Lumen Pro", share: 0.33, p95: 468, price: 1.8 },
  { name: "Lumen Ultra", share: 0.09, p95: 1184, price: 9 },
];

function Heatmap() {
  let busiest = { d: 0, h: 0, v: 0 };
  HEAT.forEach((row, d) => row.forEach((v, h) => v > busiest.v && (busiest = { d, h, v })));
  return (
    <div>
      <div
        role="img"
        aria-label={`Requests by weekday and hour. Busiest: ${HEAT_DAYS[busiest.d]} at ${String(busiest.h).padStart(2, "0")}:00, about ${Math.round((busiest.v / HEAT_MAX) * HEAT_REQUESTS_PER_UNIT)} thousand requests.`}
        className="grid grid-cols-[32px_1fr] gap-x-2 gap-y-1"
      >
        {HEAT.map((row, d) => (
          <div key={HEAT_DAYS[d]} className="contents">
            <span className="self-center text-[12px] text-stone-400">{HEAT_DAYS[d]}</span>
            <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
              {row.map((v, h) => {
                const t = v / HEAT_MAX;
                return (
                  <span
                    key={h}
                    title={`${HEAT_DAYS[d]} ${String(h).padStart(2, "0")}:00 · ${Math.round(t * HEAT_REQUESTS_PER_UNIT)}k requests`}
                    className="h-5 rounded-[3px] ring-1 ring-inset ring-white/[0.04] transition-transform hover:scale-125 hover:ring-white/30 sm:h-6"
                    style={{ backgroundColor: `rgba(251,191,36,${(0.05 + 0.9 * Math.pow(t, 1.15)).toFixed(3)})` }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <span />
        <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-stone-400">
          {["00", "06", "12", "18", "23"].map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-[12px] text-stone-400">
        Fewer
        {[0.08, 0.28, 0.5, 0.75, 0.95].map((a) => (
          <span key={a} className="h-3 w-5 rounded-[3px]" style={{ backgroundColor: `rgba(251,191,36,${a})` }} />
        ))}
        More requests
      </div>
    </div>
  );
}

function UsageView() {
  const tokens = sum(USAGE_NOW, (r) => r.tokensM);
  const tokensPrior = sum(USAGE_PRIOR, (r) => r.tokensM);
  const requests = sum(USAGE_NOW, (r) => r.requestsM);
  const requestsPrior = sum(USAGE_PRIOR, (r) => r.requestsM);
  const p95 = mean(USAGE_NOW, (r) => r.p95);
  const p95Prior = mean(USAGE_PRIOR, (r) => r.p95);
  const errors = mean(USAGE_NOW, (r) => r.errors);
  const errorsPrior = mean(USAGE_PRIOR, (r) => r.errors);

  return (
    <>
      <div>
        <h1 className="font-display text-[34px] font-normal leading-tight tracking-[-0.01em] text-stone-50">Usage</h1>
        <p className="mt-1.5 text-[14px] text-stone-400">
          Inference traffic across every workspace in the last 30 days, {fmtPct(pctChange(tokens, tokensPrior))} more tokens than the 30 before.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Tokens served"
          value={<CountUp to={tokens / 1000} format={(n) => `${n.toFixed(2)}B`} />}
          delta={<Delta value={fmtPct(pctChange(tokens, tokensPrior))} label="vs prior 30 days" direction="up" good />}
          detail={`${fmtCount(Math.round(tokensPrior / 1000 * 100) / 100)}B in the prior 30 days`}
        >
          <Sparkline values={USAGE_NOW.map((r) => r.tokensM)} className="hidden text-amber-400 sm:block" />
        </KpiCard>
        <KpiCard
          index={1}
          label="Requests"
          value={<CountUp to={requests} format={(n) => `${n.toFixed(1)}M`} delay={60} />}
          delta={<Delta value={fmtPct(pctChange(requests, requestsPrior))} label="vs prior 30 days" direction="up" good />}
          detail={`${Math.round(tokens / requests)} tokens per request on average`}
        >
          <Sparkline values={USAGE_NOW.map((r) => r.requestsM)} className="hidden text-amber-400 sm:block" />
        </KpiCard>
        <KpiCard
          index={2}
          label="p95 latency"
          value={<CountUp to={p95} format={(n) => `${Math.round(n)}`} delay={120} />}
          unit="ms"
          delta={<Delta value={fmtPct(Math.abs(pctChange(p95, p95Prior)))} label="vs prior 30 days" direction="down" good />}
          detail={`${Math.round(p95Prior)} ms in the prior 30 days`}
        >
          <Sparkline values={USAGE_NOW.map((r) => r.p95)} className="hidden text-emerald-300 sm:block" />
        </KpiCard>
        <KpiCard
          index={3}
          label="Error rate"
          value={<CountUp to={errors} format={(n) => fmtPct(n, 2)} delay={180} />}
          delta={<Delta value={Math.abs(errors - errorsPrior).toFixed(2)} suffix=" pts" label="vs prior 30 days" direction="down" good />}
          detail="5xx responses over all requests"
          badge={
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-500/10 px-2 text-[12px] font-medium leading-none text-emerald-300 ring-1 ring-inset ring-emerald-400/25 shadow-[0_0_12px_-2px_rgba(52,211,153,0.35)]">
              <Check className="h-3 w-3" />
              Within SLO
            </span>
          }
        >
          <Sparkline values={USAGE_NOW.map((r) => r.errors)} className="hidden text-emerald-300 sm:block" />
        </KpiCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="animate-rise p-5" style={{ animationDelay: "240ms" }}>
          <h2 className="text-[15px] font-medium tracking-tight text-stone-50">Traffic by hour</h2>
          <p className="mt-1 text-[13px] text-stone-400">Requests per hour, UTC. Weekday demand peaks mid-afternoon.</p>
          <div className="mt-5">
            <Heatmap />
          </div>
        </Panel>

        <Panel className="animate-rise p-5" style={{ animationDelay: "300ms" }}>
          <h2 className="text-[15px] font-medium tracking-tight text-stone-50">Models</h2>
          <p className="mt-1 text-[13px] text-stone-400">Share of tokens served, with latency and list price.</p>
          <ul className="mt-5 space-y-5">
            {MODELS.map((model, i) => (
              <li key={model.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-stone-200">{model.name}</span>
                  <span className="font-mono text-[13px] tabular-nums text-stone-400">${model.price.toFixed(2)} / 1M</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cx("animate-grow h-1.5 rounded-full bg-gradient-to-r", PLAN_SHADE[(["starter", "pro", "enterprise"] as PlanId[])[i]])}
                    style={{ width: `${model.share * 88}%` }}
                  />
                  <span className="font-mono text-[13px] tabular-nums text-stone-300">{fmtPct(model.share * 100, 0)}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-stone-400">
                  <span className="font-mono tabular-nums">{((tokens * model.share) / 1000).toFixed(2)}B</span> tokens ·{" "}
                  <span className="font-mono tabular-nums">{model.p95} ms</span> p95
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function MobileNav({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-white/[0.08] bg-stone-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      {NAV.map(({ id, label, icon: Icon }) => {
        const on = view === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => onNavigate(id)}
            className={cx(
              FOCUS,
              "flex h-14 flex-col items-center justify-center gap-1 text-[12px] font-medium transition-colors",
              on ? "text-stone-50" : "text-stone-400 hover:text-stone-200",
            )}
          >
            <Icon className={cx("h-[18px] w-[18px]", on && "text-amber-300")} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/* ==========================================================================
 * 7. Dashboard
 * ========================================================================== */

export default function Dashboard({
  session,
  repo,
  onSignOut,
}: {
  session: Session;
  repo: CustomerRepo;
  onSignOut: () => void | Promise<void>;
}) {
  const [workspace, setWorkspace] = useState(WORKSPACES[0]);
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [mode, setMode] = useState<"revenue" | "accounts">("revenue");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersState, setCustomersState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const onHash = () => setView(viewFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((next: View) => {
    window.location.hash = VIEW_HASH[next];
    setView(next);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const names: Record<View, string> = { overview: "Operations", customers: "Customers", usage: "Usage" };
    document.title = `Lumen · ${names[view]}`;
  }, [view]);
  const [updatedAt, setUpdatedAt] = useState("09:14");
  const [refreshing, setRefreshing] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const loadCustomers = useCallback(() => {
    setCustomersState("loading");
    repo
      .list()
      .then((list) => {
        setCustomers(list);
        setCustomersState("ready");
      })
      .catch(() => setCustomersState("error"));
  }, [repo]);
  useEffect(loadCustomers, [loadCustomers]);

  /** Charges: the sample ledger plus the first charge of every customer added in this workspace. */
  const rows = useMemo<Transaction[]>(() => {
    const seeded = new Set(CUSTOMER_SEED.map((c) => c.name));
    const added = customers
      .filter((c) => !seeded.has(c.name) && c.invoices.length > 0)
      .map<Transaction>((c) => ({
        id: c.invoices[0].id,
        customer: c.name,
        email: c.email,
        plan: c.plan,
        amount: c.invoices[0].amount,
        method: "Visa ···· 4242",
        status: c.invoices[0].status,
        date: c.invoices[0].date,
        tint: c.tint,
      }));
    return [...added, ...TRANSACTIONS];
  }, [customers]);

  /** Optimistic write: update the screen now, roll back and say so if the save fails. */
  const mutate = useCallback(
    async (apply: (list: Customer[]) => Customer[], save: () => Promise<void>, failure: string) => {
      let previous: Customer[] = [];
      setCustomers((current) => {
        previous = current;
        return apply(current);
      });
      try {
        await save();
      } catch {
        setCustomers(previous);
        notify(failure);
      }
    },
    [notify],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chartRows = useMemo(() => windowOf(range.days), [range]);
  const windowTotal = useMemo(() => sum(chartRows, (row) => row.revenue), [chartRows]);
  const windowFrom = chartRows[0].date;
  const windowTo = chartRows[chartRows.length - 1].date;

  const visibleRows = useMemo(() => {
    const inRange = rows.filter(
      (row) => row.date >= windowFrom && (statusFilter === "all" || row.status === statusFilter),
    );
    return customerFilter ? inRange.filter((row) => row.customer === customerFilter) : inRange;
  }, [rows, windowFrom, customerFilter, statusFilter]);

  const chargeCount = useMemo(() => chargesIn(range.days), [range]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      setUpdatedAt(
        new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      );
      notify("Dashboard refreshed");
    }, 600);
  };

  const addCustomer = (customer: Transaction) => {
    const created: Customer = {
      id: newId(),
      name: customer.customer,
      email: customer.email,
      plan: customer.plan,
      status: "trialing",
      seats: 1,
      tokens: 0,
      joined: TODAY,
      lastActive: TODAY,
      location: "—",
      tint: customer.tint,
      invoices: [{ id: customer.id, date: customer.date, amount: customer.amount, status: customer.status }],
    };
    void mutate((current) => [created, ...current], () => repo.add(created), `Couldn’t save ${created.name}`);
    setNewCustomerOpen(false);
    notify(`${customer.customer} added — first charge pending`);
  };

  const setCustomerStatus = (id: string, status: CustomerStatus) =>
    void mutate(
      (current) => current.map((c) => (c.id === id ? { ...c, status } : c)),
      () => repo.update(id, { status }),
      "Couldn’t update the customer",
    );

  const removeCustomer = (id: string) => {
    const name = customers.find((c) => c.id === id)?.name ?? "Customer";
    void mutate(
      (current) => current.filter((c) => c.id !== id),
      () => repo.remove(id),
      `Couldn’t delete ${name}`,
    );
    notify(`${name} deleted`);
  };

  const resetDemo = () => {
    if (repo instanceof LocalRepo) repo.clear();
    loadCustomers();
    notify("Sample data restored");
  };

  const viewCharges = (name: string) => {
    setStatusFilter("all");
    setCustomerFilter(name);
    navigate("overview");
    window.setTimeout(
      () => document.getElementById("transactions")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };

  const exportCsv = () => {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ["date", "customer", "email", "plan", "amount", "payment method", "status"];
    const lines = visibleRows.map((row) =>
      [row.date, row.customer, row.email, row.plan, row.amount.toFixed(2), row.method, row.status]
        .map(cell)
        .join(","),
    );
    const blob = new Blob([[header.map(cell).join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lumen-charges-${range.id}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen bg-stone-950 bg-[radial-gradient(55%_45%_at_30%_-12%,rgba(251,191,36,0.10),transparent_70%),radial-gradient(40%_30%_at_100%_0%,rgba(244,114,76,0.05),transparent_70%)] bg-no-repeat text-stone-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px] [-webkit-mask-image:linear-gradient(to_bottom,black,transparent_85%)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <Sidebar view={view} onNavigate={navigate} session={session} />
      <MobileNav view={view} onNavigate={navigate} />
      <div className="lg:pl-[232px]">
      <TopBar
        workspace={workspace}
        onWorkspace={setWorkspace}
        range={range}
        onRange={setRange}
        onSearch={() => setPaletteOpen(true)}
        onNewCustomer={() => setNewCustomerOpen(true)}
        showRange={view === "overview"}
        session={session}
        onSignOut={() => void onSignOut()}
        onResetDemo={resetDemo}
      />

      <main className="mx-auto max-w-[1680px] px-4 pb-24 pt-6 sm:px-6 lg:pb-16">
        {view === "customers" && (
          <CustomersView
            customers={customers}
            hasCharges={(name) => rows.some((row) => row.customer === name)}
            onViewCharges={viewCharges}
            onCopy={(email) => {
              navigator.clipboard?.writeText(email);
              notify(`Copied ${email}`);
            }}
            onNewCustomer={() => setNewCustomerOpen(true)}
            onStatus={setCustomerStatus}
            onDelete={removeCustomer}
            state={customersState}
            onRetry={loadCustomers}
          />
        )}
        {view === "usage" && <UsageView />}
        {view === "overview" && (
        <>
        {/* Title row ------------------------------------------------------ */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[34px] font-normal leading-tight tracking-[-0.01em] text-stone-50">
              Operations overview
            </h1>
            <p className="mt-1.5 text-[14px] text-stone-400">
              Recurring revenue rose {fmtSigned0(MRR_CHANGE)} in the last 30 days;{" "}
              {sum(CURRENT, (d) => d.added.pro)} Pro upgrades added{" "}
              {fmtMoney0(PRO_UPGRADE_REVENUE)} of it.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-stone-400">
            <span>Updated {updatedAt}</span>
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh data"
              className={cx(FOCUS, "grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-900 hover:text-stone-100")}
            >
              <RefreshCw className={cx("h-4 w-4", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Hero: revenue ------------------------------------------------- */}
        <Panel id="revenue" className="animate-rise mt-6 flex scroll-mt-20 flex-col p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium tracking-tight text-stone-400">Monthly recurring revenue</p>
              <p className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-[56px] leading-none tracking-[-0.02em] text-stone-50 tabular-nums sm:text-[76px]">
                  <CountUp to={MRR} format={fmtMoney0} />
                </span>
                <span className="text-[12px] font-medium tracking-wide text-stone-400">USD</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Delta value={fmtPct(MRR_CHANGE_PCT)} label="vs prior 30 days" direction="up" good />
                <span className="text-[13px] text-stone-400">{fmtMoney0(MRR_PRIOR)} in the prior 30 days</span>
              </div>
            </div>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { id: "revenue", label: "Revenue" },
                { id: "accounts", label: "Subscriptions" },
              ]}
            />
          </div>

          <p className="mt-6 text-[13px] text-stone-400">
            {fmtDate(windowFrom)} – {fmtDate(windowTo)} ·{" "}
            {mode === "revenue"
              ? `${fmtMoney0(windowTotal)} recognised`
              : `${sum(chartRows, newAccounts)} paid accounts joined`}
          </p>

          <div className="flex min-w-0 flex-col">
            <div className="mb-2 h-[300px] sm:h-[380px] xl:h-[420px] [&>div]:h-full">
              <TrendChart rows={chartRows} mode={mode} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.08] pt-3 text-[13px]">
            <span className="text-stone-400">MRR movement</span>
            <span className="flex items-center gap-1.5">
              <span className="text-stone-400">New</span>
              <span className="font-mono tabular-nums text-emerald-300">{fmtSigned0(NEW_REVENUE)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-stone-400">Churned</span>
              <span className="font-mono tabular-nums text-rose-300">{fmtSigned0(-CHURNED_REVENUE)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-stone-400">Usage</span>
              <span className="font-mono tabular-nums text-stone-300">{fmtSigned0(OVERAGE_REVENUE)}</span>
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-stone-400">Net</span>
              <span className="font-mono tabular-nums text-stone-50">{fmtSigned0(MRR_CHANGE)}</span>
            </span>
          </div>
        </Panel>

        {/* Metric strip --------------------------------------------------- */}
        <Panel
          className="animate-rise mt-4 grid grid-cols-1 divide-y divide-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          style={{ animationDelay: "120ms" }}
        >
          <StripMetric
            label="Active subscribers"
            value={<CountUp to={ACTIVE} format={(n) => fmtCount(Math.round(n))} delay={100} />}
            delta={<Delta value={fmtPct(ACTIVE_CHANGE_PCT)} label="vs prior 30 days" direction="up" good />}
            detail={`${fmtCount(PAID)} paid · ${fmtCount(FREE)} on free or trial`}
            series={CURRENT.map((d) => d.accounts)}
            tone="text-amber-400"
          />
          <StripMetric
            label="Average revenue per user"
            value={<CountUp to={ARPU} format={(n) => fmtMoney(n)} delay={160} />}
            unit="USD"
            delta={
              <Delta
                value={fmtPct(Math.abs(ARPU_CHANGE_PCT))}
                label="vs prior 30 days"
                direction={ARPU_CHANGE_PCT >= 0 ? "up" : "down"}
                good={ARPU_CHANGE_PCT >= 0}
              />
            }
            detail={`${fmtMoney(ARPU_PRIOR)} per paid account, down as Starter grew`}
            series={CURRENT.map((d) => d.arpu)}
            tone="text-rose-300"
          />
          <StripMetric
            label="Churn rate"
            value={<CountUp to={CHURN} format={(n) => fmtPct(n)} delay={220} />}
            delta={<Delta value={Math.abs(CHURN - CHURN_PRIOR).toFixed(1)} suffix=" pts" label="vs prior 30 days" direction="down" good />}
            detail={`${CHURNED} of ${fmtCount(PAID)} paid accounts churned`}
            series={CHURN_TREND}
            tone="text-emerald-300"
            badge={
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-500/10 px-2 text-[12px] font-medium leading-none text-emerald-300 ring-1 ring-inset ring-emerald-400/25 shadow-[0_0_12px_-2px_rgba(52,211,153,0.35)]">
                <Check className="h-3 w-3" />
                Healthy
              </span>
            }
          />
        </Panel>

        {/* Plan distribution ---------------------------------------------- */}
        <Panel id="plans" className="animate-rise mt-4 scroll-mt-20 p-5 sm:p-6" style={{ animationDelay: "200ms" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-medium tracking-tight text-stone-50">Plan distribution</h2>
              <p className="mt-1 text-[13px] text-stone-400">
                {fmtCount(PAID)} paid accounts · {NEW_ACCOUNTS} joined in 30 days. Bar shows share of MRR.
              </p>
            </div>
            <span className="font-mono text-[13px] tabular-nums text-stone-400">{fmtMoney0(MRR)}</span>
          </div>

          <div
            className="mt-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.04]"
            role="img"
            aria-label={`Share of MRR: ${PLAN_MIX.map((p) => `${p.label} ${fmtPct((p.revenue / MRR) * 100)}`).join(", ")}`}
          >
            {PLAN_MIX.map((plan) => (
              <span
                key={plan.id}
                className={cx("animate-grow h-full bg-gradient-to-r first:rounded-l-full last:rounded-r-full", PLAN_SHADE[plan.id])}
                style={{ width: `${(plan.revenue / MRR) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {PLAN_MIX.map((plan) => (
              <li key={plan.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-stone-200">
                    <span className={cx("h-2 w-2 rounded-full bg-gradient-to-br", PLAN_SHADE[plan.id])} aria-hidden />
                    {plan.label}
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-stone-400">${plan.price}</span>
                </div>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-[40px] leading-none tracking-[-0.01em] text-stone-50 tabular-nums">
                    {fmtCount(plan.accounts)}
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-stone-400">{fmtPct(plan.share)}</span>
                </p>
                <p className="mt-2 text-[13px] text-stone-400">
                  {fmtMoney0(plan.revenue)} of MRR · {plan.blurb}
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Transactions --------------------------------------------------- */}
        <Panel id="transactions" className="animate-rise mt-4 scroll-mt-20 overflow-hidden" style={{ animationDelay: "360ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[15px] font-medium tracking-tight text-stone-50">Recent transactions</h2>
              {customerFilter && (
                <button
                  type="button"
                  onClick={() => setCustomerFilter(null)}
                  className={cx(FOCUS, "inline-flex items-center gap-1.5 rounded-full bg-stone-800 px-2 py-0.5 text-[12px] text-stone-300 transition-colors hover:bg-stone-700")}
                >
                  {customerFilter}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Filter by status" className="inline-flex rounded-lg bg-black/30 p-0.5 ring-1 ring-inset ring-white/[0.08]">
                {(["all", "paid", "processing", "refunded"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={statusFilter === id}
                    onClick={() => setStatusFilter(id)}
                    className={cx(
                      FOCUS,
                      "h-9 rounded-[6px] px-3 text-[13px] capitalize transition-colors sm:h-8",
                      statusFilter === id
                        ? "bg-white/[0.08] text-stone-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                        : "text-stone-400 hover:text-stone-200",
                    )}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[12px] tabular-nums text-stone-400">
                {statusFilter === "all"
                  ? `${visibleRows.length} of ${fmtCount(chargeCount)}`
                  : `${visibleRows.length} ${statusFilter}`}{" "}
                · {range.label.toLowerCase()}
              </p>
            </div>
          </div>

          {/* Phone: one line per charge, no sideways scroll. */}
          <ul className="sm:hidden">
            {visibleRows.map((row) => (
              <li key={row.id} className="border-t border-white/[0.05] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={row.customer} tint={row.tint} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-stone-100">{row.customer}</p>
                    <p className="mt-1 flex items-center gap-2 text-[13px] text-stone-400">
                      <StatusPill status={row.status} />
                      <span className="truncate">
                        {PLAN_META[row.plan].label} · {row.method}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cx(
                        "font-mono text-[13px] tabular-nums",
                        row.amount < 0 ? "text-rose-300" : "text-stone-100",
                      )}
                    >
                      {row.amount < 0 ? `−${fmtMoney(Math.abs(row.amount))}` : fmtMoney(row.amount)}
                    </p>
                    <p className="mt-1 font-mono text-[13px] tabular-nums text-stone-400">{row.date}</p>
                  </div>
                </div>
              </li>
            ))}
            {visibleRows.length === 0 && (
              <li className="border-t border-white/[0.05] px-4 py-10 text-center text-[13px] text-stone-400">
                {statusFilter === "all" ? "No charges in this range." : `No ${statusFilter} charges in this range.`}
              </li>
            )}
          </ul>

          {/* Desktop and tablet: the table. */}
          <div className="relative hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="border-y border-white/[0.08] bg-white/[0.02] text-[12px] uppercase tracking-[0.04em] text-stone-400">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Plan tier
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Payment method
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Date
                  </th>
                  <th scope="col" className="w-10 px-2 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <TransactionRow
                    key={row.id}
                    row={row}
                    onCopy={() => {
                      navigator.clipboard?.writeText(row.email);
                      notify(`Copied ${row.email}`);
                    }}
                    onFilter={() => {
                      setCustomerFilter(row.customer);
                      notify(`Filtered to ${row.customer}`);
                    }}
                  />
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-stone-400">
                      {statusFilter === "all" ? "No charges in this range." : `No ${statusFilter} charges in this range.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        </>
        )}
      </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          rows={rows}
          onClose={() => setPaletteOpen(false)}
          onPickCustomer={(customer) => {
            setCustomerFilter(customer);
            setPaletteOpen(false);
            notify(`Filtered to ${customer}`);
          }}
          onAction={(action) => {
            setPaletteOpen(false);
            if (action === "new") {
              setNewCustomerOpen(true);
              return;
            }
            exportCsv();
            notify(`Exported ${visibleRows.length} charges as CSV`);
          }}
        />
      )}

      {newCustomerOpen && (
        <NewCustomerDialog
          onClose={() => setNewCustomerOpen(false)}
          onCreate={addCustomer}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-50 rounded-xl lg:bottom-5 lg:right-5 border border-white/[0.08] bg-stone-900 px-3.5 py-2.5 text-[13px] text-stone-100 shadow-xl shadow-black/50"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
 * 8. Rows, palette and dialog
 * ========================================================================== */

function TransactionRow({
  row,
  onCopy,
  onFilter,
}: {
  row: Transaction;
  onCopy: () => void;
  onFilter: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <tr className="group/row border-b border-white/[0.05] transition-colors last:border-b-0 hover:bg-white/[0.03]">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.customer} tint={row.tint} />
          <div className="min-w-0">
            <p className="truncate text-[14px] text-stone-100">{row.customer}</p>
            <p className="truncate text-[13px] text-stone-400">{row.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-[13px] text-stone-300">{PLAN_META[row.plan].label}</td>
      <td
        className={cx(
          "whitespace-nowrap px-3 py-3 text-right font-mono text-[13px] tabular-nums",
          row.amount < 0 ? "text-rose-300" : "text-stone-100",
        )}
      >
        {row.amount < 0 ? `−${fmtMoney(Math.abs(row.amount))}` : fmtMoney(row.amount)}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <span className="inline-flex items-center gap-2 text-[13px] text-stone-400">
          <CreditCard className="h-3.5 w-3.5 text-stone-500" />
          {row.method}
        </span>
      </td>
      <td className="px-3 py-3">
        <StatusPill status={row.status} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-[13px] tabular-nums text-stone-400">
        {row.date}
      </td>
      <td className="relative px-2 py-3 text-right">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Actions for ${row.customer}`}
          aria-haspopup="menu"
          className={cx(FOCUS, "grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-100")}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <Menu open={menuOpen} onClose={() => setMenuOpen(false)} className="min-w-[190px]">
          <MenuItem
            icon={<Copy className="h-3.5 w-3.5 text-stone-400" />}
            onClick={() => {
              onCopy();
              setMenuOpen(false);
            }}
          >
            Copy customer email
          </MenuItem>
          <MenuItem
            icon={<Search className="h-3.5 w-3.5 text-stone-400" />}
            onClick={() => {
              onFilter();
              setMenuOpen(false);
            }}
          >
            Show only this customer
          </MenuItem>
        </Menu>
      </td>
    </tr>
  );
}

function CommandPalette({
  rows,
  onClose,
  onPickCustomer,
  onAction,
}: {
  rows: Transaction[];
  onClose: () => void;
  onPickCustomer: (customer: string) => void;
  onAction: (action: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const customers = useMemo(() => {
    const seen = new Map<string, Transaction>();
    rows.forEach((row) => {
      if (!seen.has(row.customer)) seen.set(row.customer, row);
    });
    return [...seen.values()];
  }, [rows]);

  const commands = [
    { id: "new", label: "Create a new customer" },
    { id: "export", label: "Export this range as CSV" },
  ];

  const needle = query.trim().toLowerCase();
  const matchedCustomers = customers.filter(
    (row) =>
      !needle ||
      row.customer.toLowerCase().includes(needle) ||
      row.email.toLowerCase().includes(needle),
  );
  const matchedCommands = commands.filter(
    (command) => !needle || command.label.toLowerCase().includes(needle),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/80 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-white/[0.08] bg-stone-900 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search className="h-4 w-4 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
            placeholder="Search customers, invoices…"
            className="h-12 flex-1 bg-transparent text-[14px] text-stone-100 outline-none placeholder:text-stone-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className={cx(FOCUS, "grid h-7 w-7 place-items-center rounded-md text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {matchedCustomers.length > 0 && (
            <>
              <p className="px-2 py-1.5 text-[13px] text-stone-400">Customers</p>
              {matchedCustomers.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onPickCustomer(row.customer)}
                  className={cx(FOCUS, "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-stone-800")}
                >
                  <Avatar name={row.customer} tint={row.tint} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-stone-100">{row.customer}</span>
                    <span className="block truncate text-[12px] text-stone-400">{row.email}</span>
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-stone-400">
                    {PLAN_META[row.plan].label}
                  </span>
                  <CornerDownLeft className="h-3.5 w-3.5 text-stone-500" />
                </button>
              ))}
            </>
          )}

          {matchedCommands.length > 0 && (
            <>
              <p className="px-2 pb-1.5 pt-4 text-[13px] text-stone-400">Actions</p>
              {matchedCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => onAction(command.id)}
                  className={cx(FOCUS, "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] text-stone-200 transition-colors hover:bg-stone-800")}
                >
                  <CornerDownLeft className="h-3.5 w-3.5 text-stone-500" />
                  {command.label}
                </button>
              ))}
            </>
          )}

          {matchedCustomers.length === 0 && matchedCommands.length === 0 && (
            <p className="px-2 py-8 text-center text-[13px] text-stone-400">
              Nothing matches “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NewCustomerDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (customer: Transaction) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<PlanId>("pro");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({
      id: `in_${Math.random().toString(36).slice(2, 7)}`,
      customer: trimmed,
      email: email.trim() || `${trimmed.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      plan,
      amount: PLAN_PRICE[plan],
      method: "Visa ···· 4242",
      status: "processing",
      date: "2026-11-05",
      tint: "bg-cyan-400/15 text-cyan-200",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/80 px-4 pt-[10vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="New customer"
        className="w-full max-w-[440px] rounded-xl border border-white/[0.08] bg-stone-900 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <h2 className="text-[15px] font-medium text-stone-50">New customer</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx(FOCUS, "grid h-7 w-7 place-items-center rounded-md text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="text-[13px] text-stone-400">Company or customer name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Northwind Labs"
              autoFocus
              className="mt-1.5 h-10 w-full rounded-lg border border-white/[0.08] bg-stone-950 px-3 text-[14px] text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-amber-400/60 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </label>

          <label className="block">
            <span className="text-[13px] text-stone-400">Billing email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="billing@company.example"
              className="mt-1.5 h-10 w-full rounded-lg border border-white/[0.08] bg-stone-950 px-3 text-[14px] text-stone-100 outline-none transition-colors placeholder:text-stone-500 focus:border-amber-400/60 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </label>

          <fieldset>
            <legend className="text-[13px] text-stone-400">Plan</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["starter", "pro", "enterprise"] as PlanId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlan(id)}
                  className={cx(
                    FOCUS,
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    plan === id
                      ? "border-amber-400/60 bg-amber-400/10"
                      : "border-white/[0.08] hover:border-white/[0.12]",
                  )}
                >
                  <span className="block text-[13px] font-medium text-stone-100">
                    {PLAN_META[id].label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[13px] tabular-nums text-stone-400">
                    ${PLAN_PRICE[id]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.08] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className={cx(FOCUS, "h-9 rounded-lg px-3 text-[13px] text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-100")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={cx(FOCUS, "h-9 rounded-lg bg-gradient-to-b from-amber-300 to-amber-400 px-3.5 text-[13px] font-semibold text-stone-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_0_0_1px_rgba(251,191,36,0.5),0_4px_14px_-4px_rgba(251,191,36,0.55)] transition-[filter,transform] hover:brightness-110 active:translate-y-px active:brightness-95")}
          >
            Create customer
          </button>
        </div>
      </form>
    </div>
  );
}
