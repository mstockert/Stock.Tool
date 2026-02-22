import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit, TrendingUp, TrendingDown, BookOpen, DollarSign, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TradeJournalEntry = {
  id: number;
  userId: number;
  symbol: string;
  action: string; // 'buy' or 'sell'
  shares: string;
  price: string;
  totalValue: string;
  thesis: string | null;
  notes: string | null;
  outcome: string | null;
  tradeDate: string;
  createdAt: string;
  updatedAt: string;
};

type NewEntry = {
  symbol: string;
  action: string;
  shares: string;
  price: string;
  thesis: string;
  notes: string;
  outcome: string;
  tradeDate: string;
};

const emptyEntry: NewEntry = {
  symbol: "",
  action: "buy",
  shares: "",
  price: "",
  thesis: "",
  notes: "",
  outcome: "",
  tradeDate: new Date().toISOString().split("T")[0],
};

// API helpers
const fetchJournalEntries = async (): Promise<TradeJournalEntry[]> => {
  const response = await fetch("/api/journal");
  if (!response.ok) throw new Error("Failed to fetch journal entries");
  return response.json();
};

const createJournalEntry = async (data: NewEntry) => {
  const totalValue = (parseFloat(data.shares) * parseFloat(data.price)).toFixed(2);
  const response = await apiRequest("POST", "/api/journal", {
    ...data,
    totalValue,
    tradeDate: new Date(data.tradeDate).toISOString(),
    userId: 1, // Demo user
  });
  if (!response.ok) throw new Error("Failed to create journal entry");
  return response.json();
};

const updateJournalEntry = async ({ id, ...data }: { id: number } & Partial<NewEntry>) => {
  const updateData: Record<string, unknown> = { ...data };
  if (data.shares && data.price) {
    updateData.totalValue = (parseFloat(data.shares) * parseFloat(data.price)).toFixed(2);
  }
  if (data.tradeDate) {
    updateData.tradeDate = new Date(data.tradeDate).toISOString();
  }
  const response = await apiRequest("PUT", `/api/journal/${id}`, updateData);
  if (!response.ok) throw new Error("Failed to update journal entry");
  return response.json();
};

const deleteJournalEntry = async (id: number) => {
  const response = await apiRequest("DELETE", `/api/journal/${id}`, undefined);
  if (!response.ok) throw new Error("Failed to delete journal entry");
  return response.json();
};

