import {
  StockQuote,
  StockHistory,
} from "@shared/schema";

/**
 * Interactive Brokers TWS Socket API Service
 *
 * Connects to IB Gateway via the TWS socket protocol (default port 4001).
 * Uses the @stoqey/ib library for the TWS API.
 *
 * SETUP:
 * 1. Run IB Gateway and log in
 * 2. Set IBKR_ENABLED=true in .env
 * 3. Set IBKR_TWS_PORT=4001 (or 4002 for paper, or whatever your gateway uses)
 * 4. npm install @stoqey/ib
 */

let IBApi: any;
let EventName: any;
let SecType: any;
let BarSizeSetting: any;
let WhatToShow: any;
let ibLoaded = false;
let ibLoadPromise: Promise<boolean> | null = null;

// Load @stoqey/ib via dynamic import (ESM-compatible)
async function loadIBModule(): Promise<boolean> {
  if (ibLoaded) return true;
  if (ibLoadPromise) return ibLoadPromise;

  ibLoadPromise = (async () => {
    try {
      const ib = await import("@stoqey/ib");
      IBApi = ib.IBApi;
      EventName = ib.EventName;
      SecType = ib.SecType;
      BarSizeSetting = ib.BarSizeSetting;
      WhatToShow = ib.WhatToShow;
      ibLoaded = true;
      console.log("✅ @stoqey/ib loaded successfully");
      return true;
    } catch (e: any) {
      console.warn("@stoqey/ib not available:", e.message);
      return false;
    }
  })();

  return ibLoadPromise;
}

// Cache for contract IDs
const conidCache: Record<string, number> = {};

// Cache for quotes (avoid hammering the API)
const quoteCache: Record<string, { data: StockQuote; timestamp: number }> = {};
const QUOTE_CACHE_MS = 10_000; // 10 second cache

export class IBKRApiService {
  private readonly port: number;
  private readonly host: string;
  private readonly clientId: number;
  private ib: any = null;
  private connected: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private nextReqId: number = 1000;

  constructor() {
    this.port = parseInt(process.env.IBKR_TWS_PORT || "4001");
    this.host = process.env.IBKR_TWS_HOST || "127.0.0.1";
    this.clientId = parseInt(process.env.IBKR_CLIENT_ID || "0");
  }

  private getNextReqId(): number {
    return this.nextReqId++;
  }

  /**
   * Connect to IB Gateway via TWS socket
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected && this.ib) return;

    if (this.connectPromise) return this.connectPromise;

    // Load the module dynamically (ESM)
    const loaded = await loadIBModule();
    if (!loaded || !IBApi) {
      throw new Error("@stoqey/ib is not installed. Run: npm install @stoqey/ib");
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      try {
        this.ib = new IBApi({
          host: this.host,
          port: this.port,
          clientId: this.clientId,
        });

        const timeout = setTimeout(() => {
          this.connectPromise = null;
          reject(new Error(`Connection to IB Gateway timed out (${this.host}:${this.port})`));
        }, 10_000);

        this.ib.on(EventName.connected, () => {
          clearTimeout(timeout);
          this.connected = true;
          this.connectPromise = null;
          console.log(`✅ Connected to IB Gateway at ${this.host}:${this.port}`);

          // Request delayed market data (free, 15-min delay) instead of real-time
          // Market data type: 1=Live, 2=Frozen, 3=Delayed, 4=Delayed-Frozen
          try {
            this.ib.reqMarketDataType(3);
            console.log(`📊 Requesting delayed market data (no subscription required)`);
          } catch {}

          resolve();
        });

        this.ib.on(EventName.disconnected, () => {
          this.connected = false;
          this.connectPromise = null;
          console.log("⚠️ Disconnected from IB Gateway");
        });

        this.ib.on(EventName.error, (err: Error, code: number, reqId: number) => {
          // Log ALL errors for debugging, including informational ones
          const msg = err?.message || String(err);
          if (code === 2104 || code === 2106 || code === 2158) {
            console.log(`[IBKR] Info [${code}]: ${msg}`);
          } else {
            console.warn(`[IBKR] Error [${code}] reqId=${reqId}: ${msg}`);
          }
        });

        this.ib.connect();
      } catch (e) {
        this.connectPromise = null;
        reject(e);
      }
    });

    return this.connectPromise;
  }

  /**
   * Create a stock contract object for IB API
   */
  private makeStockContract(symbol: string): any {
    return {
      symbol: symbol.toUpperCase(),
      secType: SecType ? SecType.STK : "STK",
      exchange: "SMART",
      currency: "USD",
    };
  }

