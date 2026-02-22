import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type StockData = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  weekRange52: { low: number; high: number };
};

type PresetScreen = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  filter: (stocks: StockData[]) => StockData[];
};

const presetScreens: PresetScreen[] = [
  {
    id: "top-gainers",
    name: "Top Gainers",
    description: "Stocks with the highest % gain today",
    icon: <TrendingUp className="h-5 w-5 text-green-500" />,
    filter: (stocks) =>
      [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10),
  },
  {
    id: "top-losers",
    name: "Top Losers",
    description: "Stocks with the largest % decline today",
    icon: <TrendingDown className="h-5 w-5 text-red-500" />,
    filter: (stocks) =>
      [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10),
  },
  {
    id: "high-volume",
    name: "High Volume",
    description: "Stocks with unusually high trading volume",
    icon: <BarChart3 className="h-5 w-5 text-blue-500" />,
    filter: (stocks) =>
      [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 10),
  },
  {
    id: "near-52-high",
    name: "Near 52-Week High",
    description: "Stocks trading within 5% of their 52-week high",
    icon: <ArrowUpRight className="h-5 w-5 text-emerald-500" />,
    filter: (stocks) =>
      stocks
        .filter((s) => s.weekRange52.high > 0 && s.price >= s.weekRange52.high * 0.95)
        .sort((a, b) => b.price / b.weekRange52.high - a.price / a.weekRange52.high),
  },
  {
    id: "near-52-low",
    name: "Near 52-Week Low",
    description: "Stocks trading within 5% of their 52-week low",
    icon: <ArrowDownRight className="h-5 w-5 text-orange-500" />,
    filter: (stocks) =>
      stocks
        .filter((s) => s.weekRange52.low > 0 && s.price <= s.weekRange52.low * 1.05)
        .sort((a, b) => a.price / a.weekRange52.low - b.price / b.weekRange52.low),
  },
  {
    id: "value-stocks",
    name: "Value Stocks",
    description: "Stocks with P/E ratio under 20",
    icon: <Target className="h-5 w-5 text-purple-500" />,
    filter: (stocks) =>
      stocks.filter((s) => s.peRatio > 0 && s.peRatio < 20).sort((a, b) => a.peRatio - b.peRatio),
  },
  {
    id: "growth-stocks",
    name: "Growth Stocks",
    description: "High momentum stocks with strong gains",
    icon: <Zap className="h-5 w-5 text-yellow-500" />,
    filter: (stocks) =>
      stocks.filter((s) => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent),
  },
];

export default function ScreenerPage() {
  const [activeScreen, setActiveScreen] = useState<string>("top-gainers");

  // Fetch all stock data for screening
  const { data: stocks, isLoading } = useQuery<StockData[]>({
    queryKey: ["/api/screener/stocks"],
    queryFn: async () => {
      const response = await fetch("/api/screener/stocks");
      if (!response.ok) throw new Error("Failed to fetch stocks");
      return response.json();
    },
  });

  const currentScreen = presetScreens.find((s) => s.id === activeScreen);
  const filteredStocks = currentScreen && stocks ? currentScreen.filter(stocks) : [];

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Stock Screener</h1>
        <p className="text-gray-500">Filter stocks using preset screens</p>
      </div>

      {/* Preset Screen Buttons */}
      <div className="flex flex-wrap gap-2">
        {presetScreens.map((screen) => (
          <Button
            key={screen.id}
            variant={activeScreen === screen.id ? "default" : "outline"}
            className="flex items-center gap-2"
            onClick={() => setActiveScreen(screen.id)}
          >
            {screen.icon}
            {screen.name}
          </Button>
        ))}
      </div>

      {/* Active Screen Description */}
      {currentScreen && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {currentScreen.icon}
              <CardTitle>{currentScreen.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">{currentScreen.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Results {!isLoading && `(${filteredStocks.length} stocks)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
          ) : filteredStocks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No stocks match this criteria
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Symbol</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium text-right">Price</th>
                    <th className="pb-3 font-medium text-right">Change</th>
                    <th className="pb-3 font-medium text-right">Volume</th>
                    <th className="pb-3 font-medium text-right">Market Cap</th>
                    <th className="pb-3 font-medium text-right">P/E</th>
                    <th className="pb-3 font-medium text-right">52W Range</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock) => (
                    <tr
                      key={stock.symbol}
                      className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3">
                        <Link href={`/stock/${stock.symbol}`}>
                          <Badge variant="outline" className="font-mono cursor-pointer hover:bg-primary/10">
                            {stock.symbol}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-3 text-sm">{stock.name}</td>
                      <td className="py-3 text-right font-mono">
                        ${stock.price.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 text-right font-mono ${
                          stock.changePercent >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            {stock.changePercent >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {stock.change >= 0 ? "+" : ""}
                            ${Math.abs(stock.change).toFixed(2)}
                          </div>
                          <span className="text-xs">
                            ({stock.changePercent >= 0 ? "+" : ""}
                            {(stock.changePercent * 100).toFixed(2)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-sm">
                        {formatLargeNumber(stock.volume)}
                      </td>
                      <td className="py-3 text-right font-mono text-sm">
                        ${formatLargeNumber(stock.marketCap)}
                      </td>
                      <td className="py-3 text-right font-mono text-sm">
                        {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : "N/A"}
                      </td>
                      <td className="py-3 text-right text-sm">
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-gray-400">
                            ${stock.weekRange52.low.toFixed(0)} - ${stock.weekRange52.high.toFixed(0)}
                          </span>
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${
                                  ((stock.price - stock.weekRange52.low) /
                                    (stock.weekRange52.high - stock.weekRange52.low)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
