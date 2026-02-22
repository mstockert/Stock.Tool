import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { MarketIndex } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import MiniChart from "@/components/MiniChart";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";

type TimeframeOption = "1D" | "1W" | "1M" | "3M" | "1Y";

type MarketOverviewProps = {
  externalTimeframe?: TimeframeOption;
};

export default function MarketOverview({ externalTimeframe }: MarketOverviewProps = {}) {
  const [localTimeframe, setLocalTimeframe] = useState<TimeframeOption>("1D");
  
  // Use external timeframe if provided, otherwise use local state
  const timeframe = externalTimeframe || localTimeframe;
  
  const { data: indices, isLoading, error } = useQuery<MarketIndex[]>({
    queryKey: ["/api/market/indices", timeframe],
    queryFn: async () => {
      // Add timestamp to avoid browser caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/market/indices?timeframe=${timeframe}&_t=${timestamp}`);
      if (!response.ok) {
        throw new Error('Failed to fetch market indices');
      }
      return response.json();
    },
  });

  const formatValue = (value: number) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const renderSkeletonItems = () => {
    return Array(6)
      .fill(0)
      .map((_, i) => (
        <Card key={i} className="bg-dark-surface">
          <CardContent className="p-3">
            <div className="flex justify-between items-start mb-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-5 w-20 mb-1" />
            <Skeleton className="h-10 w-full rounded" />
          </CardContent>
        </Card>
      ));
  };

  if (error) {
    return (
      <div className="bg-dark-surface border border-destructive p-4 rounded-lg">
        <p className="text-destructive">Error loading market indices. Please try again later.</p>
      </div>
    );
  }

  const handleTimeframeChange = (value: string) => {
    setLocalTimeframe(value as TimeframeOption);
    // Force refresh the data when timeframe changes
    // Need to use more specific query key that includes timeframe
    queryClient.invalidateQueries({ queryKey: ["/api/market/indices", value] });
    
    // Force immediate refetch
    queryClient.refetchQueries({ 
      queryKey: ["/api/market/indices", value],
      exact: true 
    });
    
    console.log(`Timeframe changed to ${value} - invalidating queries`);
  };
  
  return (
    <>
      {!externalTimeframe && (
        <div className="flex justify-end mb-4">
          <Select value={timeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1D">1 Day</SelectItem>
              <SelectItem value="1W">1 Week</SelectItem>
              <SelectItem value="1M">1 Month</SelectItem>
              <SelectItem value="3M">3 Months</SelectItem>
              <SelectItem value="1Y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {isLoading
        ? renderSkeletonItems()
        : indices?.map((index) => (
            <Link key={index.symbol} href={`/stock/${index.symbol}`} className="block">
              <Card className="bg-dark-surface hover:bg-dark-surface-2 transition-colors duration-200">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-sm truncate">{index.name}</h3>
                    <span
                      className={
                        index.changePercent >= 0 ? "text-positive text-xs font-medium" : "text-negative text-xs font-medium"
                      }
                    >
                      {index.changePercent >= 0 ? "+" : ""}
                      {index.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="font-mono text-base mb-1">{formatValue(index.price)}</p>
                  <div className="h-20 rounded overflow-visible">
                    <MiniChart
                      data={index.sparkline || []}
                      color={index.changePercent >= 0 ? "#22c55e" : "#ef4444"}
                      showLabels={true}
                      timeframe={timeframe}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
    </>
  );
}
