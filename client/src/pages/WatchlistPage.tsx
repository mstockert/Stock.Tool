import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Watchlist = {
  id: number;
  name: string;
  symbols: Array<{
    id: number;
    symbol: string;
    companyName: string;
    price?: number;
    changePercent?: number;
  }>;
};

export default function WatchlistPage() {
  const [activeWatchlist, setActiveWatchlist] = useState<string>("1");
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);
  const [watchlistDialogOpen, setWatchlistDialogOpen] = useState(false);
  const [symbolDialogOpen, setSymbolDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [watchlistToDelete, setWatchlistToDelete] = useState<number | null>(null);
  const [isDeletingWatchlist, setIsDeletingWatchlist] = useState(false);
  const { toast } = useToast();

  const { data: watchlists, isLoading, refetch } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
    initialData: [],
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refresh every 30s
  });
  
  // Initialize default watchlist if none exists
  useEffect(() => {
    if (!isLoading && watchlists && watchlists.length === 0) {
      setWatchlistDialogOpen(true);
    } else if (watchlists && watchlists.length > 0 && !activeWatchlist) {
      setActiveWatchlist(watchlists[0].id.toString());
    }
  }, [isLoading, watchlists, activeWatchlist]);

  const createWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    
    setIsAddingWatchlist(true);
    try {
      const result = await apiRequest("POST", "/api/watchlists", {
        name: newWatchlistName,
        userId: 1, // Default user for demo
      });
      
      const newWatchlist = await result.json();
      
      toast({
        title: "Watchlist Created",
        description: `"${newWatchlistName}" has been created.`,
      });
      
      // Refresh the watchlist data
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      // Also manually refetch to make sure we have the latest data
      refetch();
      setNewWatchlistName("");
      setWatchlistDialogOpen(false);
      setActiveWatchlist(newWatchlist.id.toString());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create watchlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingWatchlist(false);
    }
  };

  const addSymbol = async () => {
    if (!newSymbol.trim()) return;
    
    setIsAddingSymbol(true);
    try {
      await apiRequest("POST", `/api/watchlists/${activeWatchlist}/symbols`, {
        symbol: newSymbol.toUpperCase(),
        companyName: "",
      });
      
      toast({
        title: "Symbol Added",
        description: `${newSymbol.toUpperCase()} has been added to your watchlist.`,
      });
      
      // Refresh the watchlist data
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      // Also manually refetch to make sure we have the latest data
      refetch();
      setNewSymbol("");
      setSymbolDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add symbol. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingSymbol(false);
    }
  };

  const removeSymbol = async (watchlistId: number, symbolId: number) => {
    try {
      await apiRequest("DELETE", `/api/watchlists/${watchlistId}/symbols/${symbolId}`, undefined);
      
      toast({
        title: "Symbol Removed",
        description: "Symbol has been removed from your watchlist.",
      });
      
      // Refresh the watchlist data
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      // Also manually refetch to make sure we have the latest data
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove symbol. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const openDeleteDialog = (watchlistId: number) => {
    setWatchlistToDelete(watchlistId);
    setDeleteDialogOpen(true);
  };
  
  const deleteWatchlist = async () => {
    if (!watchlistToDelete) return;
    
    setIsDeletingWatchlist(true);
    try {
      const response = await apiRequest("DELETE", `/api/watchlists/${watchlistToDelete}`, undefined);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      toast({
        title: "Watchlist Deleted",
        description: "Your watchlist has been deleted.",
      });
      
      // Select a new active watchlist first before refreshing data
      // This prevents issues with the current active watchlist being deleted
      if (watchlistToDelete.toString() === activeWatchlist && watchlists && watchlists.length > 1) {
        const remainingWatchlists = watchlists.filter(w => w.id !== watchlistToDelete);
        if (remainingWatchlists.length > 0) {
          setActiveWatchlist(remainingWatchlists[0].id.toString());
        }
      }
      
      // Refresh the watchlist data
      await queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      // Also manually refetch to make sure we have the latest data
      await refetch();
      
      setDeleteDialogOpen(false);
      setWatchlistToDelete(null);
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to delete watchlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingWatchlist(false);
    }
  };

  const activeWatchlistData = watchlists?.find(w => w.id.toString() === activeWatchlist);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Watchlists</h1>
        
        <Dialog open={watchlistDialogOpen} onOpenChange={setWatchlistDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              New Watchlist
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-dark-surface text-black dark:text-text-primary">
            <DialogHeader>
              <DialogTitle className="text-black dark:text-white">Create New Watchlist</DialogTitle>
              <DialogDescription className="text-gray-700 dark:text-gray-300">
                Enter a name for your new watchlist
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Watchlist name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                className="bg-gray-100 dark:bg-dark-surface-2"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setWatchlistDialogOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button 
                onClick={createWatchlist}
                disabled={isAddingWatchlist || !newWatchlistName.trim()}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="bg-dark-surface">
          <CardContent className="p-6">
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : watchlists && watchlists.length > 0 ? (
        <Tabs
          defaultValue={activeWatchlist}
          value={activeWatchlist}
          onValueChange={setActiveWatchlist}
          className="space-y-4"
        >
          <div className="flex justify-between items-center">
            <TabsList className="bg-gray-200 dark:bg-dark-surface-2">
              {watchlists.map((list) => (
                <TabsTrigger
                  key={list.id}
                  value={list.id.toString()}
                  className="!text-black !dark:text-white data-[state=active]:bg-primary data-[state=active]:!text-white"
                >
                  {list.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <Dialog open={symbolDialogOpen} onOpenChange={setSymbolDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Symbol
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-dark-surface text-black dark:text-text-primary">
                <DialogHeader>
                  <DialogTitle className="text-black dark:text-white">Add Symbol to Watchlist</DialogTitle>
                  <DialogDescription className="text-gray-700 dark:text-gray-300">
                    Enter a stock symbol to add to your watchlist
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Enter stock symbol (e.g. AAPL)"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="bg-gray-100 dark:bg-dark-surface-2"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSymbolDialogOpen(false)}
                    className="mr-2"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={addSymbol}
                    disabled={isAddingSymbol || !newSymbol.trim()}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {watchlists.map((list) => (
            <TabsContent key={list.id} value={list.id.toString()}>
              <Card className="bg-dark-surface">
                <CardHeader className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                  <CardTitle>{list.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-text-secondary hover:text-destructive"
                    onClick={() => openDeleteDialog(list.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {list.symbols && list.symbols.length > 0 ? (
                    <div className="divide-y divide-gray-800">
                      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-dark-surface-2 text-text-secondary font-medium text-sm">
                        <div className="col-span-3">Symbol</div>
                        <div className="col-span-5">Company</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Change</div>
                      </div>
                      {list.symbols.map((symbol) => (
                        <div key={symbol.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-dark-surface-2">
                          <div className="col-span-3">
                            <Link href={`/stock/${symbol.symbol}`} className="font-medium text-primary hover:underline">
                              {symbol.symbol}
                            </Link>
                          </div>
                          <div className="col-span-5">{symbol.companyName}</div>
                          <div className="col-span-2 text-right font-mono">
                            ${symbol.price?.toFixed(2) || "—"}
                          </div>
                          <div className="col-span-1 text-right font-mono">
                            <span
                              className={
                                (symbol.changePercent || 0) >= 0
                                  ? "text-positive"
                                  : "text-negative"
                              }
                            >
                              {symbol.changePercent !== undefined
                                ? `${symbol.changePercent >= 0 ? "+" : ""}${(
                                    symbol.changePercent * 100
                                  ).toFixed(2)}%`
                                : "—"}
                            </span>
                          </div>
                          <div className="col-span-1 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-text-secondary hover:text-destructive"
                              onClick={() => removeSymbol(list.id, symbol.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-text-secondary">
                      <p>No symbols in this watchlist yet.</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setSymbolDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Symbol
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card className="bg-dark-surface">
          <CardContent className="p-6 text-center">
            <p className="text-text-secondary mb-4">You don't have any watchlists yet.</p>
            <Button onClick={() => setWatchlistDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Watchlist
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Delete Watchlist Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white dark:bg-dark-surface text-black dark:text-text-primary">
          <DialogHeader>
            <DialogTitle className="text-black dark:text-white">Delete Watchlist</DialogTitle>
            <DialogDescription className="text-gray-700 dark:text-gray-300">
              Confirm if you want to delete this watchlist
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete this watchlist? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setWatchlistToDelete(null);
              }}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={deleteWatchlist}
              disabled={isDeletingWatchlist}
            >
              {isDeletingWatchlist ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
