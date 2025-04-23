import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import MarketOverview from "@/components/MarketOverview";
import StockDetail from "@/components/StockDetail";
import TechnicalIndicators from "@/components/TechnicalIndicators";
import CompanyOverview from "@/components/CompanyOverview";
import Watchlist from "@/components/Watchlist";
import NewsSection from "@/components/NewsSection";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type TimeframeOption = "1D" | "1W" | "1M" | "3M" | "1Y";

export default function Dashboard() {
  // Default stock for the dashboard
  const defaultSymbol = "AAPL";
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1D");

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as TimeframeOption);
    // Force refresh data when timeframe changes
    queryClient.invalidateQueries({ queryKey: ["/api/market/indices"] });
    queryClient.invalidateQueries({ queryKey: [`/api/stocks/history/${defaultSymbol}`] });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
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

      <Card className="bg-dark-surface mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <MarketOverview externalTimeframe={timeframe} />
          </div>
        </CardContent>
      </Card>
      
      <StockDetail symbol={defaultSymbol} initialTimeframe={timeframe} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <TechnicalIndicators symbol={defaultSymbol} />
        <CompanyOverview symbol={defaultSymbol} />
        
        <div className="space-y-6">
          <Watchlist />
          <NewsSection />
        </div>
      </div>
    </>
  );
}
