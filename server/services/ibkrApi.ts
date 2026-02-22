import axios, { AxiosInstance } from "axios";
import https from "https";
import {
  StockQuote,
  StockHistory,
  MarketIndex,
} from "@shared/schema";

/**
 * Interactive Brokers Client Portal API Service
 *
 * This service connects to the IB Client Portal API for real-time market data.
 *
 * SETUP REQUIREMENTS:
 * 1. Download and run the IB Gateway or Client Portal Gateway
 *    - Download from: https://www.interactivebrokers.com/en/trading/ibgateway-stable.php
 *    - Or use the Client Portal API Gateway
 *
 * 2. The gateway runs locally and exposes a REST API (default: https://localhost:5000)
 *
 * 3. Set environment variables:
 *    - IBKR_GATEWAY_URL: Gateway URL (default: https://localhost:5000)
 *    - IBKR_ACCOUNT_ID: Your IB account ID
 *
 * 4. Authenticate via the gateway's web interface first (usually at the gateway URL)
 *
 * API Documentation: https://www.interactivebrokers.com/api/doc.html
 */
export class IBKRApiService {
  private readonly gatewayUrl: string;
  private readonly accountId: string;
  private client: AxiosInstance;
  private isAuthenticated: boolean = false;
  private sessionToken: string | null = null;

