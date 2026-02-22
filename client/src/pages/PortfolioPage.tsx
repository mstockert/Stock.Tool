import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  // Set default selected portfolio when data loads
  if (portfolios.length > 0 && selectedPortfolioId === null) {
    setSelectedPortfolioId(portfolios[0].id);
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
      if (portfolios.length > 1) {
        setSelectedPortfolioId(portfolios.find(p => p.id !== selectedPortfolioId)?.id || null);
      }
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

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId);

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
    if (portfolios.length <= 1) {
      alert("You must have at least one portfolio");
      return;
    }
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
      !selectedPortfolioId
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>

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

        <button
          onClick={handleOpenAddPosition}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Position
        </button>
      </div>

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
                {selectedPortfolio.holdings.map((holding) => {
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
                      key={holding.id}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>No positions in this portfolio.</p>
            <button
              onClick={handleOpenAddPosition}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add Your First Position
            </button>
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
