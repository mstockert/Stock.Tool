import { useState, useMemo } from "react";
import { StockHistory } from "@shared/schema";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Area,
  AreaChart,
  Line,
  Bar,
  Cell,
  ComposedChart,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type IndicatorState = {
  showSMAShort: boolean;
  showSMAMedium: boolean;
  showSMALong: boolean;
  showSMA50: boolean;
  showSMA200: boolean;
  showTrendMA: boolean;
  showBollinger: boolean;
  showBenchmark?: boolean;
  showPatterns?: boolean;
  showSR?: boolean;
  showPivots?: boolean;
  showVolume?: boolean;
  showRSI?: boolean;
  showMACD?: boolean;
};

export type ChartPattern = {
  type: string;
  confidence: "High" | "Medium" | "Low";
  description: string;
  location: { startIdx: number; endIdx: number };
  targetPrice?: number;
  neckline?: number;
};

export type SRLevel = { level: number; touches: number };

type StockChartProps = {
  data: StockHistory[];
  timeframe: string;
  isPositive: boolean;
  indicators?: IndicatorState;
  onIndicatorChange?: (indicators: IndicatorState) => void;
  benchmarkData?: StockHistory[];
  benchmarkSymbol?: string;
  patterns?: ChartPattern[];
  supportLevels?: SRLevel[];
  resistanceLevels?: SRLevel[];
  pivots?: { highs: number[]; lows: number[] };
  highlightPatternIdx?: number | null;
};

// Calculate Simple Moving Average
const calculateSMA = (data: number[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
};

// Calculate Exponential Moving Average (for Trend MA)
const calculateEMA = (data: number[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push((data[i] - prev) * multiplier + prev);
    }
  }
  return result;
};

// Calculate RSI (Wilder's smoothing)
const calculateRSI = (closes: number[], period: number = 14): (number | null)[] => {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
};

// Calculate MACD (12, 26, 9)
const calculateMACD = (
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signalP: number = 9,
): { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } => {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macd: (number | null)[] = closes.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f != null && s != null ? f - s : null;
  });
  // Signal line is EMA of macd, but EMA only over defined values
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  let started = false;
  let emaVal = 0;
  const k = 2 / (signalP + 1);
  let count = 0;
  let seed = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] == null) continue;
    if (!started) {
      count++;
      seed += macd[i] as number;
      if (count === signalP) {
        emaVal = seed / signalP;
        signal[i] = emaVal;
        started = true;
      }
    } else {
      emaVal = ((macd[i] as number) - emaVal) * k + emaVal;
      signal[i] = emaVal;
    }
  }
  const hist: (number | null)[] = macd.map((m, i) =>
    m != null && signal[i] != null ? m - (signal[i] as number) : null
  );
  return { macd, signal, hist };
};

// Calculate Bollinger Bands
const calculateBollingerBands = (data: number[], period: number = 20, multiplier: number = 2) => {
  const sma = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || sma[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i]!;
      const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mean + multiplier * stdDev);
      lower.push(mean - multiplier * stdDev);
    }
  }

  return { upper, lower, middle: sma };
};