  /**
   * Resolve a symbol to a conId using reqContractDetails
   */
  private async resolveConId(symbol: string): Promise<number | null> {
    if (conidCache[symbol]) return conidCache[symbol];

    await this.ensureConnected();

    return new Promise((resolve) => {
      const reqId = this.getNextReqId();
      const contract = this.makeStockContract(symbol);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 8000);

      this.ib.on(EventName.contractDetails, (id: number, details: any) => {
        if (id === reqId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          const conId = details?.contract?.conId || details?.conId;
          if (conId) {
            conidCache[symbol] = conId;
          }
          resolve(conId || null);
        }
      });

      this.ib.on(EventName.contractDetailsEnd, (id: number) => {
        if (id === reqId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });

      this.ib.reqContractDetails(reqId, contract);
    });
  }

  /**
   * Check if the gateway is running and authenticated
   */
  async checkAuthStatus(): Promise<{ authenticated: boolean; connected: boolean; message: string }> {
    const loaded = await loadIBModule();
    if (!loaded || !IBApi) {
      return {
        authenticated: false,
        connected: false,
        message: "@stoqey/ib is not installed. Run: npm install @stoqey/ib",
      };
    }

    try {
      await this.ensureConnected();
      return {
        authenticated: true,
        connected: true,
        message: `Connected to IB Gateway at ${this.host}:${this.port}`,
      };
    } catch (error: any) {
      return {
        authenticated: false,
        connected: false,
        message: error.message || `Cannot connect to IB Gateway at ${this.host}:${this.port}`,
      };
    }
  }

