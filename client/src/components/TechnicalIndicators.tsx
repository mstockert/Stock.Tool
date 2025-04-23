import { useQuery } from "@tanstack/react-query";
import { TechnicalIndicator } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type TechnicalIndicatorsProps = {
  symbol: string;
};

export default function TechnicalIndicators({ symbol }: TechnicalIndicatorsProps) {
  const { data: indicators, isLoading, error } = useQuery<TechnicalIndicator[]>({
    queryKey: [`/api/stocks/indicators/${symbol}`],
    enabled: !!symbol,
  });

  // Calculate progress values based on indicator type
  const getProgressValue = (indicator: TechnicalIndicator) => {
    if (indicator.name.includes("RSI")) {
      // RSI ranges from 0-100, with 30/70 as common thresholds
      return indicator.value;
    } else if (indicator.name.includes("MACD")) {
      // Map MACD to a 0-100 scale for visualization
      const scaledValue = Math.min(Math.max((indicator.value + 5) * 10, 0), 100);
      return scaledValue;
    } else {
      // For other indicators, use a simple percentage (65% and 80% as in the design)
      return indicator.name.includes("(50)") ? 65 : 80;
    }
  };

  const getProgressColor = (indicator: TechnicalIndicator) => {
    if (indicator.name.includes("RSI")) {
      if (indicator.value < 30) return "bg-negative";
      if (indicator.value > 70) return "bg-negative";
      return "bg-primary";
    } else if (indicator.signal === "Buy" || indicator.signal === "Strong Buy") {
      return "bg-positive";
    } else if (indicator.signal === "Sell" || indicator.signal === "Strong Sell") {
      return "bg-negative";
    }
    return "bg-primary";
  };

  // Get overall signal from indicators
  const getSignalSummary = () => {
    if (!indicators || indicators.length === 0) return { short: "Neutral", medium: "Neutral", long: "Neutral" };
    
    // Count positive signals
    const buyCount = indicators.filter(i => i.signal?.includes("Buy")).length;
    const total = indicators.length;
    
    if (buyCount / total > 0.7) {
      return { short: "Buy", medium: "Buy", long: "Strong Buy" };
    } else if (buyCount / total > 0.5) {
      return { short: "Neutral", medium: "Buy", long: "Buy" };
    } else if (buyCount / total < 0.3) {
      return { short: "Sell", medium: "Sell", long: "Neutral" };
    } else {
      return { short: "Neutral", medium: "Neutral", long: "Buy" };
    }
  };

  const signalSummary = getSignalSummary();

  const getTextColorClass = (signal: string) => {
    if (signal.includes("Buy")) return "text-positive";
    if (signal.includes("Sell")) return "text-negative";
    return "text-text-primary";
  };

  if (error) {
    return (
      <Card className="bg-dark-surface">
        <CardHeader>
          <CardTitle>Technical Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading indicators. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-surface">
      <CardHeader className="px-4 py-3 border-b border-gray-800">
        <CardTitle className="text-base font-semibold">Technical Indicators</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
            <Skeleton className="h-6 w-48 mb-3 mt-6" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded" />
              ))}
            </div>
          </>
        ) : (
          <>
            {indicators?.map((indicator, index) => (
              <div key={index} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">{indicator.name}</span>
                  <span
                    className={`text-sm font-mono ${
                      indicator.signal === "Buy" || indicator.signal === "Strong Buy"
                        ? "text-positive"
                        : indicator.signal === "Sell" || indicator.signal === "Strong Sell"
                        ? "text-negative"
                        : ""
                    }`}
                  >
                    {indicator.value.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-dark-bg rounded-full h-1.5">
                  <Progress 
                    value={getProgressValue(indicator)} 
                    className={getProgressColor(indicator)}
                  />
                </div>
              </div>
            ))}

            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Signal Summary</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-dark-bg rounded p-2">
                  <p className="text-xs text-text-secondary mb-1">Short Term</p>
                  <p className={`${getTextColorClass(signalSummary.short)} font-medium`}>
                    {signalSummary.short}
                  </p>
                </div>
                <div className="bg-dark-bg rounded p-2">
                  <p className="text-xs text-text-secondary mb-1">Medium Term</p>
                  <p className={`${getTextColorClass(signalSummary.medium)} font-medium`}>
                    {signalSummary.medium}
                  </p>
                </div>
                <div className="bg-dark-bg rounded p-2">
                  <p className="text-xs text-text-secondary mb-1">Long Term</p>
                  <p className={`${getTextColorClass(signalSummary.long)} font-medium`}>
                    {signalSummary.long}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