const StockChart = ({ data, timeframe, isPositive, indicators, onIndicatorChange, benchmarkData, benchmarkSymbol = "SPY", patterns = [], supportLevels = [], resistanceLevels = [], pivots, highlightPatternIdx = null }: StockChartProps) => {
  // Use local state if no external state is provided
  const [localIndicators, setLocalIndicators] = useState<IndicatorState>({
    showSMAShort: false,
    showSMAMedium: false,
    showSMALong: false,
    showSMA50: true,
    showSMA200: true,
    showTrendMA: false,
    showBollinger: false,
    showBenchmark: true,
    showPatterns: true,
    showSR: true,
    showPivots: false,
    showVolume: true,
    showRSI: true,
    showMACD: false,
  });

  // Use external indicators if provided, otherwise use local state
  const currentIndicators = indicators || localIndicators;
  const { showSMAShort, showSMAMedium, showSMALong, showSMA50, showSMA200, showTrendMA, showBollinger } = currentIndicators;
  const showBenchmark = currentIndicators.showBenchmark !== false;
  const showPatterns = currentIndicators.showPatterns !== false;
  const showSR = currentIndicators.showSR !== false;
  const showPivots = currentIndicators.showPivots === true;
  const showVolume = currentIndicators.showVolume !== false;
  const showRSI = currentIndicators.showRSI !== false;
  const showMACD = currentIndicators.showMACD === true;
  const hasBenchmark = !!benchmarkData && benchmarkData.length > 0;
  const hasPatterns = patterns.length > 0;
  const hasSR = (supportLevels?.length || 0) + (resistanceLevels?.length || 0) > 0;
  const hasPivots = !!pivots && (pivots.highs.length + pivots.lows.length) > 0;

  const updateIndicator = (key: keyof IndicatorState, value: boolean) => {
    const newIndicators = { ...currentIndicators, [key]: value };
    if (onIndicatorChange) {
      onIndicatorChange(newIndicators);
    } else {
      setLocalIndicators(newIndicators);
    }
  };

  const chartColor = isPositive ? "#22c55e" : "#ef4444";

  // Use colors that work on both light and dark backgrounds
  const axisColor = "#666666";
  const gridColor = "#e5e5e5";

  // Calculate appropriate periods based on data length
  const dataLength = data?.length || 0;
  const shortPeriod = Math.max(2, Math.min(5, Math.floor(dataLength / 3)));
  const mediumPeriod = Math.max(3, Math.min(10, Math.floor(dataLength / 2)));
  const longPeriod = Math.max(5, Math.min(20, Math.floor(dataLength * 0.8)));

  // Calculate technical indicators
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const closes = data.map(d => d.close);
    const len = closes.length;

    // Use adaptive periods based on data length
    const shortP = Math.max(2, Math.min(5, Math.floor(len / 3)));
    const mediumP = Math.max(3, Math.min(10, Math.floor(len / 2)));
    const longP = Math.max(5, Math.min(20, Math.floor(len * 0.8)));
    const bollingerP = Math.max(3, Math.min(10, Math.floor(len / 2)));

    const smaShort = calculateSMA(closes, shortP);
    const smaMedium = calculateSMA(closes, mediumP);
    const smaLong = calculateSMA(closes, longP);
    const sma50 = calculateSMA(closes, Math.min(50, len));
    const sma200 = calculateSMA(closes, Math.min(200, len));
    const trendMA = calculateEMA(closes, Math.min(21, Math.max(2, Math.floor(len / 2))));
    const bollinger = calculateBollingerBands(closes, bollingerP, 2);
    const rsi = calculateRSI(closes, Math.min(14, Math.max(2, Math.floor(len / 3))));
    const macd = calculateMACD(closes, 12, 26, 9);
    const volumeMA = calculateSMA(data.map(d => d.volume || 0), Math.min(20, Math.max(3, Math.floor(len / 4))));

    // Build benchmark lookup rebased to stock's first close
    const benchmarkByTs = new Map<string, number>();
    if (benchmarkData && benchmarkData.length > 0 && closes.length > 0) {
      const bFirst = benchmarkData[0].close;
      const sFirst = closes[0];
      if (bFirst > 0) {
        const scale = sFirst / bFirst;
        for (const b of benchmarkData) {
          benchmarkByTs.set(b.timestamp, b.close * scale);
        }
      }
    }

    return data.map((item, index) => {
      const prevClose = index > 0 ? data[index - 1].close : item.close;
      const volColor = item.close >= prevClose ? "#22c55e" : "#ef4444";
      return {
        ...item,
        smaShort: smaShort[index],
        smaMedium: smaMedium[index],
        smaLong: smaLong[index],
        sma50: sma50[index],
        sma200: sma200[index],
        trendMA: trendMA[index],
        bollingerUpper: bollinger.upper[index],
        bollingerLower: bollinger.lower[index],
        bollingerMiddle: bollinger.middle[index],
        benchmarkRebased: benchmarkByTs.get(item.timestamp) ?? null,
        rsi: rsi[index],
        macd: macd.macd[index],
        macdSignal: macd.signal[index],
        macdHist: macd.hist[index],
        volumeMA: volumeMA[index],
        volColor,
      };
    });
  }, [data, benchmarkData]);

  // Format date for x-axis based on timeframe
  const formatDate = (timestamp: string) => {
    const date = timestamp.includes(' ')
      ? new Date(timestamp.replace(' ', 'T'))
      : new Date(timestamp);

    switch (timeframe) {
      case "1D":
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      case "1W":
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      case "1M":
      case "3M":
        // Show month and day for better clarity
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      case "1Y":
        // Show month and year for yearly view
        return date.toLocaleDateString([], { month: "short", year: "2-digit" });
      case "5Y":
        return date.toLocaleDateString([], { year: "numeric" });
      default:
        return date.toLocaleDateString();
    }
  };

  // Format tooltip date
  const formatTooltipDate = (timestamp: string) => {
    const date = timestamp.includes(' ')
      ? new Date(timestamp.replace(' ', 'T'))
      : new Date(timestamp);

    if (timeframe === "1D") {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }`;
    }

    return date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-dark-surface p-3 border border-gray-200 dark:border-gray-800 rounded shadow-md text-sm">
          <p className="text-gray-500 dark:text-text-secondary text-xs mb-2">
            {formatTooltipDate(data.timestamp)}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
            <span className="text-gray-600">Open:</span>
            <span>${data.open.toFixed(2)}</span>
            <span className="text-gray-600">High:</span>
            <span>${data.high.toFixed(2)}</span>
            <span className="text-gray-600">Low:</span>
            <span>${data.low.toFixed(2)}</span>
            <span className="text-gray-600">Close:</span>
            <span className="font-semibold">${data.close.toFixed(2)}</span>
          </div>
          {(showSMAShort || showSMAMedium || showSMALong || showSMA50 || showSMA200 || showTrendMA || showBollinger) && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
              {showSMAShort && data.smaShort && (
                <>
                  <span className="text-orange-500">SMA Short:</span>
                  <span>${data.smaShort.toFixed(2)}</span>
                </>
              )}
              {showSMAMedium && data.smaMedium && (
                <>
                  <span className="text-blue-500">SMA Medium:</span>
                  <span>${data.smaMedium.toFixed(2)}</span>
                </>
              )}
              {showSMALong && data.smaLong && (
                <>
                  <span className="text-purple-500">SMA Long:</span>
                  <span>${data.smaLong.toFixed(2)}</span>
                </>
              )}
              {showSMA50 && data.sma50 && (
                <>
                  <span className="text-teal-500">SMA 50:</span>
                  <span>${data.sma50.toFixed(2)}</span>
                </>
              )}
              {showSMA200 && data.sma200 && (
                <>
                  <span className="text-red-500">SMA 200:</span>
                  <span>${data.sma200.toFixed(2)}</span>
                </>
              )}
              {showTrendMA && data.trendMA && (
                <>
                  <span className="text-yellow-500">Trend MA:</span>
                  <span>${data.trendMA.toFixed(2)}</span>
                </>
              )}
              {showBollinger && data.bollingerUpper && (
                <>
                  <span className="text-pink-500">BB Upper:</span>
                  <span>${data.bollingerUpper.toFixed(2)}</span>
                  <span className="text-pink-500">BB Lower:</span>
                  <span>${data.bollingerLower.toFixed(2)}</span>
                </>
              )}
              {showBenchmark && hasBenchmark && data.benchmarkRebased != null && (
                <>
                  <span className="text-cyan-500">{benchmarkSymbol} (rebased):</span>
                  <span>${data.benchmarkRebased.toFixed(2)}</span>
                </>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      {/* Indicator Toggles */}
      <div className="flex flex-wrap gap-4 mb-3 px-1">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="smaShort"
            checked={showSMAShort}
            onCheckedChange={(checked) => updateIndicator('showSMAShort', checked as boolean)}
          />
          <Label htmlFor="smaShort" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-orange-500 inline-block"></span>
            SMA ({shortPeriod})
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="smaMedium"
            checked={showSMAMedium}
            onCheckedChange={(checked) => updateIndicator('showSMAMedium', checked as boolean)}
          />
          <Label htmlFor="smaMedium" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
            SMA ({mediumPeriod})
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="smaLong"
            checked={showSMALong}
            onCheckedChange={(checked) => updateIndicator('showSMALong', checked as boolean)}
          />
          <Label htmlFor="smaLong" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-purple-500 inline-block"></span>
            SMA ({longPeriod})
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sma50"
            checked={showSMA50}
            onCheckedChange={(checked) => updateIndicator('showSMA50', checked as boolean)}
          />
          <Label htmlFor="sma50" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-teal-500 inline-block"></span>
            SMA (50)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sma200"
            checked={showSMA200}
            onCheckedChange={(checked) => updateIndicator('showSMA200', checked as boolean)}
          />
          <Label htmlFor="sma200" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-500 inline-block"></span>
            SMA (200)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="trendMA"
            checked={showTrendMA}
            onCheckedChange={(checked) => updateIndicator('showTrendMA', checked as boolean)}
          />
          <Label htmlFor="trendMA" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-yellow-500 inline-block"></span>
            Trend MA (21 EMA)
          </Label>
        </div>
        {hasBenchmark && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="benchmark"
              checked={showBenchmark}
              onCheckedChange={(checked) => updateIndicator('showBenchmark', checked as boolean)}
            />
            <Label htmlFor="benchmark" className="text-sm cursor-pointer flex items-center gap-1">
              <span className="w-3 h-0.5 bg-cyan-500 inline-block"></span>
              vs. {benchmarkSymbol}
            </Label>
          </div>
        )}
        {hasPatterns && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="patterns"
              checked={showPatterns}
              onCheckedChange={(checked) => updateIndicator('showPatterns', checked as boolean)}
            />
            <Label htmlFor="patterns" className="text-sm cursor-pointer flex items-center gap-1">
              <span className="w-3 h-2 bg-amber-400/40 border border-amber-400 inline-block"></span>
              Patterns ({patterns.length})
            </Label>
          </div>
        )}
        {hasSR && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sr"
              checked={showSR}
              onCheckedChange={(checked) => updateIndicator('showSR', checked as boolean)}
            />
            <Label htmlFor="sr" className="text-sm cursor-pointer flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span>
              S/R
            </Label>
          </div>
        )}
        {hasPivots && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pivots"
              checked={showPivots}
              onCheckedChange={(checked) => updateIndicator('showPivots', checked as boolean)}
            />
            <Label htmlFor="pivots" className="text-sm cursor-pointer flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span>
              Pivots
            </Label>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="volPanel"
            checked={showVolume}
            onCheckedChange={(checked) => updateIndicator('showVolume', checked as boolean)}
          />
          <Label htmlFor="volPanel" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-slate-400 inline-block"></span>
            Volume
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rsiPanel"
            checked={showRSI}
            onCheckedChange={(checked) => updateIndicator('showRSI', checked as boolean)}
          />
          <Label htmlFor="rsiPanel" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-fuchsia-500 inline-block"></span>
            RSI
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="macdPanel"
            checked={showMACD}
            onCheckedChange={(checked) => updateIndicator('showMACD', checked as boolean)}
          />
          <Label htmlFor="macdPanel" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-indigo-500 inline-block"></span>
            MACD
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="bollinger"
            checked={showBollinger}
            onCheckedChange={(checked) => updateIndicator('showBollinger', checked as boolean)}
          />
          <Label htmlFor="bollinger" className="text-sm cursor-pointer flex items-center gap-1">
            <span className="w-3 h-0.5 bg-pink-500 inline-block"></span>
            Bollinger Bands
          </Label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bollingerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#ec4899" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fill: axisColor, fontSize: 11 }}
            axisLine={{ stroke: axisColor }}
            tickLine={{ stroke: axisColor }}
            minTickGap={50}
            height={40}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: axisColor, fontSize: 12 }}
            axisLine={{ stroke: axisColor }}
            tickLine={{ stroke: axisColor }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Bollinger Bands - render first so they appear behind */}
          {showBollinger && (
            <>
              <Area
                type="monotone"
                dataKey="bollingerUpper"
                stroke="#ec4899"
                strokeWidth={1}
                strokeDasharray="3 3"
                fill="none"
                dot={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="bollingerLower"
                stroke="#ec4899"
                strokeWidth={1}
                strokeDasharray="3 3"
                fill="url(#bollingerFill)"
                dot={false}
                connectNulls
              />
            </>
          )}

          {/* Price Area */}
          <Area
            type="monotone"
            dataKey="close"
            stroke={chartColor}
            fillOpacity={1}
            fill="url(#colorClose)"
            strokeWidth={2}
            activeDot={{ r: 6, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
          />

          {/* SMA Lines */}
          {showSMAShort && (
            <Line
              type="monotone"
              dataKey="smaShort"
              stroke="#f97316"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
          {showSMAMedium && (
            <Line
              type="monotone"
              dataKey="smaMedium"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
          {showSMALong && (
            <Line
              type="monotone"
              dataKey="smaLong"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
          {showSMA50 && (
            <Line
              type="monotone"
              dataKey="sma50"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
          {showSMA200 && (
            <Line
              type="monotone"
              dataKey="sma200"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
          {showTrendMA && (
            <Line
              type="monotone"
              dataKey="trendMA"
              stroke="#eab308"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />
          )}

          {/* Benchmark (rebased) */}
          {hasBenchmark && showBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmarkRebased"
              stroke="#06b6d4"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
            />
          )}

          {/* Opening price reference line */}
          {chartData.length > 0 && (
            <ReferenceLine
              y={chartData[0].close}
              stroke="#666"
              strokeDasharray="3 3"
            />
          )}

          {/* Support / Resistance horizontal lines */}
          {showSR && resistanceLevels.map((r, i) => (
            <ReferenceLine
              key={`res-${i}`}
              y={r.level}
              stroke="#ef4444"
              strokeOpacity={0.55}
              strokeDasharray="5 3"
              label={{
                value: `R $${r.level.toFixed(2)} (${r.touches}x)`,
                position: "insideTopLeft",
                fill: "#ef4444",
                fontSize: 10,
              }}
            />
          ))}
          {showSR && supportLevels.map((s, i) => (
            <ReferenceLine
              key={`sup-${i}`}
              y={s.level}
              stroke="#10b981"
              strokeOpacity={0.55}
              strokeDasharray="5 3"
              label={{
                value: `S $${s.level.toFixed(2)} (${s.touches}x)`,
                position: "insideBottomLeft",
                fill: "#10b981",
                fontSize: 10,
              }}
            />
          ))}

          {/* Pivot dots */}
          {showPivots && hasPivots && pivots!.highs.map((idx, i) => (
            data[idx] ? (
              <ReferenceDot
                key={`ph-${i}`}
                x={data[idx].timestamp}
                y={data[idx].high}
                r={3}
                fill="#0ea5e9"
                stroke="#fff"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            ) : null
          ))}
          {showPivots && hasPivots && pivots!.lows.map((idx, i) => (
            data[idx] ? (
              <ReferenceDot
                key={`pl-${i}`}
                x={data[idx].timestamp}
                y={data[idx].low}
                r={3}
                fill="#0ea5e9"
                stroke="#fff"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            ) : null
          ))}

          {/* Detected pattern overlays */}
          {showPatterns && hasPatterns && patterns.map((p, i) => {
            const s = Math.max(0, Math.min(p.location.startIdx, data.length - 1));
            const e = Math.max(0, Math.min(p.location.endIdx, data.length - 1));
            const x1 = data[s]?.timestamp;
            const x2 = data[e]?.timestamp;
            if (!x1 || !x2) return null;
            const isHighlight = highlightPatternIdx === i;
            const color =
              p.confidence === "High" ? "#f59e0b" :
              p.confidence === "Medium" ? "#fbbf24" : "#fcd34d";
            return (
              <ReferenceArea
                key={`pat-${i}`}
                x1={x1}
                x2={x2}
                stroke={isHighlight ? "#f97316" : color}
                strokeOpacity={isHighlight ? 1 : 0.8}
                strokeWidth={isHighlight ? 2 : 1}
                fill={isHighlight ? "#f97316" : color}
                fillOpacity={isHighlight ? 0.25 : 0.12}
                label={{ value: p.type, position: "insideTop", fill: isHighlight ? "#f97316" : color, fontSize: 10 }}
                ifOverflow="extendDomain"
              />
            );
          })}
          {/* Necklines for H&S patterns — only drawn within pattern's x-range via segment */}
          {showPatterns && hasPatterns && patterns.map((p, i) => {
            if (p.neckline == null) return null;
            const s = Math.max(0, Math.min(p.location.startIdx, data.length - 1));
            const e = Math.max(0, Math.min(p.location.endIdx, data.length - 1));
            const x1 = data[s]?.timestamp;
            const x2 = data[e]?.timestamp;
            if (!x1 || !x2) return null;
            return (
              <ReferenceLine
                key={`neck-${i}`}
                segment={[{ x: x1, y: p.neckline }, { x: x2, y: p.neckline }]}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                label={{ value: `neckline $${p.neckline.toFixed(2)}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 9 }}
              />
            );
          })}
          {/* Pattern target prices */}
          {showPatterns && hasPatterns && patterns.map((p, i) => (
            p.targetPrice != null ? (
              <ReferenceLine
                key={`tgt-${i}`}
                y={p.targetPrice}
                stroke="#f59e0b"
                strokeDasharray="2 4"
                strokeOpacity={highlightPatternIdx === i ? 0.9 : 0.5}
                label={{ value: `${p.type} target $${p.targetPrice.toFixed(2)}`, position: "right", fill: "#f59e0b", fontSize: 9 }}
              />
            ) : null
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume sub-panel */}
      {showVolume && (
        <ResponsiveContainer width="100%" height={90}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                return String(v);
              }}
              width={65}
            />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.1)" }}
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
              labelFormatter={(l) => formatTooltipDate(String(l))}
              formatter={(value: any, name: any) => {
                if (name === "volume") return [Number(value).toLocaleString(), "Volume"];
                if (name === "volumeMA") return [Number(value).toLocaleString(), "Vol MA"];
                return [value, name];
              }}
            />
            <Bar dataKey="volume" isAnimationActive={false}>
              {chartData.map((d, i) => (
                <Cell key={`cell-${i}`} fill={d.volColor} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="volumeMA" stroke="#64748b" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* RSI sub-panel */}
      {showRSI && (
        <ResponsiveContainer width="100%" height={90}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 30, 50, 70, 100]}
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              width={65}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
              labelFormatter={(l) => formatTooltipDate(String(l))}
              formatter={(value: any) => [typeof value === "number" ? value.toFixed(1) : value, "RSI(14)"]}
            />
            <ReferenceLine y={70} stroke="#ef4444" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#10b981" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={50} stroke="#94a3b8" strokeOpacity={0.25} />
            <Line type="monotone" dataKey="rsi" stroke="#d946ef" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* MACD sub-panel */}
      {showMACD && (
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              width={65}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
              labelFormatter={(l) => formatTooltipDate(String(l))}
              formatter={(value: any, name: any) => {
                const label = name === "macd" ? "MACD" : name === "macdSignal" ? "Signal" : "Histogram";
                return [typeof value === "number" ? value.toFixed(3) : value, label];
              }}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeOpacity={0.5} />
            <Bar dataKey="macdHist" fill="#6366f1" fillOpacity={0.5} isAnimationActive={false} />
            <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="macdSignal" stroke="#ef4444" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default StockChart;
