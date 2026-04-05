import { StockHistory } from "@shared/schema";

/**
 * Pure technical-analysis calculations driven entirely from a StockHistory[]
 * array. No external API calls — we reuse whatever price history is already
 * cached, avoiding the Alpha Vantage per-indicator rate limit.
 *
 * Bars are assumed to be in chronological order (oldest → newest).
 */

export interface TrendAnalysis {
  direction: "Uptrend" | "Downtrend" | "Sideways";
  strength: "Strong" | "Moderate" | "Weak";
  summary: string;
  details: string[];
  priceVsSMA50: number;   // %
  priceVsSMA200: number;  // %
  sma50AboveSma200: boolean;
  slope: number;          // daily % change of 20-bar linear regression
}

export interface SupportResistance {
  support: Array<{ level: number; touches: number; distance: number }>;
  resistance: Array<{ level: number; touches: number; distance: number }>;
  summary: string;
}

export interface VolumeAnalysis {
  avgVolume: number;
  recentAvgVolume: number;  // last 10 bars
  currentVolume: number;
  volumeRatio: number;      // current / avg
  trend: "Increasing" | "Decreasing" | "Stable";
  summary: string;
}

export interface DetectedPattern {
  type: string;
  confidence: "High" | "Medium" | "Low";
  description: string;
  location: { startIdx: number; endIdx: number };
  targetPrice?: number;
  neckline?: number;
}

export interface RiskReturnMetrics {
  periodDays: number;
  totalReturnPct: number;     // over window
  cagrPct: number | null;     // annualized
  maxDrawdownPct: number;     // peak-to-trough
  sharpe: number | null;      // annualized
  sortino: number | null;     // annualized
  valueAtRisk95Pct: number;   // 1-day parametric VaR, % loss
}

export interface BenchmarkComparison {
  benchmarkSymbol: string;
  correlation: number;
  beta: number;
  alphaPct: number;            // annualized, Jensen's alpha
  trackingErrorPct: number;    // annualized
  informationRatio: number | null;
  stockReturnPct: number;      // over overlapping window
  benchmarkReturnPct: number;  // over overlapping window
  outperformancePct: number;   // stock − benchmark
}

export interface TechnicalAnalysisResult {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  trend: TrendAnalysis;
  supportResistance: SupportResistance;
  volume: VolumeAnalysis;
  patterns: DetectedPattern[];
  pivots: { highs: number[]; lows: number[] };
  indicators: {
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    rsi14: number | null;
    atr14: number | null;
    volatilityAnnualized: number | null;
  };
  riskReturn: RiskReturnMetrics;
  benchmark: BenchmarkComparison | null;
}

