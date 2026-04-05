import Database from "better-sqlite3";
import * as path from "path";
import {
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
  type InsertTradeJournalEntry,
} from "@shared/schema";
import { IStorage } from "./storage";

const DB_PATH = path.join(process.cwd(), "stocktool.db");

export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initTables();
    this.ensureDemoUser();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL DEFAULT '',
        email TEXT,
        full_name TEXT
      );

      CREATE TABLE IF NOT EXISTS watchlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS watchlist_symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watchlist_id INTEGER REFERENCES watchlists(id),
        symbol TEXT NOT NULL,
        company_name TEXT,
        added_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        default_timeframe TEXT DEFAULT '1D',
        favorite_symbols TEXT, -- JSON array
        theme TEXT DEFAULT 'dark'
      );

      CREATE TABLE IF NOT EXISTS portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS portfolio_holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        portfolio_id INTEGER REFERENCES portfolios(id),
        symbol TEXT NOT NULL,
        company_name TEXT,
        shares TEXT NOT NULL,
        avg_cost TEXT NOT NULL,
        purchase_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS price_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        symbol TEXT NOT NULL,
        target_price TEXT NOT NULL,
        condition TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        is_triggered INTEGER DEFAULT 0,
        triggered_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trade_journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        portfolio_id INTEGER REFERENCES portfolios(id),
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        shares TEXT NOT NULL,
        price TEXT NOT NULL,
        total_value TEXT NOT NULL,
        thesis TEXT,
        notes TEXT,
        outcome TEXT,
        trade_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  private ensureDemoUser(): void {
    const user = this.db.prepare("SELECT id FROM users WHERE id = 1").get();
    if (!user) {
      this.db.prepare(
        "INSERT INTO users (id, username, password, email, full_name) VALUES (1, 'demo', '', 'demo@example.com', 'Demo User')"
      ).run();
    }

    // Create default watchlist if none exist
    const wlCount = this.db.prepare("SELECT COUNT(*) as cnt FROM watchlists WHERE user_id = 1").get() as any;
    if (wlCount.cnt === 0) {
      this.createDefaultMag7Watchlist();
    }

    // Create default portfolio if none exist
    const pCount = this.db.prepare("SELECT COUNT(*) as cnt FROM portfolios WHERE user_id = 1").get() as any;
    if (pCount.cnt === 0) {
      this.createDefaultPortfolio();
    }
  }

  private createDefaultMag7Watchlist(): void {
    const result = this.db.prepare("INSERT INTO watchlists (name, user_id) VALUES ('Magnificent 7', 1)").run();
    const wlId = result.lastInsertRowid;
    const stocks = [
      { symbol: "AAPL", name: "Apple Inc." },
      { symbol: "MSFT", name: "Microsoft Corporation" },
      { symbol: "GOOGL", name: "Alphabet Inc." },
      { symbol: "AMZN", name: "Amazon.com Inc." },
      { symbol: "NVDA", name: "NVIDIA Corporation" },
      { symbol: "META", name: "Meta Platforms Inc." },
      { symbol: "TSLA", name: "Tesla Inc." },
    ];
    const stmt = this.db.prepare("INSERT INTO watchlist_symbols (watchlist_id, symbol, company_name) VALUES (?, ?, ?)");
    for (const s of stocks) {
      stmt.run(wlId, s.symbol, s.name);
    }
  }

  private createDefaultPortfolio(): void {
    const result = this.db.prepare("INSERT INTO portfolios (name, user_id) VALUES ('Main Portfolio', 1)").run();
    const pId = result.lastInsertRowid;
    const holdings = [
      { symbol: "AAPL", name: "Apple Inc.", shares: "50", avgCost: "145.00" },
      { symbol: "MSFT", name: "Microsoft Corporation", shares: "30", avgCost: "280.00" },
      { symbol: "NVDA", name: "NVIDIA Corporation", shares: "20", avgCost: "450.00" },
    ];
    const stmt = this.db.prepare(
      "INSERT INTO portfolio_holdings (portfolio_id, symbol, company_name, shares, avg_cost) VALUES (?, ?, ?, ?, ?)"
    );
    for (const h of holdings) {
      stmt.run(pId, h.symbol, h.name, h.shares, h.avgCost);
    }
  }

  // Helper to convert SQLite row to typed object
  private rowToUser(row: any): User {
    return { id: row.id, username: row.username, password: row.password, email: row.email, fullName: row.full_name };
  }

  private rowToWatchlistSymbol(row: any): WatchlistSymbol {
    return {
      id: row.id,
      watchlistId: row.watchlist_id,
      symbol: row.symbol,
      companyName: row.company_name,
      addedAt: row.added_at ? new Date(row.added_at) : null,
    };
  }

  private rowToPortfolio(row: any): Portfolio {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at ? new Date(row.created_at) : null,
    };
  }

  private rowToHolding(row: any): PortfolioHolding {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      symbol: row.symbol,
      companyName: row.company_name,
      shares: row.shares,
      avgCost: row.avg_cost,
      purchaseDate: row.purchase_date ? new Date(row.purchase_date) : null,
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  }

  private rowToAlert(row: any): PriceAlert {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      targetPrice: row.target_price,
      condition: row.condition,
      isActive: !!row.is_active,
      isTriggered: !!row.is_triggered,
      triggeredAt: row.triggered_at ? new Date(row.triggered_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : null,
    };
  }

  private rowToJournalEntry(row: any): TradeJournalEntry {
    return {
      id: row.id,
      userId: row.user_id,
      portfolioId: row.portfolio_id,
      symbol: row.symbol,
      action: row.action,
      shares: row.shares,
      price: row.price,
      totalValue: row.total_value,
      thesis: row.thesis,
      notes: row.notes,
      outcome: row.outcome,
      tradeDate: row.trade_date ? new Date(row.trade_date) : new Date(),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  }

  // ===== User methods =====
  async getUser(id: number): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    return row ? this.rowToUser(row) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    return row ? this.rowToUser(row) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = this.db.prepare(
      "INSERT INTO users (username, password, email, full_name) VALUES (?, ?, ?, ?)"
    ).run(user.username, user.password, user.email || null, user.fullName || null);
    return { id: Number(result.lastInsertRowid), username: user.username, password: user.password, email: user.email || null, fullName: user.fullName || null };
  }

  // ===== Watchlist methods =====
  async getWatchlistsByUserId(userId: number): Promise<Watchlist[]> {
    const rows = this.db.prepare("SELECT * FROM watchlists WHERE user_id = ?").all(userId) as any[];
    return rows.map((row) => {
      const symbols = this.db.prepare("SELECT * FROM watchlist_symbols WHERE watchlist_id = ?").all(row.id) as any[];
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        symbols: symbols.map((s) => this.rowToWatchlistSymbol(s)),
      };
    });
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    const row = this.db.prepare("SELECT * FROM watchlists WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const symbols = this.db.prepare("SELECT * FROM watchlist_symbols WHERE watchlist_id = ?").all(id) as any[];
    return { id: row.id, userId: row.user_id, name: row.name, symbols: symbols.map((s) => this.rowToWatchlistSymbol(s)) };
  }

  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const result = this.db.prepare("INSERT INTO watchlists (name, user_id) VALUES (?, ?)").run(watchlist.name, watchlist.userId || null);
    return { id: Number(result.lastInsertRowid), userId: watchlist.userId || null, name: watchlist.name, symbols: [] };
  }

  async deleteWatchlist(id: number): Promise<void> {
    this.db.prepare("DELETE FROM watchlist_symbols WHERE watchlist_id = ?").run(id);
    this.db.prepare("DELETE FROM watchlists WHERE id = ?").run(id);
  }

  async addSymbolToWatchlist(data: InsertWatchlistSymbol): Promise<WatchlistSymbol> {
    const existing = this.db.prepare("SELECT * FROM watchlist_symbols WHERE watchlist_id = ? AND symbol = ?").get(data.watchlistId || 0, data.symbol) as any;
    if (existing) return this.rowToWatchlistSymbol(existing);

    const result = this.db.prepare(
      "INSERT INTO watchlist_symbols (watchlist_id, symbol, company_name) VALUES (?, ?, ?)"
    ).run(data.watchlistId || null, data.symbol, data.companyName || null);
    return { id: Number(result.lastInsertRowid), watchlistId: data.watchlistId || null, symbol: data.symbol, companyName: data.companyName || null, addedAt: new Date() };
  }

  async removeSymbolFromWatchlist(symbolId: number, _watchlistId: number): Promise<void> {
    this.db.prepare("DELETE FROM watchlist_symbols WHERE id = ?").run(symbolId);
  }

  // ===== User preferences =====
  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    const row = this.db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.user_id,
      defaultTimeframe: row.default_timeframe,
      favoriteSymbols: row.favorite_symbols ? JSON.parse(row.favorite_symbols) : null,
      theme: row.theme,
    };
  }

  async updateUserPreferences(userId: number, prefs: Partial<UserPreference>): Promise<UserPreference> {
    let existing = await this.getUserPreferences(userId);
    if (!existing) {
      const result = this.db.prepare(
        "INSERT INTO user_preferences (user_id, default_timeframe, favorite_symbols, theme) VALUES (?, ?, ?, ?)"
      ).run(userId, prefs.defaultTimeframe || "1D", prefs.favoriteSymbols ? JSON.stringify(prefs.favoriteSymbols) : null, prefs.theme || "dark");
      return { id: Number(result.lastInsertRowid), userId, defaultTimeframe: prefs.defaultTimeframe || "1D", favoriteSymbols: prefs.favoriteSymbols || null, theme: prefs.theme || "dark" };
    }
    const updated = { ...existing, ...prefs };
    this.db.prepare(
      "UPDATE user_preferences SET default_timeframe = ?, favorite_symbols = ?, theme = ? WHERE id = ?"
    ).run(updated.defaultTimeframe, updated.favoriteSymbols ? JSON.stringify(updated.favoriteSymbols) : null, updated.theme, updated.id);
    return updated;
  }

  // ===== Portfolio methods =====
  async getPortfoliosByUserId(userId: number): Promise<Portfolio[]> {
    const rows = this.db.prepare("SELECT * FROM portfolios WHERE user_id = ?").all(userId) as any[];
    return rows.map((row) => {
      const holdings = this.db.prepare("SELECT * FROM portfolio_holdings WHERE portfolio_id = ?").all(row.id) as any[];
      return { ...this.rowToPortfolio(row), holdings: holdings.map((h) => this.rowToHolding(h)) };
    });
  }

  async getPortfolio(id: number): Promise<Portfolio | undefined> {
    const row = this.db.prepare("SELECT * FROM portfolios WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const holdings = this.db.prepare("SELECT * FROM portfolio_holdings WHERE portfolio_id = ?").all(id) as any[];
    return { ...this.rowToPortfolio(row), holdings: holdings.map((h) => this.rowToHolding(h)) };
  }

  async createPortfolio(data: InsertPortfolio): Promise<Portfolio> {
    const result = this.db.prepare("INSERT INTO portfolios (name, user_id) VALUES (?, ?)").run(data.name, data.userId || null);
    return { id: Number(result.lastInsertRowid), userId: data.userId || null, name: data.name, createdAt: new Date(), holdings: [] };
  }

  async updatePortfolio(id: number, data: Partial<Portfolio>): Promise<Portfolio> {
    if (data.name) {
      this.db.prepare("UPDATE portfolios SET name = ? WHERE id = ?").run(data.name, id);
    }
    return (await this.getPortfolio(id))!;
  }

  async deletePortfolio(id: number): Promise<void> {
    this.db.prepare("DELETE FROM portfolio_holdings WHERE portfolio_id = ?").run(id);
    this.db.prepare("UPDATE trade_journal_entries SET portfolio_id = NULL WHERE portfolio_id = ?").run(id);
    this.db.prepare("DELETE FROM portfolios WHERE id = ?").run(id);
  }

  async addHoldingToPortfolio(data: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      "INSERT INTO portfolio_holdings (portfolio_id, symbol, company_name, shares, avg_cost, purchase_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(data.portfolioId || null, data.symbol, data.companyName || null, data.shares, data.avgCost, data.purchaseDate ? new Date(data.purchaseDate as any).toISOString() : null, now, now);
    return this.rowToHolding(this.db.prepare("SELECT * FROM portfolio_holdings WHERE id = ?").get(Number(result.lastInsertRowid)));
  }

  async updateHolding(id: number, data: Partial<PortfolioHolding>): Promise<PortfolioHolding> {
    const now = new Date().toISOString();
    const existing = this.db.prepare("SELECT * FROM portfolio_holdings WHERE id = ?").get(id) as any;
    if (!existing) throw new Error("Holding not found");

    this.db.prepare(
      "UPDATE portfolio_holdings SET symbol = ?, company_name = ?, shares = ?, avg_cost = ?, updated_at = ? WHERE id = ?"
    ).run(data.symbol || existing.symbol, data.companyName !== undefined ? data.companyName : existing.company_name, data.shares || existing.shares, data.avgCost || existing.avg_cost, now, id);

    return this.rowToHolding(this.db.prepare("SELECT * FROM portfolio_holdings WHERE id = ?").get(id));
  }

  async removeHoldingFromPortfolio(holdingId: number): Promise<void> {
    this.db.prepare("DELETE FROM portfolio_holdings WHERE id = ?").run(holdingId);
  }

  // ===== Price alert methods =====
  async getPriceAlertsByUserId(userId: number): Promise<PriceAlert[]> {
    const rows = this.db.prepare("SELECT * FROM price_alerts WHERE user_id = ?").all(userId) as any[];
    return rows.map((r) => this.rowToAlert(r));
  }

  async createPriceAlert(data: InsertPriceAlert): Promise<PriceAlert> {
    const result = this.db.prepare(
      "INSERT INTO price_alerts (user_id, symbol, target_price, condition) VALUES (?, ?, ?, ?)"
    ).run(data.userId || null, data.symbol, data.targetPrice, data.condition);
    return this.rowToAlert(this.db.prepare("SELECT * FROM price_alerts WHERE id = ?").get(Number(result.lastInsertRowid)));
  }

  async updatePriceAlert(id: number, data: Partial<PriceAlert>): Promise<PriceAlert> {
    const existing = this.db.prepare("SELECT * FROM price_alerts WHERE id = ?").get(id) as any;
    if (!existing) throw new Error("Price alert not found");

    if (data.isActive !== undefined) this.db.prepare("UPDATE price_alerts SET is_active = ? WHERE id = ?").run(data.isActive ? 1 : 0, id);
    if (data.isTriggered !== undefined) this.db.prepare("UPDATE price_alerts SET is_triggered = ? WHERE id = ?").run(data.isTriggered ? 1 : 0, id);
    if (data.triggeredAt) this.db.prepare("UPDATE price_alerts SET triggered_at = ? WHERE id = ?").run(new Date(data.triggeredAt as any).toISOString(), id);

    return this.rowToAlert(this.db.prepare("SELECT * FROM price_alerts WHERE id = ?").get(id));
  }

  async deletePriceAlert(id: number): Promise<void> {
    this.db.prepare("DELETE FROM price_alerts WHERE id = ?").run(id);
  }

  // ===== Trade journal methods =====
  async getTradeJournalEntriesByUserId(userId: number): Promise<TradeJournalEntry[]> {
    const rows = this.db.prepare("SELECT * FROM trade_journal_entries WHERE user_id = ? ORDER BY trade_date DESC").all(userId) as any[];
    return rows.map((r) => this.rowToJournalEntry(r));
  }

  async createTradeJournalEntry(data: InsertTradeJournalEntry): Promise<TradeJournalEntry> {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      "INSERT INTO trade_journal_entries (user_id, portfolio_id, symbol, action, shares, price, total_value, thesis, notes, outcome, trade_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      data.userId || null,
      data.portfolioId || null,
      data.symbol,
      data.action,
      data.shares,
      data.price,
      data.totalValue,
      data.thesis || null,
      data.notes || null,
      data.outcome || null,
      data.tradeDate ? new Date(data.tradeDate as any).toISOString() : now,
      now,
      now
    );
    return this.rowToJournalEntry(this.db.prepare("SELECT * FROM trade_journal_entries WHERE id = ?").get(Number(result.lastInsertRowid)));
  }

  async updateTradeJournalEntry(id: number, data: Partial<TradeJournalEntry>): Promise<TradeJournalEntry> {
    const existing = this.db.prepare("SELECT * FROM trade_journal_entries WHERE id = ?").get(id) as any;
    if (!existing) throw new Error("Trade journal entry not found");

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE trade_journal_entries SET
        portfolio_id = ?, symbol = ?, action = ?, shares = ?, price = ?, total_value = ?,
        thesis = ?, notes = ?, outcome = ?, trade_date = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.portfolioId !== undefined ? data.portfolioId : existing.portfolio_id,
      data.symbol || existing.symbol,
      data.action || existing.action,
      data.shares || existing.shares,
      data.price || existing.price,
      data.totalValue || existing.total_value,
      data.thesis !== undefined ? data.thesis : existing.thesis,
      data.notes !== undefined ? data.notes : existing.notes,
      data.outcome !== undefined ? data.outcome : existing.outcome,
      data.tradeDate ? new Date(data.tradeDate as any).toISOString() : existing.trade_date,
      now,
      id
    );

    return this.rowToJournalEntry(this.db.prepare("SELECT * FROM trade_journal_entries WHERE id = ?").get(id));
  }

  async deleteTradeJournalEntry(id: number): Promise<void> {
    this.db.prepare("DELETE FROM trade_journal_entries WHERE id = ?").run(id);
  }
}
