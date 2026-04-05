import {
  users,
  type User,
  type InsertUser,
  type Watchlist,
  type InsertWatchlist,
  type WatchlistSymbol,
  type InsertWatchlistSymbol,
  type UserPreference,
  type InsertUserPreference,
  type Portfolio,
  type InsertPortfolio,
  type PortfolioHolding,
  type InsertPortfolioHolding,
  type PriceAlert,
  type InsertPriceAlert,
  type TradeJournalEntry,
  type InsertTradeJournalEntry
} from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Watchlist methods
  getWatchlistsByUserId(userId: number): Promise<Watchlist[]>;
  getWatchlist(id: number): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  deleteWatchlist(id: number): Promise<void>;
  addSymbolToWatchlist(symbol: InsertWatchlistSymbol): Promise<WatchlistSymbol>;
  removeSymbolFromWatchlist(symbolId: number, watchlistId: number): Promise<void>;
  
  // User preferences methods
  getUserPreferences(userId: number): Promise<UserPreference | undefined>;
  updateUserPreferences(userId: number, preferences: Partial<UserPreference>): Promise<UserPreference>;

  // Portfolio methods
  getPortfoliosByUserId(userId: number): Promise<Portfolio[]>;
  getPortfolio(id: number): Promise<Portfolio | undefined>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: number, data: Partial<Portfolio>): Promise<Portfolio>;
  deletePortfolio(id: number): Promise<void>;
  addHoldingToPortfolio(holding: InsertPortfolioHolding): Promise<PortfolioHolding>;
  updateHolding(id: number, data: Partial<PortfolioHolding>): Promise<PortfolioHolding>;
  removeHoldingFromPortfolio(holdingId: number): Promise<void>;

  // Price alert methods
  getPriceAlertsByUserId(userId: number): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(id: number, data: Partial<PriceAlert>): Promise<PriceAlert>;
  deletePriceAlert(id: number): Promise<void>;

  // Trade journal methods
  getTradeJournalEntriesByUserId(userId: number): Promise<TradeJournalEntry[]>;
  createTradeJournalEntry(entry: InsertTradeJournalEntry): Promise<TradeJournalEntry>;
  updateTradeJournalEntry(id: number, data: Partial<TradeJournalEntry>): Promise<TradeJournalEntry>;
  deleteTradeJournalEntry(id: number): Promise<void>;
}

const DATA_FILE = path.join(process.cwd(), "data.json");

interface StorageData {
  users: Record<string, User>;
  watchlists: Record<string, Watchlist>;
  watchlistSymbols: Record<string, WatchlistSymbol>;
  userPreferences: Record<string, UserPreference>;
  portfolios: Record<string, Portfolio>;
  portfolioHoldings: Record<string, PortfolioHolding>;
  priceAlerts: Record<string, PriceAlert>;
  tradeJournalEntries: Record<string, TradeJournalEntry>;
  counters: {
    userId: number;
    watchlistId: number;
    symbolId: number;
    preferenceId: number;
    portfolioId: number;
    holdingId: number;
    alertId: number;
    journalEntryId: number;
  };
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private watchlists: Map<number, Watchlist>;
  private watchlistSymbols: Map<number, WatchlistSymbol>;
  private userPreferences: Map<number, UserPreference>;
  private portfolios: Map<number, Portfolio>;
  private portfolioHoldings: Map<number, PortfolioHolding>;
  private priceAlerts: Map<number, PriceAlert>;
  private tradeJournalEntries: Map<number, TradeJournalEntry>;

  private userIdCounter: number;
  private watchlistIdCounter: number;
  private symbolIdCounter: number;
  private preferenceIdCounter: number;
  private portfolioIdCounter: number;
  private holdingIdCounter: number;
  private alertIdCounter: number;
  private journalEntryIdCounter: number;

  constructor() {
    this.users = new Map();
    this.watchlists = new Map();
    this.watchlistSymbols = new Map();
    this.userPreferences = new Map();
    this.portfolios = new Map();
    this.portfolioHoldings = new Map();
    this.priceAlerts = new Map();
    this.tradeJournalEntries = new Map();

    this.userIdCounter = 1;
    this.watchlistIdCounter = 1;
    this.symbolIdCounter = 1;
    this.preferenceIdCounter = 1;
    this.portfolioIdCounter = 1;
    this.holdingIdCounter = 1;
    this.alertIdCounter = 1;
    this.journalEntryIdCounter = 1;

    // Try to load persisted data
    this.loadFromDisk();

    // Ensure demo user exists
    if (!this.users.has(1)) {
      this.users.set(1, {
        id: 1,
        username: "demo",
        email: "demo@example.com",
        fullName: "Demo User"
      });
      this.saveToDisk();
    }

    // Create default Mag7 watchlist if no watchlists exist
    if (this.watchlists.size === 0) {
      this.createDefaultMag7Watchlist();
    }

    // Create default portfolio if none exist
    if (this.portfolios.size === 0) {
      this.createDefaultPortfolio();
    }

    // Unlink any journal entries that reference a portfolio that no longer
    // exists (e.g. from a previous delete that didn't cascade).
    let orphanFix = 0;
    Array.from(this.tradeJournalEntries.values()).forEach(entry => {
      if (entry.portfolioId != null && !this.portfolios.has(entry.portfolioId)) {
        this.tradeJournalEntries.set(entry.id, { ...entry, portfolioId: null });
        orphanFix++;
      }
    });
    if (orphanFix > 0) {
      console.log(`[storage] Unlinked ${orphanFix} orphaned journal entries`);
      this.saveToDisk();
    }
  }