  /**
   * Get a stock quote using reqMktData
   */
  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    // Check cache
    const cached = quoteCache[symbol];
    if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_MS) {
      return cached.data;
    }

    try {
      await this.ensureConnected();
    } catch {
      return null;
    }

    return new Promise((resolve) => {
      const reqId = this.getNextReqId();
      const contract = this.makeStockContract(symbol);

      const fields: Record<number, number> = {};
      let resolved = false;

      // Set a timeout — market data can trickle in over multiple callbacks
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.ib.cancelMktData(reqId);
          finalize();
        }
      }, 5000);

      const finalize = () => {
        // Field IDs: https://interactivebrokers.github.io/tws-api/tick_types.html
        // Live:    1=Bid, 2=Ask, 4=Last, 6=High, 7=Low, 8=Volume, 9=Close(prev), 14=Open
        // Delayed: 66=Bid, 67=Ask, 68=Last, 72=High, 73=Low, 74=Volume, 75=Close, 76=Open
        const last = fields[4] || fields[68] || fields[2] || fields[66] || fields[1] || fields[67] || 0;
        const prevClose = fields[9] || fields[75] || last;
        const change = last - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        if (last > 0) {
          const quote: StockQuote = {
            symbol: symbol.toUpperCase(),
            name: symbol.toUpperCase(),
            price: last,
            change: change,
            changePercent: changePercent,
            open: fields[14] || fields[76] || last,
            high: fields[6] || fields[72] || last,
            low: fields[7] || fields[73] || last,
            close: prevClose,
            volume: fields[8] || fields[74] || 0,
            marketCap: 0,
          };
          quoteCache[symbol] = { data: quote, timestamp: Date.now() };
          console.log(`[IBKR] Quote for ${symbol}: $${last} (delayed: ${!fields[4]})`);
          resolve(quote);
        } else {
          console.log(`[IBKR] No price data for ${symbol}, fields:`, Object.keys(fields).join(','));
          resolve(null);
        }
      };

      this.ib.on(EventName.tickPrice, (id: number, tickType: number, value: number) => {
        if (id === reqId) {
          fields[tickType] = value;
        }
      });

      this.ib.on(EventName.tickSize, (id: number, tickType: number, value: number) => {
        if (id === reqId) {
          fields[tickType] = value;
        }
      });

      this.ib.on(EventName.tickSnapshotEnd, (id: number) => {
        if (id === reqId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.ib.cancelMktData(reqId);
          finalize();
        }
      });

      // Request snapshot (frozen data if market closed, live if open)
      // genericTickList="" for basic fields, snapshot=true for one-time data
      this.ib.reqMktData(reqId, contract, "", true, false);
    });
  }

  /**
   * Get historical data bars
   */
  async getStockHistory(symbol: string, timeframe: string): Promise<StockHistory[]> {
    try {
      await this.ensureConnected();
    } catch {
      return [];
    }

    // Map timeframes to IB parameters
    let durationStr: string;
    let barSize: string;

    switch (timeframe) {
      case "1D":
        durationStr = "1 D";
        barSize = "5 mins";
        break;
      case "1W":
        durationStr = "1 W";
        barSize = "30 mins";
        break;
      case "1M":
        durationStr = "1 M";
        barSize = "1 hour";
        break;
      case "3M":
        durationStr = "3 M";
        barSize = "1 day";
        break;
      case "1Y":
        durationStr = "1 Y";
        barSize = "1 day";
        break;
      case "5Y":
        durationStr = "5 Y";
        barSize = "1 week";
        break;
      default:
        durationStr = "1 D";
        barSize = "5 mins";
    }

    return new Promise((resolve) => {
      const reqId = this.getNextReqId();
      const contract = this.makeStockContract(symbol);
      const bars: StockHistory[] = [];
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(bars);
        }
      }, 15000);

      this.ib.on(EventName.historicalData, (id: number, bar: any) => {
        if (id === reqId && bar) {
          // IB sends a final bar with date="finished" to signal end
          if (bar.date === "finished" || bar.date?.startsWith("finished")) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(bars);
            }
            return;
          }

          bars.push({
            timestamp: bar.date || bar.time || new Date().toISOString(),
            open: bar.open || 0,
            high: bar.high || 0,
            low: bar.low || 0,
            close: bar.close || 0,
            volume: bar.volume || 0,
          });
        }
      });

      this.ib.on(EventName.historicalDataEnd, (id: number) => {
        if (id === reqId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(bars);
        }
      });

      // Request historical data
      // endDateTime="" means now, useRTH=1 means regular trading hours only
      this.ib.reqHistoricalData(
        reqId,
        contract,
        "",           // endDateTime (empty = now)
        durationStr,
        barSize,
        "TRADES",     // whatToShow
        1,            // useRTH (regular trading hours)
        1,            // formatDate (1 = yyyyMMdd HH:mm:ss)
        false         // keepUpToDate
      );
    });
  }

  /**
   * Get portfolio positions directly from the IB account.
   * Tries reqPositions first, falls back to reqAccountUpdates.
   */
  async getPositions(): Promise<any[]> {
    try {
      await this.ensureConnected();
      console.log(`[IBKR] Connected: ${this.connected}, attempting reqPositions...`);
    } catch (e: any) {
      console.error(`[IBKR] Connection failed:`, e.message);
      return [];
    }

    // Method 1: reqPositions
    const positions = await this._reqPositions();
    if (positions.length > 0) {
      console.log(`[IBKR] reqPositions returned ${positions.length} positions`);
      return positions;
    }

    // Method 2: reqAccountUpdates (fallback)
    console.log(`[IBKR] reqPositions returned 0, trying reqAccountUpdates...`);
    const positions2 = await this._reqAccountUpdates();
    console.log(`[IBKR] reqAccountUpdates returned ${positions2.length} positions`);
    return positions2;
  }

  private async _reqPositions(): Promise<any[]> {
    return new Promise((resolve) => {
      const positionMap: Record<string, any> = {}; // Deduplicate by symbol
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(Object.values(positionMap));
        }
      }, 8000);

      const onPosition = (_account: string, contract: any, pos: number, avgCost: number) => {
        console.log(`[IBKR] Position: ${contract?.symbol} qty=${pos} avgCost=${avgCost}`);
        if (pos !== 0 && contract?.symbol) {
          positionMap[contract.symbol] = {
            symbol: contract.symbol,
            secType: contract.secType,
            exchange: contract.exchange,
            conId: contract.conId,
            shares: pos,
            avgCost: avgCost,
          };
        }
      };

      const onPositionEnd = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          const positions = Object.values(positionMap);
          console.log(`[IBKR] positionEnd: ${positions.length} unique positions`);
          resolve(positions);
        }
      };

      const cleanup = () => {
        this.ib.removeListener(EventName.position, onPosition);
        this.ib.removeListener(EventName.positionEnd, onPositionEnd);
      };

      this.ib.on(EventName.position, onPosition);
      this.ib.on(EventName.positionEnd, onPositionEnd);

      console.log(`[IBKR] Calling reqPositions()...`);
      this.ib.reqPositions();
    });
  }

  private async _reqAccountUpdates(): Promise<any[]> {
    return new Promise((resolve) => {
      const positions: any[] = [];
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Stop the subscription
          try { this.ib.reqAccountUpdates(false, ""); } catch {}
          console.log(`[IBKR] reqAccountUpdates timed out with ${positions.length} positions`);
          resolve(positions);
        }
      }, 10000);

      this.ib.on(EventName.updatePortfolio,
        (contract: any, pos: number, _marketPrice: number, _marketValue: number,
         avgCost: number, _unrealizedPNL: number, _realizedPNL: number, _accountName: string) => {
          console.log(`[IBKR] updatePortfolio: ${contract?.symbol} qty=${pos} avgCost=${avgCost}`);
          if (pos !== 0) {
            positions.push({
              symbol: contract.symbol,
              secType: contract.secType,
              exchange: contract.exchange,
              conId: contract.conId,
              shares: pos,
              avgCost: avgCost,
            });
          }
        }
      );

      this.ib.on(EventName.accountDownloadEnd, (_accountName: string) => {
        console.log(`[IBKR] accountDownloadEnd with ${positions.length} positions`);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try { this.ib.reqAccountUpdates(false, ""); } catch {}
          resolve(positions);
        }
      });

      console.log(`[IBKR] Calling reqAccountUpdates(true, "")...`);
      this.ib.reqAccountUpdates(true, "");
    });
  }

  /**
   * Get account summary
   */
  async getAccountSummary(): Promise<any> {
    try {
      await this.ensureConnected();
    } catch {
      return null;
    }

    return new Promise((resolve) => {
      const reqId = this.getNextReqId();
      const summary: Record<string, any> = {};
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.ib.cancelAccountSummary(reqId);
          resolve(summary);
        }
      }, 10000);

      this.ib.on(EventName.accountSummary, (id: number, account: string, tag: string, value: string) => {
        if (id === reqId) {
          summary[tag] = value;
          summary.accountId = account;
        }
      });

      this.ib.on(EventName.accountSummaryEnd, (id: number) => {
        if (id === reqId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.ib.cancelAccountSummary(reqId);
          resolve(summary);
        }
      });

      // Request key account tags
      this.ib.reqAccountSummary(reqId, "All", "NetLiquidation,TotalCashValue,BuyingPower,GrossPositionValue,UnrealizedPnL,RealizedPnL");
    });
  }

  /**
   * Get recent trade executions from the account
   * Uses reqExecutions to fetch filled orders
   */
  async getExecutions(daysBack: number = 7): Promise<any[]> {
    try {
      await this.ensureConnected();
      console.log(`[IBKR] Fetching executions (last ${daysBack} days)...`);
    } catch (e: any) {
      console.error(`[IBKR] Connection failed for executions:`, e.message);
      return [];
    }

    return new Promise((resolve) => {
      const reqId = this.getNextReqId();
      const executions: any[] = [];
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log(`[IBKR] reqExecutions timed out with ${executions.length} trades`);
          resolve(executions);
        }
      }, 15000);

      this.ib.on(EventName.execDetails, (id: number, contract: any, execution: any) => {
        if (id === reqId) {
          console.log(`[IBKR] Execution: ${execution?.side} ${execution?.shares} ${contract?.symbol} @ ${execution?.price} on ${execution?.time}`);
          executions.push({
            symbol: contract?.symbol,
            secType: contract?.secType,
            side: execution?.side,       // BOT or SLD
            shares: execution?.shares,
            price: execution?.price,
            time: execution?.time,        // YYYYMMDD HH:MM:SS
            exchange: execution?.exchange,
            orderId: execution?.orderId,
            execId: execution?.execId,
            avgPrice: execution?.avgPrice,
            cumQty: execution?.cumQty,
            account: execution?.acctNumber,
          });
        }
      });

      this.ib.on(EventName.execDetailsEnd, (id: number) => {
        if (id === reqId && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log(`[IBKR] execDetailsEnd with ${executions.length} trades`);
          resolve(executions);
        }
      });

      // Build execution filter — empty filter gets all recent executions
      // The TWS API returns executions from the current and previous trading day by default
      const filter: any = {};

      // If we want a specific time range, we can set filter.time
      // Format: "yyyyMMdd-HH:mm:ss" — setting to N days back
      if (daysBack > 0) {
        const since = new Date();
        since.setDate(since.getDate() - daysBack);
        const y = since.getFullYear();
        const m = String(since.getMonth() + 1).padStart(2, '0');
        const d = String(since.getDate()).padStart(2, '0');
        filter.time = `${y}${m}${d}-00:00:00`;
      }

      console.log(`[IBKR] Calling reqExecutions() with filter:`, JSON.stringify(filter));
      this.ib.reqExecutions(reqId, filter);
    });
  }

  /**
   * Disconnect from IB Gateway
   */
  disconnect(): void {
    if (this.ib && this.connected) {
      this.ib.disconnect();
      this.connected = false;
    }
  }

  isConfigured(): boolean {
    return ibLoaded && !!IBApi;
  }

  getGatewayUrl(): string {
    return `${this.host}:${this.port} (TWS Socket)`;
  }
}

// Singleton instance
export const ibkrApi = new IBKRApiService();
