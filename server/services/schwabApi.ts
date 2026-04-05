import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockHistory } from "@shared/schema";

/**
 * Charles Schwab Market Data API Service
 *
 * OAuth 2.0 authorization_code flow. Tokens:
 *   - access_token:  ~30 minutes
 *   - refresh_token: 7 days (Schwab limitation — user must re-auth weekly)
 *
 * SETUP:
 *   1. Register an app at https://developer.schwab.com
 *   2. Set SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SCHWAB_REDIRECT_URI in .env
 *   3. Set SCHWAB_ENABLED=true
 *   4. Start the server and hit GET /api/schwab/auth-url → open in browser, log in
 *   5. Schwab redirects back to SCHWAB_REDIRECT_URI with ?code=... — copy the full URL
 *   6. POST it to /api/schwab/exchange with { redirectUrl } to complete the flow
 *
 * API endpoints used:
 *   POST https://api.schwabapi.com/v1/oauth/token
 *   GET  https://api.schwabapi.com/marketdata/v1/quotes?symbols=...
 *   GET  https://api.schwabapi.com/marketdata/v1/pricehistory?...
 */

const AUTH_BASE = "https://api.schwabapi.com/v1/oauth";
const MARKETDATA_BASE = "https://api.schwabapi.com/marketdata/v1";
const TRADER_BASE = "https://api.schwabapi.com/trader/v1";
const TOKEN_FILE = path.join(process.cwd(), ".schwab-tokens.json");

interface SchwabTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;        // epoch ms
  refresh_expires_at: number; // epoch ms (7 days after issue)
  token_type: string;
  scope?: string;
}

