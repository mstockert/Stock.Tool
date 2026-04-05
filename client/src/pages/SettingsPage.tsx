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
  Database,
  KeyRound,
  LinkIcon,
  Sun,
  Moon,
  Monitor,
  Palette,
} from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";

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

type SchwabStatus = {
  enabled: boolean;
  authenticated: boolean;
  accessExpiresIn: number | null;
  refreshExpiresIn: number | null;
  message: string;
};

const fetchSchwabStatus = async (): Promise<SchwabStatus> => {
  const response = await fetch("/api/schwab/status");
  if (!response.ok) throw new Error("Failed to fetch Schwab status");
  return response.json();
};

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [schwabRedirectUrl, setSchwabRedirectUrl] = useState("");
  const [schwabExchanging, setSchwabExchanging] = useState(false);
  const [schwabMsg, setSchwabMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const { data: ibkrStatus, isLoading, refetch } = useQuery<IBKRStatus>({
    queryKey: ["/api/ibkr/status"],
    queryFn: fetchIBKRStatus,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const { data: schwabStatus, refetch: refetchSchwab } = useQuery<SchwabStatus>({
    queryKey: ["/api/schwab/status"],
    queryFn: fetchSchwabStatus,
    refetchInterval: 60000,
  });

  const { data: schwabAuthUrlData } = useQuery<{ authUrl: string }>({
    queryKey: ["/api/schwab/auth-url"],
    queryFn: async () => {
      const r = await fetch("/api/schwab/auth-url");
      if (!r.ok) throw new Error("Failed to fetch Schwab auth URL");
      return r.json();
    },
    enabled: !!schwabStatus?.enabled,
    staleTime: Infinity,
  });
  const schwabAuthUrl = schwabAuthUrlData?.authUrl || "";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchSchwab()]);
    setIsRefreshing(false);
  };


  const handleSchwabExchange = async () => {
    if (!schwabRedirectUrl.trim()) return;
    setSchwabExchanging(true);
    setSchwabMsg(null);
    try {
      const resp = await fetch("/api/schwab/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectUrl: schwabRedirectUrl.trim() }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setSchwabMsg({ kind: "ok", text: "Connected! Tokens saved." });
        setSchwabRedirectUrl("");
        await refetchSchwab();
      } else {
        setSchwabMsg({ kind: "err", text: data.message || "Exchange failed" });
      }
    } catch (e: any) {
      setSchwabMsg({ kind: "err", text: e.message });
    } finally {
      setSchwabExchanging(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription className="mt-1">
              Choose between light, dark, or match your system theme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
          </CardContent>
        </Card>

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
                      The Stock.Tool server cannot reach IB Gateway on 127.0.0.1:4001. Open the
                      IB Gateway (or TWS) desktop application and sign in. Then, in Configure →
                      API → Settings, make sure "Enable ActiveX and Socket Clients" is checked
                      and the Socket port is set to <code className="px-1 bg-dark-surface rounded">4001</code> (IB Gateway)
                      or <code className="px-1 bg-dark-surface rounded">7497</code> (TWS paper).
                    </p>
                    <p className="text-text-secondary text-xs">
                      Note: IB Gateway has no web login — you must sign in inside the desktop app itself.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-secondary">Unable to fetch IBKR status</p>
            )}
          </CardContent>
        </Card>

        {/* Schwab Connection */}
        <Card className="bg-dark-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Charles Schwab API
            </CardTitle>
            <CardDescription className="mt-1">
              OAuth 2.0 market data fallback (quotes + price history)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schwabStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-dark-surface-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary text-sm">Integration</span>
                      {schwabStatus.enabled ? (
                        <Badge className="bg-positive/20 text-positive">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {schwabStatus.enabled ? (
                        <CheckCircle2 className="h-5 w-5 text-positive" />
                      ) : (
                        <XCircle className="h-5 w-5 text-text-secondary" />
                      )}
                      <span className="font-medium">
                        {schwabStatus.enabled ? "Credentials Configured" : "Not Configured"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-dark-surface-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary text-sm">OAuth</span>
                      {schwabStatus.authenticated ? (
                        <Badge className="bg-positive/20 text-positive">Connected</Badge>
                      ) : (
                        <Badge variant="destructive">Not Connected</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {schwabStatus.authenticated ? (
                        <Wifi className="h-5 w-5 text-positive" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-negative" />
                      )}
                      <span className="font-medium">
                        {schwabStatus.authenticated ? "Session Active" : "Auth Required"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-dark-surface-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary text-sm">Token Expiry</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Access:</span>
                        <span className="font-mono">{formatDuration(schwabStatus.accessExpiresIn)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Refresh:</span>
                        <span className="font-mono">{formatDuration(schwabStatus.refreshExpiresIn)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  schwabStatus.authenticated
                    ? "bg-positive/10 border-positive/30"
                    : "bg-yellow-500/10 border-yellow-500/30"
                }`}>
                  <p className={schwabStatus.authenticated ? "text-positive" : "text-yellow-500"}>
                    {schwabStatus.message}
                  </p>
                </div>

                {schwabStatus.enabled && !schwabStatus.authenticated && (
                  <div className="p-4 rounded-lg bg-dark-surface-2 border border-gray-700 space-y-3">
                    <h4 className="font-medium">Connect Your Schwab Account</h4>
                    <ol className="list-decimal list-inside space-y-1 text-text-secondary text-sm">
                      <li>Click "Open Schwab Login" — this tab navigates to Schwab's OAuth page</li>
                      <li>Log in and approve access to your app</li>
                      <li>Schwab redirects to <code className="bg-dark-bg px-1 rounded text-xs">https://127.0.0.1:8182/?code=...</code> (cert warning is expected — nothing is running there)</li>
                      <li>Copy the <strong>full URL</strong> from the address bar</li>
                      <li>Navigate back to Stock.Tool (browser back button, or retype the URL), paste the URL below, click "Exchange Code"</li>
                    </ol>
                    <div className="flex gap-2 pt-1">
                      <a
                        href={schwabAuthUrl || "#"}
                        className={`inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ${!schwabAuthUrl ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Open Schwab Login
                      </a>
                    </div>
                    <div className="pt-2">
                      <label className="text-sm text-text-secondary block mb-1">
                        Paste redirect URL (or just the code):
                      </label>
                      <textarea
                        value={schwabRedirectUrl}
                        onChange={(e) => setSchwabRedirectUrl(e.target.value)}
                        placeholder="https://127.0.0.1:8182/?code=...@&session=..."
                        className="w-full px-3 py-2 rounded bg-dark-bg border border-gray-700 text-sm font-mono resize-none focus:outline-none focus:border-primary"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={handleSchwabExchange}
                          disabled={schwabExchanging || !schwabRedirectUrl.trim()}
                        >
                          {schwabExchanging ? "Exchanging..." : "Exchange Code"}
                        </Button>
                      </div>
                      {schwabMsg && (
                        <p className={`mt-2 text-sm ${schwabMsg.kind === "ok" ? "text-positive" : "text-negative"}`}>
                          {schwabMsg.text}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {schwabStatus.authenticated && (
                  <div className="flex gap-2">
                    <a
                      href={schwabAuthUrl || "#"}
                      className={`inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium border border-input hover:bg-accent transition-colors ${!schwabAuthUrl ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-authenticate
                    </a>
                    <a
                      href="https://developer.schwab.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline text-sm px-3 py-2"
                    >
                      Developer Portal
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <Skeleton className="h-24 w-full" />
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
                  <div className={`w-3 h-3 rounded-full ${schwabStatus?.authenticated ? "bg-positive" : "bg-text-secondary"}`} />
                  <div>
                    <p className="font-medium">Charles Schwab</p>
                    <p className="text-text-secondary text-sm">Quotes + price history (OAuth fallback)</p>
                  </div>
                </div>
                <Badge variant={schwabStatus?.authenticated ? "default" : "secondary"}>
                  {schwabStatus?.authenticated ? "Active" : "Inactive"}
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
