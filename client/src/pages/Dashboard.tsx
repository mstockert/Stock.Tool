import MarketOverview from "@/components/MarketOverview";
import StockDetail from "@/components/StockDetail";
import TechnicalIndicators from "@/components/TechnicalIndicators";
import CompanyOverview from "@/components/CompanyOverview";
import Watchlist from "@/components/Watchlist";
import NewsSection from "@/components/NewsSection";

export default function Dashboard() {
  // Default stock for the dashboard
  const defaultSymbol = "AAPL";

  return (
    <>
      <MarketOverview />
      
      <StockDetail symbol={defaultSymbol} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
