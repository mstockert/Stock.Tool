import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortfolioChart from "@/components/PortfolioChart";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  X,
  Check,
  FolderPlus,
  RefreshCw,
  Upload,
  Image,
  Loader2,
  Download,
} from "lucide-react";

type PortfolioHolding = {
  id: number;
  portfolioId: number;
  symbol: string;
  companyName: string | null;
  shares: string;
  avgCost: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
};

type Portfolio = {
  id: number;
  userId: number;
  name: string;
  holdings?: PortfolioHolding[];
};

type PortfolioSummary = {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
};

// API functions
const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const res = await fetch("/api/portfolios");
  if (!res.ok) throw new Error("Failed to fetch portfolios");
  return res.json();
};

const createPortfolio = async (name: string): Promise<Portfolio> => {
  const res = await fetch("/api/portfolios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create portfolio");
  return res.json();
};

const updatePortfolio = async ({ id, name }: { id: number; name: string }): Promise<Portfolio> => {
  const res = await fetch(`/api/portfolios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to update portfolio");
  return res.json();
};

const deletePortfolio = async (id: number): Promise<void> => {
  const res = await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete portfolio");
};

const addHolding = async ({
  portfolioId,
  symbol,
  companyName,
  shares,
  avgCost,
}: {
  portfolioId: number;
  symbol: string;
  companyName: string;
  shares: string;
  avgCost: string;
}): Promise<PortfolioHolding> => {
  const res = await fetch(`/api/portfolios/${portfolioId}/holdings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, companyName, shares, avgCost }),
  });
  if (!res.ok) throw new Error("Failed to add holding");
  return res.json();
};