// ---------- Core math helpers ----------

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atr(bars: StockHistory[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const prevClose = bars[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    trs.push(tr);
  }
  return sma(trs, period);
}

/** Slope of linear regression on last `period` closes, expressed as %/bar. */
function regressionSlope(closes: number[], period = 20): number {
  const n = Math.min(closes.length, period);
  if (n < 3) return 0;
  const slice = closes.slice(closes.length - n);
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  const xMean = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (slice[i] - mean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return mean === 0 ? 0 : (slope / mean) * 100; // % per bar
}

// ---------- Trend analysis ----------

export function analyzeTrend(bars: StockHistory[]): TrendAnalysis {
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1];
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const slope = regressionSlope(closes, 20);

  const priceVsSMA50 = sma50 ? ((last - sma50) / sma50) * 100 : 0;
  const priceVsSMA200 = sma200 ? ((last - sma200) / sma200) * 100 : 0;
  const sma50AboveSma200 = sma50 !== null && sma200 !== null && sma50 > sma200;

  let direction: TrendAnalysis["direction"];
  if (slope > 0.15) direction = "Uptrend";
  else if (slope < -0.15) direction = "Downtrend";
  else direction = "Sideways";

  // Strength: combine slope magnitude with alignment of price/SMA50/SMA200
  let alignmentScore = 0;
  if (sma50 && last > sma50) alignmentScore++;
  if (sma200 && last > sma200) alignmentScore++;
  if (sma50AboveSma200) alignmentScore++;
  if (direction === "Downtrend") alignmentScore = 3 - alignmentScore;

  const absSlope = Math.abs(slope);
  let strength: TrendAnalysis["strength"];
  if (absSlope > 0.4 && alignmentScore >= 2) strength = "Strong";
  else if (absSlope > 0.15 || alignmentScore >= 2) strength = "Moderate";
  else strength = "Weak";

  const details: string[] = [];
  if (sma50) {
    details.push(
      `Price is ${priceVsSMA50 >= 0 ? "above" : "below"} the 50-day SMA by ${Math.abs(priceVsSMA50).toFixed(2)}%`,
    );
  }
  if (sma200) {
    details.push(
      `Price is ${priceVsSMA200 >= 0 ? "above" : "below"} the 200-day SMA by ${Math.abs(priceVsSMA200).toFixed(2)}%`,
    );
  }
  if (sma50 && sma200) {
    details.push(
      sma50AboveSma200
        ? "Golden cross alignment: SMA50 > SMA200 (long-term bullish)"
        : "Death cross alignment: SMA50 < SMA200 (long-term bearish)",
    );
  }
  details.push(`20-bar regression slope: ${slope.toFixed(3)}% per bar`);

  const summary =
    `${strength.toLowerCase()} ${direction.toLowerCase()}. ` +
    (sma50 && sma200
      ? `Price ${priceVsSMA50 >= 0 ? "above" : "below"} both key moving averages, ${sma50AboveSma200 ? "with bullish MA alignment" : "with bearish MA alignment"}.`
      : "Insufficient history for full moving-average context.");

  return {
    direction,
    strength,
    summary,
    details,
    priceVsSMA50,
    priceVsSMA200,
    sma50AboveSma200,
    slope,
  };
}

// ---------- Support / resistance ----------

/**
 * Find pivot highs/lows using a simple swing detection (3 bars on each side),
 * then cluster nearby pivots into S/R levels.
 */
export function analyzeSupportResistance(bars: StockHistory[]): SupportResistance {
  const lookback = Math.min(bars.length, 120); // last ~120 bars
  const window = bars.slice(bars.length - lookback);
  const last = window[window.length - 1].close;

  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  const w = 3;
  for (let i = w; i < window.length - w; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (window[j].high >= window[i].high) isHigh = false;
      if (window[j].low <= window[i].low) isLow = false;
    }
    if (isHigh) pivotHighs.push(window[i].high);
    if (isLow) pivotLows.push(window[i].low);
  }

  // Cluster levels within 1.5% of each other
  const cluster = (prices: number[]) => {
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters: { level: number; touches: number }[] = [];
    for (const p of sorted) {
      const nearest = clusters[clusters.length - 1];
      if (nearest && Math.abs(p - nearest.level) / nearest.level < 0.015) {
        // merge by weighted average
        nearest.level = (nearest.level * nearest.touches + p) / (nearest.touches + 1);
        nearest.touches += 1;
      } else {
        clusters.push({ level: p, touches: 1 });
      }
    }
    return clusters.filter((c) => c.touches >= 2); // require at least 2 touches
  };

  const support = cluster(pivotLows)
    .filter((c) => c.level < last)
    .map((c) => ({ ...c, distance: ((c.level - last) / last) * 100 }))
    .sort((a, b) => b.level - a.level) // nearest first
    .slice(0, 3);

  const resistance = cluster(pivotHighs)
    .filter((c) => c.level > last)
    .map((c) => ({ ...c, distance: ((c.level - last) / last) * 100 }))
    .sort((a, b) => a.level - b.level)
    .slice(0, 3);

  const parts: string[] = [];
  if (support.length) {
    const s = support[0];
    parts.push(`Nearest support at $${s.level.toFixed(2)} (${Math.abs(s.distance).toFixed(1)}% below, ${s.touches} touches)`);
  }
  if (resistance.length) {
    const r = resistance[0];
    parts.push(`Nearest resistance at $${r.level.toFixed(2)} (${r.distance.toFixed(1)}% above, ${r.touches} touches)`);
  }
  if (!parts.length) parts.push("No clear S/R levels detected in recent price action");

  return {
    support,
    resistance,
    summary: parts.join(". ") + ".",
  };
}

