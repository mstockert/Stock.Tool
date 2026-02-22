import { useState, useMemo } from "react";
import { StockHistory } from "@shared/schema";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  Line,
  ComposedChart,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type IndicatorState = {
  showSMAShort: boolean;
  showSMAMedium: boolean;
  showSMALong: boolean;
  showBollinger: boolean;
};

type StockChartProps = {
  data: StockHistory[];
  timeframe: string;
  isPositive: boolean;
  indicators?: IndicatorState;
  onIndicatorChange?: (indicators: IndicatorState) => void;
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

const StockChart = ({ data, timeframe, isPositive, indicators, onIndicatorChange }: StockChartProps) => {
  // Use local state if no external state is provided
  const [localIndicators, setLocalIndicators] = useState<IndicatorState>({
    showSMAShort: false,
    showSMAMedium: false,
    showSMALong: false,
    showBollinger: false,
  });

  // Use external indicators if provided, otherwise use local state
  const currentIndicators = indicators || localIndicators;
  const { showSMAShort, showSMAMedium, showSMALong, showBollinger } = currentIndicators;

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
    const bollinger = calculateBollingerBands(closes, bollingerP, 2);

    return data.map((item, index) => ({
      ...item,
      smaShort: smaShort[index],
      smaMedium: smaMedium[index],
      smaLong: smaLong[index],
      bollingerUpper: bollinger.upper[index],
      bollingerLower: bollinger.lower[index],
      bollingerMiddle: bollinger.middle[index],
    }));
  }, [data]);

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
          {(showSMAShort || showSMAMedium || showSMALong || showBollinger) && (
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
              {showBollinger && data.bollingerUpper && (
                <>
                  <span className="text-pink-500">BB Upper:</span>
                  <span>${data.bollingerUpper.toFixed(2)}</span>
                  <span className="text-pink-500">BB Lower:</span>
                  <span>${data.bollingerLower.toFixed(2)}</span>
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

          {/* Opening price reference line */}
          {chartData.length > 0 && (
            <ReferenceLine
              y={chartData[0].close}
              stroke="#666"
              strokeDasharray="3 3"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