export class SchwabApiService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private tokens: SchwabTokens | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.clientId = process.env.SCHWAB_CLIENT_ID || "";
    this.clientSecret = process.env.SCHWAB_CLIENT_SECRET || "";
    this.redirectUri = process.env.SCHWAB_REDIRECT_URI || "https://127.0.0.1:8182";
    this.loadTokens();
  }

  // ---------- token persistence ----------

  private loadTokens(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        this.tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
        console.log("🔑 Loaded Schwab tokens from disk");
      }
    } catch (e: any) {
      console.warn("Failed to load Schwab tokens:", e.message);
    }
  }

  private saveTokens(tokens: SchwabTokens): void {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
      this.tokens = tokens;
    } catch (e: any) {
      console.warn("Failed to save Schwab tokens:", e.message);
    }
  }

  // ---------- OAuth flow ----------

  getAuthUrl(): string {
    const url = new URL(`${AUTH_BASE}/authorize`);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  /**
   * Exchange the authorization code for access + refresh tokens.
   * Accepts either a bare code or the full redirect URL pasted by the user.
   */
  async exchangeCode(codeOrRedirectUrl: string): Promise<SchwabTokens> {
    let code = codeOrRedirectUrl.trim();
    // If they pasted the full redirect URL, extract ?code=...
    if (code.includes("code=")) {
      try {
        const u = new URL(code);
        code = u.searchParams.get("code") || code;
      } catch {
        const m = code.match(/code=([^&]+)/);
        if (m) code = decodeURIComponent(m[1]);
      }
    }
    // Schwab wraps the code in @ — it arrives URL-encoded (%40)
    code = decodeURIComponent(code);

    console.log(`[Schwab] Exchanging code (len=${code.length}, first8=${code.substring(0, 8)}..., last4=...${code.substring(code.length - 4)})`);
    console.log(`[Schwab] Client ID: ${this.clientId.substring(0, 8)}... (len=${this.clientId.length})`);
    console.log(`[Schwab] Client Secret: (len=${this.clientSecret.length})`);
    console.log(`[Schwab] Redirect URI: ${this.redirectUri}`);

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
    });

    let resp;
    try {
      resp = await axios.post(`${AUTH_BASE}/token`, body.toString(), {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
    } catch (e: any) {
      console.error("[Schwab] Token exchange HTTP error:");
      console.error("  Status:", e.response?.status, e.response?.statusText);
      console.error("  Body:", JSON.stringify(e.response?.data, null, 2));
      console.error("  Headers:", JSON.stringify(e.response?.headers, null, 2));
      throw e;
    }

    const now = Date.now();
    const tokens: SchwabTokens = {
      access_token: resp.data.access_token,
      refresh_token: resp.data.refresh_token,
      expires_at: now + (resp.data.expires_in || 1800) * 1000,
      refresh_expires_at: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      token_type: resp.data.token_type || "Bearer",
      scope: resp.data.scope,
    };
    this.saveTokens(tokens);
    console.log("✅ Schwab tokens obtained");
    return tokens;
  }

  /**
   * Returns a valid access_token, refreshing if needed. Null if not authenticated
   * or refresh token has expired (re-auth required).
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.tokens) return null;

    // Refresh 60s before expiry
    if (Date.now() < this.tokens.expires_at - 60_000) {
      return this.tokens.access_token;
    }

    // Refresh token expired?
    if (Date.now() >= this.tokens.refresh_expires_at) {
      console.warn("⚠️ Schwab refresh token expired — re-auth required");
      return null;
    }

    // Deduplicate concurrent refreshes
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshAccessToken().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.tokens) return null;
    try {
      const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.tokens.refresh_token,
      });
      const resp = await axios.post(`${AUTH_BASE}/token`, body.toString(), {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const now = Date.now();
      const next: SchwabTokens = {
        access_token: resp.data.access_token,
        // Schwab may or may not rotate the refresh token
        refresh_token: resp.data.refresh_token || this.tokens.refresh_token,
        expires_at: now + (resp.data.expires_in || 1800) * 1000,
        refresh_expires_at: resp.data.refresh_token
          ? now + 7 * 24 * 60 * 60 * 1000
          : this.tokens.refresh_expires_at,
        token_type: resp.data.token_type || "Bearer",
        scope: resp.data.scope || this.tokens.scope,
      };
      this.saveTokens(next);
      console.log("🔄 Schwab access token refreshed");
      return next.access_token;
    } catch (e: any) {
      console.error("❌ Schwab token refresh failed:", e.response?.data || e.message);
      return null;
    }
  }

  // ---------- status ----------

  getStatus(): {
    enabled: boolean;
    authenticated: boolean;
    accessExpiresIn: number | null;
    refreshExpiresIn: number | null;
    message: string;
  } {
    const enabled = !!this.clientId && !!this.clientSecret;
    if (!enabled) {
      return {
        enabled: false, authenticated: false, accessExpiresIn: null, refreshExpiresIn: null,
        message: "Schwab credentials not configured in .env",
      };
    }
    if (!this.tokens) {
      return {
        enabled: true, authenticated: false, accessExpiresIn: null, refreshExpiresIn: null,
        message: "Not authenticated. Hit /api/schwab/auth-url to begin OAuth.",
      };
    }
    const now = Date.now();
    const accessExpiresIn = Math.max(0, Math.round((this.tokens.expires_at - now) / 1000));
    const refreshExpiresIn = Math.max(0, Math.round((this.tokens.refresh_expires_at - now) / 1000));
    return {
      enabled: true,
      authenticated: refreshExpiresIn > 0,
      accessExpiresIn,
      refreshExpiresIn,
      message: refreshExpiresIn > 0
        ? `Authenticated. Refresh token expires in ${Math.round(refreshExpiresIn / 3600)}h.`
        : "Refresh token expired — re-authenticate.",
    };
  }

  // ---------- market data ----------

  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const resp = await axios.get(`${MARKETDATA_BASE}/quotes`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { symbols: symbol, fields: "quote,reference" },
      });
      const entry = resp.data?.[symbol];
      if (!entry || !entry.quote) return null;

      const q = entry.quote;
      const ref = entry.reference || {};
      const last = q.lastPrice ?? q.regularMarketLastPrice ?? q.closePrice;
      const prevClose = q.closePrice ?? q.regularMarketLastPrice ?? last;
      const change = q.netChange ?? (last - prevClose);
      const changePct = q.netPercentChange != null
        ? q.netPercentChange / 100
        : prevClose ? (last - prevClose) / prevClose : 0;

      return {
        symbol,
        name: ref.description || "",
        price: last,
        change,
        changePercent: changePct,
        open: q.openPrice ?? last,
        high: q.highPrice ?? last,
        low: q.lowPrice ?? last,
        close: prevClose,
        volume: q.totalVolume ?? 0,
        marketCap: 0,
      };
    } catch (e: any) {
      const status = e.response?.status;
      console.warn(`Schwab quote failed for ${symbol}: ${status} ${e.response?.data?.message || e.message}`);
      return null;
    }
  }

  /**
   * Fetch price history. Timeframes map to Schwab's periodType/frequencyType.
   */
  async getStockHistory(symbol: string, timeframe: string): Promise<StockHistory[] | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    // Map our timeframe → Schwab periodType/period/frequencyType/frequency
    let params: Record<string, string | number> = { symbol };
    switch (timeframe) {
      case "1D":
        params = { symbol, periodType: "day", period: 1, frequencyType: "minute", frequency: 5 };
        break;
      case "1W":
        params = { symbol, periodType: "day", period: 5, frequencyType: "minute", frequency: 30 };
        break;
      case "1M":
        params = { symbol, periodType: "month", period: 1, frequencyType: "daily", frequency: 1 };
        break;
      case "3M":
        params = { symbol, periodType: "month", period: 3, frequencyType: "daily", frequency: 1 };
        break;
      case "1Y":
        params = { symbol, periodType: "year", period: 1, frequencyType: "daily", frequency: 1 };
        break;
      case "5Y":
        params = { symbol, periodType: "year", period: 5, frequencyType: "weekly", frequency: 1 };
        break;
      default:
        params = { symbol, periodType: "month", period: 1, frequencyType: "daily", frequency: 1 };
    }

    try {
      const resp = await axios.get(`${MARKETDATA_BASE}/pricehistory`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const candles = resp.data?.candles as any[] | undefined;
      if (!candles || candles.length === 0) return null;
      // Filter out bad/empty candles — Schwab sometimes returns bars with close=0
      // during after-hours or weekend gaps.
      const mapped = candles
        .filter((c) => typeof c.close === "number" && c.close > 0)
        .map((c) => ({
          timestamp: new Date(c.datetime).toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
        }));
      if (mapped.length === 0) {
        console.warn(`Schwab history for ${symbol} (${timeframe}): all candles had close=0, returning null for fallback`);
        return null;
      }
      return mapped;
    } catch (e: any) {
      const status = e.response?.status;
      console.warn(`Schwab history failed for ${symbol}: ${status} ${e.response?.data?.message || e.message}`);
      return null;
    }
  }

  // ---------- Trader API: accounts, positions, balances ----------

  /**
   * List all account numbers with their hashValue (hashes are used in subsequent calls).
   * Returns [{ accountNumber: "12345678", hashValue: "abc..." }]
   */
  async getAccountNumbers(): Promise<Array<{ accountNumber: string; hashValue: string }> | null> {
    const token = await this.getAccessToken();
    if (!token) return null;
    try {
      const resp = await axios.get(`${TRADER_BASE}/accounts/accountNumbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return resp.data || [];
    } catch (e: any) {
      console.warn(`Schwab accountNumbers failed: ${e.response?.status} ${e.response?.data?.message || e.message}`);
      return null;
    }
  }

  /**
   * Get full account details including positions and balances.
   * accountHash comes from getAccountNumbers(). Requires fields=positions to return positions.
   */
  async getAccount(accountHash: string, withPositions = true): Promise<any | null> {
    const token = await this.getAccessToken();
    if (!token) return null;
    try {
      const resp = await axios.get(`${TRADER_BASE}/accounts/${accountHash}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: withPositions ? { fields: "positions" } : {},
      });
      return resp.data?.securitiesAccount || resp.data || null;
    } catch (e: any) {
      console.warn(`Schwab getAccount failed: ${e.response?.status} ${e.response?.data?.message || e.message}`);
      return null;
    }
  }

  /**
   * Aggregate positions across all Schwab accounts, normalized to Stock.Tool's
   * holding shape { symbol, qty, cost, last, value }.
   * Cash balance is returned as a synthetic CASH holding (qty = dollar amount, last = 1).
   */
  async getAllPositions(): Promise<{
    holdings: Array<{ symbol: string; qty: number; cost: number; last: number; value: number }>;
    accountId: string;
    netLiquidation: number;
    cashBalance: number;
  } | null> {
    const accounts = await this.getAccountNumbers();
    if (!accounts || accounts.length === 0) return null;

    const holdings: Array<{ symbol: string; qty: number; cost: number; last: number; value: number }> = [];
    let netLiquidation = 0;
    let cashBalance = 0;
    const accountIds: string[] = [];

    for (const acct of accounts) {
      const data = await this.getAccount(acct.hashValue, true);
      if (!data) continue;
      accountIds.push(acct.accountNumber);

      const balances = data.currentBalances || {};
      netLiquidation += balances.liquidationValue ?? balances.equity ?? 0;
      cashBalance += balances.cashBalance ?? balances.totalCash ?? 0;

      const positions = Array.isArray(data.positions) ? data.positions : [];
      for (const p of positions) {
        const inst = p.instrument || {};
        const assetType = inst.assetType || "";
        // Skip non-tradable / unsupported types
        if (!["EQUITY", "ETF", "MUTUAL_FUND", "COLLECTIVE_INVESTMENT", "INDEX", "OPTION"].includes(assetType)) continue;
        const symbol = inst.symbol || "";
        if (!symbol) continue;
        const longQty = p.longQuantity ?? 0;
        const shortQty = p.shortQuantity ?? 0;
        const qty = longQty - shortQty;
        if (qty === 0) continue;
        const avgPrice = p.averagePrice ?? p.averageLongPrice ?? 0;
        const marketValue = p.marketValue ?? 0;
        const last = qty !== 0 ? marketValue / qty : 0;
        holdings.push({
          symbol,
          qty: Math.abs(qty),
          cost: Math.abs(qty * avgPrice),
          last,
          value: marketValue,
        });
      }
    }

    // Add cash as a synthetic holding
    if (cashBalance > 0) {
      holdings.push({
        symbol: "CASH",
        qty: cashBalance,
        cost: 0,
        last: 1,
        value: cashBalance,
      });
    }

    return {
      holdings,
      accountId: accountIds.join(", "),
      netLiquidation,
      cashBalance,
    };
  }
}

export const schwabApi = new SchwabApiService();