// ---------- Volume analysis ----------

export function analyzeVolume(bars: StockHistory[]): VolumeAnalysis {
  const volumes = bars.map((b) => b.volume).filter((v) => v > 0);
  if (volumes.length < 10) {
    return {
      avgVolume: 0, recentAvgVolume: 0, currentVolume: 0, volumeRatio: 1,
      trend: "Stable", summary: "Insufficient volume data.",
    };
  }
  const currentVolume = volumes[volumes.length - 1];
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentAvgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, volumes.length);
  const olderAvgVolume = volumes.length >= 30
    ? volumes.slice(-30, -10).reduce((a, b) => a + b, 0) / 20
    : avgVolume;

  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const trendRatio = olderAvgVolume > 0 ? recentAvgVolume / olderAvgVolume : 1;

  let trend: VolumeAnalysis["trend"];
  if (trendRatio > 1.15) trend = "Increasing";
  else if (trendRatio < 0.85) trend = "Decreasing";
  else trend = "Stable";

  let summary: string;
  if (volumeRatio > 1.5) {
    summary = `Current volume is ${volumeRatio.toFixed(1)}x the average — unusually heavy participation. ${trend} overall.`;
  } else if (volumeRatio < 0.6) {
    summary = `Current volume is only ${(volumeRatio * 100).toFixed(0)}% of average — light participation. ${trend} overall.`;
  } else {
    summary = `Volume is in line with the ${volumes.length}-bar average (${volumeRatio.toFixed(2)}x). ${trend} over the recent period.`;
  }

  return { avgVolume, recentAvgVolume, currentVolume, volumeRatio, trend, summary };
}

// ---------- Pattern detection ----------