const updateHolding = async ({
  portfolioId,
  holdingId,
  data,
}: {
  portfolioId: number;
  holdingId: number;
  data: Partial<PortfolioHolding>;
}): Promise<PortfolioHolding> => {
  const res = await fetch(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update holding");
  return res.json();
};

const deleteHolding = async ({
  portfolioId,
  holdingId,
}: {
  portfolioId: number;
  holdingId: number;
}): Promise<void> => {
  const res = await fetch(`/api/portfolios/${portfolioId}/holdings/${holdingId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete holding");
};

export default function PortfolioPage() {
  const queryClient = useQueryClient();

  // Fetch portfolios from API
  const { data: portfolios = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/portfolios"],
    queryFn: fetchPortfolios,
    refetchInterval: 60000, // Refresh every minute for live prices
  });

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<number | null>(null);
  const [editingPortfolioName, setEditingPortfolioName] = useState("");
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");

  // Position modal state
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<number | null>(null);
  const [positionForm, setPositionForm] = useState({
    symbol: "",
    name: "",
    shares: "",
    avgCost: "",
  });

  // Set default selected portfolio when data loads — default to "All Portfolios" (-1)
  if (portfolios.length > 0 && selectedPortfolioId === null) {
    setSelectedPortfolioId(-1);
  }

  // Mutations
  const createPortfolioMutation = useMutation({
    mutationFn: createPortfolio,
    onSuccess: (newPortfolio) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setSelectedPortfolioId(newPortfolio.id);
      setNewPortfolioName("");
      setIsAddingPortfolio(false);
    },
  });

  const updatePortfolioMutation = useMutation({
    mutationFn: updatePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setEditingPortfolioId(null);
      setEditingPortfolioName("");
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      const remaining = portfolios.filter(p => p.id !== selectedPortfolioId);
      setSelectedPortfolioId(remaining.length > 0 ? remaining[0].id : null);
      setIsDropdownOpen(false);
    },
  });

  const addHoldingMutation = useMutation({
    mutationFn: addHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setIsAddingPosition(false);
      setPositionForm({ symbol: "", name: "", shares: "", avgCost: "" });
    },
  });

  const updateHoldingMutation = useMutation({
    mutationFn: updateHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setIsAddingPosition(false);
      setEditingPositionId(null);
      setPositionForm({ symbol: "", name: "", shares: "", avgCost: "" });
    },
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
  });

  // Image scan state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedHoldings, setScannedHoldings] = useState<any[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importTarget, setImportTarget] = useState<"new" | "existing">("new");
  const [importNewName, setImportNewName] = useState("");
  const [importExistingId, setImportExistingId] = useState<number | null>(null);
  const [isIbkrImporting, setIsIbkrImporting] = useState(false);
  const [ibkrStatus, setIbkrStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [isSchwabSyncing, setIsSchwabSyncing] = useState(false);

  // Check IBKR status on mount
  const { data: ibkrStatusData } = useQuery({
    queryKey: ["/api/ibkr/status"],
    queryFn: async () => {
      const res = await fetch("/api/ibkr/status");
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: schwabStatusData } = useQuery({
    queryKey: ["/api/schwab/status"],
    queryFn: async () => {
      const res = await fetch("/api/schwab/status");
      return res.json();
    },
    staleTime: 30000,
  });

  const handleIbkrImport = async () => {
    setIsIbkrImporting(true);
    try {
      const res = await fetch("/api/ibkr/positions");
      const data = await res.json();

      if (data.error) {
        alert(`IBKR import failed: ${data.error}`);
        setIsIbkrImporting(false);
        return;
      }

      if (!data.holdings || data.holdings.length === 0) {
        alert("No positions found in your IBKR account.");
        setIsIbkrImporting(false);
        return;
      }

      // Open the import modal with the IBKR data pre-loaded
      setScannedHoldings(data.holdings);
      setImportTarget("new");
      setImportNewName(data.accountId ? `IBKR ${data.accountId}` : "Interactive Brokers");
      setIsImportModalOpen(true);
      setScanError(null);
    } catch (e: any) {
      alert(`IBKR import error: ${e.message}`);
    } finally {
      setIsIbkrImporting(false);
    }
  };

  const handleSchwabSync = async () => {
    setIsSchwabSyncing(true);
    try {
      const res = await fetch("/api/schwab/positions");
      const data = await res.json();

      if (data.error) {
        alert(`Schwab sync failed: ${data.error}`);
        setIsSchwabSyncing(false);
        return;
      }

      if (!data.holdings || data.holdings.length === 0) {
        alert("No positions found in your Schwab account.");
        setIsSchwabSyncing(false);
        return;
      }

      // Pre-select existing Schwab portfolio if one is selected, otherwise new
      const schwabPortfolio = portfolios.find((p: Portfolio) => /schwab/i.test(p.name));
      setScannedHoldings(data.holdings);
      if (schwabPortfolio) {
        setImportTarget("existing");
        setImportExistingId(schwabPortfolio.id);
      } else {
        setImportTarget("new");
        setImportNewName(data.accountId ? `Schwab ${data.accountId}` : "Charles Schwab");
      }
      setIsImportModalOpen(true);
      setScanError(null);
    } catch (e: any) {
      alert(`Schwab sync error: ${e.message}`);
    } finally {
      setIsSchwabSyncing(false);
    }
  };

  const handleImageScan = async (imageDataUrl: string) => {
    setIsScanning(true);
    setScanError(null);
    setScannedHoldings(null);
    try {
      const res = await fetch("/api/portfolio/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      const data = await res.json();
      if (data.holdings && data.holdings.length > 0) {
        setScannedHoldings(data.holdings);
      } else {
        setScanError(data.error || "No holdings found in the image. Try a clearer screenshot.");
      }
    } catch (e: any) {
      setScanError(`Scan failed: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setScanError("Please upload an image file (PNG, JPEG, or WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      handleImageScan(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFileUpload(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleImportScannedHoldings = async () => {
    if (!scannedHoldings) return;

    let targetPortfolioId: number;

    if (importTarget === "new") {
      const name = importNewName.trim() || "Imported Portfolio";
      const newPortfolio = await createPortfolio(name);
      targetPortfolioId = newPortfolio.id;
      setSelectedPortfolioId(targetPortfolioId);
    } else {
      if (!importExistingId) return;
      targetPortfolioId = importExistingId;
    }

    for (const h of scannedHoldings) {
      // Calculate avg cost: prefer cost/qty, fallback to last price, then value/qty
      let avgCost = "0";
      const perShareCost = h.qty > 0 && h.cost > 0 ? (h.cost / h.qty) : 0;
      const perShareFromValue = h.qty > 0 && h.value > 0 ? (h.value / h.qty) : 0;
      if (perShareCost > 0) {
        avgCost = perShareCost.toFixed(2);
      } else if (h.last && h.last > 0) {
        avgCost = h.last.toFixed(2);
      } else if (perShareFromValue > 0) {
        avgCost = perShareFromValue.toFixed(2);
      } else if (h.symbol === "CASH") {
        avgCost = "1";  // Cash is always $1/unit
      }

      await addHolding({
        portfolioId: targetPortfolioId,
        symbol: h.symbol,
        companyName: h.symbol,
        shares: String(h.qty),
        avgCost: avgCost,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    setIsImportModalOpen(false);
    setScannedHoldings(null);
    setScanError(null);
    setImportNewName("");
  };

  const isAllMode = selectedPortfolioId === -1;

  // When in "All Portfolios" mode, build a virtual aggregate portfolio by
  // merging holdings across every real portfolio. Holdings with the same
  // symbol are combined (shares summed, avgCost weighted by share count).
  const aggregatedHoldings: PortfolioHolding[] = (() => {
    if (!isAllMode) return [];
    const byKey = new Map<string, PortfolioHolding>();
    for (const p of portfolios) {
      for (const h of p.holdings || []) {
        const key = h.symbol.toUpperCase();
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, { ...h });
        } else {
          const existShares = parseFloat(existing.shares);
          const newShares = parseFloat(h.shares);
          const totalShares = existShares + newShares;
          const existCost = parseFloat(existing.avgCost) * existShares;
          const newCost = parseFloat(h.avgCost) * newShares;
          const weightedAvg = totalShares > 0 ? (existCost + newCost) / totalShares : 0;
          byKey.set(key, {
            ...existing,
            shares: String(totalShares),
            avgCost: String(weightedAvg),
            // Prefer the freshest price fields if present
            currentPrice: h.currentPrice ?? existing.currentPrice,
            change: h.change ?? existing.change,
            changePercent: h.changePercent ?? existing.changePercent,
          });
        }
      }
    }
    return Array.from(byKey.values());
  })();

  const selectedPortfolio = isAllMode
    ? ({
        id: -1,
        userId: 1,
        name: "All Portfolios",
        broker: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        holdings: aggregatedHoldings,
      } as any as (typeof portfolios)[number])
    : portfolios.find((p) => p.id === selectedPortfolioId);

  // Determine the selected portfolio's brokerage so we show only the relevant sync button.
  const portfolioName = (selectedPortfolio?.name || "").toLowerCase();
  const isSchwabPortfolio = !isAllMode && /schwab/.test(portfolioName);
  const isIbkrPortfolio = !isAllMode && /(ibkr|interactive brokers)/.test(portfolioName);

  const calculateHoldingValue = (holding: PortfolioHolding) => {
    const shares = parseFloat(holding.shares);
    const price = holding.currentPrice || parseFloat(holding.avgCost);
    return shares * price;
  };

  const calculateHoldingGainLoss = (holding: PortfolioHolding) => {
    const shares = parseFloat(holding.shares);
    const avgCost = parseFloat(holding.avgCost);
    const currentPrice = holding.currentPrice || avgCost;
    const cost = shares * avgCost;
    const value = shares * currentPrice;
    return value - cost;
  };

  const calculateSummary = (holdings: PortfolioHolding[]): PortfolioSummary => {
    const totalValue = holdings.reduce((sum, h) => {
      const shares = parseFloat(h.shares);
      const price = h.currentPrice || parseFloat(h.avgCost);
      return sum + shares * price;
    }, 0);

    const totalCost = holdings.reduce((sum, h) => {
      return sum + parseFloat(h.shares) * parseFloat(h.avgCost);
    }, 0);

    const totalGainLoss = totalValue - totalCost;

    const dayChange = holdings.reduce((sum, h) => {
      const shares = parseFloat(h.shares);
      const change = h.change || 0;
      return sum + change * shares;
    }, 0);

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent: totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0,
      dayChange,
      dayChangePercent:
        totalValue - dayChange > 0
          ? (dayChange / (totalValue - dayChange)) * 100
          : 0,
    };
  };

  const summary = selectedPortfolio?.holdings
    ? calculateSummary(selectedPortfolio.holdings)
    : {
        totalValue: 0,
        totalCost: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
      };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  const allocationData = selectedPortfolio?.holdings
    ? selectedPortfolio.holdings.map((h) => ({
        symbol: h.symbol,
        percentage:
          summary.totalValue > 0
            ? (calculateHoldingValue(h) / summary.totalValue) * 100
            : 0,
        value: calculateHoldingValue(h),
      }))
    : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  // Portfolio CRUD operations
  const handleAddPortfolio = () => {
    if (!newPortfolioName.trim()) return;
    createPortfolioMutation.mutate(newPortfolioName.trim());
  };

  const handleDeletePortfolio = (portfolioId: number) => {
    deletePortfolioMutation.mutate(portfolioId);
  };

  const handleStartEditPortfolio = (portfolio: Portfolio) => {
    setEditingPortfolioId(portfolio.id);
    setEditingPortfolioName(portfolio.name);
  };

  const handleSavePortfolioName = () => {
    if (!editingPortfolioName.trim() || !editingPortfolioId) return;
    updatePortfolioMutation.mutate({
      id: editingPortfolioId,
      name: editingPortfolioName.trim()
    });
  };

  // Position CRUD operations
  const handleOpenAddPosition = () => {
    setPositionForm({ symbol: "", name: "", shares: "", avgCost: "" });
    setEditingPositionId(null);
    setIsAddingPosition(true);
  };

  const handleOpenEditPosition = (holding: PortfolioHolding) => {
    setPositionForm({
      symbol: holding.symbol,
      name: holding.companyName || "",
      shares: holding.shares,
      avgCost: holding.avgCost,
    });
    setEditingPositionId(holding.id);
    setIsAddingPosition(true);
  };

  const handleSavePosition = () => {
    if (
      !positionForm.symbol.trim() ||
      !positionForm.shares ||
      !positionForm.avgCost ||
      !selectedPortfolioId ||
      selectedPortfolioId === -1
    ) {
      return;
    }

    const shares = parseFloat(positionForm.shares);
    const avgCost = parseFloat(positionForm.avgCost);

    if (isNaN(shares) || isNaN(avgCost) || shares <= 0 || avgCost <= 0) {
      return;
    }

    const symbol = positionForm.symbol.toUpperCase();

    if (editingPositionId) {
      // Edit existing position
      updateHoldingMutation.mutate({
        portfolioId: selectedPortfolioId,
        holdingId: editingPositionId,
        data: {
          symbol,
          companyName: positionForm.name || symbol,
          shares: positionForm.shares,
          avgCost: positionForm.avgCost,
        }
      });
    } else {
      // Add new position
      addHoldingMutation.mutate({
        portfolioId: selectedPortfolioId,
        symbol,
        companyName: positionForm.name || symbol,
        shares: positionForm.shares,
        avgCost: positionForm.avgCost,
      });
    }
  };

  const handleDeletePosition = (holdingId: number) => {
    if (!selectedPortfolioId) return;
    deleteHoldingMutation.mutate({
      portfolioId: selectedPortfolioId,
      holdingId
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Brokerage / Portfolio tabs */}
      {portfolios.length > 0 && (
        <div className="-mx-1 overflow-x-auto">
          <div className="flex items-center gap-2 px-1 pb-1">
            {(() => {
              const tabBase =
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border";
              const tabActive = "bg-primary text-white border-primary";
              const tabInactive =
                "bg-gray-100 dark:bg-dark-surface-2 text-black dark:text-white border-transparent hover:border-gray-400 dark:hover:border-gray-600";
              const totalHoldingsCount = portfolios.reduce(
                (sum, p) => sum + (p.holdings?.length || 0),
                0
              );
              return (
                <>
                  <button
                    onClick={() => setSelectedPortfolioId(-1)}
                    className={`${tabBase} ${isAllMode ? tabActive : tabInactive}`}
                  >
                    All Portfolios ({totalHoldingsCount})
                  </button>
                  {portfolios.map((p) => {
                    const isActive = selectedPortfolioId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPortfolioId(p.id)}
                        className={`${tabBase} ${isActive ? tabActive : tabInactive}`}
                      >
                        {p.name} ({p.holdings?.length || 0})
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Portfolios</h1>

          {/* Portfolio Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {selectedPortfolio?.name || "Select Portfolio"}
              <ChevronDown size={18} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-700">
                <div className="p-2">
                  {portfolios.map((portfolio) => (
                    <div
                      key={portfolio.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        portfolio.id === selectedPortfolioId
                          ? "bg-blue-600"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      {editingPortfolioId === portfolio.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingPortfolioName}
                            onChange={(e) => setEditingPortfolioName(e.target.value)}
                            className="flex-1 px-2 py-1 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePortfolioName();
                              if (e.key === "Escape") setEditingPortfolioId(null);
                            }}
                          />
                          <button
                            onClick={handleSavePortfolioName}
                            className="p-1 text-green-500 hover:text-green-400"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingPortfolioId(null)}
                            className="p-1 text-gray-400 hover:text-gray-300"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setSelectedPortfolioId(portfolio.id);
                              setIsDropdownOpen(false);
                            }}
                            className="flex-1 text-left text-white"
                          >
                            {portfolio.name}
                            <span className="text-gray-400 text-sm ml-2">
                              ({portfolio.holdings?.length || 0} positions)
                            </span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditPortfolio(portfolio);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-400"
                              title="Rename portfolio"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePortfolio(portfolio.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500"
                              title="Delete portfolio"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add New Portfolio */}
                  <div className="border-t border-gray-700 mt-2 pt-2">
                    {isAddingPortfolio ? (
                      <div className="flex items-center gap-2 p-2">
                        <input
                          type="text"
                          value={newPortfolioName}
                          onChange={(e) => setNewPortfolioName(e.target.value)}
                          placeholder="Portfolio name"
                          className="flex-1 px-2 py-1 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddPortfolio();
                            if (e.key === "Escape") setIsAddingPortfolio(false);
                          }}
                        />
                        <button
                          onClick={handleAddPortfolio}
                          className="p-1 text-green-500 hover:text-green-400"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingPortfolio(false);
                            setNewPortfolioName("");
                          }}
                          className="p-1 text-gray-400 hover:text-gray-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingPortfolio(true)}
                        className="flex items-center gap-2 w-full p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg"
                      >
                        <FolderPlus size={16} />
                        New Portfolio
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedPortfolio && !isAllMode && (
            <button
              onClick={() => {
                if (confirm(`Delete "${selectedPortfolio.name}" and all its holdings?`)) {
                  handleDeletePortfolio(selectedPortfolio.id);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 size={18} />
              Delete Portfolio
            </button>
          )}
          {ibkrStatusData?.enabled && !isSchwabPortfolio && (
            <button
              onClick={handleIbkrImport}
              disabled={isIbkrImporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors"
            >
              {isIbkrImporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isIbkrImporting ? "Importing..." : "Import from IBKR"}
            </button>
          )}
          {schwabStatusData?.authenticated && !isIbkrPortfolio && (
            <button
              onClick={handleSchwabSync}
              disabled={isSchwabSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white rounded-lg transition-colors"
            >
              {isSchwabSyncing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isSchwabSyncing ? "Syncing..." : "Sync from Schwab"}
            </button>
          )}
          <button
            onClick={() => { setIsImportModalOpen(true); setScanError(null); setScannedHoldings(null); setImportTarget("new"); setImportNewName(""); setImportExistingId(selectedPortfolioId); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Upload size={18} />
            Import from Image
          </button>
          <button
            onClick={handleOpenAddPosition}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            Add Position
          </button>
        </div>
      </div>

      {/* Empty State - No Portfolios */}
      {portfolios.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PieChart size={64} className="text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Portfolios</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Get started by creating a new portfolio or importing one from a brokerage screenshot.
          </p>
          <div className="flex items-center gap-3">
            {ibkrStatusData?.enabled && (
              <button
                onClick={handleIbkrImport}
                disabled={isIbkrImporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors"
              >
                {isIbkrImporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {isIbkrImporting ? "Importing..." : "Import from IBKR"}
              </button>
            )}
            {schwabStatusData?.authenticated && (
              <button
                onClick={handleSchwabSync}
                disabled={isSchwabSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white rounded-lg transition-colors"
              >
                {isSchwabSyncing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {isSchwabSyncing ? "Syncing..." : "Sync from Schwab"}
              </button>
            )}
            <button
              onClick={() => { setIsImportModalOpen(true); setScanError(null); setScannedHoldings(null); setImportTarget("new"); setImportNewName(""); }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Upload size={18} />
              Import from Image
            </button>
            <button
              onClick={() => { setIsDropdownOpen(true); setIsAddingPortfolio(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <FolderPlus size={18} />
              Create Portfolio
            </button>
          </div>
        </div>
      )}

      {portfolios.length > 0 && selectedPortfolio && (<>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign size={16} />
            Total Value
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(summary.totalValue)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <TrendingUp size={16} />
            Total Gain/Loss
          </div>
          <div
            className={`text-2xl font-bold ${
              summary.totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {formatCurrency(summary.totalGainLoss)}
          </div>
          <div
            className={`text-sm ${
              summary.totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {formatPercent(summary.totalGainLossPercent)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            {summary.dayChange >= 0 ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}
            Today's Change
          </div>
          <div
            className={`text-2xl font-bold ${
              summary.dayChange >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {formatCurrency(summary.dayChange)}
          </div>
          <div
            className={`text-sm ${
              summary.dayChange >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {formatPercent(summary.dayChangePercent)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <PieChart size={16} />
            Total Cost Basis
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(summary.totalCost)}
          </div>
        </div>
      </div>

      {/* Allocation Chart */}
      {allocationData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            Portfolio Allocation
          </h2>
          <div className="flex flex-wrap gap-4">
            {allocationData.map((item) => (
              <div key={item.symbol} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: getColorForSymbol(item.symbol),
                  }}
                />
                <span className="text-gray-300">
                  {item.symbol}: {item.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-4 rounded-full overflow-hidden flex">
            {allocationData.map((item) => (
              <div
                key={item.symbol}
                className="h-full"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: getColorForSymbol(item.symbol),
                }}
                title={`${item.symbol}: ${item.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Performance Chart — only for individual portfolios */}
      {selectedPortfolioId && !isAllMode && (
        <PortfolioChart portfolioId={selectedPortfolioId} />
      )}

      {/* Holdings Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <h2 className="text-lg font-semibold text-white p-4 border-b border-gray-700">
          Holdings
        </h2>
        {selectedPortfolio && selectedPortfolio.holdings && selectedPortfolio.holdings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-3 text-gray-300 font-medium">
                    Symbol
                  </th>
                  <th className="text-right p-3 text-gray-300 font-medium">
                    Shares
                  </th>
                  <th className="text-right p-3 text-gray-300 font-medium">
                    Avg Cost
                  </th>
                  <th className="text-right p-3 text-gray-300 font-medium">
                    Price
                  </th>
                  <th className="text-right p-3 text-gray-300 font-medium">
                    Day Change
                  </th>
                  <th className="text-right p-3 text-gray-300 font-medium">
                    Value
                  </th>
                  <th className="text-right p-3 text-gray-300 font-medium">
                    Gain/Loss
                  </th>
                  <th className="text-center p-3 text-gray-300 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedPortfolio.holdings.map((holding, hIdx) => {
                  const value = calculateHoldingValue(holding);
                  const gainLoss = calculateHoldingGainLoss(holding);
                  const shares = parseFloat(holding.shares);
                  const avgCost = parseFloat(holding.avgCost);
                  const gainLossPercent =
                    (gainLoss / (shares * avgCost)) * 100;
                  const currentPrice = holding.currentPrice || avgCost;
                  const change = holding.change || 0;
                  const changePercent = holding.changePercent || 0;

                  return (
                    <tr
                      key={isAllMode ? `${holding.symbol}-${hIdx}` : holding.id}
                      className="border-b border-gray-700 hover:bg-gray-750"
                    >
                      <td className="p-3">
                        <Link href={`/stock/${holding.symbol}`}>
                          <div className="cursor-pointer">
                            <div className="font-medium text-white hover:text-blue-400">
                              {holding.symbol}
                            </div>
                            <div className="text-sm text-gray-400">
                              {holding.companyName}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="p-3 text-right text-white">
                        {holding.shares}
                      </td>
                      <td className="p-3 text-right text-white">
                        {formatCurrency(avgCost)}
                      </td>
                      <td className="p-3 text-right text-white">
                        {formatCurrency(currentPrice)}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={
                            change >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          {formatCurrency(change)} (
                          {formatPercent(changePercent)})
                        </span>
                      </td>
                      <td className="p-3 text-right text-white font-medium">
                        {formatCurrency(value)}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={
                            gainLoss >= 0 ? "text-green-500" : "text-red-500"
                          }
                        >
                          {formatCurrency(gainLoss)}
                          <br />
                          <span className="text-sm">
                            {formatPercent(gainLossPercent)}
                          </span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isAllMode ? (
                          <span className="text-xs text-gray-500">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditPosition(holding)}
                              className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Edit position"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePosition(holding.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove position"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>{isAllMode ? "No positions across any portfolio." : "No positions in this portfolio."}</p>
            {!isAllMode && (
              <button
                onClick={handleOpenAddPosition}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Add Your First Position
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Position Modal */}
      {isAddingPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingPositionId ? "Edit Position" : "Add Position"}
              </h3>
              <button
                onClick={() => {
                  setIsAddingPosition(false);
                  setEditingPositionId(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Symbol *
                </label>
                <input
                  type="text"
                  value={positionForm.symbol}
                  onChange={(e) =>
                    setPositionForm({
                      ...positionForm,
                      symbol: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., AAPL"
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Company Name (optional)
                </label>
                <input
                  type="text"
                  value={positionForm.name}
                  onChange={(e) =>
                    setPositionForm({ ...positionForm, name: e.target.value })
                  }
                  placeholder="e.g., Apple Inc."
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Number of Shares *
                </label>
                <input
                  type="number"
                  value={positionForm.shares}
                  onChange={(e) =>
                    setPositionForm({ ...positionForm, shares: e.target.value })
                  }
                  placeholder="e.g., 100"
                  min="0"
                  step="any"
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Average Cost per Share *
                </label>
                <input
                  type="number"
                  value={positionForm.avgCost}
                  onChange={(e) =>
                    setPositionForm({ ...positionForm, avgCost: e.target.value })
                  }
                  placeholder="e.g., 150.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsAddingPosition(false);
                    setEditingPositionId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePosition}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingPositionId ? "Save Changes" : "Add Position"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* Import from Image Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onPaste={handlePaste}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Import Portfolio from Screenshot</h3>
              <button
                onClick={() => { setIsImportModalOpen(false); setScannedHoldings(null); setScanError(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {!scannedHoldings && !isScanning && (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    dragOver ? "border-purple-500 bg-purple-500/10" : "border-gray-600 hover:border-gray-500"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Image size={48} className="mx-auto mb-4 text-gray-500" />
                  <p className="text-white text-lg mb-2">Paste or drop a portfolio screenshot</p>
                  <p className="text-gray-400 text-sm mb-4">
                    Take a screenshot of your brokerage positions and paste it here (Cmd+V), or drag & drop an image file
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer transition-colors">
                    <Upload size={16} />
                    Browse Files
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                </div>
              </>
            )}

            {isScanning && (
              <div className="text-center py-12">
                <Loader2 size={48} className="mx-auto mb-4 text-purple-500 animate-spin" />
                <p className="text-white text-lg">Scanning your portfolio...</p>
                <p className="text-gray-400 text-sm mt-2">Claude is reading your screenshot and extracting positions</p>
              </div>
            )}

            {scanError && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mt-4">
                <p className="text-red-400 text-sm">{scanError}</p>
                <button
                  onClick={() => { setScanError(null); setScannedHoldings(null); }}
                  className="text-red-300 underline text-sm mt-2"
                >
                  Try again
                </button>
              </div>
            )}

            {scannedHoldings && (
              <div>
                <p className="text-green-400 text-sm mb-3">
                  Found {scannedHoldings.length} position{scannedHoldings.length !== 1 ? "s" : ""}. Review and import:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-2 pr-4">Symbol</th>
                        <th className="pb-2 pr-4 text-right">Shares</th>
                        <th className="pb-2 pr-4 text-right">Cost Basis</th>
                        <th className="pb-2 pr-4 text-right">Last Price</th>
                        <th className="pb-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedHoldings.map((h, i) => (
                        <tr key={i} className="border-b border-gray-700/50 text-white">
                          <td className="py-2 pr-4 font-mono font-semibold">{h.symbol}</td>
                          <td className="py-2 pr-4 text-right">{h.qty}</td>
                          <td className="py-2 pr-4 text-right">${h.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2 pr-4 text-right">${h.last.toFixed(2)}</td>
                          <td className="py-2 text-right">${h.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Import destination */}
                <div className="mt-4 p-4 bg-gray-900 rounded-lg space-y-3">
                  <p className="text-sm text-gray-400 font-medium">Import into:</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setImportTarget("new")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        importTarget === "new"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      Create New Portfolio
                    </button>
                    <button
                      onClick={() => { setImportTarget("existing"); setImportExistingId(selectedPortfolioId); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        importTarget === "existing"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      Add to Existing Portfolio
                    </button>
                  </div>

                  {importTarget === "new" && (
                    <input
                      type="text"
                      value={importNewName}
                      onChange={(e) => setImportNewName(e.target.value)}
                      placeholder="Portfolio name (e.g. IBKR, Fidelity, Schwab)"
                      className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      autoFocus
                    />
                  )}

                  {importTarget === "existing" && (
                    <select
                      value={importExistingId || ""}
                      onChange={(e) => setImportExistingId(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="" disabled>Select a portfolio</option>
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setScannedHoldings(null); setScanError(null); }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Rescan
                  </button>
                  <button
                    onClick={handleImportScannedHoldings}
                    disabled={importTarget === "existing" && !importExistingId}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                  >
                    {importTarget === "new"
                      ? `Create "${importNewName.trim() || "Imported Portfolio"}" with ${scannedHoldings.length} Position${scannedHoldings.length !== 1 ? "s" : ""}`
                      : `Import ${scannedHoldings.length} Position${scannedHoldings.length !== 1 ? "s" : ""}`
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}

function getColorForSymbol(symbol: string): string {
  const colors: Record<string, string> = {
    AAPL: "#3b82f6",
    MSFT: "#22c55e",
    GOOGL: "#f59e0b",
    AMZN: "#ef4444",
    NVDA: "#8b5cf6",
    TSLA: "#ec4899",
    META: "#06b6d4",
    JPM: "#14b8a6",
    V: "#f97316",
    JNJ: "#84cc16",
  };
  return colors[symbol] || "#6b7280";
}
