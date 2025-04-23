import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { StockApiService } from "./services/stockApi";
import { z } from "zod";
import { insertWatchlistSchema, insertWatchlistSymbolSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const stockApi = new StockApiService();

  // Market data routes
  app.get("/api/market/indices", async (req, res) => {
    try {
      const indices = await stockApi.getMarketIndices();
      res.json(indices);
    } catch (error) {
      console.error("Error fetching market indices:", error);
      res.status(500).json({ message: "Error fetching market indices" });
    }
  });

  // Stock search
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query || query.length < 1) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const results = await stockApi.searchStocks(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching stocks:", error);
      res.status(500).json({ message: "Error searching stocks" });
    }
  });

  // Stock quote
  app.get("/api/stocks/quote/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const quote = await stockApi.getStockQuote(symbol);
      res.json(quote);
    } catch (error) {
      console.error(`Error fetching quote for ${req.params.symbol}:`, error);
      res.status(500).json({ message: `Error fetching quote for ${req.params.symbol}` });
    }
  });

  // Stock history for chart data
  app.get("/api/stocks/history/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const timeframe = req.query.timeframe as string || "1D";
      const history = await stockApi.getStockHistory(symbol, timeframe);
      res.json(history);
    } catch (error) {
      console.error(`Error fetching history for ${req.params.symbol}:`, error);
      res.status(500).json({ message: `Error fetching history for ${req.params.symbol}` });
    }
  });

  // Technical indicators
  app.get("/api/stocks/indicators/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const indicators = await stockApi.getTechnicalIndicators(symbol);
      res.json(indicators);
    } catch (error) {
      console.error(`Error fetching indicators for ${req.params.symbol}:`, error);
      res.status(500).json({ message: `Error fetching indicators for ${req.params.symbol}` });
    }
  });

  // Company info
  app.get("/api/stocks/company/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const company = await stockApi.getCompanyInfo(symbol);
      res.json(company);
    } catch (error) {
      console.error(`Error fetching company info for ${req.params.symbol}:`, error);
      res.status(500).json({ message: `Error fetching company info for ${req.params.symbol}` });
    }
  });

  // News
  app.get("/api/news/:symbol?", async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const news = await stockApi.getNews(symbol);
      res.json(news);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Error fetching news" });
    }
  });

  // Watchlist management
  app.get("/api/watchlists", async (req, res) => {
    try {
      // In a real app, this would use the authenticated user's ID
      const userId = 1; // Default user for demo
      const watchlists = await storage.getWatchlistsByUserId(userId);
      res.json(watchlists);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({ message: "Error fetching watchlists" });
    }
  });

  app.post("/api/watchlists", async (req, res) => {
    try {
      const data = insertWatchlistSchema.parse(req.body);
      const watchlist = await storage.createWatchlist(data);
      res.status(201).json(watchlist);
    } catch (error) {
      console.error("Error creating watchlist:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid watchlist data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error creating watchlist" });
      }
    }
  });

  app.get("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const watchlist = await storage.getWatchlist(id);
      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      console.error(`Error fetching watchlist ${req.params.id}:`, error);
      res.status(500).json({ message: `Error fetching watchlist ${req.params.id}` });
    }
  });

  app.post("/api/watchlists/:id/symbols", async (req, res) => {
    try {
      const watchlistId = parseInt(req.params.id);
      const data = insertWatchlistSymbolSchema.parse({
        ...req.body,
        watchlistId
      });
      
      const symbol = await storage.addSymbolToWatchlist(data);
      res.status(201).json(symbol);
    } catch (error) {
      console.error("Error adding symbol to watchlist:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid symbol data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error adding symbol to watchlist" });
      }
    }
  });

  app.delete("/api/watchlists/:watchlistId/symbols/:symbolId", async (req, res) => {
    try {
      const watchlistId = parseInt(req.params.watchlistId);
      const symbolId = parseInt(req.params.symbolId);
      
      await storage.removeSymbolFromWatchlist(symbolId, watchlistId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing symbol from watchlist:", error);
      res.status(500).json({ message: "Error removing symbol from watchlist" });
    }
  });

  // User preferences
  app.get("/api/user/preferences", async (req, res) => {
    try {
      // In a real app, this would use the authenticated user's ID
      const userId = 1; // Default user for demo
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: "Error fetching user preferences" });
    }
  });

  app.put("/api/user/preferences", async (req, res) => {
    try {
      // In a real app, this would use the authenticated user's ID
      const userId = 1; // Default user for demo
      const preferences = await storage.updateUserPreferences(userId, req.body);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Error updating user preferences" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