function findPivots(bars: StockHistory[], w = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = w; i < bars.length - w; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

export function detectPatterns(bars: StockHistory[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  if (bars.length < 30) return patterns;
  const { highs, lows } = findPivots(bars);
  const tol = 0.03; // 3% price proximity

  // Double top: two highs at similar price with a lower low between
  for (let i = 1; i < highs.length; i++) {
    const a = highs[i - 1];
    const b = highs[i];
    if (b - a < 10 || b - a > 80) continue;
    const pa = bars[a].high;
    const pb = bars[b].high;
    if (Math.abs(pa - pb) / pa > tol) continue;
    // Find lowest low between a and b
    let between = Infinity;
    let troughIdx = -1;
    for (let k = a + 1; k < b; k++) {
      if (bars[k].low < between) {
        between = bars[k].low;
        troughIdx = k;
      }
    }
    if (troughIdx === -1) continue;
    const dropFromPeak = (pa - between) / pa;
    if (dropFromPeak < 0.03) continue;
    const last = bars[bars.length - 1].close;
    if (b < bars.length - 20) continue; // only flag recent patterns
    patterns.push({
      type: "Double Top",
      confidence: dropFromPeak > 0.06 ? "High" : dropFromPeak > 0.04 ? "Medium" : "Low",
      description: `Two peaks near $${((pa + pb) / 2).toFixed(2)} with a ${(dropFromPeak * 100).toFixed(1)}% trough between — bearish reversal signal if price breaks below $${between.toFixed(2)}`,
      location: { startIdx: a, endIdx: b },
      targetPrice: between - (pa - between),
    });
  }

  // Double bottom
  for (let i = 1; i < lows.length; i++) {
    const a = lows[i - 1];
    const b = lows[i];
    if (b - a < 10 || b - a > 80) continue;
    const pa = bars[a].low;
    const pb = bars[b].low;
    if (Math.abs(pa - pb) / pa > tol) continue;
    let between = -Infinity;
    let peakIdx = -1;
    for (let k = a + 1; k < b; k++) {
      if (bars[k].high > between) {
        between = bars[k].high;
        peakIdx = k;
      }
    }
    if (peakIdx === -1) continue;
    const rallyFromLow = (between - pa) / pa;
    if (rallyFromLow < 0.03) continue;
    if (b < bars.length - 20) continue;
    patterns.push({
      type: "Double Bottom",
      confidence: rallyFromLow > 0.06 ? "High" : rallyFromLow > 0.04 ? "Medium" : "Low",
      description: `Two troughs near $${((pa + pb) / 2).toFixed(2)} with a ${(rallyFromLow * 100).toFixed(1)}% peak between — bullish reversal signal if price breaks above $${between.toFixed(2)}`,
      location: { startIdx: a, endIdx: b },
      targetPrice: between + (between - pa),
    });
  }

  // Head & shoulders: 3 consecutive highs where middle is highest, shoulders similar
  for (let i = 2; i < highs.length; i++) {
    const l = highs[i - 2];
    const h = highs[i - 1];
    const r = highs[i];
    if (r - l > 100 || r - l < 20) continue;
    const pl = bars[l].high;
    const ph = bars[h].high;
    const pr = bars[r].high;
    if (ph <= pl || ph <= pr) continue;
    if (Math.abs(pl - pr) / pl > tol) continue;
    // Neckline = avg of the two troughs between the peaks
    const t1 = Math.min(...bars.slice(l, h).map((b) => b.low));
    const t2 = Math.min(...bars.slice(h, r).map((b) => b.low));
    const neckline = (t1 + t2) / 2;
    if (r < bars.length - 25) continue;
    patterns.push({
      type: "Head & Shoulders",
      confidence: Math.abs(pl - pr) / pl < 0.015 ? "High" : "Medium",
      description: `Head at $${ph.toFixed(2)}, shoulders near $${((pl + pr) / 2).toFixed(2)}, neckline at $${neckline.toFixed(2)} — classic bearish reversal if price closes below neckline`,
      location: { startIdx: l, endIdx: r },
      targetPrice: neckline - (ph - neckline),
      neckline,
    });
  }

  // Inverse head & shoulders
  for (let i = 2; i < lows.length; i++) {
    const l = lows[i - 2];
    const h = lows[i - 1];
    const r = lows[i];
    if (r - l > 100 || r - l < 20) continue;
    const pl = bars[l].low;
    const ph = bars[h].low;
    const pr = bars[r].low;
    if (ph >= pl || ph >= pr) continue;
    if (Math.abs(pl - pr) / pl > tol) continue;
    const t1 = Math.max(...bars.slice(l, h).map((b) => b.high));
    const t2 = Math.max(...bars.slice(h, r).map((b) => b.high));
    const neckline = (t1 + t2) / 2;
    if (r < bars.length - 25) continue;
    patterns.push({
      type: "Inverse Head & Shoulders",
      confidence: Math.abs(pl - pr) / pl < 0.015 ? "High" : "Medium",
      description: `Bottom at $${ph.toFixed(2)}, shoulders near $${((pl + pr) / 2).toFixed(2)}, neckline at $${neckline.toFixed(2)} — classic bullish reversal if price closes above neckline`,
      location: { startIdx: l, endIdx: r },
      targetPrice: neckline + (neckline - ph),
      neckline,
    });
  }

  // Ascending/Descending trend channel via regression
  if (bars.length >= 30) {
    const closes = bars.slice(-60).map((b) => b.close);
    const slope = regressionSlope(closes, Math.min(60, closes.length));
    if (Math.abs(slope) > 0.2) {
      patterns.push({
        type: slope > 0 ? "Ascending Channel" : "Descending Channel",
        confidence: Math.abs(slope) > 0.4 ? "High" : "Medium",
        description: `Price trending ${slope > 0 ? "up" : "down"} at ${Math.abs(slope).toFixed(2)}% per bar over the last ${Math.min(60, closes.length)} bars`,
        location: { startIdx: bars.length - Math.min(60, closes.length), endIdx: bars.length - 1 },
      });
    }
  }

  return patterns;
}

// ---------- Annualized volatility ----------

function volatilityAnnualized(closes: number[], period = 20): number | null {
  if (closes.length < period + 1) return null;
  const returns: number[] = [];
  const slice = closes.slice(closes.length - period - 1);
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100; // % annualized
}

// ---------- Risk / return metrics ----------

const TRADING_DAYS = 252;
const DEFAULT_RISK_FREE_RATE = 0.045; // 4.5% annual — rough current 3-mo T-bill proxy

function dailyReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) r.push(closes[i] / closes[i - 1] - 1);
  }
  return r;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function analyzeRiskReturn(
  bars: StockHistory[],
  riskFreeAnnual = DEFAULT_RISK_FREE_RATE,
): RiskReturnMetrics {
  const closes = bars.map((b) => b.close);
  const n = closes.length;
  const first = closes[0];
  const last = closes[n - 1];
  const totalReturn = first > 0 ? last / first - 1 : 0;

  // Approximate years based on bar count (assumes daily bars)
  const years = n / TRADING_DAYS;
  const cagr = years > 0 && first > 0 ? Math.pow(last / first, 1 / years) - 1 : null;

  // Max drawdown
  let peak = closes[0];
  let maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = peak > 0 ? (c - peak) / peak : 0;
    if (dd < maxDD) maxDD = dd;
  }

  // Daily returns for Sharpe, Sortino, VaR
  const rets = dailyReturns(closes);
  const rfDaily = riskFreeAnnual / TRADING_DAYS;
  const excess = rets.map((r) => r - rfDaily);
  const sd = stdev(rets);
  const sharpe =
    sd > 0 ? (mean(excess) / sd) * Math.sqrt(TRADING_DAYS) : null;

  // Sortino uses downside deviation
  const downside = rets.filter((r) => r < rfDaily).map((r) => r - rfDaily);
  const downsideSd =
    downside.length > 1 ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length) : 0;
  const sortino =
    downsideSd > 0 ? (mean(excess) / downsideSd) * Math.sqrt(TRADING_DAYS) : null;

  // Parametric VaR at 95%: z = 1.645
  const valueAtRisk95 = 1.645 * sd;

  return {
    periodDays: n,
    totalReturnPct: totalReturn * 100,
    cagrPct: cagr == null ? null : cagr * 100,
    maxDrawdownPct: maxDD * 100,
    sharpe,
    sortino,
    valueAtRisk95Pct: valueAtRisk95 * 100,
  };
}