  private createDefaultPortfolio(): void {
    const portfolioId = this.portfolioIdCounter++;
    const portfolio: Portfolio = {
      id: portfolioId,
      userId: 1,
      name: "Main Portfolio",
      createdAt: new Date(),
      holdings: []
    };
    this.portfolios.set(portfolioId, portfolio);

    // Add some sample holdings
    const sampleHoldings = [
      { symbol: "AAPL", companyName: "Apple Inc.", shares: "50", avgCost: "145.00" },
      { symbol: "MSFT", companyName: "Microsoft Corporation", shares: "30", avgCost: "280.00" },
      { symbol: "NVDA", companyName: "NVIDIA Corporation", shares: "20", avgCost: "450.00" },
    ];

    for (const h of sampleHoldings) {
      const holdingId = this.holdingIdCounter++;
      const holding: PortfolioHolding = {
        id: holdingId,
        portfolioId: portfolioId,
        symbol: h.symbol,
        companyName: h.companyName,
        shares: h.shares,
        avgCost: h.avgCost,
        purchaseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.portfolioHoldings.set(holdingId, holding);
    }

    this.saveToDisk();
  }

  private createDefaultMag7Watchlist(): void {
    const watchlistId = this.watchlistIdCounter++;
    const watchlist: Watchlist = {
      id: watchlistId,
      userId: 1,
      name: "Magnificent 7",
      symbols: []
    };
    this.watchlists.set(watchlistId, watchlist);

    const mag7Stocks = [
      { symbol: "AAPL", companyName: "Apple Inc." },
      { symbol: "MSFT", companyName: "Microsoft Corporation" },
      { symbol: "GOOGL", companyName: "Alphabet Inc." },
      { symbol: "AMZN", companyName: "Amazon.com Inc." },
      { symbol: "NVDA", companyName: "NVIDIA Corporation" },
      { symbol: "META", companyName: "Meta Platforms Inc." },
      { symbol: "TSLA", companyName: "Tesla Inc." }
    ];

    for (const stock of mag7Stocks) {
      const symbolId = this.symbolIdCounter++;
      const symbol: WatchlistSymbol = {
        id: symbolId,
        watchlistId: watchlistId,
        symbol: stock.symbol,
        companyName: stock.companyName,
        price: Math.random() * 500 + 100,
        changePercent: (Math.random() * 0.1) - 0.05
      };
      this.watchlistSymbols.set(symbolId, symbol);
    }

    this.saveToDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const data: StorageData = JSON.parse(raw);

        // Restore maps from objects
        for (const [k, v] of Object.entries(data.users || {})) {
          this.users.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.watchlists || {})) {
          this.watchlists.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.watchlistSymbols || {})) {
          this.watchlistSymbols.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.userPreferences || {})) {
          this.userPreferences.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.portfolios || {})) {
          this.portfolios.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.portfolioHoldings || {})) {
          this.portfolioHoldings.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.priceAlerts || {})) {
          this.priceAlerts.set(Number(k), v);
        }
        for (const [k, v] of Object.entries(data.tradeJournalEntries || {})) {
          this.tradeJournalEntries.set(Number(k), v);
        }

        // Restore counters
        this.userIdCounter = data.counters?.userId || 1;
        this.watchlistIdCounter = data.counters?.watchlistId || 1;
        this.symbolIdCounter = data.counters?.symbolId || 1;
        this.preferenceIdCounter = data.counters?.preferenceId || 1;
        this.portfolioIdCounter = data.counters?.portfolioId || 1;
        this.holdingIdCounter = data.counters?.holdingId || 1;
        this.alertIdCounter = data.counters?.alertId || 1;
        this.journalEntryIdCounter = data.counters?.journalEntryId || 1;

        console.log("Loaded data from disk");
      }
    } catch (err) {
      console.error("Failed to load data from disk:", err);
    }
  }

  private saveToDisk(): void {
    try {
      const data: StorageData = {
        users: Object.fromEntries(this.users),
        watchlists: Object.fromEntries(this.watchlists),
        watchlistSymbols: Object.fromEntries(this.watchlistSymbols),
        userPreferences: Object.fromEntries(this.userPreferences),
        portfolios: Object.fromEntries(this.portfolios),
        portfolioHoldings: Object.fromEntries(this.portfolioHoldings),
        priceAlerts: Object.fromEntries(this.priceAlerts),
        tradeJournalEntries: Object.fromEntries(this.tradeJournalEntries),
        counters: {
          userId: this.userIdCounter,
          watchlistId: this.watchlistIdCounter,
          symbolId: this.symbolIdCounter,
          preferenceId: this.preferenceIdCounter,
          portfolioId: this.portfolioIdCounter,
          holdingId: this.holdingIdCounter,
          alertId: this.alertIdCounter,
          journalEntryId: this.journalEntryIdCounter
        }
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save data to disk:", err);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    this.saveToDisk();
    return user;
  }

  // Watchlist methods
  async getWatchlistsByUserId(userId: number): Promise<Watchlist[]> {
    const watchlists = Array.from(this.watchlists.values())
      .filter(watchlist => watchlist.userId === userId);
    
    // Attach symbols to each watchlist
    return watchlists.map(watchlist => {
      const symbols = Array.from(this.watchlistSymbols.values())
        .filter(symbol => symbol.watchlistId === watchlist.id);
      
      return {
        ...watchlist,
        symbols
      };
    });
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    const watchlist = this.watchlists.get(id);
    if (!watchlist) return undefined;

    const symbols = Array.from(this.watchlistSymbols.values())
      .filter(symbol => symbol.watchlistId === id);
    
    return {
      ...watchlist,
      symbols
    };
  }

  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const id = this.watchlistIdCounter++;
    const newWatchlist: Watchlist = {
      ...watchlist,
      id,
      symbols: []
    };
    this.watchlists.set(id, newWatchlist);
    this.saveToDisk();
    return newWatchlist;
  }
  
  async deleteWatchlist(id: number): Promise<void> {
    // Delete the watchlist
    this.watchlists.delete(id);

    // Delete all symbols associated with this watchlist
    const symbolsToDelete = Array.from(this.watchlistSymbols.values())
      .filter(symbol => symbol.watchlistId === id)
      .map(symbol => symbol.id);

    symbolsToDelete.forEach(symbolId => {
      this.watchlistSymbols.delete(symbolId);
    });
    this.saveToDisk();
  }

  async addSymbolToWatchlist(symbolData: InsertWatchlistSymbol): Promise<WatchlistSymbol> {
    const id = this.symbolIdCounter++;

    // Check if the symbol already exists in the watchlist
    const existingSymbol = Array.from(this.watchlistSymbols.values())
      .find(s => s.watchlistId === symbolData.watchlistId && s.symbol === symbolData.symbol);

    if (existingSymbol) {
      return existingSymbol;
    }

    // Add dummy price data for the demo
    const symbol: WatchlistSymbol = {
      ...symbolData,
      id,
      price: Math.random() * 500 + 50,
      changePercent: (Math.random() * 0.1) - 0.05
    };

    this.watchlistSymbols.set(id, symbol);
    this.saveToDisk();
    return symbol;
  }

  async removeSymbolFromWatchlist(symbolId: number, watchlistId: number): Promise<void> {
    this.watchlistSymbols.delete(symbolId);
    this.saveToDisk();
  }

  // User preferences methods
  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    return Array.from(this.userPreferences.values())
      .find(prefs => prefs.userId === userId);
  }

  async updateUserPreferences(userId: number, preferences: Partial<UserPreference>): Promise<UserPreference> {
    let userPrefs = await this.getUserPreferences(userId);
    
    if (!userPrefs) {
      const id = this.preferenceIdCounter++;
      userPrefs = {
        id,
        userId,
        theme: "dark",
        defaultTimeframe: "1D",
        ...preferences
      };
    } else {
      userPrefs = {
        ...userPrefs,
        ...preferences
      };
    }
    
    this.userPreferences.set(userPrefs.id, userPrefs);
    this.saveToDisk();
    return userPrefs;
  }

  // Portfolio methods
  async getPortfoliosByUserId(userId: number): Promise<Portfolio[]> {
    const portfolios = Array.from(this.portfolios.values())
      .filter(p => p.userId === userId);

    return portfolios.map(portfolio => {
      const holdings = Array.from(this.portfolioHoldings.values())
        .filter(h => h.portfolioId === portfolio.id);
      return { ...portfolio, holdings };
    });
  }

  async getPortfolio(id: number): Promise<Portfolio | undefined> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) return undefined;

    const holdings = Array.from(this.portfolioHoldings.values())
      .filter(h => h.portfolioId === id);

    return { ...portfolio, holdings };
  }

  async createPortfolio(data: InsertPortfolio): Promise<Portfolio> {
    const id = this.portfolioIdCounter++;
    const portfolio: Portfolio = {
      ...data,
      id,
      createdAt: new Date(),
      holdings: []
    };
    this.portfolios.set(id, portfolio);
    this.saveToDisk();
    return portfolio;
  }

  async updatePortfolio(id: number, data: Partial<Portfolio>): Promise<Portfolio> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) throw new Error("Portfolio not found");

    const updated = { ...portfolio, ...data };
    this.portfolios.set(id, updated);
    this.saveToDisk();
    return this.getPortfolio(id) as Promise<Portfolio>;
  }

  async deletePortfolio(id: number): Promise<void> {
    this.portfolios.delete(id);

    // Delete all holdings in this portfolio
    const holdingsToDelete = Array.from(this.portfolioHoldings.values())
      .filter(h => h.portfolioId === id)
      .map(h => h.id);

    holdingsToDelete.forEach(hId => this.portfolioHoldings.delete(hId));

    // Unlink any trade journal entries that referenced this portfolio —
    // otherwise they become "orphaned" pointing at a deleted id, and show up
    // under neither a portfolio tab nor the Unassigned tab.
    Array.from(this.tradeJournalEntries.values()).forEach(entry => {
      if (entry.portfolioId === id) {
        this.tradeJournalEntries.set(entry.id, { ...entry, portfolioId: null });
      }
    });

    this.saveToDisk();
  }

  async addHoldingToPortfolio(data: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const id = this.holdingIdCounter++;
    const holding: PortfolioHolding = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.portfolioHoldings.set(id, holding);
    this.saveToDisk();
    return holding;
  }

  async updateHolding(id: number, data: Partial<PortfolioHolding>): Promise<PortfolioHolding> {
    const holding = this.portfolioHoldings.get(id);
    if (!holding) throw new Error("Holding not found");

    const updated = { ...holding, ...data, updatedAt: new Date() };
    this.portfolioHoldings.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  async removeHoldingFromPortfolio(holdingId: number): Promise<void> {
    this.portfolioHoldings.delete(holdingId);
    this.saveToDisk();
  }

  // Price alert methods
  async getPriceAlertsByUserId(userId: number): Promise<PriceAlert[]> {
    return Array.from(this.priceAlerts.values())
      .filter(a => a.userId === userId);
  }

  async createPriceAlert(data: InsertPriceAlert): Promise<PriceAlert> {
    const id = this.alertIdCounter++;
    const alert: PriceAlert = {
      ...data,
      id,
      isActive: true,
      isTriggered: false,
      triggeredAt: null,
      createdAt: new Date()
    };
    this.priceAlerts.set(id, alert);
    this.saveToDisk();
    return alert;
  }

  async updatePriceAlert(id: number, data: Partial<PriceAlert>): Promise<PriceAlert> {
    const alert = this.priceAlerts.get(id);
    if (!alert) throw new Error("Price alert not found");

    const updated = { ...alert, ...data };
    this.priceAlerts.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  async deletePriceAlert(id: number): Promise<void> {
    this.priceAlerts.delete(id);
    this.saveToDisk();
  }

  // Trade journal methods
  async getTradeJournalEntriesByUserId(userId: number): Promise<TradeJournalEntry[]> {
    return Array.from(this.tradeJournalEntries.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());
  }

  async createTradeJournalEntry(data: InsertTradeJournalEntry): Promise<TradeJournalEntry> {
    const id = this.journalEntryIdCounter++;
    const entry: TradeJournalEntry = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tradeJournalEntries.set(id, entry);
    this.saveToDisk();
    return entry;
  }

  async updateTradeJournalEntry(id: number, data: Partial<TradeJournalEntry>): Promise<TradeJournalEntry> {
    const entry = this.tradeJournalEntries.get(id);
    if (!entry) throw new Error("Trade journal entry not found");

    const updated = { ...entry, ...data, updatedAt: new Date() };
    this.tradeJournalEntries.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  async deleteTradeJournalEntry(id: number): Promise<void> {
    this.tradeJournalEntries.delete(id);
    this.saveToDisk();
  }
}

// Try SQLite first, fall back to in-memory storage
let storageInstance: IStorage;
try {
  const { SqliteStorage } = require("./sqliteStorage");
  storageInstance = new SqliteStorage();
  console.log("Using SQLite storage (stocktool.db)");
} catch (e: any) {
  console.warn("SQLite not available, falling back to in-memory storage:", e.message);
  storageInstance = new MemStorage();
}

export const storage = storageInstance;
