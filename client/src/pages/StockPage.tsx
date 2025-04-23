import { useParams } from "wouter";
import StockDetail from "@/components/StockDetail";
import TechnicalIndicators from "@/components/TechnicalIndicators";
import CompanyOverview from "@/components/CompanyOverview";
import Watchlist from "@/components/Watchlist";
import NewsSection from "@/components/NewsSection";

export default function StockPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol.toUpperCase();

  return (
    <>
      <StockDetail symbol={symbol} />
      
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