// ---------- Benchmark comparison ----------

export function compareToBenchmark(
  stockBars: StockHistory[],
  benchmarkBars: StockHistory[],
  benchmarkSymbol: string,
  riskFreeAnnual = DEFAULT_RISK_FREE_RATE,
): BenchmarkComparison | null {
  if (stockBars.length < 20 || benchmarkBars.length < 20) return null;

  // Align by date (intersect). Both arrays are chronological.
  const byDateBench = new Map<string, number>();
  for (const b of benchmarkBars) byDateBench.set(b.timestamp, b.close);

  const pairs: Array<{ s: number; b: number }> = [];
  for (const s of stockBars) {
    const bc = byDateBench.get(s.timestamp);
    if (bc != null) pairs.push({ s: s.close, b: bc });
  }
  if (pairs.length < 20) return null;

  const sCloses = pairs.map((p) => p.s);
  const bCloses = pairs.map((p) => p.b);
  const sRets = dailyReturns(sCloses);
  const bRets = dailyReturns(bCloses);
  const pairsRet = Math.min(sRets.length, bRets.length);
  const sr = sRets.slice(-pairsRet);
  const br = bRets.slice(-pairsRet);

  // Correlation
  const sMean = mean(sr);
  const bMean = mean(br);
  let cov = 0;
  let sVar = 0;
  let bVar = 0;
  for (let i = 0; i < pairsRet; i++) {
    const ds = sr[i] - sMean;
    const db = br[i] - bMean;
    cov += ds * db;
    sVar += ds * ds;
    bVar += db * db;
  }
  cov /= pairsRet - 1;
  sVar /= pairsRet - 1;
  bVar /= pairsRet - 1;
  const sSd = Math.sqrt(sVar);
  const bSd = Math.sqrt(bVar);
  const correlation = sSd > 0 && bSd > 0 ? cov / (sSd * bSd) : 0;
  const beta = bVar > 0 ? cov / bVar : 0;

  // Jensen's alpha (annualized): α = (Rp − Rf) − β(Rm − Rf)
  const rfDaily = riskFreeAnnual / TRADING_DAYS;
  const alphaDaily = sMean - rfDaily - beta * (bMean - rfDaily);
  const alphaAnnual = alphaDaily * TRADING_DAYS;

  // Tracking error and information ratio
  const diffs = sr.map((r, i) => r - br[i]);
  const teDaily = stdev(diffs);
  const trackingError = teDaily * Math.sqrt(TRADING_DAYS);
  const infoRatio =
    teDaily > 0 ? (mean(diffs) * TRADING_DAYS) / trackingError : null;

  // Period returns (overlapping window only)
  const sFirst = sCloses[0];
  const sLast = sCloses[sCloses.length - 1];
  const bFirst = bCloses[0];
  const bLast = bCloses[bCloses.length - 1];
  const stockRet = sFirst > 0 ? sLast / sFirst - 1 : 0;
  const benchRet = bFirst > 0 ? bLast / bFirst - 1 : 0;

  return {
    benchmarkSymbol,
    correlation,
    beta,
    alphaPct: alphaAnnual * 100,
    trackingErrorPct: trackingError * 100,
    informationRatio: infoRatio,
    stockReturnPct: stockRet * 100,
    benchmarkReturnPct: benchRet * 100,
    outperformancePct: (stockRet - benchRet) * 100,
  };
}

