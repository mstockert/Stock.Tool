import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TechnicalIndicators from "@/components/TechnicalIndicators";
import StockChart from "@/components/StockChart";
import { Search } from "lucide-react";
import { StockHistory, StockQuote } from "@shared/schema";

export default function TechnicalAnalysisPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [searchInput, setSearchInput] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("1D");

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSymbol(searchInput.toUpperCase());
    }
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

  const isPositive = (quote?.changePercent || 0) >= 0;
  const timeframes = ["1D", "1W", "1M", "3M", "1Y"];

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
        </CardContent>
      </Card>

      <Card className="mb-6">
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
          {historyLoading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : (
            <StockChart
              data={history || []}
              timeframe={timeframe}
              isPositive={isPositive}
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
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-medium mb-2">Trend Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Based on the technical indicators, {symbol} is showing a mixed signal.
                  The moving averages suggest a bullish trend while RSI indicates neutral momentum.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-medium mb-2">Support & Resistance</h3>
                <p className="text-sm text-muted-foreground">
                  Key support levels are identified at the 50-day moving average.
                  Resistance is found near recent highs.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-medium mb-2">Volume Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Trading volume has been consistent with the average,
                  suggesting stable market participation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
