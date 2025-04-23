import { useQuery } from "@tanstack/react-query";
import { NewsItem } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type NewsSectionProps = {
  symbol?: string;
};

export default function NewsSection({ symbol }: NewsSectionProps) {
  const endpoint = symbol ? `/api/news/${symbol}` : "/api/news";
  
  const { data: news, isLoading, error } = useQuery<NewsItem[]>({
    queryKey: [endpoint],
  });

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (secondsAgo < 60) {
      return 'Just now';
    } else if (secondsAgo < 3600) {
      const minutes = Math.floor(secondsAgo / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (secondsAgo < 86400) {
      const hours = Math.floor(secondsAgo / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (secondsAgo < 172800) {
      return 'Yesterday';
    } else {
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
      return date.toLocaleDateString(undefined, options);
    }
  };

  if (error) {
    return (
      <Card className="bg-dark-surface">
        <CardHeader>
          <CardTitle>Recent News</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading news. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-surface">
      <CardHeader className="px-4 py-3 border-b border-gray-800">
        <CardTitle className="text-base font-semibold">Recent News</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-800">
          {isLoading ? (
            // Skeleton loading state
            Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-5/6 mb-2" />
                      <Skeleton className="h-3 w-3/4 mb-2" />
                      <div className="flex items-center text-xs mt-2">
                        <Skeleton className="h-3 w-16 mr-2" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
          ) : news && news.length > 0 ? (
            news.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 hover:bg-dark-surface-2 cursor-pointer"
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1">{item.title}</h3>
                    <p className="text-text-secondary text-xs mb-2">{item.summary}</p>
                    <div className="flex items-center text-xs text-text-secondary">
                      <span>{item.source}</span>
                      <span className="mx-2">•</span>
                      <span>{formatTimeAgo(item.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))
          ) : (
            <div className="p-4 text-center text-text-secondary text-sm">
              <p>No recent news available.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
