import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export type WatchlistSymbol = typeof watchlistSymbols.$inferSelect;
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
