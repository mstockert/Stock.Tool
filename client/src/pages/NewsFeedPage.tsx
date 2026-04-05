import { useState, useMemo } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Newspaper, X, Filter as FilterIcon } from "lucide-react";
import { NewsItem } from "@shared/schema";

type TimeRange = "any" | "1h" | "24h" | "7d" | "30d";

type Watchlist = {
  id: number;
  name: string;
  symbols: Array<{ id: number; symbol: string; companyName: string }>;
};

type TaggedNewsItem = NewsItem & { tickers: string[] };

export default function NewsFeedPage() {
  const [tickerInput, setTickerInput] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("any");
  const [watchlistId, setWatchlistId] = useState<string>("none");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
    initialData: [],
  });

  const effectiveTickers = useMemo(() => {
    const set = new Set<string>(tickers.map(t => t.toUpperCase()));
    if (watchlistId !== "none") {
      const wl = watchlists?.find(w => w.id.toString() === watchlistId);
      wl?.symbols.forEach(s => set.add(s.symbol.toUpperCase()));
    }
    return Array.from(set);
  }, [tickers, watchlistId, watchlists]);

  // Base news stream (no symbol filter)
  const { data: baseNews, isLoading: baseLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  // Per-ticker streams
  const tickerQueries = useQueries({
    queries: effectiveTickers.map(sym => ({
      queryKey: [`/api/news/${sym}`],
      staleTime: 60_000,
    })),
  });

  const anyLoading = baseLoading || tickerQueries.some(q => q.isLoading);

  // Combine articles and tag with their source tickers
  const combined: TaggedNewsItem[] = useMemo(() => {
    const map = new Map<string, TaggedNewsItem>();
    const addArticles = (items: NewsItem[] | undefined, ticker: string | null) => {
      if (!items) return;
      items.forEach(item => {
        const existing = map.get(item.id);
        if (existing) {
          if (ticker && !existing.tickers.includes(ticker)) existing.tickers.push(ticker);
        } else {
          map.set(item.id, { ...item, tickers: ticker ? [ticker] : [] });
        }
      });
    };
    addArticles(baseNews, null);
    effectiveTickers.forEach((sym, i) => addArticles(tickerQueries[i]?.data as NewsItem[] | undefined, sym));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [
    baseNews,
    effectiveTickers.join(","),
    tickerQueries.map(q => q.dataUpdatedAt).join(","),
  ]);

  // Available sources from data
  const availableSources = useMemo(() => {
    const s = new Set<string>();
    combined.forEach(a => a.source && s.add(a.source));
    return Array.from(s).sort();
  }, [combined]);

  const timeRangeMs = (r: TimeRange): number | null => {
    switch (r) {
      case "1h": return 60 * 60 * 1000;
      case "24h": return 24 * 60 * 60 * 1000;
      case "7d": return 7 * 24 * 60 * 60 * 1000;
      case "30d": return 30 * 24 * 60 * 60 * 1000;
      default: return null;
    }
  };

  // Apply filters with OR logic across active dimensions
  const filtered = useMemo(() => {
    const hasTickerFilter = effectiveTickers.length > 0;
    const hasSourceFilter = selectedSources.length > 0;
    const rangeMs = timeRangeMs(timeRange);
    const hasTimeFilter = rangeMs !== null;

    if (!hasTickerFilter && !hasSourceFilter && !hasTimeFilter) return combined;

    const now = Date.now();
    return combined.filter(article => {
      if (hasTickerFilter) {
        const hit = article.tickers.some(t => effectiveTickers.includes(t));
        if (hit) return true;
      }
      if (hasSourceFilter) {
        if (selectedSources.includes(article.source)) return true;
      }
      if (hasTimeFilter && rangeMs !== null) {
        const age = now - new Date(article.publishedAt).getTime();
        if (age >= 0 && age <= rangeMs) return true;
      }
      return false;
    });
  }, [combined, effectiveTickers, selectedSources, timeRange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/news"] });
    await Promise.all(
      effectiveTickers.map(sym =>
        queryClient.invalidateQueries({ queryKey: [`/api/news/${sym}`] })
      )
    );
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t && !tickers.includes(t)) setTickers([...tickers, t]);
    setTickerInput("");
  };

  const removeTicker = (t: string) => setTickers(tickers.filter(x => x !== t));

  const toggleSource = (s: string) => {
    setSelectedSources(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const clearAllFilters = () => {
    setTickers([]);
    setSelectedSources([]);
    setTimeRange("any");
    setWatchlistId("none");
    setTickerInput("");
  };

  const activeFilterCount =
    (tickers.length > 0 ? 1 : 0) +
    (watchlistId !== "none" ? 1 : 0) +
    (selectedSources.length > 0 ? 1 : 0) +
    (timeRange !== "any" ? 1 : 0);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (secondsAgo < 60) return "Just now";
    if (secondsAgo < 3600) {
      const m = Math.floor(secondsAgo / 60);
      return `${m} minute${m > 1 ? "s" : ""} ago`;
    }
    if (secondsAgo < 86400) {
      const h = Math.floor(secondsAgo / 3600);
      return `${h} hour${h > 1 ? "s" : ""} ago`;
    }
    if (secondsAgo < 172800) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">News Feed</h1>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={anyLoading || isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FilterIcon className="h-4 w-4" />
              Filters {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              <span className="text-xs text-muted-foreground ml-2">(OR — any match)</span>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            )}
          </div>

          {/* Tickers */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tickers</label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Add ticker (e.g. AAPL) and press Enter"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTicker(); } }}
              />
              <Button onClick={addTicker} disabled={!tickerInput.trim()}>Add</Button>
            </div>
            {tickers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tickers.map(t => (
                  <Badge key={t} variant="default" className="cursor-pointer gap-1" onClick={() => removeTicker(t)}>
                    {t} <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Watchlist + Time range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Watchlist symbols</label>
              <Select value={watchlistId} onValueChange={setWatchlistId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {watchlists?.map(w => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.name} ({w.symbols.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Time range</label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="1h">Last hour</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Past week</SelectItem>
                  <SelectItem value="30d">Past month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sources */}
          {availableSources.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sources</label>
              <div className="flex flex-wrap gap-2">
                {availableSources.map(s => (
                  <Badge
                    key={s}
                    variant={selectedSources.includes(s) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSource(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 text-sm text-muted-foreground">
        Showing {filtered.length} article{filtered.length === 1 ? "" : "s"}
        {effectiveTickers.length > 0 && ` · tickers: ${effectiveTickers.join(", ")}`}
      </div>

      <div className="space-y-4">
        {anyLoading ? (
          Array(5).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-4" />
                <div className="flex gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-24" /></div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((item) => (
            <Card key={item.id} className="hover:bg-muted/50 transition-colors">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Newspaper className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-2 hover:text-primary transition-colors">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{item.summary}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium">{item.source}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(item.publishedAt)}</span>
                        {item.tickers.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex gap-1">
                              {item.tickers.map(t => (
                                <Badge key={t} variant="outline" className="text-[10px] py-0 px-1.5">{t}</Badge>
                              ))}
                            </div>
                          </>
                        )}
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
              <p className="text-muted-foreground">No news articles match your filters.</p>
              <p className="text-sm text-muted-foreground mt-1">Try clearing filters or refreshing.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
