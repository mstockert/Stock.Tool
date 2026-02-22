import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { StockApiService } from "./services/stockApi";
import { z } from "zod";
import {
  insertWatchlistSchema,
  insertWatchlistSymbolSchema,
  insertPortfolioSchema,
  insertPortfolioHoldingSchema,
  insertPriceAlertSchema,
  insertTradeJournalEntrySchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const stockApi = new StockApiService();

  // IBKR Connection Status Route
  app.get("/api/ibkr/status", async (req, res) => {
    try {
      const status = await stockApi.getIBKRStatus();
      res.json(status);
    } catch (error) {
      console.error("Error checking IBKR status:", error);
      res.status(500).json({
        enabled: false,
        authenticated: false,
        connected: false,
        message: "Error checking IBKR connection status",
      });
    }
  });

  // Market data routes
  app.get("/api/market/indices", async (req, res) => {
    try {
      // Support timeframe parameter
      const timeframe = req.query.timeframe as string || "1D";
      const timestamp = req.query._t as string || '';
      
      console.log(`Market indices API called with timeframe: ${timeframe} (timestamp: ${timestamp})`);
      
      // Disable caching to ensure fresh data for each timeframe
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const indices = await stockApi.getMarketIndices(timeframe);
      
      console.log(`Responding with ${indices.length} market indices for timeframe ${timeframe}`);
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
      
      // Disable caching to ensure fresh data for each timeframe
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
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

  // Screener - returns all available stocks with their data for filtering
  app.get("/api/screener/stocks", async (req, res) => {
    try {
      // Get all stocks we have data for (Mag7 + common stocks)
      const symbols = [
        { symbol: "AAPL", name: "Apple Inc." },
        { symbol: "MSFT", name: "Microsoft Corporation" },
        { symbol: "GOOGL", name: "Alphabet Inc." },
        { symbol: "AMZN", name: "Amazon.com Inc." },
        { symbol: "NVDA", name: "NVIDIA Corporation" },
        { symbol: "META", name: "Meta Platforms Inc." },
        { symbol: "TSLA", name: "Tesla Inc." },
        { symbol: "JPM", name: "JPMorgan Chase & Co." },
        { symbol: "V", name: "Visa Inc." },
        { symbol: "WMT", name: "Walmart Inc." },
        { symbol: "JNJ", name: "Johnson & Johnson" },
        { symbol: "PG", name: "Procter & Gamble Co." },
        { symbol: "MA", name: "Mastercard Inc." },
        { symbol: "HD", name: "The Home Depot Inc." },
        { symbol: "DIS", name: "The Walt Disney Co." },
      ];

      // Generate realistic data for each stock
      const stockData = symbols.map((s) => {
        // Generate consistent but varied data for each symbol
        const basePrice = {
          AAPL: 178.72, MSFT: 415.50, GOOGL: 175.25, AMZN: 185.60, NVDA: 125.80,
          META: 510.30, TSLA: 245.20, JPM: 195.40, V: 280.15, WMT: 165.80,
          JNJ: 155.20, PG: 162.45, MA: 465.30, HD: 385.60, DIS: 112.40
        }[s.symbol] || 100;

        // Random daily change between -5% and +5%
        const changePercent = (Math.random() - 0.5) * 0.1;
        const change = basePrice * changePercent;
        const price = basePrice + change;

        // Volume varies by stock
        const baseVolume = {
          AAPL: 58000000, MSFT: 22000000, GOOGL: 25000000, AMZN: 48000000, NVDA: 42000000,
          META: 15000000, TSLA: 98000000, JPM: 12000000, V: 8000000, WMT: 6500000,
          JNJ: 7200000, PG: 6800000, MA: 3500000, HD: 4200000, DIS: 9500000
        }[s.symbol] || 5000000;
        const volume = Math.floor(baseVolume * (0.8 + Math.random() * 0.4));

        // Market cap
        const marketCap = {
          AAPL: 2810000000000, MSFT: 3100000000000, GOOGL: 2200000000000, AMZN: 1920000000000,
          NVDA: 3100000000000, META: 1300000000000, TSLA: 780000000000, JPM: 560000000000,
          V: 580000000000, WMT: 530000000000, JNJ: 375000000000, PG: 380000000000,
          MA: 440000000000, HD: 370000000000, DIS: 205000000000
        }[s.symbol] || 100000000000;

        // P/E ratio
        const peRatio = {
          AAPL: 29.47, MSFT: 35.12, GOOGL: 24.85, AMZN: 60.24, NVDA: 65.32,
          META: 28.45, TSLA: 72.15, JPM: 11.85, V: 31.20, WMT: 28.65,
          JNJ: 15.40, PG: 25.80, MA: 35.90, HD: 22.15, DIS: 68.50
        }[s.symbol] || 20;

        // 52-week range
        const weekRange52 = {
          AAPL: { low: 164.08, high: 199.62 },
          MSFT: { low: 309.45, high: 430.82 },
          GOOGL: { low: 120.21, high: 191.75 },
          AMZN: { low: 118.35, high: 201.20 },
          NVDA: { low: 47.32, high: 152.89 },
          META: { low: 274.38, high: 542.81 },
          TSLA: { low: 138.80, high: 299.29 },
          JPM: { low: 135.19, high: 205.88 },
          V: { low: 227.68, high: 290.96 },
          WMT: { low: 141.51, high: 169.94 },
          JNJ: { low: 143.13, high: 175.97 },
          PG: { low: 140.54, high: 171.03 },
          MA: { low: 359.77, high: 490.00 },
          HD: { low: 274.26, high: 395.10 },
          DIS: { low: 78.73, high: 123.74 }
        }[s.symbol] || { low: basePrice * 0.7, high: basePrice * 1.3 };

        return {
          symbol: s.symbol,
          name: s.name,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: changePercent,
          volume,
          marketCap,
          peRatio,
          weekRange52
        };
      });

      res.json(stockData);
    } catch (error) {
      console.error("Error fetching screener stocks:", error);
      res.status(500).json({ message: "Error fetching screener stocks" });
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
  
  app.delete("/api/watchlists/:id", async (req, res) => {
    try {
      const watchlistId = parseInt(req.params.id);
      await storage.deleteWatchlist(watchlistId);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting watchlist ${req.params.id}:`, error);
      res.status(500).json({ message: `Error deleting watchlist ${req.params.id}` });
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

  // ============================================
  // PORTFOLIO ROUTES
  // ============================================

  // Get all portfolios for user
  app.get("/api/portfolios", async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const portfolios = await storage.getPortfoliosByUserId(userId);

      // Enrich holdings with current price data
      for (const portfolio of portfolios) {
        if (portfolio.holdings) {
          for (const holding of portfolio.holdings) {
            try {
              const quote = await stockApi.getStockQuote(holding.symbol);
              holding.currentPrice = quote.price;
              holding.change = quote.change;
              holding.changePercent = quote.changePercent;
            } catch {
              // Use fallback if quote fails
              holding.currentPrice = parseFloat(holding.avgCost) * 1.1;
              holding.change = 0;
              holding.changePercent = 0;
            }
          }
        }
      }

      res.json(portfolios);
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      res.status(500).json({ message: "Error fetching portfolios" });
    }
  });

  // Get single portfolio
  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const portfolio = await storage.getPortfolio(id);
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found" });
      }

      // Enrich holdings with current price data
      if (portfolio.holdings) {
        for (const holding of portfolio.holdings) {
          try {
            const quote = await stockApi.getStockQuote(holding.symbol);
            holding.currentPrice = quote.price;
            holding.change = quote.change;
            holding.changePercent = quote.changePercent;
          } catch {
            holding.currentPrice = parseFloat(holding.avgCost) * 1.1;
            holding.change = 0;
            holding.changePercent = 0;
          }
        }
      }

      res.json(portfolio);
    } catch (error) {
      console.error(`Error fetching portfolio ${req.params.id}:`, error);
      res.status(500).json({ message: `Error fetching portfolio ${req.params.id}` });
    }
  });

  // Create portfolio
  app.post("/api/portfolios", async (req, res) => {
    try {
      const data = insertPortfolioSchema.parse({ ...req.body, userId: 1 });
      const portfolio = await storage.createPortfolio(data);
      res.status(201).json(portfolio);
    } catch (error) {
      console.error("Error creating portfolio:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid portfolio data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error creating portfolio" });
      }
    }
  });

  // Update portfolio
  app.put("/api/portfolios/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const portfolio = await storage.updatePortfolio(id, req.body);
      res.json(portfolio);
    } catch (error) {
      console.error(`Error updating portfolio ${req.params.id}:`, error);
      res.status(500).json({ message: `Error updating portfolio ${req.params.id}` });
    }
  });

  // Delete portfolio
  app.delete("/api/portfolios/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePortfolio(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting portfolio ${req.params.id}:`, error);
      res.status(500).json({ message: `Error deleting portfolio ${req.params.id}` });
    }
  });

  // Add holding to portfolio
  app.post("/api/portfolios/:id/holdings", async (req, res) => {
    try {
      const portfolioId = parseInt(req.params.id);
      const data = insertPortfolioHoldingSchema.parse({
        ...req.body,
        portfolioId
      });
      const holding = await storage.addHoldingToPortfolio(data);
      res.status(201).json(holding);
    } catch (error) {
      console.error("Error adding holding:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid holding data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error adding holding" });
      }
    }
  });

  // Update holding
  app.put("/api/portfolios/:portfolioId/holdings/:holdingId", async (req, res) => {
    try {
      const holdingId = parseInt(req.params.holdingId);
      const holding = await storage.updateHolding(holdingId, req.body);
      res.json(holding);
    } catch (error) {
      console.error(`Error updating holding ${req.params.holdingId}:`, error);
      res.status(500).json({ message: `Error updating holding ${req.params.holdingId}` });
    }
  });

  // Delete holding
  app.delete("/api/portfolios/:portfolioId/holdings/:holdingId", async (req, res) => {
    try {
      const holdingId = parseInt(req.params.holdingId);
      await storage.removeHoldingFromPortfolio(holdingId);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting holding ${req.params.holdingId}:`, error);
      res.status(500).json({ message: `Error deleting holding ${req.params.holdingId}` });
    }
  });

  // ============================================
  // PRICE ALERT ROUTES
  // ============================================

  // Get all price alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const userId = 1;
      const alerts = await storage.getPriceAlertsByUserId(userId);

      // Enrich alerts with current prices and check triggered status
      const enrichedAlerts = await Promise.all(alerts.map(async (alert) => {
        let currentPrice: number | undefined;

        try {
          const quote = await stockApi.getStockQuote(alert.symbol);
          currentPrice = quote.price;

          // Check if alert should be triggered
          if (alert.isActive && !alert.isTriggered) {
            const targetPrice = parseFloat(alert.targetPrice);
            const shouldTrigger =
              (alert.condition === "above" && quote.price >= targetPrice) ||
              (alert.condition === "below" && quote.price <= targetPrice);

            if (shouldTrigger) {
              await storage.updatePriceAlert(alert.id, {
                isTriggered: true,
                triggeredAt: new Date()
              });
              return {
                ...alert,
                currentPrice,
                isTriggered: true,
                triggeredAt: new Date()
              };
            }
          }
        } catch {
          // Skip price check if API fails
        }

        return { ...alert, currentPrice };
      }));

      res.json(enrichedAlerts);
    } catch (error) {
      console.error("Error fetching price alerts:", error);
      res.status(500).json({ message: "Error fetching price alerts" });
    }
  });

  // Create price alert
  app.post("/api/alerts", async (req, res) => {
    try {
      const data = insertPriceAlertSchema.parse({ ...req.body, userId: 1 });
      const alert = await storage.createPriceAlert(data);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating price alert:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid alert data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error creating price alert" });
      }
    }
  });

  // Update price alert
  app.put("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.updatePriceAlert(id, req.body);
      res.json(alert);
    } catch (error) {
      console.error(`Error updating price alert ${req.params.id}:`, error);
      res.status(500).json({ message: `Error updating price alert ${req.params.id}` });
    }
  });

  // Delete price alert
  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePriceAlert(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting price alert ${req.params.id}:`, error);
      res.status(500).json({ message: `Error deleting price alert ${req.params.id}` });
    }
  });

  // ============================================
  // TRADE JOURNAL ROUTES
  // ============================================

  // Get all trade journal entries
  app.get("/api/journal", async (req, res) => {
    try {
      const userId = 1;
      const entries = await storage.getTradeJournalEntriesByUserId(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching trade journal:", error);
      res.status(500).json({ message: "Error fetching trade journal" });
    }
  });

  // Create trade journal entry
  app.post("/api/journal", async (req, res) => {
    try {
      const data = insertTradeJournalEntrySchema.parse({ ...req.body, userId: 1 });
      const entry = await storage.createTradeJournalEntry(data);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating trade journal entry:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid journal entry data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error creating trade journal entry" });
      }
    }
  });

  // Update trade journal entry
  app.put("/api/journal/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.updateTradeJournalEntry(id, req.body);
      res.json(entry);
    } catch (error) {
      console.error(`Error updating trade journal entry ${req.params.id}:`, error);
      res.status(500).json({ message: `Error updating trade journal entry ${req.params.id}` });
    }
  });

  // Delete trade journal entry
  app.delete("/api/journal/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTradeJournalEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting trade journal entry ${req.params.id}:`, error);
      res.status(500).json({ message: `Error deleting trade journal entry ${req.params.id}` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
