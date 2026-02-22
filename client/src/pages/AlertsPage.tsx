import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Bell, BellOff, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PriceAlert = {
  id: number;
  userId: number;
  symbol: string;
  targetPrice: string;
  condition: string; // 'above' or 'below'
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
  currentPrice?: number;
};

// API helpers
const fetchAlerts = async (): Promise<PriceAlert[]> => {
  const response = await fetch("/api/alerts");
  if (!response.ok) throw new Error("Failed to fetch alerts");
  return response.json();
};

const createAlert = async (data: { symbol: string; targetPrice: string; condition: string }) => {
  const response = await apiRequest("POST", "/api/alerts", {
    ...data,
    userId: 1, // Demo user
  });
  if (!response.ok) throw new Error("Failed to create alert");
  return response.json();
};

const updateAlert = async ({ id, ...data }: { id: number; isActive?: boolean }) => {
  const response = await apiRequest("PUT", `/api/alerts/${id}`, data);
  if (!response.ok) throw new Error("Failed to update alert");
  return response.json();
};

const deleteAlert = async (id: number) => {
  const response = await apiRequest("DELETE", `/api/alerts/${id}`, undefined);
  if (!response.ok) throw new Error("Failed to delete alert");
  return response.json();
};

export default function AlertsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: "",
    targetPrice: "",
    condition: "above",
  });
  const { toast } = useToast();

  const { data: alerts = [], isLoading, refetch } = useQuery<PriceAlert[]>({
    queryKey: ["/api/alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 30000, // Check alerts every 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      refetch();
      setDialogOpen(false);
      setNewAlert({ symbol: "", targetPrice: "", condition: "above" });
      toast({
        title: "Alert Created",
        description: `Price alert for ${newAlert.symbol.toUpperCase()} has been created.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      refetch();
      toast({
        title: "Alert Deleted",
        description: "Price alert has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateAlert = () => {
    if (!newAlert.symbol.trim() || !newAlert.targetPrice.trim()) return;
    createMutation.mutate({
      symbol: newAlert.symbol.toUpperCase(),
      targetPrice: newAlert.targetPrice,
      condition: newAlert.condition,
    });
  };

  const toggleAlertActive = (alert: PriceAlert) => {
    updateMutation.mutate({ id: alert.id, isActive: !alert.isActive });
  };

  // Separate active and triggered alerts
  const activeAlerts = alerts.filter(a => a.isActive && !a.isTriggered);
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const inactiveAlerts = alerts.filter(a => !a.isActive && !a.isTriggered);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Price Alerts</h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-dark-surface text-black dark:text-text-primary">
            <DialogHeader>
              <DialogTitle className="text-black dark:text-white">Create Price Alert</DialogTitle>
              <DialogDescription className="text-gray-700 dark:text-gray-300">
                Get notified when a stock reaches your target price
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Stock Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g. AAPL"
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
                  className="bg-gray-100 dark:bg-dark-surface-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={newAlert.condition}
                  onValueChange={(value) => setNewAlert({ ...newAlert, condition: value })}
                >
                  <SelectTrigger className="bg-gray-100 dark:bg-dark-surface-2">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Price goes above</SelectItem>
                    <SelectItem value="below">Price goes below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetPrice">Target Price ($)</Label>
                <Input
                  id="targetPrice"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 150.00"
                  value={newAlert.targetPrice}
                  onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                  className="bg-gray-100 dark:bg-dark-surface-2"
                />
              </div>
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
                onClick={handleCreateAlert}
                disabled={createMutation.isPending || !newAlert.symbol.trim() || !newAlert.targetPrice.trim()}
              >
                {createMutation.isPending ? "Creating..." : "Create Alert"}
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
      ) : (
        <div className="space-y-6">
          {/* Triggered Alerts */}
          {triggeredAlerts.length > 0 && (
            <Card className="bg-dark-surface border-yellow-500/50">
              <CardHeader className="px-6 py-4 border-b border-gray-800">
                <CardTitle className="flex items-center text-yellow-500">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Triggered Alerts ({triggeredAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-800">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-dark-surface-2 text-text-secondary font-medium text-sm">
                    <div className="col-span-2">Symbol</div>
                    <div className="col-span-3">Condition</div>
                    <div className="col-span-2 text-right">Target</div>
                    <div className="col-span-2 text-right">Triggered</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  {triggeredAlerts.map((alert) => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onToggle={toggleAlertActive}
                      onDelete={() => deleteMutation.mutate(alert.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Alerts */}
          <Card className="bg-dark-surface">
            <CardHeader className="px-6 py-4 border-b border-gray-800">
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2 text-primary" />
                Active Alerts ({activeAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activeAlerts.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-dark-surface-2 text-text-secondary font-medium text-sm">
                    <div className="col-span-2">Symbol</div>
                    <div className="col-span-3">Condition</div>
                    <div className="col-span-2 text-right">Target</div>
                    <div className="col-span-2 text-right">Current</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  {activeAlerts.map((alert) => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onToggle={toggleAlertActive}
                      onDelete={() => deleteMutation.mutate(alert.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-text-secondary">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active price alerts.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Alert
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inactive Alerts */}
          {inactiveAlerts.length > 0 && (
            <Card className="bg-dark-surface opacity-75">
              <CardHeader className="px-6 py-4 border-b border-gray-800">
                <CardTitle className="flex items-center text-text-secondary">
                  <BellOff className="h-5 w-5 mr-2" />
                  Inactive Alerts ({inactiveAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-800">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-dark-surface-2 text-text-secondary font-medium text-sm">
                    <div className="col-span-2">Symbol</div>
                    <div className="col-span-3">Condition</div>
                    <div className="col-span-2 text-right">Target</div>
                    <div className="col-span-2 text-right">Current</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  {inactiveAlerts.map((alert) => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onToggle={toggleAlertActive}
                      onDelete={() => deleteMutation.mutate(alert.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

// Alert row component
type AlertRowProps = {
  alert: PriceAlert;
  onToggle: (alert: PriceAlert) => void;
  onDelete: () => void;
  isDeleting: boolean;
};

function AlertRow({ alert, onToggle, onDelete, isDeleting }: AlertRowProps) {
  const targetPrice = parseFloat(alert.targetPrice);
  const currentPrice = alert.currentPrice;
  const isAbove = alert.condition === "above";

  // Calculate proximity to target (for visual indicator)
  let proximityPercent = 0;
  if (currentPrice) {
    const diff = isAbove
      ? (targetPrice - currentPrice) / targetPrice
      : (currentPrice - targetPrice) / targetPrice;
    proximityPercent = Math.max(0, Math.min(100, (1 - diff) * 100));
  }

  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-dark-surface-2 items-center">
      <div className="col-span-2">
        <Link href={`/stock/${alert.symbol}`} className="font-medium text-primary hover:underline">
          {alert.symbol}
        </Link>
      </div>
      <div className="col-span-3 flex items-center">
        {isAbove ? (
          <>
            <TrendingUp className="h-4 w-4 mr-2 text-positive" />
            <span>Above</span>
          </>
        ) : (
          <>
            <TrendingDown className="h-4 w-4 mr-2 text-negative" />
            <span>Below</span>
          </>
        )}
        {alert.isTriggered && (
          <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500">
            Triggered
          </Badge>
        )}
      </div>
      <div className="col-span-2 text-right font-mono">
        ${targetPrice.toFixed(2)}
      </div>
      <div className="col-span-2 text-right font-mono">
        {alert.isTriggered && alert.triggeredAt ? (
          <span className="text-text-secondary text-sm">
            {new Date(alert.triggeredAt).toLocaleDateString()}
          </span>
        ) : currentPrice ? (
          <span className={
            (isAbove && currentPrice >= targetPrice) || (!isAbove && currentPrice <= targetPrice)
              ? "text-yellow-500"
              : ""
          }>
            ${currentPrice.toFixed(2)}
          </span>
        ) : (
          <span className="text-text-secondary">—</span>
        )}
      </div>
      <div className="col-span-3 flex justify-end items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Switch
            checked={alert.isActive}
            onCheckedChange={() => onToggle(alert)}
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-text-secondary hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
