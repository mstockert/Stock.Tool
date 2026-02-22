import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Newspaper } from "lucide-react";
import { NewsItem } from "@shared/schema";

export default function NewsFeedPage() {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const endpoint = activeFilter ? `/api/news/${activeFilter}` : "/api/news";

  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: [endpoint],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: [endpoint] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSearch = () => {
    if (searchSymbol.trim()) {
      setActiveFilter(searchSymbol.toUpperCase());
    }
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setSearchSymbol("");
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secondsAgo < 60) {
      return "Just now";
    } else if (secondsAgo < 3600) {
      const minutes = Math.floor(secondsAgo / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (secondsAgo < 86400) {
      const hours = Math.floor(secondsAgo / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (secondsAgo < 172800) {
      return "Yesterday";
    } else {
      const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
      return date.toLocaleDateString(undefined, options);
    }
  };

  const quickFilters = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">News Feed</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search news by stock symbol (e.g. AAPL)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              {activeFilter && (
                <Button variant="outline" onClick={handleClearFilter}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Quick filters:</span>
            {quickFilters.map((symbol) => (
              <Badge
                key={symbol}
                variant={activeFilter === symbol ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  if (activeFilter === symbol) {
                    handleClearFilter();
                  } else {
                    setActiveFilter(symbol);
                    setSearchSymbol(symbol);
                  }
                }}
              >
                {symbol}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeFilter && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing news for <span className="font-medium">{activeFilter}</span>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          Array(5)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6 mb-4" />
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))
        ) : news && news.length > 0 ? (
          news.map((item) => (
            <Card key={item.id} className="hover:bg-muted/50 transition-colors">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Newspaper className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-2 hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {item.summary}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-medium">{item.source}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(item.publishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </a>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No news articles available.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try refreshing or searching for a different symbol.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
