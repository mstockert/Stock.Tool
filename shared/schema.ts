import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  fullName: text("full_name"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
});

// Watchlist schema
export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id),
});

export const insertWatchlistSchema = createInsertSchema(watchlists).pick({
  name: true,
  userId: true,
});

// Watchlist symbols schema
export const watchlistSymbols = pgTable("watchlist_symbols", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id").references(() => watchlists.id),
  symbol: text("symbol").notNull(),
  companyName: text("company_name"),
  addedAt: timestamp("added_at").defaultNow()
});

export const insertWatchlistSymbolSchema = createInsertSchema(watchlistSymbols).pick({
  watchlistId: true,
  symbol: true,
  companyName: true,
});

// User preferences schema
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  defaultTimeframe: text("default_timeframe").default("1D"),
  favoriteSymbols: jsonb("favorite_symbols").$type<string[]>(),
  theme: text("theme").default("dark"),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).pick({
  userId: true,
  defaultTimeframe: true,
  favoriteSymbols: true,
  theme: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Watchlist = typeof watchlists.$inferSelect & {
  symbols?: WatchlistSymbol[];
};
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export type WatchlistSymbol = typeof watchlistSymbols.$inferSelect & {
  price?: number;
  changePercent?: number;
};
export type InsertWatchlistSymbol = z.infer<typeof insertWatchlistSymbolSchema>;

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferencesSchema>;

// Stock-related types (not stored in DB but used for API types)
export type MarketIndex = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  region: string;
  sparkline?: number[];
};

export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap: number;
};

export type StockHistory = {
  timestamp: string;
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
};

export type TechnicalIndicator = {
  name: string;
  value: number;
  signal?: string;
};

export type CompanyInfo = {
  symbol: string;
  name: string;
  description: string;
  industry: string;
  sector: string;
  ceo: string;
  employees: number;
  founded: string;
  headquarters: string;
  website: string;
  peRatio: number;
  eps: number;
  dividendYield: number;
  weekRange52: {
    low: number;
    high: number;
  };
  avgVolume: number;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
};

export type SearchResult = {
  symbol: string;
  name: string;
  type: string;
  change?: number;
  changePercent?: number;
};

// Portfolio schemas
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortfolioSchema = createInsertSchema(portfolios).pick({
  userId: true,
  name: true,
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").references(() => portfolios.id),
  symbol: text("symbol").notNull(),
  companyName: text("company_name"),
  shares: text("shares").notNull(), // stored as text to preserve decimal precision
  avgCost: text("avg_cost").notNull(), // stored as text to preserve decimal precision
  purchaseDate: timestamp("purchase_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).pick({
  portfolioId: true,
  symbol: true,
  companyName: true,
  shares: true,
  avgCost: true,
  purchaseDate: true,
});

// Portfolio types
export type Portfolio = typeof portfolios.$inferSelect & {
  holdings?: PortfolioHolding[];
};
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect & {
  currentPrice?: number;
  change?: number;
  changePercent?: number;
};
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;

// Price alerts schema
export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  symbol: text("symbol").notNull(),
  targetPrice: text("target_price").notNull(),
  condition: text("condition").notNull(), // 'above' or 'below'
  isActive: boolean("is_active").default(true),
  isTriggered: boolean("is_triggered").default(false),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).pick({
  userId: true,
  symbol: true,
  targetPrice: true,
  condition: true,
});

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;

// Trade journal schema
export const tradeJournalEntries = pgTable("trade_journal_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  portfolioId: integer("portfolio_id").references(() => portfolios.id),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(), // 'buy' or 'sell'
  shares: text("shares").notNull(),
  price: text("price").notNull(),
  totalValue: text("total_value").notNull(),
  thesis: text("thesis"), // Why you made the trade
  notes: text("notes"), // Additional notes
  outcome: text("outcome"), // Post-trade reflection
  tradeDate: timestamp("trade_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTradeJournalEntrySchema = createInsertSchema(tradeJournalEntries).pick({
  userId: true,
  portfolioId: true,
  symbol: true,
  action: true,
  shares: true,
  price: true,
  totalValue: true,
  thesis: true,
  notes: true,
  outcome: true,
  tradeDate: true,
});

export type TradeJournalEntry = typeof tradeJournalEntries.$inferSelect;
export type InsertTradeJournalEntry = z.infer<typeof insertTradeJournalEntrySchema>;