export default function JournalPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TradeJournalEntry | null>(null);
  const [newEntry, setNewEntry] = useState<NewEntry>(emptyEntry);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  const { data: entries = [], isLoading, refetch } = useQuery<TradeJournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: fetchJournalEntries,
  });

  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      refetch();
      setDialogOpen(false);
      setNewEntry(emptyEntry);
      toast({
        title: "Entry Added",
        description: `Trade journal entry for ${newEntry.symbol.toUpperCase()} has been added.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create journal entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      refetch();
      setDialogOpen(false);
      setEditingEntry(null);
      setNewEntry(emptyEntry);
      toast({
        title: "Entry Updated",
        description: "Trade journal entry has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update journal entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      refetch();
      toast({
        title: "Entry Deleted",
        description: "Trade journal entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete journal entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveEntry = () => {
    if (!newEntry.symbol.trim() || !newEntry.shares.trim() || !newEntry.price.trim()) return;

    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        symbol: newEntry.symbol.toUpperCase(),
        action: newEntry.action,
        shares: newEntry.shares,
        price: newEntry.price,
        thesis: newEntry.thesis || null,
        notes: newEntry.notes || null,
        outcome: newEntry.outcome || null,
        tradeDate: newEntry.tradeDate,
      });
    } else {
      createMutation.mutate({
        ...newEntry,
        symbol: newEntry.symbol.toUpperCase(),
      });
    }
  };

  const openEditDialog = (entry: TradeJournalEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      symbol: entry.symbol,
      action: entry.action,
      shares: entry.shares,
      price: entry.price,
      thesis: entry.thesis || "",
      notes: entry.notes || "",
      outcome: entry.outcome || "",
      tradeDate: new Date(entry.tradeDate).toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingEntry(null);
    setNewEntry(emptyEntry);
    setDialogOpen(true);
  };

  // Filter entries by action type
  const buyEntries = entries.filter(e => e.action === "buy");
  const sellEntries = entries.filter(e => e.action === "sell");

  // Calculate statistics
  const totalBuys = buyEntries.reduce((sum, e) => sum + parseFloat(e.totalValue), 0);
  const totalSells = sellEntries.reduce((sum, e) => sum + parseFloat(e.totalValue), 0);
  const netFlow = totalSells - totalBuys;

  const getFilteredEntries = () => {
    switch (activeTab) {
      case "buy": return buyEntries;
      case "sell": return sellEntries;
      default: return entries;
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Trade Journal</h1>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingEntry(null);
            setNewEntry(emptyEntry);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center" onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Log Trade
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-dark-surface text-black dark:text-text-primary max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-black dark:text-white">
                {editingEntry ? "Edit Trade Entry" : "Log New Trade"}
              </DialogTitle>
              <DialogDescription className="text-gray-700 dark:text-gray-300">
                Record your trade details and reasoning
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Stock Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g. AAPL"
                  value={newEntry.symbol}
                  onChange={(e) => setNewEntry({ ...newEntry, symbol: e.target.value.toUpperCase() })}
                  className="bg-gray-100 dark:bg-dark-surface-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select
                  value={newEntry.action}
                  onValueChange={(value) => setNewEntry({ ...newEntry, action: value })}
                >
                  <SelectTrigger className="bg-gray-100 dark:bg-dark-surface-2">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shares">Shares</Label>
                <Input
                  id="shares"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 10"
                  value={newEntry.shares}
                  onChange={(e) => setNewEntry({ ...newEntry, shares: e.target.value })}
                  className="bg-gray-100 dark:bg-dark-surface-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Share ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 150.00"
                  value={newEntry.price}
                  onChange={(e) => setNewEntry({ ...newEntry, price: e.target.value })}
                  className="bg-gray-100 dark:bg-dark-surface-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tradeDate">Trade Date</Label>
                <Input
                  id="tradeDate"
                  type="date"
                  value={newEntry.tradeDate}
                  onChange={(e) => setNewEntry({ ...newEntry, tradeDate: e.target.value })}
                  className="bg-gray-100 dark:bg-dark-surface-2"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Value</Label>
                <div className="h-10 px-3 py-2 bg-gray-200 dark:bg-dark-surface-2 rounded-md font-mono text-lg">
                  ${newEntry.shares && newEntry.price
                    ? (parseFloat(newEntry.shares) * parseFloat(newEntry.price)).toFixed(2)
                    : "0.00"}
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="thesis">Trade Thesis (Why did you make this trade?)</Label>
                <Textarea
                  id="thesis"
                  placeholder="Describe your reasoning for this trade..."
                  value={newEntry.thesis}
                  onChange={(e) => setNewEntry({ ...newEntry, thesis: e.target.value })}
                  className="bg-gray-100 dark:bg-dark-surface-2 min-h-[80px]"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any other relevant details..."
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="bg-gray-100 dark:bg-dark-surface-2 min-h-[60px]"
                />
              </div>
              {editingEntry && (
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="outcome">Outcome / Post-Trade Reflection</Label>
                  <Textarea
                    id="outcome"
                    placeholder="How did this trade turn out? What did you learn?"
                    value={newEntry.outcome}
                    onChange={(e) => setNewEntry({ ...newEntry, outcome: e.target.value })}
                    className="bg-gray-100 dark:bg-dark-surface-2 min-h-[80px]"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEntry}
                disabled={
                  (createMutation.isPending || updateMutation.isPending) ||
                  !newEntry.symbol.trim() ||
                  !newEntry.shares.trim() ||
                  !newEntry.price.trim()
                }
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingEntry ? "Update Entry" : "Log Trade"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-dark-surface">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Trades</p>
                <p className="text-2xl font-bold">{entries.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-surface">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Bought</p>
                <p className="text-2xl font-bold text-negative">${totalBuys.toFixed(2)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-negative opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-surface">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Sold</p>
                <p className="text-2xl font-bold text-positive">${totalSells.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-positive opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-dark-surface">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Net Cash Flow</p>
                <p className={`text-2xl font-bold ${netFlow >= 0 ? "text-positive" : "text-negative"}`}>
                  {netFlow >= 0 ? "+" : ""}${netFlow.toFixed(2)}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 opacity-50 ${netFlow >= 0 ? "text-positive" : "text-negative"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card className="bg-dark-surface">
          <CardContent className="p-6">
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-dark-surface">
          <CardHeader className="px-6 py-4 border-b border-gray-800">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-gray-200 dark:bg-dark-surface-2">
                <TabsTrigger
                  value="all"
                  className="!text-black !dark:text-white data-[state=active]:bg-primary data-[state=active]:!text-white"
                >
                  All Trades ({entries.length})
                </TabsTrigger>
                <TabsTrigger
                  value="buy"
                  className="!text-black !dark:text-white data-[state=active]:bg-primary data-[state=active]:!text-white"
                >
                  Buys ({buyEntries.length})
                </TabsTrigger>
                <TabsTrigger
                  value="sell"
                  className="!text-black !dark:text-white data-[state=active]:bg-primary data-[state=active]:!text-white"
                >
                  Sells ({sellEntries.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {getFilteredEntries().length > 0 ? (
              <div className="divide-y divide-gray-800">
                {getFilteredEntries()
                  .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())
                  .map((entry) => (
                    <JournalEntryRow
                      key={entry.id}
                      entry={entry}
                      onEdit={() => openEditDialog(entry)}
                      onDelete={() => deleteMutation.mutate(entry.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))}
              </div>
            ) : (
              <div className="p-6 text-center text-text-secondary">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No trade entries yet.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={openNewDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Log Your First Trade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Journal entry row component
type JournalEntryRowProps = {
  entry: TradeJournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
};

function JournalEntryRow({ entry, onEdit, onDelete, isDeleting }: JournalEntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isBuy = entry.action === "buy";

  return (
    <div className="hover:bg-dark-surface-2">
      <div
        className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="col-span-2">
          <Link
            href={`/stock/${entry.symbol}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {entry.symbol}
          </Link>
        </div>
        <div className="col-span-2 flex items-center">
          <Badge variant={isBuy ? "destructive" : "default"} className={isBuy ? "bg-negative" : "bg-positive"}>
            {isBuy ? (
              <><TrendingDown className="h-3 w-3 mr-1" /> Buy</>
            ) : (
              <><TrendingUp className="h-3 w-3 mr-1" /> Sell</>
            )}
          </Badge>
        </div>
        <div className="col-span-2 text-right font-mono">
          {parseFloat(entry.shares).toFixed(2)} shares
        </div>
        <div className="col-span-2 text-right font-mono">
          @ ${parseFloat(entry.price).toFixed(2)}
        </div>
        <div className="col-span-2 text-right font-mono font-medium">
          ${parseFloat(entry.totalValue).toFixed(2)}
        </div>
        <div className="col-span-2 flex justify-end items-center space-x-2">
          <span className="text-text-secondary text-sm flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(entry.tradeDate).toLocaleDateString()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-secondary hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-secondary hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (entry.thesis || entry.notes || entry.outcome) && (
        <div className="px-6 pb-4 space-y-3 bg-dark-surface-2/50">
          {entry.thesis && (
            <div>
              <p className="text-text-secondary text-xs uppercase font-medium mb-1">Trade Thesis</p>
              <p className="text-sm">{entry.thesis}</p>
            </div>
          )}
          {entry.notes && (
            <div>
              <p className="text-text-secondary text-xs uppercase font-medium mb-1">Notes</p>
              <p className="text-sm">{entry.notes}</p>
            </div>
          )}
          {entry.outcome && (
            <div>
              <p className="text-text-secondary text-xs uppercase font-medium mb-1">Outcome</p>
              <p className="text-sm">{entry.outcome}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
