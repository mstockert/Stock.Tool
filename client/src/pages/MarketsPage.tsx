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
              {/* Override the default grid in MarketOverview with a more responsive grid */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium">Major Indices</h2>
                  <div className="text-sm text-text-secondary">
                    <span>Last updated: </span>
                    <span>{new Date().toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <MarketOverview />
                </div>
              </div>
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