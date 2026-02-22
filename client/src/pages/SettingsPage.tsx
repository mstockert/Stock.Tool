import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Server,
  Wifi,
  WifiOff,
  Settings,
  Database
} from "lucide-react";

type IBKRStatus = {
  enabled: boolean;
  authenticated: boolean;
  connected: boolean;
  message: string;
};

const fetchIBKRStatus = async (): Promise<IBKRStatus> => {
  const response = await fetch("/api/ibkr/status");
  if (!response.ok) throw new Error("Failed to fetch IBKR status");
  return response.json();
};

export default function SettingsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: ibkrStatus, isLoading, refetch } = useQuery<IBKRStatus>({
    queryKey: ["/api/ibkr/status"],
    queryFn: fetchIBKRStatus,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* IBKR Connection Status */}
        <Card className="bg-dark-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Interactive Brokers Connection
                </CardTitle>
                <CardDescription className="mt-1">
                  Real-time market data from your IB account
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : ibkrStatus ? (
              <div className="space-y-4">
                {/* Connection Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-dark-surface-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary text-sm">Integration</span>
                      {ibkrStatus.enabled ? (
                        <Badge className="bg-positive/20 text-positive">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ibkrStatus.enabled ? (
                        <CheckCircle2 className="h-5 w-5 text-positive" />
                      ) : (
                        <XCircle className="h-5 w-5 text-text-secondary" />
                      )}
                      <span className="font-medium">
                        {ibkrStatus.enabled ? "IBKR API Active" : "Not Configured"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-dark-surface-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary text-sm">Gateway</span>
                      {ibkrStatus.connected ? (
                        <Badge className="bg-positive/20 text-positive">Connected</Badge>
                      ) : (
                        <Badge variant="destructive">Disconnected</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ibkrStatus.connected ? (
                        <Wifi className="h-5 w-5 text-positive" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-negative" />
                      )}
                      <span className="font-medium">
                        {ibkrStatus.connected ? "Gateway Running" : "Gateway Offline"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-dark-surface-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary text-sm">Authentication</span>
                      {ibkrStatus.authenticated ? (
                        <Badge className="bg-positive/20 text-positive">Authenticated</Badge>
                      ) : (
                        <Badge variant="destructive">Not Authenticated</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ibkrStatus.authenticated ? (
                        <CheckCircle2 className="h-5 w-5 text-positive" />
                      ) : (
                        <XCircle className="h-5 w-5 text-negative" />
                      )}
                      <span className="font-medium">
                        {ibkrStatus.authenticated ? "Session Active" : "Login Required"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Message */}
                <div className={`p-4 rounded-lg border ${
                  ibkrStatus.authenticated
                    ? "bg-positive/10 border-positive/30"
                    : "bg-yellow-500/10 border-yellow-500/30"
                }`}>
                  <p className={ibkrStatus.authenticated ? "text-positive" : "text-yellow-500"}>
                    {ibkrStatus.message}
                  </p>
                </div>

                {/* Setup Instructions */}
                {!ibkrStatus.enabled && (
                  <div className="p-4 rounded-lg bg-dark-surface-2 border border-gray-700">
                    <h4 className="font-medium mb-3">Setup Instructions</h4>
                    <ol className="list-decimal list-inside space-y-2 text-text-secondary text-sm">
                      <li>Download the IB Gateway or Client Portal Gateway from Interactive Brokers</li>
                      <li>Run the gateway application on your computer</li>
                      <li>Create a <code className="bg-dark-bg px-1 rounded">.env</code> file in your Stock.Tool directory</li>
                      <li>Add <code className="bg-dark-bg px-1 rounded">IBKR_ENABLED=true</code> to enable the integration</li>
                      <li>Restart the Stock.Tool server</li>
                      <li>Authenticate via the gateway's web interface (usually https://localhost:5000)</li>
                    </ol>
                    <div className="mt-4">
                      <a
                        href="https://www.interactivebrokers.com/en/trading/ibgateway-stable.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:underline"
                      >
                        Download IB Gateway
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    </div>
                  </div>
                )}

                {ibkrStatus.enabled && !ibkrStatus.authenticated && (
                  <div className="p-4 rounded-lg bg-dark-surface-2 border border-yellow-500/30">
                    <h4 className="font-medium mb-2 text-yellow-500">Authentication Required</h4>
                    <p className="text-text-secondary text-sm mb-3">
                      The IB Gateway is running but you need to log in to access market data.
                    </p>
                    <a
                      href="https://localhost:5000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      Open IB Gateway Login
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-secondary">Unable to fetch IBKR status</p>
            )}
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card className="bg-dark-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Sources
            </CardTitle>
            <CardDescription>
              Configure where market data is fetched from
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-dark-surface-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${ibkrStatus?.authenticated ? "bg-positive" : "bg-text-secondary"}`} />
                  <div>
                    <p className="font-medium">Interactive Brokers</p>
                    <p className="text-text-secondary text-sm">Real-time quotes and historical data</p>
                  </div>
                </div>
                <Badge variant={ibkrStatus?.authenticated ? "default" : "secondary"}>
                  {ibkrStatus?.authenticated ? "Primary" : "Inactive"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-dark-surface-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-positive" />
                  <div>
                    <p className="font-medium">Alpha Vantage</p>
                    <p className="text-text-secondary text-sm">Stock quotes and company info (fallback)</p>
                  </div>
                </div>
                <Badge variant={ibkrStatus?.authenticated ? "secondary" : "default"}>
                  {ibkrStatus?.authenticated ? "Fallback" : "Primary"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-dark-surface-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-positive" />
                  <div>
                    <p className="font-medium">Finnhub</p>
                    <p className="text-text-secondary text-sm">Market news and sentiment</p>
                  </div>
                </div>
                <Badge>Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="bg-dark-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              About Stock.Tool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-text-secondary">
              <p><span className="text-text-primary font-medium">Version:</span> 1.0.0</p>
              <p><span className="text-text-primary font-medium">Built with:</span> React, Express, TypeScript</p>
              <p className="text-sm mt-4">
                Stock.Tool is a comprehensive stock tracking and analysis application.
                Connect your Interactive Brokers account for real-time market data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
