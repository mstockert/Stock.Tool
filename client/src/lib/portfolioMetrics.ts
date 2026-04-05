// Portfolio analytics helpers. All return calculations use daily log/arithmetic
// returns and annualize with 252 trading days.

export const TRADING_DAYS = 252;
export const DEFAULT_RISK_FREE_RATE = 0.045; // 4.5% annualized 3mo T-bill proxy

export type Bar = { timestamp: string; close: number };

export type HoldingInput = {
  symbol: string;
  shares: number;
  avgCost: number;
  history: Bar[]; // sorted ascending by timestamp
};

export type SeriesPoint = { timestamp: string; value: number };

/** Arithmetic daily returns from a close series. Returns length N-1. */
export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    if (prev > 0) out.push(closes[i] / prev - 1);
    else out.push(0);
  }
  return out;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}

export function stdDev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

export function downsideDeviation(xs: number[], threshold = 0): number {
  if (xs.length === 0) return 0;
  const neg = xs.map((x) => Math.min(0, x - threshold));
  const sq = neg.reduce((s, x) => s + x * x, 0) / xs.length;
  return Math.sqrt(sq);
}

export function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - 1);
}

export function correlation(a: number[], b: number[]): number {
  const sa = stdDev(a);
  const sb = stdDev(b);
  if (sa === 0 || sb === 0) return 0;
  return covariance(a, b) / (sa * sb);
}

/** Beta of a relative to benchmark b. */
export function beta(a: number[], b: number[]): number {
  const vb = variance(b);
  if (vb === 0) return 0;
  return covariance(a, b) / vb;
}

/** Max drawdown of a value series, returned as a NEGATIVE percentage (e.g. -0.23). */
export function maxDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let mdd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? v / peak - 1 : 0;
    if (dd < mdd) mdd = dd;
  }
  return mdd;
}

export function annualize(dailyMean: number): number {
  return dailyMean * TRADING_DAYS;
}

export function annualizeVol(dailyStd: number): number {
  return dailyStd * Math.sqrt(TRADING_DAYS);
}

/** CAGR from a value series. Requires at least 2 points with positive values. */
export function cagr(values: number[], tradingDays: number): number | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (first <= 0 || last <= 0) return null;
  const years = tradingDays / TRADING_DAYS;
  if (years <= 0) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

export function sharpeRatio(dailyRets: number[], rfAnnual = DEFAULT_RISK_FREE_RATE): number | null {
  const s = stdDev(dailyRets);
  if (s === 0) return null;
  const rAnn = annualize(mean(dailyRets));
  const volAnn = annualizeVol(s);
  return (rAnn - rfAnnual) / volAnn;
}

export function sortinoRatio(dailyRets: number[], rfAnnual = DEFAULT_RISK_FREE_RATE): number | null {
  const dd = downsideDeviation(dailyRets, 0);
  if (dd === 0) return null;
  const rAnn = annualize(mean(dailyRets));
  const ddAnn = dd * Math.sqrt(TRADING_DAYS);
  return (rAnn - rfAnnual) / ddAnn;
}

export function informationRatio(portRets: number[], benchRets: number[]): number | null {
  const n = Math.min(portRets.length, benchRets.length);
  if (n < 2) return null;
  const excess: number[] = [];
  for (let i = 0; i < n; i++) excess.push(portRets[i] - benchRets[i]);
  const te = stdDev(excess);
  if (te === 0) return null;
  return annualize(mean(excess)) / (te * Math.sqrt(TRADING_DAYS));
}

export function treynorRatio(
  dailyRets: number[],
  benchRets: number[],
  rfAnnual = DEFAULT_RISK_FREE_RATE,
): number | null {
  const b = beta(dailyRets, benchRets);
  if (b === 0) return null;
  return (annualize(mean(dailyRets)) - rfAnnual) / b;
}

/** Parametric VaR at 95% confidence (returns positive dollar loss). */
export function var95(portfolioValue: number, dailyStdev: number): number {
  return portfolioValue * 1.645 * dailyStdev;
}

/** Conditional VaR (Expected Shortfall) at 95% using empirical tail. */
export function cvar95(dailyRets: number[], portfolioValue: number): number {
  if (dailyRets.length === 0) return 0;
  const sorted = [...dailyRets].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor(sorted.length * 0.05));
  const tail = sorted.slice(0, cutoff);
  const avgTail = mean(tail);
  return Math.abs(avgTail) * portfolioValue;
}

/**
 * Align multiple price series on a common set of timestamps (intersection).
 * Returns aligned close arrays in the same order as inputs.
 */
export function alignSeries(serieses: Bar[][]): { timestamps: string[]; closes: number[][] } {
  if (serieses.length === 0) return { timestamps: [], closes: [] };
  // Build per-series maps
  const maps = serieses.map((s) => {
    const m = new Map<string, number>();
    for (const b of s) m.set(b.timestamp, b.close);
    return m;
  });
  // Intersection of timestamps, using the first series' order
  const firstTs = serieses[0].map((b) => b.timestamp);
  const timestamps = firstTs.filter((t) => maps.every((m) => m.has(t)));
  const closes = maps.map((m) => timestamps.map((t) => m.get(t)!));
  return { timestamps, closes };
}

/**
 * Build the portfolio value time series from aligned holding closes.
 * Shares are treated as constant over the window.
 */
export function buildPortfolioSeries(
  timestamps: string[],
  closes: number[][],
  shares: number[],
): SeriesPoint[] {
  const n = timestamps.length;
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let h = 0; h < closes.length; h++) {
      v += closes[h][i] * shares[h];
    }
    out.push({ timestamp: timestamps[i], value: v });
  }
  return out;
}

/** Rebase a series to a starting value (default 100) for charting. */
export function rebase(values: number[], base = 100): number[] {
  if (values.length === 0 || values[0] === 0) return values.slice();
  const factor = base / values[0];
  return values.map((v) => v * factor);
}

export function formatPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function formatMoney(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