// ---------- Top-level analysis ----------

export function runTechnicalAnalysis(
  symbol: string,
  bars: StockHistory[],
  benchmarkBars?: StockHistory[],
  benchmarkSymbol = "SPY",
): TechnicalAnalysisResult {
  if (bars.length < 10) {
    throw new Error("Insufficient price history for technical analysis");
  }
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1];
  const prev = closes.length > 1 ? closes[closes.length - 2] : last;

  const benchmark =
    benchmarkBars && benchmarkBars.length >= 20
      ? compareToBenchmark(bars, benchmarkBars, benchmarkSymbol)
      : null;

  return {
    symbol,
    price: last,
    priceChange: last - prev,
    priceChangePercent: prev === 0 ? 0 : ((last - prev) / prev) * 100,
    trend: analyzeTrend(bars),
    supportResistance: analyzeSupportResistance(bars),
    volume: analyzeVolume(bars),
    patterns: detectPatterns(bars),
    pivots: findPivots(bars),
    indicators: {
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      sma200: sma(closes, 200),
      rsi14: rsi(closes, 14),
      atr14: atr(bars, 14),
      volatilityAnnualized: volatilityAnnualized(closes, 20),
    },
    riskReturn: analyzeRiskReturn(bars),
    benchmark,
  };
}
