import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TechnicalIndicators from "@/components/TechnicalIndicators";
import StockChart from "@/components/StockChart";
import { Search, Sparkles, RefreshCw, X } from "lucide-react";
import { StockHistory, StockQuote } from "@shared/schema";

export default function TechnicalAnalysisPage() {
  const RECENT_KEY = "ta:recentSymbols";
  const MAX_RECENT = 12;

  const [symbol, setSymbol] = useState("AAPL");
  const [searchInput, setSearchInput] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("1Y");
  const [highlightPatternIdx, setHighlightPatternIdx] = useState<number | null>(null);
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const chartRef = useRef<HTMLDivElement | null>(null);

  const addRecent = (sym: string) => {
    setRecentSymbols((prev) => {
      const next = [sym, ...prev.filter((s) => s !== sym)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeRecent = (sym: string) => {
    setRecentSymbols((prev) => {
      const next = prev.filter((s) => s !== sym);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Track the currently-analyzed symbol in the recent list
  useEffect(() => {
    if (symbol) addRecent(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const handlePatternClick = (idx: number) => {
    setHighlightPatternIdx(idx);
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => setHighlightPatternIdx(null), 3000);
  };

  const handleSearch = () => {
    if (searchInput.trim()) {
      const sym = searchInput.toUpperCase().trim();
      setSymbol(sym);
      setSearchInput(sym);
    }
  };

  const handleRecentClick = (sym: string) => {
    setSymbol(sym);
    setSearchInput(sym);
  };

  // Fetch stock history
  const { data: history, isLoading: historyLoading } = useQuery<StockHistory[]>({
    queryKey: [`/api/stocks/history/${symbol}`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/history/${symbol}?timeframe=${timeframe}`);
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
  });

  // Fetch stock quote
  const { data: quote } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/quote/${symbol}`],
  });

  // Fetch SPY history for benchmark overlay (skip when viewing SPY itself)
  const { data: spyHistory } = useQuery<StockHistory[]>({
    queryKey: [`/api/stocks/history/SPY`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/history/SPY?timeframe=${timeframe}`);
      if (!response.ok) throw new Error("Failed to fetch SPY history");
      return response.json();
    },
    enabled: symbol !== "SPY",
  });

  // Fetch real technical analysis
  type TrendAnalysis = {
    direction: "Uptrend" | "Downtrend" | "Sideways";
    strength: "Strong" | "Moderate" | "Weak";
    summary: string;
    details: string[];
    priceVsSMA50: number;
    priceVsSMA200: number;
    sma50AboveSma200: boolean;
    slope: number;
  };
  type SRLevel = { level: number; touches: number; distance: number };
  type SupportResistance = {
    support: SRLevel[];
    resistance: SRLevel[];
    summary: string;
  };
  type VolumeAnalysis = {
    avgVolume: number;
    recentAvgVolume: number;
    currentVolume: number;
    volumeRatio: number;
    trend: "Increasing" | "Decreasing" | "Stable";
    summary: string;
  };
  type DetectedPattern = {
    type: string;
    confidence: "High" | "Medium" | "Low";
    description: string;
    location: { startIdx: number; endIdx: number };
    targetPrice?: number;
    neckline?: number;
  };
  type RiskReturnMetrics = {
    periodDays: number;
    totalReturnPct: number;
    cagrPct: number | null;
    maxDrawdownPct: number;
    sharpe: number | null;
    sortino: number | null;
    valueAtRisk95Pct: number;
  };
  type BenchmarkComparison = {
    benchmarkSymbol: string;
    correlation: number;
    beta: number;
    alphaPct: number;
    trackingErrorPct: number;
    informationRatio: number | null;
    stockReturnPct: number;
    benchmarkReturnPct: number;
    outperformancePct: number;
  };
  type AnalysisResult = {
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
  };

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisResult>({
    queryKey: [`/api/stocks/analysis/${symbol}`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/analysis/${symbol}?timeframe=${timeframe}`);
      if (!response.ok) throw new Error("Failed to fetch analysis");
      return response.json();
    },
    enabled: !!symbol,
  });

  // AI commentary — fetched on demand (Anthropic call is expensive)
  type CommentaryResponse = { symbol: string; timeframe: string; commentary: string; generatedAt: string; cached?: boolean };
  const [commentaryEnabled, setCommentaryEnabled] = useState(false);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const { data: commentary, isFetching: commentaryLoading, refetch: refetchCommentary, error: commentaryError } =
    useQuery<CommentaryResponse>({
      queryKey: [`/api/stocks/commentary/${symbol}`, timeframe],
      queryFn: async () => {
        const url = `/api/stocks/commentary/${symbol}?timeframe=${timeframe}${forceRegenerate ? "&force=true" : ""}`;
        const response = await fetch(url);
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Failed to generate commentary" }));
          throw new Error(err.error || "Failed to generate commentary");
        }
        setForceRegenerate(false);
        return response.json();
      },
      enabled: commentaryEnabled,
      staleTime: 6 * 60 * 60 * 1000, // 6h (matches server cache)
      refetchOnWindowFocus: false,
      retry: false,
    });

  const formatGeneratedAt = (iso: string) => {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleString();
  };

  const fmtPrice = (n: number) => `$${n.toFixed(2)}`;
  const fmtVolume = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  };

  const isPositive = (quote?.changePercent || 0) >= 0;
  const timeframes = ["1D", "1W", "1M", "3M", "1Y"];

  // Stale-data notice: when the latest bar isn't from today (e.g. weekend, holiday,
  // or pre-open) the 1D chart represents the most recent session, not live data.
  const staleNotice = (() => {
    if (!history || history.length === 0) {
      if (timeframe === "1D") return "No intraday data available right now — try 1W or 1M.";
      return null;
    }
    const last = history[history.length - 1];
    const lastDate = new Date(last.timestamp);
    if (isNaN(lastDate.getTime())) return null;
    const today = new Date();
    const sameDay =
      lastDate.getFullYear() === today.getFullYear() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getDate() === today.getDate();
    if (sameDay) return null;
    const label = lastDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return timeframe === "1D"
      ? `Markets closed — showing last session (${label}).`
      : null;
  })();

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Technical Analysis</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analyze Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Enter stock symbol (e.g. AAPL)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          </div>
          {recentSymbols.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-text-secondary mr-1">Recent:</span>
              {recentSymbols.map((sym) => (
                <div
                  key={sym}
                  className={`group inline-flex items-center gap-1 rounded-full border text-xs pl-2 pr-1 py-0.5 cursor-pointer transition-colors ${
                    sym === symbol
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleRecentClick(sym)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleRecentClick(sym);
                  }}
                >
                  <span className="font-medium">{sym}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecent(sym);
                    }}
                    className={`ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100 ${
                      sym === symbol ? "hover:bg-blue-700" : "hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                    aria-label={`Remove ${sym}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6" ref={chartRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{symbol} Price Chart</CardTitle>
          <div className="flex gap-2">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {staleNotice && (
            <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-200">
              {staleNotice}
            </div>
          )}
          {historyLoading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : (
            <StockChart
              data={history || []}
              timeframe={timeframe}
              isPositive={isPositive}
              benchmarkData={symbol !== "SPY" ? spyHistory : undefined}
              benchmarkSymbol="SPY"
              patterns={analysis?.patterns || []}
              supportLevels={analysis?.supportResistance.support.map(s => ({ level: s.level, touches: s.touches })) || []}
              resistanceLevels={analysis?.supportResistance.resistance.map(r => ({ level: r.level, touches: r.touches })) || []}
              pivots={analysis?.pivots}
              highlightPatternIdx={highlightPatternIdx}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TechnicalIndicators symbol={symbol} />

        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {analysisLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !analysis ? (
              <p className="text-sm text-muted-foreground">No analysis available.</p>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-medium mb-2">Trend Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    {symbol} is in a <strong>{analysis.trend.strength.toLowerCase()} {analysis.trend.direction.toLowerCase()}</strong>
                    {typeof analysis.trend.slope === "number" &&
                      ` (20-bar slope ${analysis.trend.slope >= 0 ? "+" : ""}${analysis.trend.slope.toFixed(2)}%/bar)`}
                    .{" "}
                    {/* Strip server summary's redundant "strength direction. " prefix */}
                    {analysis.trend.summary.replace(
                      new RegExp(`^${analysis.trend.strength.toLowerCase()} ${analysis.trend.direction.toLowerCase()}\\.\\s*`, 'i'),
                      ''
                    )}
                    {analysis.indicators.rsi14 != null &&
                      ` RSI(14) at ${analysis.indicators.rsi14.toFixed(1)}${
                        analysis.indicators.rsi14 > 70
                          ? " — overbought."
                          : analysis.indicators.rsi14 < 30
                          ? " — oversold."
                          : " — neutral momentum."
                      }`}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-medium mb-2">Support & Resistance</h3>
                  <p className="text-sm text-muted-foreground">
                    Current price {fmtPrice(analysis.price)}.
                    {" "}Support:{" "}
                    {analysis.supportResistance.support.length > 0
                      ? analysis.supportResistance.support
                          .map((s) => `${fmtPrice(s.level)} (${s.touches}×)`)
                          .join(", ")
                      : "none detected"}
                    .{" "}Resistance:{" "}
                    {analysis.supportResistance.resistance.length > 0
                      ? analysis.supportResistance.resistance
                          .map((r) => `${fmtPrice(r.level)} (${r.touches}×)`)
                          .join(", ")
                      : "none detected"}
                    .
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-medium mb-2">Volume Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    {analysis.volume.summary}
                  </p>
                </div>
                {analysis.indicators.volatilityAnnualized != null && (
                  <div className="p-4 rounded-lg bg-muted">
                    <h3 className="font-medium mb-2">Volatility</h3>
                    <p className="text-sm text-muted-foreground">
                      Annualized volatility: {analysis.indicators.volatilityAnnualized.toFixed(1)}%
                      {analysis.indicators.atr14 != null &&
                        ` • ATR(14): ${fmtPrice(analysis.indicators.atr14)}`}
                      .
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {analysis && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI Commentary
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={commentaryLoading}
              onClick={() => {
                if (commentaryEnabled) {
                  setForceRegenerate(true);
                  refetchCommentary();
                } else {
                  setCommentaryEnabled(true);
                }
              }}
            >
              {commentaryLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : commentary ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {commentaryError ? (
              <p className="text-sm text-red-500">
                {(commentaryError as Error).message}
              </p>
            ) : commentaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : commentary ? (
              <div className="space-y-3">
                {commentary.commentary.split(/\n\s*\n/).map((para, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {para.trim()}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground/60 pt-2 border-t flex items-center gap-2 flex-wrap">
                  <span>Last generated {formatGeneratedAt(commentary.generatedAt)}</span>
                  {commentary.cached && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">
                      cached
                    </span>
                  )}
                  <span>• {new Date(commentary.generatedAt).toLocaleString()}</span>
                  <span>• Claude Sonnet 4</span>
                  <span>• Analytical tooling only, not financial advice.</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click <strong>Generate</strong> to produce a natural-language summary of {symbol}'s
                current technical setup using Claude.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk & Return ({analysis.riskReturn.periodDays} trading days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Total Return</div>
                  <div className={`font-semibold ${analysis.riskReturn.totalReturnPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {analysis.riskReturn.totalReturnPct >= 0 ? "+" : ""}
                    {analysis.riskReturn.totalReturnPct.toFixed(2)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">CAGR</div>
                  <div className={`font-semibold ${(analysis.riskReturn.cagrPct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {analysis.riskReturn.cagrPct == null
                      ? "—"
                      : `${analysis.riskReturn.cagrPct >= 0 ? "+" : ""}${analysis.riskReturn.cagrPct.toFixed(2)}%`}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Max Drawdown</div>
                  <div className="font-semibold text-red-500">
                    {analysis.riskReturn.maxDrawdownPct.toFixed(2)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">VaR (95%, 1-day)</div>
                  <div className="font-semibold text-red-500">
                    -{analysis.riskReturn.valueAtRisk95Pct.toFixed(2)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Sharpe Ratio</div>
                  <div className="font-semibold">
                    {analysis.riskReturn.sharpe == null ? "—" : analysis.riskReturn.sharpe.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Sortino Ratio</div>
                  <div className="font-semibold">
                    {analysis.riskReturn.sortino == null ? "—" : analysis.riskReturn.sortino.toFixed(2)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Risk-free rate: 4.5% annual (T-bill proxy). Ratios annualized assuming daily bars.
              </p>
            </CardContent>
          </Card>

          {analysis.benchmark ? (
            <Card>
              <CardHeader>
                <CardTitle>Relative to {analysis.benchmark.benchmarkSymbol}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-xs text-muted-foreground">Beta</div>
                    <div className="font-semibold">{analysis.benchmark.beta.toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-xs text-muted-foreground">Correlation</div>
                    <div className="font-semibold">{analysis.benchmark.correlation.toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-xs text-muted-foreground">Alpha (annualized)</div>
                    <div className={`font-semibold ${analysis.benchmark.alphaPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {analysis.benchmark.alphaPct >= 0 ? "+" : ""}{analysis.benchmark.alphaPct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-xs text-muted-foreground">Tracking Error</div>
                    <div className="font-semibold">{analysis.benchmark.trackingErrorPct.toFixed(2)}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-xs text-muted-foreground">Information Ratio</div>
                    <div className="font-semibold">
                      {analysis.benchmark.informationRatio == null
                        ? "—"
                        : analysis.benchmark.informationRatio.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-xs text-muted-foreground">Outperformance</div>
                    <div className={`font-semibold ${analysis.benchmark.outperformancePct >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {analysis.benchmark.outperformancePct >= 0 ? "+" : ""}
                      {analysis.benchmark.outperformancePct.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {symbol}: {analysis.benchmark.stockReturnPct >= 0 ? "+" : ""}
                  {analysis.benchmark.stockReturnPct.toFixed(2)}% vs {analysis.benchmark.benchmarkSymbol}:{" "}
                  {analysis.benchmark.benchmarkReturnPct >= 0 ? "+" : ""}
                  {analysis.benchmark.benchmarkReturnPct.toFixed(2)}% over overlapping window.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Relative to SPY</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Benchmark comparison unavailable for {symbol}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {analysis && analysis.patterns.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detected Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.patterns.map((p, idx) => {
                const bullish = /bottom|inverse|ascending|bullish/i.test(p.type);
                const bearish = /top|head and shoulders|descending|bearish/i.test(p.type) && !/inverse/i.test(p.type);
                const tone = bullish ? "bullish" : bearish ? "bearish" : "neutral";
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => handlePatternClick(idx)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handlePatternClick(idx); }}
                    className={`p-3 rounded-lg border-l-4 bg-muted cursor-pointer transition-all hover:bg-muted/70 hover:ring-1 hover:ring-amber-400/60 ${
                      highlightPatternIdx === idx ? "ring-2 ring-amber-500" : ""
                    } ${
                      tone === "bullish"
                        ? "border-green-500"
                        : tone === "bearish"
                        ? "border-red-500"
                        : "border-gray-400"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm">{p.type}</span>
                      <span
                        className={`text-xs uppercase font-semibold ${
                          tone === "bullish"
                            ? "text-green-500"
                            : tone === "bearish"
                            ? "text-red-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {tone} • {p.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    {p.targetPrice != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: {fmtPrice(p.targetPrice)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
