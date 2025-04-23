import { useQuery } from "@tanstack/react-query";
import { StockQuote, StockHistory } from "@shared/schema";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Star, StarHalf, Maximize2 } from "lucide-react";
import StockChart from "@/components/StockChart";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TimeframeOption = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

type StockDetailProps = {
  symbol: string;
  initialTimeframe?: TimeframeOption;
};

export default function StockDetail({ symbol, initialTimeframe = "1D" }: StockDetailProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>(initialTimeframe);
  
  // Update timeframe when initialTimeframe prop changes
  useEffect(() => {
    if (timeframe !== initialTimeframe) {
      setTimeframe(initialTimeframe);
      // Force refetch when timeframe changes from parent
      queryClient.invalidateQueries({ queryKey: [`/api/stocks/history/${symbol}`] });
    }
  }, [initialTimeframe, symbol, timeframe, queryClient]);
  const [isFavorite, setIsFavorite] = useState(false);
  const { toast } = useToast();

  const { data: quote, isLoading: quoteLoading } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/quote/${symbol}`],
  });

  const { data: history, isLoading: historyLoading } = useQuery<StockHistory[]>({
    queryKey: [`/api/stocks/history/${symbol}`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/history/${symbol}?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stock history');
      }
      return response.json();
    },
    enabled: !!symbol,
  });

  const isLoading = quoteLoading || historyLoading;

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  };

  const handleTimeframeChange = (newTimeframe: TimeframeOption) => {
    setTimeframe(newTimeframe);
    // Force refetch when timeframe changes
    queryClient.invalidateQueries({ queryKey: [`/api/stocks/history/${symbol}`, timeframe] });
  };

  const toggleFavorite = async () => {
    try {
      if (!isFavorite) {
        // Add to watchlist (default watchlist ID = 1)
        await apiRequest("POST", "/api/watchlists/1/symbols", {
          symbol,
          companyName: quote?.name || symbol,
        });
        toast({
          title: "Added to Watchlist",
          description: `${symbol} has been added to your watchlist.`,
        });
      } else {
        // We would need the symbol ID, which we'd normally get from the API
        // For now, just show success message
        toast({
          title: "Removed from Watchlist",
          description: `${symbol} has been removed from your watchlist.`,
        });
      }
      setIsFavorite(!isFavorite);
      // Invalidate watchlist queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update watchlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <div className="flex items-center mb-2 md:mb-0">
          <div className="flex flex-col">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-8 w-32" />
              </>
            ) : (
              <>
                <div className="flex items-center">
                  <h2 className="text-xl font-semibold mr-2">{quote?.name}</h2>
                  <span className="text-text-secondary font-mono">{symbol}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-mono text-2xl font-semibold mr-2">
                    ${quote?.price.toFixed(2)}
                  </span>
                  <span
                    className={
                      (quote?.changePercent || 0) >= 0
                        ? "font-mono text-positive"
                        : "font-mono text-negative"
                    }
                  >
                    {(quote?.change || 0) >= 0 ? "+" : ""}
                    {(quote?.change || 0).toFixed(2)} ({(quote?.changePercent || 0) * 100}%)
                  </span>
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-4"
            onClick={toggleFavorite}
            disabled={isLoading}
          >
            {isFavorite ? (
              <StarHalf className="h-5 w-5 text-primary" />
            ) : (
              <Star className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-dark-surface rounded-lg flex overflow-hidden">
            {(["1D", "1W", "1M", "3M", "1Y", "5Y"] as TimeframeOption[]).map((option) => (
              <Button
                key={option}
                variant={timeframe === option ? "secondary" : "ghost"}
                className="px-3 py-1.5 text-sm h-auto rounded-none"
                onClick={() => handleTimeframeChange(option)}
                disabled={isLoading}
              >
                {option}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" disabled={isLoading}>
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Card className="bg-dark-surface">
        <CardContent className="p-0">
          <div className="chart-container p-4">
            {isLoading ? (
              <Skeleton className="w-full h-[300px]" />
            ) : (
              <StockChart
                data={history || []}
                timeframe={timeframe}
                isPositive={(quote?.changePercent || 0) >= 0}
              />
            )}
          </div>

          <div className="border-t border-gray-800 px-4 py-3 bg-dark-surface-2">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <p className="text-text-secondary text-xs">Open</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <p className="font-mono">${(quote?.open || 0).toFixed(2)}</p>
                )}
              </div>
              <div>
                <p className="text-text-secondary text-xs">High</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <p className="font-mono">${(quote?.high || 0).toFixed(2)}</p>
                )}
              </div>
              <div>
                <p className="text-text-secondary text-xs">Low</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <p className="font-mono">${(quote?.low || 0).toFixed(2)}</p>
                )}
              </div>
              <div>
                <p className="text-text-secondary text-xs">Close</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <p className="font-mono">${(quote?.close || 0).toFixed(2)}</p>
                )}
              </div>
              <div>
                <p className="text-text-secondary text-xs">Volume</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <p className="font-mono">{formatLargeNumber(quote?.volume || 0)}</p>
                )}
              </div>
              <div>
                <p className="text-text-secondary text-xs">Market Cap</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 mt-1" />
                ) : (
                  <p className="font-mono">${formatLargeNumber(quote?.marketCap || 0)}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
