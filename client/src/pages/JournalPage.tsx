import { useRef, useState } from "react";
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
import { Plus, Trash2, Edit, TrendingUp, TrendingDown, BookOpen, DollarSign, Calendar, Upload, Image, Loader2, X, Download, FolderInput } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Portfolio = {
  id: number;
  userId: number;
  name: string;
};

type TradeJournalEntry = {
  id: number;
  userId: number;
  portfolioId: number | null;
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
  portfolioId: number | null;
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
  portfolioId: null,
};

const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const res = await fetch("/api/portfolios");
  if (!res.ok) throw new Error("Failed to fetch portfolios");
  return res.json();
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
    portfolioId: data.portfolioId,
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
  // apiRequest already throws on non-2xx. DELETE returns 204 No Content,
  // so don't try to parse JSON from an empty body.
  await apiRequest("DELETE", `/api/journal/${id}`, undefined);
};

export default function JournalPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TradeJournalEntry | null>(null);
  const [newEntry, setNewEntry] = useState<NewEntry>(emptyEntry);
  const [activeTab, setActiveTab] = useState("all");
  const [filterPortfolioId, setFilterPortfolioId] = useState<number | null>(null);
  // Sort controls for the transactions list
  type SortKey = "date" | "symbol" | "action" | "shares" | "price" | "value";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "value" || key === "shares" || key === "price" ? "desc" : "asc");
    }
  };
  const { toast } = useToast();

  // Image scan state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedTrades, setScannedTrades] = useState<any[] | null>(null);
  const [importPortfolioId, setImportPortfolioId] = useState<number | null>(null);
  const [importPortfolioMode, setImportPortfolioMode] = useState<"existing" | "new">("existing");
  const [importNewPortfolioName, setImportNewPortfolioName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isIbkrImporting, setIsIbkrImporting] = useState(false);
  const [isFlexImporting, setIsFlexImporting] = useState(false);
  const flexFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportingScanned, setIsImportingScanned] = useState(false);
  // Paste-text import state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isParsingPaste, setIsParsingPaste] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveTargetPortfolioId, setMoveTargetPortfolioId] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashEntryType, setCashEntryType] = useState<"deposit" | "withdrawal">("deposit");
  const [cashAmount, setCashAmount] = useState("");
  const [cashDate, setCashDate] = useState(new Date().toISOString().split("T")[0]);
  const [cashNotes, setCashNotes] = useState("");
  const [cashPortfolioId, setCashPortfolioId] = useState<number | null>(null);
  const [isSavingCash, setIsSavingCash] = useState(false);

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
    queryFn: fetchPortfolios,
  });

  const { data: entries = [], isLoading, refetch } = useQuery<TradeJournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: fetchJournalEntries,
  });

  // IBKR status
  const { data: ibkrStatusData } = useQuery({
    queryKey: ["/api/ibkr/status"],
    queryFn: async () => {
      const res = await fetch("/api/ibkr/status");
      return res.json();
    },
    staleTime: 30000,
  });

  const handleFlexFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file later
    if (!file) return;
    setIsFlexImporting(true);
    try {
      const text = await file.text();
      const res = await apiRequest("POST", "/api/ibkr/flex", { content: text });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Flex Import Failed", description: data.error, variant: "destructive" });
        return;
      }
      if (!data.trades || data.trades.length === 0) {
        toast({ title: "No Trades Found", description: "No trades found in the Flex Query file.", variant: "destructive" });
        return;
      }
      // Reuse the existing confirm/import modal flow
      const trades = data.trades.map((t: any) => ({
        symbol: t.symbol,
        action: t.action,
        shares: t.shares,
        price: t.price,
        tradeDate: t.date,
      }));
      setScannedTrades(trades);
      setImportPortfolioId(filterPortfolioId);
      setIsImportModalOpen(true);
      toast({ title: "Flex Query Parsed", description: `Found ${trades.length} trade(s) (${data.format.toUpperCase()}). Review & import.` });
    } catch (err: any) {
      toast({ title: "Flex Import Failed", description: err.message || "Could not parse file", variant: "destructive" });
    } finally {
      setIsFlexImporting(false);
    }
  };

  const handleIbkrTradeImport = async () => {
    setIsIbkrImporting(true);
    try {
      // IBKR's reqExecutions API returns ~7 trading days of history max, but
      // we ask for 90 to be safe in case limits loosen. For older history, use
      // the Flex Query importer (CSV/XML from IBKR Client Portal).
      const res = await fetch("/api/ibkr/trades?days=90");
      const data = await res.json();

      if (data.error) {
        toast({ title: "IBKR Import Failed", description: data.error, variant: "destructive" });
        setIsIbkrImporting(false);
        return;
      }

      if (!data.trades || data.trades.length === 0) {
        toast({ title: "No Trades Found", description: "No recent executions found (IBKR's live API only returns ~7 trading days). For full history, use Import Flex Query.", variant: "destructive" });
        setIsIbkrImporting(false);
        return;
      }

      // Route through the import confirmation modal so the user can pick or
      // create a portfolio. Pre-fill the new-portfolio name with the IBKR
      // account number if present.
      const trades = data.trades.map((t: any) => ({
        symbol: t.symbol,
        action: t.action,
        shares: t.shares,
        price: t.price,
        tradeDate: t.date,
      }));
      const account = data.trades.find((t: any) => t.account)?.account;
      setScannedTrades(trades);
      // If there's already a portfolio whose name contains the account id, select it.
      const existing = account
        ? portfolios.find(p => p.name.toUpperCase().includes(String(account).toUpperCase()))
        : undefined;
      if (existing) {
        setImportPortfolioId(existing.id);
        setImportPortfolioMode("existing");
      } else {
        setImportPortfolioId(filterPortfolioId);
        setImportPortfolioMode("new");
        setImportNewPortfolioName(account ? `IBKR ${account}` : "Interactive Brokers");
      }
      setIsImportModalOpen(true);
      toast({
        title: "IBKR Trades Fetched",
        description: `Found ${trades.length} trade(s). Review & choose a portfolio to import into.`,
      });
    } catch (e: any) {
      toast({ title: "Import Error", description: e.message, variant: "destructive" });
    } finally {
      setIsIbkrImporting(false);
    }
  };

  // Image scan handlers
  const handleTradeScan = async (imageDataUrl: string) => {
    setIsScanning(true);
    setScanError(null);
    setScannedTrades(null);
    try {
      const res = await fetch("/api/journal/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      const data = await res.json();
      if (data.trades && data.trades.length > 0) {
        setScannedTrades(data.trades);
      } else {
        setScanError(data.error || "No trades found in the image. Try a clearer screenshot.");
      }
    } catch (e: any) {
      setScanError(`Scan failed: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTradeFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setScanError("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => handleTradeScan(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleTradePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleTradeFileUpload(file);
        return;
      }
    }
  };

  const handleTradeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleTradeFileUpload(file);
  };

  const handleParsePastedText = async () => {
    if (!pasteText.trim()) {
      setPasteError("Please paste some trade text first.");
      return;
    }
    setIsParsingPaste(true);
    setPasteError(null);
    try {
      const res = await fetch("/api/journal/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPasteError(data.error || "Failed to parse pasted text");
        return;
      }
      const trades = data.trades || [];
      if (trades.length === 0) {
        setPasteError("No trades found in the pasted text. Try pasting the raw table/rows.");
        return;
      }
      // Route parsed trades to the scan-import flow (which already handles confirm + portfolio linking)
      setScannedTrades(trades);
      setIsPasteModalOpen(false);
      setIsImportModalOpen(true);
    } catch (e: any) {
      setPasteError(e.message || "Unexpected error");
    } finally {
      setIsParsingPaste(false);
    }
  };

  const handleImportScannedTrades = async () => {
    if (!scannedTrades) return;
    setIsImportingScanned(true);

    try {
      // Resolve portfolio ID — create new if needed
      let targetPortfolioId: number | null = importPortfolioId;
      let createdPortfolioName: string | null = null;
      if (importPortfolioMode === "new" && importNewPortfolioName.trim()) {
        const res = await apiRequest("POST", "/api/portfolios", {
          userId: 1,
          name: importNewPortfolioName.trim(),
        });
        const newPortfolio = await res.json();
        if (!newPortfolio || typeof newPortfolio.id !== "number") {
          throw new Error("Portfolio creation returned no id: " + JSON.stringify(newPortfolio));
        }
        targetPortfolioId = newPortfolio.id;
        createdPortfolioName = newPortfolio.name;
        // Optimistically add to the cache so the tab appears immediately,
        // then force a refetch to pull authoritative data.
        queryClient.setQueryData<Portfolio[]>(["/api/portfolios"], (prev) => {
          const list = prev || [];
          return list.some(p => p.id === newPortfolio.id) ? list : [...list, newPortfolio];
        });
      }

      // Import all trades in parallel — convert numbers to strings for NewEntry type
      await Promise.all(scannedTrades.map(t =>
        createJournalEntry({
          symbol: String(t.symbol),
          action: String(t.action),
          shares: String(t.shares),
          price: String(t.price),
          thesis: "",
          notes: "Imported from screenshot",
          outcome: "",
          tradeDate: String(t.tradeDate),
          portfolioId: targetPortfolioId,
        })
      ));

      // Force fresh refetch of BOTH portfolios and journal entries so the new
      // portfolio tab appears and the entries show up under it.
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/portfolios"], exact: true }),
        queryClient.refetchQueries({ queryKey: ["/api/journal"], exact: true }),
      ]);
      setIsImportModalOpen(false);
      setScannedTrades(null);
      setImportNewPortfolioName("");
      setImportPortfolioMode("existing");
      // Auto-switch the filter to the newly created portfolio so the user
      // immediately sees their imported trades.
      if (targetPortfolioId !== null) {
        setFilterPortfolioId(targetPortfolioId);
      }
      toast({
        title: "Trades Imported",
        description: createdPortfolioName
          ? `${scannedTrades.length} trade(s) imported into "${createdPortfolioName}".`
          : `${scannedTrades.length} trade(s) imported successfully.`,
      });
    } catch (e: any) {
      console.error("Error importing scanned trades:", e);
      toast({ title: "Import Failed", description: e.message || "Failed to import trades. Please try again.", variant: "destructive" });
    } finally {
      setIsImportingScanned(false);
    }
  };

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
      portfolioId: entry.portfolioId,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingEntry(null);
    setNewEntry(emptyEntry);
    setDialogOpen(true);
  };

  // Apply portfolio filter first.
  // filterPortfolioId: null = "All Portfolios", -1 = "Unassigned", else = specific portfolio
  // Cash flows (deposits/withdrawals) are account-level and always shown on every
  // specific-portfolio tab, in addition to entries matching that portfolio.
  const isCashAction = (a: string) =>
    a === "deposit" || a === "withdrawal" || a === "withdraw";
  const portfolioFilteredEntries =
    filterPortfolioId === null
      ? entries
      : filterPortfolioId === -1
        ? entries.filter(e => e.portfolioId === null || e.portfolioId === undefined)
        : entries.filter(
            e =>
              e.portfolioId === filterPortfolioId ||
              isCashAction(e.action) // cash flows appear on every portfolio tab
          );

  // Filter entries by action type
  const buyEntries = portfolioFilteredEntries.filter(e => e.action === "buy");
  const sellEntries = portfolioFilteredEntries.filter(e => e.action === "sell");
  const depositEntries = portfolioFilteredEntries.filter(e => e.action === "deposit");
  const withdrawalEntries = portfolioFilteredEntries.filter(
    e => e.action === "withdrawal" || e.action === "withdraw"
  );

  // Calculate statistics
  const totalBuys = buyEntries.reduce((sum, e) => sum + parseFloat(e.totalValue), 0);
  const totalSells = sellEntries.reduce((sum, e) => sum + parseFloat(e.totalValue), 0);
  const totalDeposits = depositEntries.reduce((sum, e) => sum + parseFloat(e.totalValue), 0);
  const totalWithdrawals = withdrawalEntries.reduce((sum, e) => sum + parseFloat(e.totalValue), 0);
  const netFlow = totalSells - totalBuys + totalDeposits - totalWithdrawals;
  const netDeposits = totalDeposits - totalWithdrawals;

  const getFilteredEntries = () => {
    switch (activeTab) {
      case "buy": return buyEntries;
      case "sell": return sellEntries;
      case "deposit": return depositEntries;
      case "withdrawal": return withdrawalEntries;
      default: return portfolioFilteredEntries;
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Trade Journal</h1>
          {filterPortfolioId !== null && filterPortfolioId !== -1 && (
            <Button
              variant="outline"
              className="flex items-center bg-red-600 hover:bg-red-700 text-white border-red-600"
              onClick={async () => {
                const portfolio = portfolios.find(p => p.id === filterPortfolioId);
                if (confirm(`Delete "${portfolio?.name}" and all its holdings? Trade journal entries will be kept but unlinked.`)) {
                  try {
                    await apiRequest("DELETE", `/api/portfolios/${filterPortfolioId}`, undefined);
                    setFilterPortfolioId(null);
                    // Remove from cache immediately, then force a fresh refetch of
                    // both portfolios and journal entries (entries may reference the
                    // deleted portfolioId and need to re-render as Unassigned).
                    queryClient.setQueryData<Portfolio[]>(["/api/portfolios"], (prev) =>
                      (prev || []).filter(p => p.id !== filterPortfolioId)
                    );
                    await Promise.all([
                      queryClient.refetchQueries({ queryKey: ["/api/portfolios"], exact: true }),
                      queryClient.refetchQueries({ queryKey: ["/api/journal"], exact: true }),
                    ]);
                    toast({ title: "Portfolio Deleted", description: `"${portfolio?.name}" has been deleted.` });
                  } catch (e: any) {
                    toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
                  }
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Portfolio
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <Button
              variant="outline"
              className="flex items-center bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              onClick={() => {
                setMoveTargetPortfolioId(filterPortfolioId ?? null);
                setIsMoveModalOpen(true);
              }}
            >
              <FolderInput className="h-4 w-4 mr-2" />
              Move Trades
            </Button>
          )}
          {entries.length > 0 && (
            <Button
              variant="outline"
              className="flex items-center bg-red-600 hover:bg-red-700 text-white border-red-600"
              onClick={async () => {
                const count = portfolioFilteredEntries.length;
                const scopeLabel =
                  filterPortfolioId === null ? `all ${count} trade(s)` :
                  filterPortfolioId === -1 ? `${count} unassigned trade(s)` :
                  `${count} trade(s) in this portfolio`;
                if (confirm(`Delete ${scopeLabel}? This cannot be undone.`)) {
                  try {
                    const url =
                      filterPortfolioId === null ? "/api/journal" :
                      filterPortfolioId === -1 ? "/api/journal?portfolioId=null" :
                      `/api/journal?portfolioId=${filterPortfolioId}`;
                    await apiRequest("DELETE", url, undefined);
                    refetch();
                    toast({ title: "Trades Deleted", description: `Deleted ${count} trade(s).` });
                  } catch (e: any) {
                    toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
                  }
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {filterPortfolioId === null ? "Clear All Trades" :
               filterPortfolioId === -1 ? "Clear Unassigned" :
               "Clear Trades"}
            </Button>
          )}
          {ibkrStatusData?.enabled && (
            <Button
              variant="outline"
              className="flex items-center bg-green-600 hover:bg-green-700 text-white border-green-600"
              onClick={handleIbkrTradeImport}
              disabled={isIbkrImporting}
            >
              {isIbkrImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isIbkrImporting ? "Importing..." : "Import from IBKR"}
            </Button>
          )}
          <input
            ref={flexFileInputRef}
            type="file"
            accept=".csv,.xml,.txt,text/csv,text/xml,application/xml"
            className="hidden"
            onChange={handleFlexFileSelected}
          />
          <Button
            variant="outline"
            className="flex items-center bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700"
            onClick={() => flexFileInputRef.current?.click()}
            disabled={isFlexImporting}
            title="Import full trade history from an IBKR Flex Query CSV or XML file"
          >
            {isFlexImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {isFlexImporting ? "Parsing..." : "Import Flex Query"}
          </Button>
          <Button
            variant="outline"
            className="flex items-center bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
            onClick={() => { setIsImportModalOpen(true); setScanError(null); setScannedTrades(null); setImportPortfolioId(filterPortfolioId); }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import from Image
          </Button>
          <Button
            variant="outline"
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
            onClick={() => { setIsPasteModalOpen(true); setPasteError(null); setPasteText(""); setScannedTrades(null); setImportPortfolioId(filterPortfolioId); }}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Paste Text
          </Button>
          <Button
            variant="outline"
            className="flex items-center bg-teal-600 hover:bg-teal-700 text-white border-teal-600"
            onClick={() => {
              setCashPortfolioId(
                filterPortfolioId !== null && filterPortfolioId !== -1 ? filterPortfolioId : null
              );
              setCashEntryType("deposit");
              setCashAmount("");
              setCashDate(new Date().toISOString().split("T")[0]);
              setCashNotes("");
              setIsCashModalOpen(true);
            }}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Log Cash
          </Button>

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
                <Label htmlFor="portfolio">Portfolio</Label>
                <Select
                  value={newEntry.portfolioId ? String(newEntry.portfolioId) : "none"}
                  onValueChange={(v) => setNewEntry({ ...newEntry, portfolioId: v === "none" ? null : parseInt(v) })}
                >
                  <SelectTrigger className="bg-gray-100 dark:bg-dark-surface-2">
                    <SelectValue placeholder="Select portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Portfolio</SelectItem>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {(totalDeposits > 0 || totalWithdrawals > 0) && (
                  <p className="text-xs text-text-secondary mt-1">
                    Net deposits: {netDeposits >= 0 ? "+" : ""}${netDeposits.toFixed(2)}
                  </p>
                )}
              </div>
              <DollarSign className={`h-8 w-8 opacity-50 ${netFlow >= 0 ? "text-positive" : "text-negative"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brokerage / Portfolio tabs */}
      {portfolios.length > 0 && (
        <div className="mb-4 -mx-1 overflow-x-auto">
          <div className="flex items-center gap-2 px-1 pb-1">
            {(() => {
              const tabBase =
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border";
              const tabActive =
                "bg-primary text-white border-primary";
              const tabInactive =
                "bg-gray-100 dark:bg-dark-surface-2 text-black dark:text-white border-transparent hover:border-gray-400 dark:hover:border-gray-600";
              const unassignedCount = entries.filter(
                e => e.portfolioId === null || e.portfolioId === undefined
              ).length;
              return (
                <>
                  <button
                    onClick={() => setFilterPortfolioId(null)}
                    className={`${tabBase} ${filterPortfolioId === null ? tabActive : tabInactive}`}
                  >
                    All Portfolios ({entries.length})
                  </button>
                  {portfolios.map((p) => {
                    const count = entries.filter(e => e.portfolioId === p.id).length;
                    const isActive = filterPortfolioId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setFilterPortfolioId(p.id)}
                        className={`${tabBase} ${isActive ? tabActive : tabInactive}`}
                      >
                        {p.name} ({count})
                      </button>
                    );
                  })}
                  {unassignedCount > 0 && (
                    <button
                      onClick={() => setFilterPortfolioId(-1)}
                      className={`${tabBase} ${filterPortfolioId === -1 ? tabActive : tabInactive}`}
                    >
                      Unassigned ({unassignedCount})
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

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
                  All Trades ({portfolioFilteredEntries.length})
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
                <TabsTrigger
                  value="deposit"
                  className="!text-black !dark:text-white data-[state=active]:bg-primary data-[state=active]:!text-white"
                >
                  Deposits ({depositEntries.length})
                </TabsTrigger>
                <TabsTrigger
                  value="withdrawal"
                  className="!text-black !dark:text-white data-[state=active]:bg-primary data-[state=active]:!text-white"
                >
                  Withdrawals ({withdrawalEntries.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {/* Tab total banner */}
            {(activeTab === "deposit" || activeTab === "withdrawal" || activeTab === "buy" || activeTab === "sell") && getFilteredEntries().length > 0 && (
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-dark-surface-2">
                <span className="text-sm text-text-secondary">
                  {activeTab === "deposit" ? "Total Deposits"
                    : activeTab === "withdrawal" ? "Total Withdrawals"
                    : activeTab === "buy" ? "Total Bought"
                    : "Total Sold"}
                  {" "}({getFilteredEntries().length})
                </span>
                <span className={`text-lg font-semibold ${
                  activeTab === "deposit" || activeTab === "sell"
                    ? "text-teal-700 dark:text-teal-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}>
                  ${(
                    activeTab === "deposit" ? totalDeposits
                    : activeTab === "withdrawal" ? totalWithdrawals
                    : activeTab === "buy" ? totalBuys
                    : totalSells
                  ).toFixed(2)}
                </span>
              </div>
            )}
            {getFilteredEntries().length > 0 ? (
              <div className="divide-y divide-gray-800">
                {/* Sort header — click any column to sort. Applies to buys, sells,
                    deposits, and withdrawals uniformly. */}
                <div className="hidden md:grid grid-cols-[1fr_1fr_0.9fr_0.9fr_0.9fr_0.6fr] gap-2 px-4 py-2 bg-gray-50 dark:bg-dark-surface-2 text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400 select-none">
                  {([
                    ["date", "Date"],
                    ["symbol", "Symbol"],
                    ["action", "Type"],
                    ["shares", "Qty"],
                    ["price", "Price"],
                    ["value", "Value"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="text-left hover:text-black dark:hover:text-white transition-colors"
                    >
                      {label}
                      {sortKey === key && (
                        <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </button>
                  ))}
                </div>
                {[...getFilteredEntries()]
                  .sort((a, b) => {
                    const mul = sortDir === "asc" ? 1 : -1;
                    const aIsCash = a.action === "deposit" || a.action === "withdrawal" || a.action === "withdraw";
                    const bIsCash = b.action === "deposit" || b.action === "withdrawal" || b.action === "withdraw";
                    switch (sortKey) {
                      case "date":
                        return (new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()) * mul;
                      case "symbol": {
                        // Show CASH alongside by symbol — "CASH" sorts with C's.
                        const as = (a.symbol || "").toUpperCase();
                        const bs = (b.symbol || "").toUpperCase();
                        return as.localeCompare(bs) * mul;
                      }
                      case "action":
                        return (a.action || "").localeCompare(b.action || "") * mul;
                      case "shares":
                        return (parseFloat(a.shares) - parseFloat(b.shares)) * mul;
                      case "price":
                        // cash entries have synthetic price=1; sort by tradeDate as tiebreaker
                        return (
                          ((aIsCash ? 1 : parseFloat(a.price)) - (bIsCash ? 1 : parseFloat(b.price))) * mul
                        );
                      case "value":
                        return (parseFloat(a.totalValue) - parseFloat(b.totalValue)) * mul;
                      default:
                        return 0;
                    }
                  })
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
      {/* Paste Text Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black dark:text-white">Paste Trade History</h3>
              <button
                onClick={() => { setIsPasteModalOpen(false); setPasteText(""); setPasteError(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Copy your trade history from IBKR (or any broker) and paste it below. Claude will parse out every trade — symbol, action, shares, price, date — and you'll review before importing.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your trades here... (e.g. columns of Symbol, Date, Action, Quantity, Price — even messy spacing is fine)"
              className="w-full h-64 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-black dark:text-white text-sm font-mono resize-y"
            />
            {pasteError && (
              <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm">{pasteError}</p>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setIsPasteModalOpen(false); setPasteText(""); setPasteError(null); }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-black dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParsePastedText}
                disabled={isParsingPaste || !pasteText.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
              >
                {isParsingPaste ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Parsing...</>
                ) : (
                  "Parse Trades"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Cash Flow Modal */}
      {isCashModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black dark:text-white">Log Cash Flow</h3>
              <button
                onClick={() => setIsCashModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Record a deposit (cash in) or withdrawal (cash out). This keeps the portfolio performance chart accurate when money moves in or out of the account.
            </p>

            <div className="space-y-4">
              <div>
                <Label className="text-black dark:text-white">Type</Label>
                <Select
                  value={cashEntryType}
                  onValueChange={(v) => setCashEntryType(v as "deposit" | "withdrawal")}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit (cash in)</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal (cash out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-black dark:text-white">Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="5000.00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-black dark:text-white">Date</Label>
                <Input
                  type="date"
                  value={cashDate}
                  onChange={(e) => setCashDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-black dark:text-white">Portfolio</Label>
                <Select
                  value={cashPortfolioId === null ? "none" : String(cashPortfolioId)}
                  onValueChange={(v) => setCashPortfolioId(v === "none" ? null : parseInt(v))}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Portfolio</SelectItem>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-black dark:text-white">Notes (optional)</Label>
                <Input
                  type="text"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  placeholder="e.g. Monthly contribution"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsCashModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-black dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isSavingCash || !cashAmount || parseFloat(cashAmount) <= 0}
                onClick={async () => {
                  setIsSavingCash(true);
                  try {
                    const amount = parseFloat(cashAmount);
                    await apiRequest("POST", "/api/journal", {
                      userId: 1,
                      portfolioId: cashPortfolioId,
                      symbol: "CASH",
                      action: cashEntryType,
                      shares: String(amount),
                      price: "1",
                      totalValue: String(amount.toFixed(2)),
                      thesis: "",
                      notes: cashNotes,
                      outcome: "",
                      tradeDate: new Date(cashDate).toISOString(),
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
                    refetch();
                    setIsCashModalOpen(false);
                    toast({
                      title: cashEntryType === "deposit" ? "Deposit Logged" : "Withdrawal Logged",
                      description: `$${amount.toFixed(2)} ${cashEntryType === "deposit" ? "added to" : "removed from"} the account.`,
                    });
                  } catch (e: any) {
                    toast({ title: "Save Failed", description: e.message, variant: "destructive" });
                  } finally {
                    setIsSavingCash(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
              >
                {isSavingCash ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Trades Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black dark:text-white">Move Trades to Portfolio</h3>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {filterPortfolioId === null
                ? `Move all ${entries.length} trade(s) to:`
                : filterPortfolioId === -1
                  ? `Move all ${portfolioFilteredEntries.length} unassigned trade(s) to:`
                  : `Move all trades currently in "${portfolios.find(p => p.id === filterPortfolioId)?.name}" to:`}
            </p>
            <Select
              value={moveTargetPortfolioId === null ? "none" : String(moveTargetPortfolioId)}
              onValueChange={(v) => setMoveTargetPortfolioId(v === "none" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select portfolio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Portfolio (unassign)</SelectItem>
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-black dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isMoving}
                onClick={async () => {
                  setIsMoving(true);
                  try {
                    const body: any = { toPortfolioId: moveTargetPortfolioId };
                    // null filter = "All Portfolios" (no from filter)
                    // -1 filter = "Unassigned" → send null
                    // else = specific portfolio id
                    if (filterPortfolioId !== null) {
                      body.fromPortfolioId = filterPortfolioId === -1 ? null : filterPortfolioId;
                    }
                    const res = await apiRequest("PATCH", "/api/journal/bulk-assign", body);
                    const result = await res.json();
                    refetch();
                    queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
                    toast({
                      title: "Trades Moved",
                      description: `${result.updated} trade(s) reassigned.`,
                    });
                    setIsMoveModalOpen(false);
                  } catch (e: any) {
                    toast({ title: "Move Failed", description: e.message, variant: "destructive" });
                  } finally {
                    setIsMoving(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
              >
                {isMoving ? <><Loader2 className="h-4 w-4 animate-spin" /> Moving...</> : "Move Trades"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Image Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onPaste={handleTradePaste}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black dark:text-white">Import Trades from Screenshot</h3>
              <button
                onClick={() => { setIsImportModalOpen(false); setScannedTrades(null); setScanError(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>


            {!scannedTrades && !isScanning && (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragOver ? "border-purple-500 bg-purple-500/10" : "border-gray-600 hover:border-gray-500"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleTradeDrop}
              >
                <Image size={48} className="mx-auto mb-4 text-gray-500" />
                <p className="text-black dark:text-white text-lg mb-2">Paste or drop a trade history screenshot</p>
                <p className="text-gray-400 text-sm mb-4">
                  Screenshot your brokerage order fills / trade history and paste here (Cmd+V)
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-black dark:text-white rounded-lg cursor-pointer transition-colors">
                  <Upload size={16} />
                  Browse Files
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleTradeFileUpload(file);
                    }}
                  />
                </label>
              </div>
            )}

            {isScanning && (
              <div className="text-center py-12">
                <Loader2 size={48} className="mx-auto mb-4 text-purple-500 animate-spin" />
                <p className="text-black dark:text-white text-lg">Scanning your trades...</p>
                <p className="text-gray-400 text-sm mt-2">Claude is reading your screenshot and extracting trade data</p>
              </div>
            )}

            {scanError && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mt-4">
                <p className="text-red-400 text-sm">{scanError}</p>
                <button onClick={() => { setScanError(null); setScannedTrades(null); }} className="text-red-300 underline text-sm mt-2">Try again</button>
              </div>
            )}

            {scannedTrades && (
              <div>
                <p className="text-green-400 text-sm mb-3">
                  Found {scannedTrades.length} trade{scannedTrades.length !== 1 ? "s" : ""}. Review and import:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-2 pr-4">Symbol</th>
                        <th className="pb-2 pr-4">Action</th>
                        <th className="pb-2 pr-4 text-right">Shares</th>
                        <th className="pb-2 pr-4 text-right">Price</th>
                        <th className="pb-2 pr-4 text-right">Total</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedTrades.map((t, i) => (
                        <tr key={i} className="border-b border-gray-700/50 text-black dark:text-white">
                          <td className="py-2 pr-4 font-mono font-semibold">{t.symbol}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={t.action === "buy" ? "destructive" : "default"} className={t.action === "buy" ? "bg-red-600" : "bg-green-600"}>
                              {t.action}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-right">{t.shares}</td>
                          <td className="py-2 pr-4 text-right">${parseFloat(t.price).toFixed(2)}</td>
                          <td className="py-2 pr-4 text-right">${parseFloat(t.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2">{t.tradeDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Portfolio destination picker */}
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Link trades to portfolio:</Label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setImportPortfolioMode("existing")}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        importPortfolioMode === "existing"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Existing Portfolio
                    </button>
                    <button
                      onClick={() => setImportPortfolioMode("new")}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        importPortfolioMode === "new"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Create New Portfolio
                    </button>
                  </div>
                  {importPortfolioMode === "existing" ? (
                    <Select
                      value={importPortfolioId ? String(importPortfolioId) : "none"}
                      onValueChange={(v) => setImportPortfolioId(v === "none" ? null : parseInt(v))}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-900">
                        <SelectValue placeholder="Select portfolio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Portfolio</SelectItem>
                        {portfolios.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={importNewPortfolioName}
                      onChange={(e) => setImportNewPortfolioName(e.target.value)}
                      placeholder="Portfolio name (e.g. IBKR, Schwab, Fidelity)"
                      className="bg-white dark:bg-gray-900"
                    />
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={() => { setScannedTrades(null); setScanError(null); }} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-black dark:text-white rounded-lg transition-colors">
                    Rescan
                  </button>
                  <button
                    onClick={handleImportScannedTrades}
                    disabled={isImportingScanned || (importPortfolioMode === "new" && !importNewPortfolioName.trim())}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                  >
                    {isImportingScanned
                      ? "Importing..."
                      : importPortfolioMode === "new" && importNewPortfolioName.trim()
                        ? `Import ${scannedTrades.length} Trade${scannedTrades.length !== 1 ? "s" : ""} → "${importNewPortfolioName.trim()}"`
                        : `Import ${scannedTrades.length} Trade${scannedTrades.length !== 1 ? "s" : ""}`
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
  const action = entry.action.toLowerCase();
  const isBuy = action === "buy";
  const isDeposit = action === "deposit";
  const isWithdrawal = action === "withdrawal" || action === "withdraw";
  const isCashFlow = isDeposit || isWithdrawal;

  const badgeClass = isDeposit
    ? "bg-teal-600 hover:bg-teal-700"
    : isWithdrawal
      ? "bg-orange-600 hover:bg-orange-700"
      : isBuy
        ? "bg-green-600 hover:bg-green-700"
        : "bg-red-600 hover:bg-red-700";
  const badgeLabel = isDeposit ? "Deposit" : isWithdrawal ? "Withdraw" : isBuy ? "Buy" : "Sell";

  return (
    <div className={`hover:bg-dark-surface-2 ${isCashFlow ? "bg-teal-50/60 dark:bg-teal-950/20" : ""}`}>
      <div
        className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="col-span-2">
          {isCashFlow ? (
            <span className="font-medium text-teal-700 dark:text-teal-400">{entry.symbol}</span>
          ) : (
            <Link
              href={`/stock/${entry.symbol}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {entry.symbol}
            </Link>
          )}
        </div>
        <div className="col-span-2 flex items-center">
          <Badge variant="default" className={`text-white ${badgeClass}`}>
            {isDeposit ? (
              <><DollarSign className="h-3 w-3 mr-1" /> Deposit</>
            ) : isWithdrawal ? (
              <><DollarSign className="h-3 w-3 mr-1" /> Withdraw</>
            ) : isBuy ? (
              <><TrendingUp className="h-3 w-3 mr-1" /> Buy</>
            ) : (
              <><TrendingDown className="h-3 w-3 mr-1" /> Sell</>
            )}
          </Badge>
        </div>
        <div className="col-span-2 text-right font-mono">
          {isCashFlow ? "—" : `${parseFloat(entry.shares).toFixed(2)} shares`}
        </div>
        <div className="col-span-2 text-right font-mono">
          {isCashFlow ? "—" : `@ $${parseFloat(entry.price).toFixed(2)}`}
        </div>
        <div className={`col-span-2 text-right font-mono font-medium ${isDeposit ? "text-teal-700 dark:text-teal-400" : isWithdrawal ? "text-orange-600 dark:text-orange-400" : ""}`}>
          {isWithdrawal ? "-" : ""}${parseFloat(entry.totalValue).toFixed(2)}
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
