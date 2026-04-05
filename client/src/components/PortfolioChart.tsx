import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

type PortfolioHistoryPoint = {
  timestamp: string;
  value: number;
};

type TimeframeOption = {
  label: string;
  value: string;
};

const TIMEFRAMES: TimeframeOption[] = [
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(timestamp: string, timeframe: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    // Try parsing "YYYYMMDD HH:MM:SS" format from IB
    const match = timestamp.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) {
      const d = new Date(`${match[1]}-${match[2]}-${match[3]}`);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return timestamp;
  }

  switch (timeframe) {
    case "1W":
      return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    case "1M":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "3M":
    case "1Y":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "5Y":
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    default:
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

type Props = {
  portfolioId: number;
};

export default function PortfolioChart({ portfolioId }: Props) {
  const [timeframe, setTimeframe] = useState("1Y");

  const { data: history = [], isLoading } = useQuery<PortfolioHistoryPoint[]>({
    queryKey: [`/api/portfolios/${portfolioId}/history`, timeframe],
    queryFn: async () => {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/history?timeframe=${timeframe}`
      );
      if (!res.ok) throw new Error("Failed to fetch portfolio history");
      return res.json();
    },
    staleTime: 60_000,
  });

  const hasData = history.length > 1;
  const startValue = hasData ? history[0].value : 0;
  const endValue = hasData ? history[history.length - 1].value : 0;
  const changeValue = endValue - startValue;
  const changePercent = startValue > 0 ? (changeValue / startValue) * 100 : 0;
  const isPositive = changeValue >= 0;

  // Calculate Y-axis domain with padding
  const values = history.map((h) => h.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.1 || maxVal * 0.05;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Portfolio Performance</h2>
          {hasData && (
            <div className="flex items-center gap-2 mt-1">
              {isPositive ? (
                <TrendingUp size={16} className="text-green-500" />
              ) : (
                <TrendingDown size={16} className="text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {isPositive ? "+" : ""}
                {formatCurrency(changeValue)} ({isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%)
              </span>
              <span className="text-gray-400 text-sm">
                over {TIMEFRAMES.find((t) => t.value === timeframe)?.label}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeframe === tf.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No historical data available for this timeframe
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? "#22c55e" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? "#22c55e" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts) => formatDate(ts, timeframe)}
                stroke="#6b7280"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v) => formatCurrency(v)}
                stroke="#6b7280"
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                labelFormatter={(ts) => formatDate(ts as string, timeframe)}
                formatter={(value: number) => [formatCurrency(value), "Portfolio Value"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#portfolioGradient)"
                dot={false}
                activeDot={{ r: 4, fill: isPositive ? "#22c55e" : "#ef4444" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
