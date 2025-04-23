import { useQuery } from "@tanstack/react-query";
import { MarketIndex } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import MiniChart from "@/components/MiniChart";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketOverview() {
  const { data: indices, isLoading, error } = useQuery<MarketIndex[]>({
    queryKey: ["/api/market/indices"],
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
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <Skeleton className="h-5 w-20 mb-1" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-6 w-24 mb-2" />
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

  return (
    <>
      {isLoading
        ? renderSkeletonItems()
        : indices?.map((index) => (
            <Link key={index.symbol} href={`/stock/${index.symbol}`} className="block">
              <Card className="bg-dark-surface hover:bg-dark-surface-2 transition-colors duration-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{index.name}</h3>
                      <p className="text-xs text-text-secondary">{index.region}</p>
                    </div>
                    <span
                      className={
                        index.changePercent >= 0 ? "text-positive text-sm" : "text-negative text-sm"
                      }
                    >
                      {index.changePercent >= 0 ? "+" : ""}
                      {(index.changePercent * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="font-mono text-lg">{formatValue(index.price)}</p>
                  <div className="mt-2 h-10 bg-dark-bg rounded">
                    <MiniChart 
                      data={index.sparkline || []} 
                      color={index.changePercent >= 0 ? "#4CAF50" : "#F44336"} 
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
    </>
  );
}