  constructor() {
    this.gatewayUrl = process.env.IBKR_GATEWAY_URL || "https://localhost:5000";
    this.accountId = process.env.IBKR_ACCOUNT_ID || "";

    // Create axios instance with SSL verification disabled for local gateway
    this.client = axios.create({
      baseURL: `${this.gatewayUrl}/v1/api`,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
      // The IB Gateway uses self-signed certificates locally
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    // Add response interceptor for session management
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          this.isAuthenticated = false;
          console.log("IBKR session expired, need to re-authenticate via gateway");
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if the gateway is running and authenticated
   */
  async checkAuthStatus(): Promise<{ authenticated: boolean; connected: boolean; message: string }> {
    try {
      const response = await this.client.get("/iserver/auth/status");
      const data = response.data;

      this.isAuthenticated = data.authenticated === true;

      return {
        authenticated: data.authenticated,
        connected: data.connected,
        message: data.authenticated
          ? "Connected to Interactive Brokers"
          : "Please authenticate via the IB Gateway web interface",
      };
    } catch (error: any) {
      console.error("IBKR auth check failed:", error.message);
      return {
        authenticated: false,
        connected: false,
        message: `Cannot connect to IB Gateway at ${this.gatewayUrl}. Make sure the gateway is running.`,
      };
    }
  }

  /**
   * Ping the server to keep the session alive
   * Should be called periodically (every few minutes)
   */
  async tickle(): Promise<boolean> {
    try {
      await this.client.post("/tickle");
      return true;
    } catch (error) {
      console.error("IBKR tickle failed:", error);
      return false;
    }
  }

  /**
   * Search for securities by symbol or name
   */
  async searchSecurities(query: string): Promise<any[]> {
    try {
      const response = await this.client.get("/iserver/secdef/search", {
        params: { symbol: query },
      });
      return response.data || [];
    } catch (error) {
      console.error("IBKR search failed:", error);
      return [];
    }
  }

  /**
   * Get contract details by conid (contract ID)
   */
  async getContractDetails(conid: number): Promise<any> {
    try {
      const response = await this.client.get(`/iserver/contract/${conid}/info`);
      return response.data;
    } catch (error) {
      console.error(`IBKR contract details failed for ${conid}:`, error);
      return null;
    }
  }

  /**
   * Get real-time market data snapshot for a contract
   * Returns bid, ask, last price, volume, etc.
   */
  async getMarketDataSnapshot(conids: number[]): Promise<any[]> {
    try {
      // First, request the market data
      const conidStr = conids.join(",");
      const fields = "31,84,85,86,88"; // Last, Bid, Ask, Volume, Close

      const response = await this.client.get("/iserver/marketdata/snapshot", {
        params: {
          conids: conidStr,
          fields: fields,
        },
      });

      return response.data || [];
    } catch (error) {
      console.error("IBKR market data snapshot failed:", error);
      return [];
    }
  }

  /**
   * Get historical market data (OHLCV bars)
   */
  async getHistoricalData(
    conid: number,
    period: string = "1d",
    bar: string = "1min"
  ): Promise<StockHistory[]> {
    try {
      // Period options: 1d, 1w, 1m, 3m, 6m, 1y, 2y, 3y, 5y
      // Bar options: 1min, 2min, 3min, 5min, 10min, 15min, 30min, 1h, 2h, 3h, 4h, 8h, 1d, 1w, 1m

      const response = await this.client.get("/iserver/marketdata/history", {
        params: {
          conid,
          period,
          bar,
        },
      });

      const data = response.data;
      if (!data || !data.data) {
        return [];
      }

      // Transform IB response to our StockHistory format
      return data.data.map((bar: any) => ({
        timestamp: new Date(bar.t).toISOString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));
    } catch (error) {
      console.error(`IBKR historical data failed for ${conid}:`, error);
      return [];
    }
  }

  /**
   * Convert symbol to IB contract ID (conid)
   * This is needed because IB uses contract IDs internally
   */
  async symbolToConid(symbol: string): Promise<number | null> {
    try {
      const results = await this.searchSecurities(symbol);

      // Find the US stock match
      const match = results.find(
        (r: any) =>
          r.symbol?.toUpperCase() === symbol.toUpperCase() &&
          (r.description?.includes("NASDAQ") || r.description?.includes("NYSE"))
      );

      if (match && match.conid) {
        return match.conid;
      }

      // Return first result if no exact match
      if (results.length > 0 && results[0].conid) {
        return results[0].conid;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get conid for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get a stock quote in the format expected by the app
   */
  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    try {
      // Get the contract ID for this symbol
      const conid = await this.symbolToConid(symbol);
      if (!conid) {
        console.log(`Could not find conid for symbol: ${symbol}`);
        return null;
      }

      // Get market data snapshot
      const snapshots = await this.getMarketDataSnapshot([conid]);
      if (!snapshots || snapshots.length === 0) {
        return null;
      }

      const data = snapshots[0];
      const contractInfo = await this.getContractDetails(conid);

      // IB field codes:
      // 31 = Last Price
      // 84 = Bid
      // 85 = Ask
      // 86 = Open
      // 87 = High
      // 88 = Low
      // 7762 = Previous Close

      const lastPrice = data["31"] || data.lastPrice || 0;
      const prevClose = data["7762"] || data.priorClose || lastPrice;
      const change = lastPrice - prevClose;
      const changePercent = prevClose ? (change / prevClose) : 0;

      return {
        symbol: symbol.toUpperCase(),
        name: contractInfo?.con_desc || symbol,
        price: lastPrice,
        change: change,
        changePercent: changePercent,
        open: data["86"] || data.open || lastPrice,
        high: data["87"] || data.high || lastPrice,
        low: data["88"] || data.low || lastPrice,
        close: prevClose,
        volume: data["7762"] || data.volume || 0,
        marketCap: 0, // Not provided by IB market data
      };
    } catch (error) {
      console.error(`IBKR getStockQuote failed for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get stock history in the format expected by the app
   */
  async getStockHistory(symbol: string, timeframe: string): Promise<StockHistory[]> {
    try {
      const conid = await this.symbolToConid(symbol);
      if (!conid) {
        return [];
      }

      // Map our timeframes to IB parameters
      let period: string;
      let bar: string;

      switch (timeframe) {
        case "1D":
          period = "1d";
          bar = "5min";
          break;
        case "1W":
          period = "1w";
          bar = "30min";
          break;
        case "1M":
          period = "1m";
          bar = "1h";
          break;
        case "3M":
          period = "3m";
          bar = "1d";
          break;
        case "1Y":
          period = "1y";
          bar = "1d";
          break;
        case "5Y":
          period = "5y";
          bar = "1w";
          break;
        default:
          period = "1d";
          bar = "5min";
      }

      return await this.getHistoricalData(conid, period, bar);
    } catch (error) {
      console.error(`IBKR getStockHistory failed for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get account summary
   */
  async getAccountSummary(): Promise<any> {
    try {
      if (!this.accountId) {
        // Get list of accounts
        const accountsResponse = await this.client.get("/portfolio/accounts");
        if (accountsResponse.data && accountsResponse.data.length > 0) {
          const accountId = accountsResponse.data[0].id;
          const summaryResponse = await this.client.get(`/portfolio/${accountId}/summary`);
          return summaryResponse.data;
        }
        return null;
      }

      const response = await this.client.get(`/portfolio/${this.accountId}/summary`);
      return response.data;
    } catch (error) {
      console.error("IBKR account summary failed:", error);
      return null;
    }
  }

  /**
   * Get portfolio positions
   */
  async getPositions(): Promise<any[]> {
    try {
      // Get accounts first
      const accountsResponse = await this.client.get("/portfolio/accounts");
      if (!accountsResponse.data || accountsResponse.data.length === 0) {
        return [];
      }

      const accountId = this.accountId || accountsResponse.data[0].id;
      const positionsResponse = await this.client.get(`/portfolio/${accountId}/positions/0`);
      return positionsResponse.data || [];
    } catch (error) {
      console.error("IBKR positions failed:", error);
      return [];
    }
  }

  /**
   * Check if IBKR API is available and configured
   */
  isConfigured(): boolean {
    return !!this.gatewayUrl;
  }

  /**
   * Get gateway URL for debugging
   */
  getGatewayUrl(): string {
    return this.gatewayUrl;
  }
}

// Singleton instance
export const ibkrApi = new IBKRApiService();
