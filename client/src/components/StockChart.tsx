import { useEffect, useRef } from "react";
import { StockHistory } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

type StockChartProps = {
  data: StockHistory[];
  timeframe: string;
  isPositive: boolean;
};

const StockChart = ({ data, timeframe, isPositive }: StockChartProps) => {
  const chartColor = isPositive ? "#4CAF50" : "#F44336";
  const chartGradientStart = isPositive ? "rgba(76, 175, 80, 0.2)" : "rgba(244, 67, 54, 0.2)";
  const chartGradientEnd = "rgba(0, 0, 0, 0)";

  // Format date for x-axis based on timeframe
  const formatDate = (timestamp: string) => {
    // Handle different timestamp formats (ISO date vs datetime string)
    const date = timestamp.includes(' ') 
      ? new Date(timestamp.replace(' ', 'T'))  // Handle intraday format: "2025-04-23 14:30:00"
      : new Date(timestamp);                    // Handle regular format: "2025-04-23"
    
    switch (timeframe) {
      case "1D":
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      case "1W":
      case "1M":
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      case "3M":
      case "1Y":
        return date.toLocaleDateString([], { month: "short" });
      case "5Y":
        return date.toLocaleDateString([], { year: "numeric" });
      default:
        return date.toLocaleDateString();
    }
  };

  // Format tooltip date
  const formatTooltipDate = (timestamp: string) => {
    // Handle different timestamp formats (ISO date vs datetime string)
    const date = timestamp.includes(' ') 
      ? new Date(timestamp.replace(' ', 'T'))  // Handle intraday format: "2025-04-23 14:30:00"
      : new Date(timestamp);                    // Handle regular format: "2025-04-23"
    
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
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-surface p-3 border border-gray-800 rounded shadow-md">
          <p className="text-text-secondary text-xs mb-1">
            {formatTooltipDate(payload[0].payload.timestamp)}
          </p>
          <p className="font-mono text-sm mb-1">
            <span className="font-medium">Open:</span> ${payload[0].payload.open.toFixed(2)}
          </p>
          <p className="font-mono text-sm mb-1">
            <span className="font-medium">High:</span> ${payload[0].payload.high.toFixed(2)}
          </p>
          <p className="font-mono text-sm mb-1">
            <span className="font-medium">Low:</span> ${payload[0].payload.low.toFixed(2)}
          </p>
          <p className="font-mono text-sm">
            <span className="font-medium">Close:</span> ${payload[0].payload.close.toFixed(2)}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatDate} 
            tick={{ fill: '#A0A0A0' }} 
            axisLine={{ stroke: '#444' }}
            tickLine={{ stroke: '#444' }}
            minTickGap={25}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fill: '#A0A0A0' }} 
            axisLine={{ stroke: '#444' }}
            tickLine={{ stroke: '#444' }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke={chartColor} 
            fillOpacity={1}
            fill="url(#colorClose)" 
            strokeWidth={2}
            activeDot={{ r: 6, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
          />
          {data.length > 0 && (
            <ReferenceLine 
              y={data[0].close} 
              stroke="#666" 
              strokeDasharray="3 3" 
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
