import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MarketOverview from "@/components/MarketOverview";
import NewsSection from "@/components/NewsSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type TimeframeOption = "1D" | "1W" | "1M" | "3M" | "1Y";

export default function MarketsPage() {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1D");

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as TimeframeOption);
    // Force refresh market data when timeframe changes
    queryClient.invalidateQueries({ queryKey: ["/api/market/indices", value] });
    
    // Force immediate refetch with new timeframe 
    queryClient.refetchQueries({ 
      queryKey: ["/api/market/indices", value],
      exact: true 
    });
    
    console.log(`Markets page timeframe changed to ${value} - refreshing data`);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Market Overview</h1>
        <Select value={timeframe} onValueChange={handleTimeframeChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1D">Daily</SelectItem>
            <SelectItem value="1W">Weekly</SelectItem>
            <SelectItem value="1M">Monthly</SelectItem>
            <SelectItem value="3M">Quarterly</SelectItem>
            <SelectItem value="1Y">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-dark-surface">
            <CardHeader className="border-b border-gray-800">
              <CardTitle>Market Indices</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium">Major Indices</h2>
                  <div className="text-sm text-text-secondary">
                    <span>Last updated: </span>
                    <span>{new Date().toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <MarketOverview externalTimeframe={timeframe} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card className="bg-dark-surface">
            <CardHeader className="border-b border-gray-800">
              <CardTitle>Market News</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <NewsSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}