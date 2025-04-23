import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WatchlistStock = {
  id: number;
  symbol: string;
  companyName: string;
  exchange: string;
  price: number;
  changePercent: number;
};

export default function Watchlist() {
  const [newSymbol, setNewSymbol] = useState("");
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: watchlistStocks, isLoading } = useQuery<WatchlistStock[]>({
    queryKey: ["/api/watchlists/1/symbols"],
    initialData: [],
  });

  const addSymbolToWatchlist = async () => {
    if (!newSymbol.trim()) return;
    
    setIsAddingSymbol(true);
    try {
      await apiRequest("POST", "/api/watchlists/1/symbols", {
        symbol: newSymbol.toUpperCase(),
        companyName: "",
      });
      
      toast({
        title: "Symbol Added",
        description: `${newSymbol.toUpperCase()} has been added to your watchlist.`,
      });
      
      // Refresh the watchlist data
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists/1/symbols"] });
      setNewSymbol("");
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add symbol to watchlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingSymbol(false);
    }
  };

  // If we don't have data yet but it's not loading, return an empty array
  const stocks = watchlistStocks || [];

  return (
    <Card className="bg-dark-surface">
      <CardHeader className="px-4 py-3 border-b border-gray-800 flex flex-row justify-between items-center">
        <CardTitle className="text-base font-semibold">My Watchlist</CardTitle>
        <Link href="/watchlists">
          <Button variant="link" className="text-primary text-sm p-0 h-auto">View All</Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-800">
          {isLoading ? (
            // Skeleton loading state
            Array(4)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center">
                        <Skeleton className="h-4 w-14 mr-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-3 w-16 mt-1" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-20 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              ))
          ) : stocks.length > 0 ? (
            stocks.map((stock) => (
              <Link key={stock.id} href={`/stock/${stock.symbol}`}>
                <a className="block px-4 py-3 hover:bg-dark-surface-2 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-text-secondary text-xs ml-2">{stock.companyName}</span>
                      </div>
                      <span className="text-xs text-text-secondary">{stock.exchange || "NASDAQ"}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">${stock.price?.toFixed(2) || "N/A"}</div>
                      <div
                        className={`text-xs font-mono ${
                          (stock.changePercent || 0) >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {(stock.changePercent || 0) >= 0 ? "+" : ""}
                        {((stock.changePercent || 0) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </a>
              </Link>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-text-secondary text-sm">
              <p>No stocks in your watchlist yet.</p>
              <p className="mt-2">Add some using the button below.</p>
            </div>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <div className="px-4 py-3 text-center">
                <Button
                  variant="ghost"
                  className="text-primary text-sm flex items-center justify-center w-full"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Symbol
                </Button>
              </div>
            </DialogTrigger>
            <DialogContent className="bg-dark-surface text-text-primary">
              <DialogHeader>
                <DialogTitle>Add Symbol to Watchlist</DialogTitle>
              </DialogHeader>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Enter stock symbol (e.g. AAPL)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="bg-dark-surface-2"
                />
                <Button 
                  onClick={addSymbolToWatchlist} 
                  disabled={isAddingSymbol || !newSymbol.trim()}
                >
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
