import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { StockHistory } from "@shared/schema";
import {
  dailyReturns,
  mean,
  stdDev,
  annualize,
  annualizeVol,
  maxDrawdown,
  sharpeRatio,
  sortinoRatio,
  informationRatio,
  treynorRatio,
  beta as calcBeta,
  correlation,
  var95,
  cvar95,
  cagr,
  alignSeries,
  buildPortfolioSeries,
  rebase,
  formatPct,
  formatNum,
  formatMoney,
  DEFAULT_RISK_FREE_RATE,
  TRADING_DAYS,
} from "@/lib/portfolioMetrics";

type PortfolioHolding = {
  id: number;
  portfolioId: number;
  symbol: string;
  companyName: string | null;
  shares: string;
  avgCost: string;
  currentPrice?: number;
};

type Portfolio = {
  id: number;
  userId: number;
  name: string;
  holdings?: PortfolioHolding[];
};

type Timeframe = "3M" | "6M" | "1Y" | "3Y" | "5Y";
const TIMEFRAMES: Timeframe[] = ["3M", "6M", "1Y", "3Y", "5Y"];

export default function PortfolioAnalysisPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1Y");

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
    queryFn: async () => {
      const res = await fetch("/api/portfolios");
      if (!res.ok) throw new Error("Failed to fetch portfolios");
      return res.json();
    },
  });

  // Default selection
  const currentId =
    selectedId ?? (portfolios.length > 0 ? portfolios[0].id : null);
  const portfolio = portfolios.find((p) => p.id === currentId) || null;
  const holdings = portfolio?.holdings ?? [];

  // Map history timeframe to our API's supported values
  const apiTimeframe = timeframe;

  // Fetch per-holding history
  const historyQueries = useQueries({
    queries: holdings.map((h) => ({
      queryKey: [`/api/stocks/history/${h.symbol}`, apiTimeframe],
      queryFn: async (): Promise<StockHistory[]> => {
        const res = await fetch(
          `/api/stocks/history/${h.symbol}?timeframe=${apiTimeframe}`,
        );
        if (!res.ok) throw new Error(`history failed for ${h.symbol}`);
        return res.json();
      },
      enabled: !!h.symbol,
    })),
  });

  // SPY benchmark
  const { data: spyHistory } = useQuery<StockHistory[]>({
    queryKey: [`/api/stocks/history/SPY`, apiTimeframe],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/SPY?timeframe=${apiTimeframe}`);
      if (!res.ok) throw new Error("Failed to fetch SPY");
      return res.json();
    },
  });

  const historiesLoading = historyQueries.some((q) => q.isLoading);
  const allLoaded =
    historyQueries.length > 0 &&
    historyQueries.every((q) => q.data && q.data.length > 0) &&
    spyHistory &&
    spyHistory.length > 0;

  const analytics = useMemo(() => {
    if (!allLoaded || !portfolio || holdings.length === 0) return null;

    // Prepare inputs
    const shares = holdings.map((h) => parseFloat(h.shares) || 0);
    const avgCosts = holdings.map((h) => parseFloat(h.avgCost) || 0);
    const serieses = historyQueries.map(
      (q) => (q.data ?? []).map((b) => ({ timestamp: b.timestamp, close: b.close })),
    );

    // Align holdings on intersected timestamps
    const aligned = alignSeries(serieses);
    if (aligned.timestamps.length < 2) return null;

    // Trusted current value — matches the Portfolio page (uses API-provided
    // currentPrice + shares, which correctly accounts for splits / adjustments
    // that historical close series may not agree with).
    const currentValue = holdings.reduce((s, h, i) => {
      const px = h.currentPrice ?? parseFloat(h.avgCost) ?? 0;
      return s + shares[i] * px;
    }, 0);

    // Raw historical portfolio value series (may diverge from currentValue if
    // history uses adjusted/unadjusted prices differently than the live quote).
    const rawPortSeries = buildPortfolioSeries(aligned.timestamps, aligned.closes, shares);
    const rawFinalValue = rawPortSeries[rawPortSeries.length - 1].value;

    // Scale the historical series so its final value equals currentValue.
    // This preserves return/risk calculations (they only depend on ratios)
    // while giving correct dollar amounts.
    const scaleFactor = rawFinalValue > 0 ? currentValue / rawFinalValue : 1;
    const portValues = rawPortSeries.map((p) => p.value * scaleFactor);
    const portRets = dailyReturns(portValues);

    // Align SPY to the same timestamps
    const spyMap = new Map<string, number>();
    for (const b of spyHistory!) spyMap.set(b.timestamp, b.close);
    const spyCloses: number[] = [];
    const tsWithSpy: string[] = [];
    for (let i = 0; i < aligned.timestamps.length; i++) {
      const t = aligned.timestamps[i];
      if (spyMap.has(t)) {
        spyCloses.push(spyMap.get(t)!);
        tsWithSpy.push(t);
      }
    }
    const spyRets = dailyReturns(spyCloses);

    // Also compute portfolio returns on the SPY-aligned set for benchmark stats
    const portOnSpyIdx = aligned.timestamps
      .map((t, i) => (spyMap.has(t) ? i : -1))
      .filter((i) => i >= 0);
    const portValuesOnSpy = portOnSpyIdx.map((i) => portValues[i]);
    const portRetsOnSpy = dailyReturns(portValuesOnSpy);

    // Performance
    const totalValue = portValues[portValues.length - 1];
    const costBasis = shares.reduce((s, sh, i) => s + sh * avgCosts[i], 0);
    const totalReturnPct = costBasis > 0 ? totalValue / costBasis - 1 : null;
    const periodReturnPct =
      portValues[0] > 0 ? portValues[portValues.length - 1] / portValues[0] - 1 : null;
    const cagrPct = cagr(portValues, portValues.length);

    // Risk
    const dailyStd = stdDev(portRets);
    const volAnn = annualizeVol(dailyStd);
    const retAnn = annualize(mean(portRets));
    const mdd = maxDrawdown(portValues);
    const sharpe = sharpeRatio(portRets);
    const sortino = sortinoRatio(portRets);
    const var95Val = var95(totalValue, dailyStd);
    const cvar95Val = cvar95(portRets, totalValue);

    // Benchmark
    const spyRetAnn = annualize(mean(spyRets));
    const b = calcBeta(portRetsOnSpy, spyRets);
    const alphaAnn = retAnn - (DEFAULT_RISK_FREE_RATE + b * (spyRetAnn - DEFAULT_RISK_FREE_RATE));
    const ir = informationRatio(portRetsOnSpy, spyRets);
    const treynor = treynorRatio(portRets, spyRets.slice(0, portRets.length));

    // Per-holding stats — use live currentPrice from the API for dollar
    // amounts (matches Portfolio page), historical closes for risk/return.
    const holdingStats = holdings.map((h, i) => {
      const closes = aligned.closes[i];
      const livePrice = h.currentPrice ?? parseFloat(h.avgCost) ?? 0;
      const value = livePrice * shares[i];
      const holdingCost = shares[i] * avgCosts[i];
      const retSinceCost = holdingCost > 0 ? value / holdingCost - 1 : null;
      const rets = dailyReturns(closes);
      const hSharpe = sharpeRatio(rets);
      const hVol = annualizeVol(stdDev(rets));
      const hBeta = calcBeta(rets, spyRets.slice(0, rets.length));
      const weight = totalValue > 0 ? value / totalValue : 0;
      return {
        symbol: h.symbol,
        companyName: h.companyName,
        shares: shares[i],
        avgCost: avgCosts[i],
        lastPrice: livePrice,
        value,
        weight,
        returnSinceCost: retSinceCost,
        vol: hVol,
        sharpe: hSharpe,
        beta: hBeta,
      };
    });

    // Weights sort & concentration
    const sortedWeights = [...holdingStats].sort((a, b) => b.weight - a.weight);
    const top1 = sortedWeights.slice(0, 1).reduce((s, h) => s + h.weight, 0);
    const top3 = sortedWeights.slice(0, 3).reduce((s, h) => s + h.weight, 0);
    const top5 = sortedWeights.slice(0, 5).reduce((s, h) => s + h.weight, 0);

    // Correlation matrix
    const retsPerHolding = aligned.closes.map((c) => dailyReturns(c));
    const corrMatrix: number[][] = retsPerHolding.map((r, i) =>
      retsPerHolding.map((r2, j) => (i === j ? 1 : correlation(r, r2))),
    );

    // High correlation pairs (>0.8, excluding self)
    const highCorrPairs: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < holdings.length; i++) {
      for (let j = i + 1; j < holdings.length; j++) {
        if (corrMatrix[i][j] > 0.8) {
          highCorrPairs.push({
            a: holdings[i].symbol,
            b: holdings[j].symbol,
            r: corrMatrix[i][j],
          });
        }
      }
    }

    // Benchmark comparison chart data (rebased to 100)
    const portRebased = rebase(portValuesOnSpy, 100);
    const spyRebased = rebase(spyCloses, 100);
    const chartData = tsWithSpy.map((t, i) => ({
      timestamp: t,
      portfolio: portRebased[i],
      spy: spyRebased[i],
    }));

    // Warnings
    const warnings: string[] = [];
    if (top1 > 0.1) warnings.push(`Top holding is ${formatPct(top1)} of portfolio (>10% concentration).`);
    if (mdd < -0.2) warnings.push(`Max drawdown of ${formatPct(mdd)} exceeds 20%.`);
    if (b > 1.3) warnings.push(`Portfolio beta ${b.toFixed(2)} indicates high market sensitivity.`);
    if (highCorrPairs.length > 0)
      warnings.push(
        `${highCorrPairs.length} pair(s) with correlation > 0.8 — diversification concern.`,
      );

    return {
      totalValue,
      costBasis,
      totalReturnPct,
      periodReturnPct,
      cagrPct,
      retAnn,
      volAnn,
      mdd,
      sharpe,
      sortino,
      var95Val,
      cvar95Val,
      beta: b,
      alphaAnn,
      ir,
      treynor,
      top1,
      top3,
      top5,
      holdingStats,
      corrMatrix,
      corrSymbols: holdings.map((h) => h.symbol),
      highCorrPairs,
      chartData,
      warnings,
    };
  }, [allLoaded, historyQueries, holdings, portfolio, spyHistory]);

  // Render
  return (
    <div className="p-2 md:p-4">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Portfolio Analysis</h1>
        <div className="flex items-center gap-2">
          <Select
            value={currentId ? String(currentId) : ""}
            onValueChange={(v) => setSelectedId(Number(v))}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select portfolio" />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf}
                size="sm"
                variant={timeframe === tf ? "default" : "outline"}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {portfoliosLoading && <Skeleton className="h-32 w-full" />}

      {!portfoliosLoading && portfolios.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 dark:text-text-secondary">
            No portfolios yet. Create one on the Portfolios page to analyze it here.
          </CardContent>
        </Card>
      )}

      {!portfoliosLoading && portfolio && holdings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 dark:text-text-secondary">
            This portfolio has no holdings yet.
          </CardContent>
        </Card>
      )}

      {portfolio && holdings.length > 0 && (historiesLoading || !allLoaded) && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {analytics && (
        <div className="space-y-6">
          {/* Warnings */}
          {analytics.warnings.length > 0 && (
            <Card className="border-amber-400/60">
              <CardContent className="py-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium text-amber-700 dark:text-amber-400">
                      Risk flags
                    </div>
                    <ul className="text-sm list-disc ml-5 space-y-0.5">
                      {analytics.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Value" value={formatMoney(analytics.totalValue)} />
            <StatCard
              label="Total Return (vs cost)"
              value={formatPct(analytics.totalReturnPct)}
              positive={analytics.totalReturnPct !== null && analytics.totalReturnPct >= 0}
            />
            <StatCard
              label={`Period Return (${timeframe})`}
              value={formatPct(analytics.periodReturnPct)}
              positive={analytics.periodReturnPct !== null && analytics.periodReturnPct >= 0}
            />
            <StatCard label="CAGR" value={formatPct(analytics.cagrPct)} />
          </div>

          {/* Returns & Risk cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Returns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Annualized Return" value={formatPct(analytics.retAnn)} />
                <Row label="CAGR" value={formatPct(analytics.cagrPct)} />
                <Row label="Cost Basis" value={formatMoney(analytics.costBasis)} />
                <Row
                  label="Gain/Loss vs Cost"
                  value={formatMoney(analytics.totalValue - analytics.costBasis)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Volatility (annualized)" value={formatPct(analytics.volAnn)} />
                <Row label="Max Drawdown" value={formatPct(analytics.mdd)} />
                <Row label="Sharpe Ratio" value={formatNum(analytics.sharpe)} />
                <Row label="Sortino Ratio" value={formatNum(analytics.sortino)} />
                <Row label="VaR (95%, 1-day)" value={formatMoney(analytics.var95Val)} />
                <Row label="CVaR (95%, 1-day)" value={formatMoney(analytics.cvar95Val)} />
              </CardContent>
            </Card>
          </div>

          {/* Benchmark */}
          <Card>
            <CardHeader>
              <CardTitle>Benchmark Comparison (vs SPY)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <Row label="Alpha (annualized)" value={formatPct(analytics.alphaAnn)} />
                <Row label="Beta" value={formatNum(analytics.beta)} />
                <Row label="Information Ratio" value={formatNum(analytics.ir)} />
                <Row label="Treynor Ratio" value={formatNum(analytics.treynor)} />
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={analytics.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(t) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                    minTickGap={40}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      fontSize: 11,
                      color: "#111827",
                    }}
                    labelFormatter={(t) => new Date(t).toLocaleDateString()}
                    formatter={(v: any, name: any) => [
                      typeof v === "number" ? v.toFixed(2) : v,
                      name === "portfolio" ? "Portfolio" : "SPY",
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} dot={false} name="Portfolio" />
                  <Line type="monotone" dataKey="spy" stroke="#f97316" strokeWidth={2} dot={false} name="SPY" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Concentration + Holdings table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Concentration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Top 1 Holding" value={formatPct(analytics.top1)} />
                <Row label="Top 3 Holdings" value={formatPct(analytics.top3)} />
                <Row label="Top 5 Holdings" value={formatPct(analytics.top5)} />
                <Row label="# Holdings" value={String(holdings.length)} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Holdings Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
                        <th className="py-2 pr-3">Symbol</th>
                        <th className="py-2 pr-3 text-right">Weight</th>
                        <th className="py-2 pr-3 text-right">Value</th>
                        <th className="py-2 pr-3 text-right">Return</th>
                        <th className="py-2 pr-3 text-right">Vol</th>
                        <th className="py-2 pr-3 text-right">Beta</th>
                        <th className="py-2 pr-3 text-right">Sharpe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.holdingStats
                        .slice()
                        .sort((a, b) => b.weight - a.weight)
                        .map((h) => (
                          <tr key={h.symbol} className="border-b border-gray-100 dark:border-gray-800/50">
                            <td className="py-2 pr-3 font-medium">{h.symbol}</td>
                            <td className="py-2 pr-3 text-right">{formatPct(h.weight)}</td>
                            <td className="py-2 pr-3 text-right">{formatMoney(h.value)}</td>
                            <td
                              className={`py-2 pr-3 text-right ${
                                h.returnSinceCost !== null && h.returnSinceCost >= 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {formatPct(h.returnSinceCost)}
                            </td>
                            <td className="py-2 pr-3 text-right">{formatPct(h.vol)}</td>
                            <td className="py-2 pr-3 text-right">{formatNum(h.beta)}</td>
                            <td className="py-2 pr-3 text-right">{formatNum(h.sharpe)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Correlation matrix */}
          {analytics.corrSymbols.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="p-1"></th>
                        {analytics.corrSymbols.map((s) => (
                          <th key={s} className="p-1 font-medium">{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.corrMatrix.map((row, i) => (
                        <tr key={i}>
                          <td className="p-1 font-medium">{analytics.corrSymbols[i]}</td>
                          {row.map((r, j) => (
                            <td
                              key={j}
                              className="p-1 text-center rounded"
                              style={{
                                backgroundColor: corrColor(r),
                                color: Math.abs(r) > 0.5 ? "#fff" : "#111827",
                                minWidth: 48,
                              }}
                              title={`${analytics.corrSymbols[i]} / ${analytics.corrSymbols[j]}: ${r.toFixed(2)}`}
                            >
                              {r.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-gray-500 dark:text-text-secondary">
            Assumptions: {TRADING_DAYS} trading days/year, risk-free rate{" "}
            {(DEFAULT_RISK_FREE_RATE * 100).toFixed(1)}%, benchmark = SPY. Values are point-in-time
            and use current share counts across the selected window.
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const colorClass =
    positive === undefined
      ? ""
      : positive
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-gray-500 dark:text-text-secondary">{label}</div>
        <div className={`text-xl font-semibold mt-1 ${colorClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 dark:text-text-secondary">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Red–neutral–green gradient for correlation values in [-1,1]
function corrColor(r: number): string {
  // Clamp
  const x = Math.max(-1, Math.min(1, r));
  if (x >= 0) {
    // 0 -> white-ish, 1 -> dark green
    const alpha = x;
    return `rgba(34,197,94,${alpha.toFixed(3)})`;
  } else {
    const alpha = -x;
    return `rgba(239,68,68,${alpha.toFixed(3)})`;
  }
}
