import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MarketOverview from "@/components/MarketOverview";
import NewsSection from "@/components/NewsSection";

export default function MarketsPage() {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Market Overview</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-dark-surface">
            <CardHeader className="border-b border-gray-800">
              <CardTitle>Market Indices</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <MarketOverview />
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card className="bg-dark-surface">
            <CardHeader className="border-b border-gray-800">
              <CardTitle>News & Updates</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <NewsSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}