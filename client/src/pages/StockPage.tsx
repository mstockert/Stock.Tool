import { useParams, useLocation } from "wouter";
import StockDetail from "@/components/StockDetail";
import TechnicalIndicators from "@/components/TechnicalIndicators";
import CompanyOverview from "@/components/CompanyOverview";
import Watchlist from "@/components/Watchlist";
import NewsSection from "@/components/NewsSection";
import { useState } from "react";

type TimeframeOption = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

export default function StockPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol.toUpperCase();
  
  // Use state to store user's selected timeframe
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1D");
  
  // Handler for when child component changes timeframe
  const handleTimeframeChange = (newTimeframe: TimeframeOption) => {
    setTimeframe(newTimeframe);
    console.log(`StockPage: timeframe changed to ${newTimeframe} for ${symbol}`);
  };

  return (
    <>
      {/* Pass initialTimeframe and onTimeframeChange to allow two-way binding */}
      <StockDetail 
        symbol={symbol} 
        initialTimeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TechnicalIndicators symbol={symbol} />
        <CompanyOverview symbol={symbol} />
        
        <div className="space-y-6">
          <Watchlist />
          <NewsSection symbol={symbol} />
        </div>
      </div>
    </>
  );
}
