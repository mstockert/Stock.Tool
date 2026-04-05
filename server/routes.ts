import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { StockApiService, isMarketOpen } from "./services/stockApi";
import { runTechnicalAnalysis } from "./services/technicalAnalysis";
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

  // Market hours check
  app.get("/api/market/hours", (_req, res) => {
    res.json({ marketOpen: isMarketOpen() });
  });

  // IBKR Connection Status Route
  app.get("/api/ibkr/status", async (req, res) => {
    try {
      const marketOpen = isMarketOpen();
      const status = await stockApi.getIBKRStatus();
      res.json({ ...status, marketOpen });
    } catch (error) {
      console.error("Error checking IBKR status:", error);
      res.status(500).json({
        enabled: false,
        authenticated: false,
        connected: false,
        marketOpen: isMarketOpen(),
        message: "Error checking IBKR connection status",
      });
    }
  });

  // ===========================================
  // Schwab API Routes (OAuth 2.0 + Market Data)
  // ===========================================
  app.get("/api/schwab/status", async (_req, res) => {
    try {
      const { schwabApi } = await import("./services/schwabApi");
      res.json(schwabApi.getStatus());
    } catch (error: any) {
      res.status(500).json({ enabled: false, authenticated: false, message: error.message });
    }
  });

  app.get("/api/schwab/auth-url", async (_req, res) => {
    try {
      const { schwabApi } = await import("./services/schwabApi");
      res.json({ authUrl: schwabApi.getAuthUrl() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Exchange authorization code (or full redirect URL) for tokens
  app.post("/api/schwab/exchange", async (req, res) => {
    try {
      const { schwabApi } = await import("./services/schwabApi");
      const input = (req.body?.code || req.body?.redirectUrl || "").toString();
      if (!input) return res.status(400).json({ message: "Provide 'code' or 'redirectUrl' in body" });
      const tokens = await schwabApi.exchangeCode(input);
      res.json({
        success: true,
        accessExpiresIn: Math.round((tokens.expires_at - Date.now()) / 1000),
        refreshExpiresIn: Math.round((tokens.refresh_expires_at - Date.now()) / 1000),
      });
    } catch (error: any) {
      console.error("Schwab exchange failed:", error.response?.data || error.message);
      res.status(500).json({
        success: false,
        message: error.response?.data?.error_description || error.response?.data?.error || error.message,
      });
    }
  });

  // OAuth redirect handler — Schwab redirects here with ?code=...
  // User can also paste the full URL into the Settings UI.
  app.get("/api/schwab/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    if (!code) {
      return res.status(400).send("<h3>Missing authorization code</h3>");
    }
    try {
      const { schwabApi } = await import("./services/schwabApi");
      await schwabApi.exchangeCode(code);
      res.send(`<html><body style="font-family:sans-serif;padding:40px">
        <h2>✅ Schwab connected</h2>
        <p>You may close this window and return to Stock.Tool.</p>
      </body></html>`);
    } catch (error: any) {
      res.status(500).send(`<h3>Schwab token exchange failed</h3><pre>${error.message}</pre>`);
    }
  });

  // Pull live positions + cash from all Schwab accounts. Returns the same
  // shape as /api/ibkr/positions so the Portfolios import modal can consume it.
  app.get("/api/schwab/positions", async (_req, res) => {
    try {
      const { schwabApi } = await import("./services/schwabApi");
      console.log("[Schwab] Fetching positions...");
      const result = await schwabApi.getAllPositions();
      if (!result) {
        return res.status(401).json({ error: "Schwab not authenticated or accounts unavailable" });
      }
      console.log(`[Schwab] ${result.holdings.length} holdings, netLiq=$${result.netLiquidation.toFixed(2)}, cash=$${result.cashBalance.toFixed(2)}`);
      res.json({ ...result, method: "schwab/trader-api" });
    } catch (error: any) {
      console.error("Error fetching Schwab positions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Schwab positions" });
    }
  });

  app.get("/api/schwab/accounts", async (_req, res) => {
    try {
      const { schwabApi } = await import("./services/schwabApi");
      const accounts = await schwabApi.getAccountNumbers();
      if (!accounts) return res.status(401).json({ error: "Schwab not authenticated" });
      // Return only masked account numbers for UI; hashes stay server-side
      res.json(accounts.map((a) => ({
        accountNumber: `...${a.accountNumber.slice(-4)}`,
        hashValue: a.hashValue,
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/schwab/quote/:symbol", async (req, res) => {
    try {
      const { schwabApi } = await import("./services/schwabApi");
      const quote = await schwabApi.getStockQuote(req.params.symbol);
      if (!quote) return res.status(404).json({ message: "Quote not available" });
      res.json(quote);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  // Full technical analysis (pure-function, no external API calls beyond history)
  app.get("/api/stocks/analysis/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const timeframe = (req.query.timeframe as string) || "1Y";
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      const history = await stockApi.getStockHistory(symbol, timeframe);
      if (!history || history.length < 20) {
        return res.status(404).json({ message: `Insufficient history for ${symbol}` });
      }
      // Fetch SPY benchmark in parallel (don't fail analysis if SPY fetch fails)
      let spyHistory: typeof history | undefined;
      if (symbol !== "SPY") {
        try {
          spyHistory = await stockApi.getStockHistory("SPY", timeframe);
        } catch (e) {
          console.warn(`[analysis] SPY benchmark fetch failed:`, e);
        }
      }
      const analysis = runTechnicalAnalysis(symbol, history, spyHistory, "SPY");
      res.json(analysis);
    } catch (error) {
      console.error(`Error running analysis for ${req.params.symbol}:`, error);
      res.status(500).json({ message: `Error running analysis for ${req.params.symbol}` });
    }
  });

  // AI-generated technical commentary (uses Anthropic Claude) — with server-side cache
  const commentaryCache = new Map<string, { commentary: string; generatedAt: string }>();
  const COMMENTARY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  app.get("/api/stocks/commentary/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const timeframe = (req.query.timeframe as string) || "1Y";
      const force = req.query.force === "true" || req.query.force === "1";
      res.setHeader('Cache-Control', 'no-store, max-age=0');

      const cacheKey = `${symbol}:${timeframe}`;
      if (!force) {
        const cached = commentaryCache.get(cacheKey);
        if (cached) {
          const age = Date.now() - new Date(cached.generatedAt).getTime();
          if (age < COMMENTARY_TTL_MS) {
            return res.json({
              symbol,
              timeframe,
              commentary: cached.commentary,
              generatedAt: cached.generatedAt,
              cached: true,
            });
          }
        }
      }

      const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
      if (!anthropicKey) {
        return res.status(503).json({ error: "ANTHROPIC_API_KEY not set on server" });
      }

      const history = await stockApi.getStockHistory(symbol, timeframe);
      if (!history || history.length < 20) {
        return res.status(404).json({ error: `Insufficient history for ${symbol}` });
      }
      let spyHistory: typeof history | undefined;
      if (symbol !== "SPY") {
        try { spyHistory = await stockApi.getStockHistory("SPY", timeframe); } catch {}
      }
      const analysis = runTechnicalAnalysis(symbol, history, spyHistory, "SPY");

      // Compact, number-focused summary for the model
      const facts = {
        symbol,
        timeframe,
        price: +analysis.price.toFixed(2),
        priceChangePercent: +analysis.priceChangePercent.toFixed(2),
        trend: {
          direction: analysis.trend.direction,
          strength: analysis.trend.strength,
          slopePctPerBar: +analysis.trend.slope.toFixed(3),
          priceVsSMA50Pct: +analysis.trend.priceVsSMA50.toFixed(2),
          priceVsSMA200Pct: +analysis.trend.priceVsSMA200.toFixed(2),
          goldenCross: analysis.trend.sma50AboveSma200,
        },
        indicators: {
          sma20: analysis.indicators.sma20 && +analysis.indicators.sma20.toFixed(2),
          sma50: analysis.indicators.sma50 && +analysis.indicators.sma50.toFixed(2),
          sma200: analysis.indicators.sma200 && +analysis.indicators.sma200.toFixed(2),
          rsi14: analysis.indicators.rsi14 && +analysis.indicators.rsi14.toFixed(1),
          atr14: analysis.indicators.atr14 && +analysis.indicators.atr14.toFixed(2),
          annualizedVolPct: analysis.indicators.volatilityAnnualized && +analysis.indicators.volatilityAnnualized.toFixed(1),
        },
        support: analysis.supportResistance.support.map((s) => ({
          level: +s.level.toFixed(2), touches: s.touches,
        })),
        resistance: analysis.supportResistance.resistance.map((r) => ({
          level: +r.level.toFixed(2), touches: r.touches,
        })),
        volume: {
          trend: analysis.volume.trend,
          ratioVsAvg: +analysis.volume.volumeRatio.toFixed(2),
        },
        patterns: analysis.patterns.map((p) => ({
          type: p.type, confidence: p.confidence, description: p.description,
        })),
        riskReturn: {
          totalReturnPct: +analysis.riskReturn.totalReturnPct.toFixed(2),
          cagrPct: analysis.riskReturn.cagrPct == null ? null : +analysis.riskReturn.cagrPct.toFixed(2),
          maxDrawdownPct: +analysis.riskReturn.maxDrawdownPct.toFixed(2),
          sharpe: analysis.riskReturn.sharpe == null ? null : +analysis.riskReturn.sharpe.toFixed(2),
          sortino: analysis.riskReturn.sortino == null ? null : +analysis.riskReturn.sortino.toFixed(2),
          var95Pct: +analysis.riskReturn.valueAtRisk95Pct.toFixed(2),
        },
        benchmark: analysis.benchmark && {
          beta: +analysis.benchmark.beta.toFixed(2),
          correlation: +analysis.benchmark.correlation.toFixed(2),
          alphaPct: +analysis.benchmark.alphaPct.toFixed(2),
          outperformancePct: +analysis.benchmark.outperformancePct.toFixed(2),
          stockReturnPct: +analysis.benchmark.stockReturnPct.toFixed(2),
          benchmarkReturnPct: +analysis.benchmark.benchmarkReturnPct.toFixed(2),
        },
      };

      const prompt = `You are a concise technical-analysis commentator for a retail trading tool. Given the JSON below, produce a short, professional, 3-paragraph commentary on ${symbol}:

1. **Trend & momentum** — describe the current trend, strength, MA posture, and RSI situation.
2. **Key levels & patterns** — summarize the most relevant support/resistance levels and any detected patterns; give a practical takeaway (e.g. "watch for a breakout above X").
3. **Risk & relative performance** — discuss volatility, max drawdown, Sharpe/Sortino if available, and how the stock is performing vs SPY (beta, alpha, outperformance).

Rules:
- Use plain prose, no bullet lists, no markdown headings.
- Under 220 words total.
- Reference specific numbers from the data.
- End with one sentence stating your overall read (bullish / bearish / neutral with a brief reason).
- Do NOT invent data that isn't in the JSON.
- This is analytical tooling, NOT financial advice — do not tell the user to buy or sell.

Data:
\`\`\`json
${JSON.stringify(facts, null, 2)}
\`\`\``;

      const { default: axios } = await import("axios");
      const resp = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          timeout: 60000,
        },
      );

      const content = resp.data?.content?.[0]?.text || "";
      const generatedAt = new Date().toISOString();
      commentaryCache.set(cacheKey, { commentary: content, generatedAt });
      res.json({ symbol, timeframe, commentary: content, generatedAt, cached: false });
    } catch (error: any) {
      console.error(`[Commentary] Error for ${req.params.symbol}:`, error?.message || error);
      res.status(500).json({ error: `Error generating commentary: ${error?.message || "unknown"}` });
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
            // Handle CASH/money market specially — no stock quote needed
            if (holding.symbol === "CASH" || holding.symbol === "USD") {
              holding.currentPrice = 1;
              holding.change = 0;
              holding.changePercent = 0;
              continue;
            }
            try {
              const quote = await stockApi.getStockQuote(holding.symbol);
              holding.currentPrice = quote.price;
              holding.change = quote.change;
              holding.changePercent = quote.changePercent;
            } catch {
              // Use fallback: avgCost if available, otherwise 0
              const avgCostNum = parseFloat(holding.avgCost);
              holding.currentPrice = avgCostNum > 0 ? avgCostNum : 0;
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
          // Handle CASH/money market specially
          if (holding.symbol === "CASH" || holding.symbol === "USD") {
            holding.currentPrice = 1;
            holding.change = 0;
            holding.changePercent = 0;
            continue;
          }
          try {
            const quote = await stockApi.getStockQuote(holding.symbol);
            holding.currentPrice = quote.price;
            holding.change = quote.change;
            holding.changePercent = quote.changePercent;
          } catch {
            const avgCostNum = parseFloat(holding.avgCost);
            holding.currentPrice = avgCostNum > 0 ? avgCostNum : 0;
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

  // Get portfolio performance history — computed by replaying the trade journal.
  // At each point in time we determine net shares held per symbol (from buy/sell
  // trades up to that point) and multiply by the historical close price. This
  // gives a true time-series of position value based on actual trades, not just
  // current holdings × historical prices.
  app.get("/api/portfolios/:id/history", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const timeframe = (req.query.timeframe as string) || "1M";
      const portfolio = await storage.getPortfolio(id);
      if (!portfolio) {
        return res.json([]);
      }

      // Get all trade journal entries for this portfolio
      const allEntries = await storage.getTradeJournalEntriesByUserId(portfolio.userId);
      const rawEntries = allEntries
        .filter(e => (e.portfolioId ?? null) === id)
        .map(e => ({
          symbol: e.symbol.toUpperCase(),
          action: e.action.toLowerCase(),
          shares: parseFloat(e.shares),
          price: parseFloat(e.price),
          totalValue: parseFloat(e.totalValue),
          date: new Date(e.tradeDate),
        }))
        .filter(t => !isNaN(t.shares) && t.shares !== 0)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      // Separate stock trades from cash flows
      const cashActions = new Set(["deposit", "withdrawal", "withdraw"]);
      const portfolioTrades = rawEntries.filter(
        t => !cashActions.has(t.action) &&
             t.symbol !== "CASH" && t.symbol !== "USD"
      );
      const cashFlows = rawEntries.filter(
        t => cashActions.has(t.action) ||
             ((t.symbol === "CASH" || t.symbol === "USD") && (t.action === "buy" || t.action === "sell"))
      );

      if (portfolioTrades.length === 0 && cashFlows.length === 0) {
        return res.json([]);
      }

      // Cash accounting: reconstruct cash balance over time.
      // We know the CURRENT cash from the portfolio's CASH holding, and we know
      // every buy (cash out) and sell (cash in) from trades. So:
      //   initial_cash = current_cash + total_buys - total_sells
      // Then at any time T: cash(T) = initial_cash + sum(sells up to T) - sum(buys up to T)
      const cashHolding = portfolio.holdings?.find(
        h => h.symbol === "CASH" || h.symbol === "USD"
      );
      const currentCash = cashHolding
        ? parseFloat(cashHolding.shares) * parseFloat(cashHolding.avgCost)
        : 0;
      const totalBuyValue = portfolioTrades
        .filter(t => t.action === "buy")
        .reduce((sum, t) => sum + t.shares * t.price, 0);
      const totalSellValue = portfolioTrades
        .filter(t => t.action === "sell")
        .reduce((sum, t) => sum + t.shares * t.price, 0);
      // We'll add net cash flows (deposits - withdrawals) after defining the helper below
      let initialCash = currentCash + totalBuyValue - totalSellValue;

      // Helper: compute the signed cash delta for a cash-flow entry.
      // Returns positive for deposit (cash in), negative for withdrawal (cash out).
      const cashFlowDelta = (t: typeof rawEntries[0]): number => {
        const amount = t.totalValue && !isNaN(t.totalValue) && t.totalValue > 0
          ? t.totalValue
          : t.shares * (t.price || 1);
        if (t.action === "deposit" || ((t.symbol === "CASH" || t.symbol === "USD") && t.action === "buy")) {
          return amount;
        }
        if (t.action === "withdrawal" || t.action === "withdraw" || ((t.symbol === "CASH" || t.symbol === "USD") && t.action === "sell")) {
          return -amount;
        }
        return 0;
      };

      // Adjust initial cash to subtract net cash flows: initial_cash represents the
      // cash that existed BEFORE any recorded entry, so we reverse the effect of flows.
      const netCashFlowTotal = cashFlows.reduce((sum, t) => sum + cashFlowDelta(t), 0);
      initialCash -= netCashFlowTotal;

      // Diagnostic logging
      console.log(`[Portfolio History] portfolio=${id} (${portfolio.name})`);
      console.log(`[Portfolio History]   trades: ${portfolioTrades.length} stock, ${cashFlows.length} cash flows`);
      console.log(`[Portfolio History]   totalBuys=$${totalBuyValue.toFixed(2)}, totalSells=$${totalSellValue.toFixed(2)}, netCashFlows=$${netCashFlowTotal.toFixed(2)}`);
      console.log(`[Portfolio History]   currentCash=$${currentCash.toFixed(2)}, initialCash=$${initialCash.toFixed(2)}`);
      // Compute final net shares per symbol by replaying all trades
      const _finalNetShares: Record<string, number> = {};
      for (const t of portfolioTrades) {
        if (t.action === "buy") _finalNetShares[t.symbol] = (_finalNetShares[t.symbol] || 0) + t.shares;
        else if (t.action === "sell") _finalNetShares[t.symbol] = (_finalNetShares[t.symbol] || 0) - t.shares;
      }
      console.log(`[Portfolio History]   final net shares:`, Object.entries(_finalNetShares)
        .filter(([_, s]) => Math.abs(s) > 0.001)
        .map(([sym, shares]) => `${sym}=${shares.toFixed(2)}`).join(", "));
      // Flag any potentially bad trades (huge values, suspicious shares)
      const suspiciousTrades = portfolioTrades.filter(
        t => t.shares * t.price > 100000 || t.shares > 10000 || t.price > 10000
      );
      if (suspiciousTrades.length > 0) {
        console.log(`[Portfolio History]   ⚠️ ${suspiciousTrades.length} suspicious trades (value>$100k or shares>10k or price>$10k):`);
        for (const t of suspiciousTrades.slice(0, 10)) {
          console.log(`[Portfolio History]     ${t.date.toISOString().slice(0, 10)} ${t.action} ${t.shares} ${t.symbol} @ $${t.price} = $${(t.shares * t.price).toFixed(2)}`);
        }
      }
      // Flag duplicate trades (same symbol/date/action/shares/price)
      const tradeKeys = new Map<string, number>();
      for (const t of portfolioTrades) {
        const key = `${t.date.toISOString().slice(0, 10)}|${t.action}|${t.symbol}|${t.shares}|${t.price}`;
        tradeKeys.set(key, (tradeKeys.get(key) || 0) + 1);
      }
      const dupes = Array.from(tradeKeys.entries()).filter(([_, c]) => c > 1);
      if (dupes.length > 0) {
        console.log(`[Portfolio History]   ⚠️ ${dupes.length} duplicate trade groups found:`);
        for (const [key, count] of dupes.slice(0, 10)) {
          console.log(`[Portfolio History]     ${count}× ${key}`);
        }
      }

      // Determine date range based on timeframe and earliest entry (trade or cash flow)
      const allEntryDates = [
        ...portfolioTrades.map(t => t.date),
        ...cashFlows.map(t => t.date),
      ];
      const earliestTradeDate = new Date(Math.min(...allEntryDates.map(d => d.getTime())));
      const now = new Date();
      const timeframeStart = (() => {
        const d = new Date();
        switch (timeframe) {
          case "1W": d.setDate(d.getDate() - 7); return d;
          case "1M": d.setMonth(d.getMonth() - 1); return d;
          case "3M": d.setMonth(d.getMonth() - 3); return d;
          case "1Y": d.setFullYear(d.getFullYear() - 1); return d;
          case "5Y": d.setFullYear(d.getFullYear() - 5); return d;
          default: d.setMonth(d.getMonth() - 1); return d;
        }
      })();
      // Clamp start to earliest trade — can't show performance before trades existed
      const startDate = earliestTradeDate > timeframeStart ? earliestTradeDate : timeframeStart;

      // Get unique symbols (traded OR currently held) — we need price history for both
      const currentHoldingSymbols = (portfolio.holdings || [])
        .map(h => h.symbol.toUpperCase())
        .filter(s => s !== "CASH" && s !== "USD");
      const uniqueSymbols = Array.from(
        new Set([...portfolioTrades.map(t => t.symbol), ...currentHoldingSymbols])
      );

      // Fetch historical prices for each symbol. Use 5Y to ensure we have deep
      // enough data, then we'll filter to our actual range.
      const fetchTimeframe = ["1Y", "5Y"].includes(timeframe) ? "5Y" : timeframe;
      const priceHistoryMap: Record<string, Map<string, number>> = {};
      await Promise.all(
        uniqueSymbols.map(async (sym) => {
          try {
            const hist = await stockApi.getStockHistory(sym, fetchTimeframe);
            const map = new Map<string, number>();
            for (const bar of hist) {
              // Normalize timestamp to YYYY-MM-DD
              const d = new Date(bar.timestamp);
              if (!isNaN(d.getTime())) {
                const key = d.toISOString().slice(0, 10);
                map.set(key, bar.close);
              }
            }
            priceHistoryMap[sym] = map;
          } catch (e) {
            console.warn(`Failed to get history for ${sym}:`, e);
            priceHistoryMap[sym] = new Map();
          }
        })
      );

      // Build sorted list of unique date keys from all price histories within range
      const allDateKeys = new Set<string>();
      for (const map of Object.values(priceHistoryMap)) {
        for (const key of map.keys()) {
          const d = new Date(key);
          if (d >= startDate && d <= now) allDateKeys.add(key);
        }
      }
      // Also include each trade date
      for (const t of portfolioTrades) {
        if (t.date >= startDate && t.date <= now) {
          allDateKeys.add(t.date.toISOString().slice(0, 10));
        }
      }
      const sortedDates = Array.from(allDateKeys).sort();

      if (sortedDates.length === 0) {
        return res.json([]);
      }

      // For each symbol, build a function to get the price on or before a given date key
      const getPriceOnOrBefore = (sym: string, dateKey: string): number | null => {
        const map = priceHistoryMap[sym];
        if (!map || map.size === 0) return null;
        // Direct hit
        if (map.has(dateKey)) return map.get(dateKey)!;
        // Walk backwards from this date
        const target = new Date(dateKey);
        let best: { key: string; price: number } | null = null;
        for (const [k, v] of map.entries()) {
          const d = new Date(k);
          if (d <= target && (!best || d > new Date(best.key))) {
            best = { key: k, price: v };
          }
        }
        return best?.price ?? null;
      };

      // Merge all entries (stock trades + cash flows) into one chronological timeline
      type TimelineEntry = typeof rawEntries[0] & { isCashFlow: boolean };
      const timeline: TimelineEntry[] = [
        ...portfolioTrades.map(t => ({ ...t, isCashFlow: false })),
        ...cashFlows.map(t => ({ ...t, isCashFlow: true })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      // Anchor on CURRENT holdings (ground truth) so the chart is accurate even
      // when the trade journal is incomplete or has duplicates. If replaying all
      // trades yields final net shares that differ from actual holdings, we
      // introduce a synthetic starting position (= current − replayed) so that
      // after replay, per-symbol shares match actual holdings exactly.
      const currentSharesBySymbol: Record<string, number> = {};
      for (const h of portfolio.holdings || []) {
        const sym = h.symbol.toUpperCase();
        if (sym === "CASH" || sym === "USD") continue;
        currentSharesBySymbol[sym] = (currentSharesBySymbol[sym] || 0) + parseFloat(h.shares);
      }
      // If the portfolio has NO stock holdings today, don't try to reconstruct
      // historical positions — we'd have to synthesize short positions to walk
      // backward, which produces misleading negative values. Instead render a
      // cash-balance-only trajectory: the portfolio's account balance through
      // time from buys/sells/deposits/withdrawals.
      const hasCurrentHoldings = Object.keys(currentSharesBySymbol).length > 0;
      const syntheticStartShares: Record<string, number> = {};
      if (hasCurrentHoldings) {
        const allSymbolsForReconcile = new Set<string>([
          ...uniqueSymbols,
          ...Object.keys(currentSharesBySymbol),
        ]);
        for (const sym of allSymbolsForReconcile) {
          syntheticStartShares[sym] =
            (currentSharesBySymbol[sym] || 0) - (_finalNetShares[sym] || 0);
        }
        const reconcileGaps = Object.entries(syntheticStartShares).filter(
          ([, s]) => Math.abs(s) > 0.001
        );
        if (reconcileGaps.length > 0) {
          console.log(`[Portfolio History]   ⚠️ reconciling ${reconcileGaps.length} share gaps (current − replayed):`,
            reconcileGaps.map(([sym, s]) => `${sym}=${s.toFixed(2)}`).join(", "));
        }
      } else {
        console.log(`[Portfolio History]   ℹ️ portfolio has 0 holdings — rendering cash-balance-only trajectory`);
      }

      // Replay entries chronologically. Track:
      //  - netShares per symbol (starts from syntheticStartShares so final = current)
      //  - cash balance (from initialCash + sells − buys + deposits − withdrawals)
      //  - last known price per symbol (fallback when historical data missing)
      const netShares: Record<string, number> = { ...syntheticStartShares };
      const lastKnownPrice: Record<string, number> = {};
      let cash = initialCash;
      let idx = 0;
      const series: { timestamp: string; value: number }[] = [];

      const applyEntry = (t: TimelineEntry) => {
        if (t.isCashFlow) {
          cash += cashFlowDelta(t);
          return;
        }
        const tradeCash = t.shares * t.price;
        if (t.action === "buy") {
          netShares[t.symbol] = (netShares[t.symbol] || 0) + t.shares;
          cash -= tradeCash;
        } else if (t.action === "sell") {
          netShares[t.symbol] = (netShares[t.symbol] || 0) - t.shares;
          cash += tradeCash;
        }
        // Record trade price as fallback for symbols lacking price history
        if (t.price > 0) lastKnownPrice[t.symbol] = t.price;
      };

      // Pre-apply any entries that happened before startDate
      while (idx < timeline.length && timeline[idx].date < new Date(sortedDates[0])) {
        applyEntry(timeline[idx]);
        idx++;
      }

      for (const dateKey of sortedDates) {
        const dateObj = new Date(dateKey);
        // Apply all entries on or before this date (but not yet applied)
        while (idx < timeline.length && timeline[idx].date <= dateObj) {
          applyEntry(timeline[idx]);
          idx++;
        }

        // Compute portfolio value as sum(netShares × price) + cash
        // When portfolio has no current holdings, skip stock-position valuation
        // entirely and render the pure cash-balance trajectory (ends at $0).
        let totalValue = cash;
        const skipStockValuation = !hasCurrentHoldings;
        for (const sym of uniqueSymbols) {
          if (skipStockValuation) continue;
          const shares = netShares[sym] || 0;
          if (shares === 0) continue;
          // Try historical close → last known trade price → skip
          const histPrice = getPriceOnOrBefore(sym, dateKey);
          const price = histPrice !== null ? histPrice : lastKnownPrice[sym];
          if (price !== undefined && price !== null) {
            totalValue += shares * price;
            // Update last known price as we learn more historical data
            if (histPrice !== null) lastKnownPrice[sym] = histPrice;
          }
        }

        series.push({
          timestamp: dateKey,
          value: Math.round(totalValue * 100) / 100,
        });
      }

      // For intraday (1D) timeframe we don't really support this view, fall back to empty
      if (timeframe === "1D") {
        return res.json([]);
      }

      res.json(series);
    } catch (error) {
      console.error(`Error fetching portfolio history:`, error);
      res.status(500).json({ message: "Error fetching portfolio history" });
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
  // PORTFOLIO SCAN (Image → Holdings via LLM Vision)
  // ============================================

  // Ticker aliases — map alternate tickers to canonical symbol
  const TICKER_ALIASES: Record<string, string> = {
    "GOOG": "GOOGL",
    "BRK.A": "BRK.B",
    "BF.A": "BF.B",
    "FOX": "FOXA",
    "NWS": "NWSA",
  };

  function parseScanResponse(content: string): any[] {
    content = content.trim();

    // Try direct JSON parse
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return normalizeHoldings(data);
      if (data && data.holdings) return normalizeHoldings(data.holdings);
      if (data && (data.symbol || data.ticker)) return normalizeHoldings([data]);
    } catch {}

    // Try to find JSON array in text
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return normalizeHoldings(JSON.parse(arrayMatch[0]));
      } catch {}
    }

    // Find individual JSON objects
    const objects = content.match(/\{[^{}]+\}/g);
    if (objects) {
      const parsed: any[] = [];
      for (const objStr of objects) {
        try {
          const obj = JSON.parse(objStr);
          if (obj.symbol || obj.ticker) parsed.push(obj);
        } catch {}
      }
      if (parsed.length) return normalizeHoldings(parsed);
    }

    return [];
  }

  function normalizeHoldings(data: any[]): any[] {
    const merged: Record<string, any> = {};
    for (const item of data) {
      if (typeof item !== "object" || !item) continue;
      let sym = (item.symbol || item.ticker || item.sym || "").toUpperCase().trim();
      if (!sym) continue;
      sym = TICKER_ALIASES[sym] || sym;

      const qty = parseFloat(item.qty || item.quantity || item.shares || 0) || 0;
      const cost = parseFloat(item.cost || item.cost_basis || item.costBasis || 0) || 0;
      const last = parseFloat(item.last || item.price || item.last_price || 0) || 0;
      const value = parseFloat(item.value || item.market_value || item.mktValue || 0) || 0;

      if (merged[sym]) {
        merged[sym].qty += qty;
        merged[sym].cost += cost;
        merged[sym].value += value;
        if (last > 0) merged[sym].last = last;
      } else {
        merged[sym] = { symbol: sym, qty, cost, last, value };
      }
    }
    return Object.values(merged);
  }

  // ============================================
  // IBKR DIRECT IMPORT
  // ============================================
  app.get("/api/ibkr/status", async (_req, res) => {
    try {
      const status = await stockApi.getIBKRStatus();
      res.json(status);
    } catch (error: any) {
      res.json({ enabled: false, authenticated: false, connected: false, message: error.message });
    }
  });

  app.get("/api/ibkr/positions", async (_req, res) => {
    try {
      const { ibkrApi } = await import("./services/ibkrApi");
      console.log("[IBKR] Fetching positions...");
      const positions = await ibkrApi.getPositions();
      console.log(`[IBKR] Raw positions received: ${positions.length}`, JSON.stringify(positions));

      // Transform to the same format as the image scan returns
      // Accept STK, ETF, and also positions without a secType label
      const holdings = positions
        .filter((p: any) => !p.secType || p.secType === "STK" || p.secType === "ETF" || p.secType === "FUT" || p.secType === "OPT")
        .map((p: any) => ({
          symbol: p.symbol,
          qty: Math.abs(p.shares),
          cost: Math.abs(p.shares * p.avgCost),
          last: 0,  // Will be enriched with current price later
          value: 0,
        }));

      // Also get cash balance via account summary
      const summary = await ibkrApi.getAccountSummary();
      const cashValue = parseFloat(summary?.TotalCashValue || "0");
      if (cashValue > 0) {
        holdings.push({
          symbol: "CASH",
          qty: cashValue,
          cost: 0,
          last: 1,
          value: cashValue,
        });
      }

      res.json({
        holdings,
        accountId: summary?.accountId || "",
        netLiquidation: parseFloat(summary?.NetLiquidation || "0"),
        method: "ibkr/tws-api",
      });
    } catch (error: any) {
      console.error("Error fetching IBKR positions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch IBKR positions" });
    }
  });

  app.get("/api/ibkr/trades", async (req, res) => {
    try {
      const { ibkrApi } = await import("./services/ibkrApi");
      const daysBack = parseInt(req.query.days as string) || 7;
      console.log(`[IBKR] Fetching trades for last ${daysBack} days...`);
      const executions = await ibkrApi.getExecutions(daysBack);

      // Transform to trade journal format
      const trades = executions.map((exec: any) => {
        // Parse IB time format: "YYYYMMDD  HH:MM:SS" or "YYYYMMDD-HH:MM:SS"
        let tradeDate = new Date().toISOString().split("T")[0];
        if (exec.time) {
          const cleaned = exec.time.replace(/\s+/g, " ").trim();
          // Try to parse "20260403 15:30:00" format
          const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
          if (match) {
            tradeDate = `${match[1]}-${match[2]}-${match[3]}`;
          }
        }

        // Map IB side to action
        const action = exec.side === "BOT" || exec.side === "BUY" ? "buy" : "sell";

        return {
          symbol: exec.symbol,
          action,
          shares: exec.shares,
          price: exec.price,
          date: tradeDate,
          time: exec.time,
          exchange: exec.exchange,
          orderId: exec.orderId,
          execId: exec.execId,
          account: exec.account,
        };
      });

      res.json({
        trades,
        count: trades.length,
        daysBack,
        method: "ibkr/tws-api",
      });
    } catch (error: any) {
      console.error("Error fetching IBKR trades:", error);
      res.status(500).json({ error: error.message || "Failed to fetch IBKR trades" });
    }
  });

  // Import trades from an IBKR Flex Query file (CSV or XML).
  // Body: { content: string, format?: "csv" | "xml" | "auto" }
  // Returns: { trades: [...], count: number, format: string }
  app.post("/api/ibkr/flex", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "No content provided" });
      }

      const trimmed = content.trim();
      const isXml = trimmed.startsWith("<");
      const trades: Array<{
        symbol: string;
        action: string;
        shares: number;
        price: number;
        date: string;
        orderId?: string;
        exchange?: string;
      }> = [];

      const normDate = (raw: string): string => {
        if (!raw) return new Date().toISOString().split("T")[0];
        // Strip any time portion
        const cleaned = raw.replace(/[;\s].*/, "").trim();
        // YYYYMMDD
        const m1 = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
        // MM/DD/YYYY
        const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m2) return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
      };

      const normAction = (raw: string): string => {
        const s = (raw || "").toUpperCase().trim();
        if (s === "BUY" || s === "BOT" || s === "B" || s.startsWith("BUY")) return "buy";
        if (s === "SELL" || s === "SLD" || s === "S" || s.startsWith("SELL")) return "sell";
        return s.toLowerCase();
      };

      if (isXml) {
        // Simple regex-based parse of <Trade .../> self-closing or with children.
        // Works for Flex Query "TradeConfirm" and "Trades" section outputs.
        const tradeRegex = /<Trade\b([^>]*)\/?\s*>/gi;
        let match: RegExpExecArray | null;
        while ((match = tradeRegex.exec(trimmed)) !== null) {
          const attrs = match[1];
          const attrMap: Record<string, string> = {};
          const attrRegex = /(\w+)="([^"]*)"/g;
          let a: RegExpExecArray | null;
          while ((a = attrRegex.exec(attrs)) !== null) {
            attrMap[a[1].toLowerCase()] = a[2];
          }
          const symbol = attrMap.symbol || attrMap.underlyingsymbol;
          if (!symbol) continue;
          // Filter out non-stock asset classes if set
          const assetClass = (attrMap.assetcategory || attrMap.assetclass || "").toUpperCase();
          if (assetClass && !["STK", "ETF", "FUND", ""].includes(assetClass)) continue;
          const shares = Math.abs(parseFloat(attrMap.quantity || "0"));
          const price = parseFloat(attrMap.tradeprice || attrMap.price || "0");
          if (!shares || !price) continue;
          trades.push({
            symbol: symbol.toUpperCase(),
            action: normAction(attrMap.buysell || attrMap.side || (parseFloat(attrMap.quantity || "0") >= 0 ? "BUY" : "SELL")),
            shares,
            price,
            date: normDate(attrMap.tradedate || attrMap.datetime || attrMap.date || ""),
            orderId: attrMap.orderid || attrMap.ordernum,
            exchange: attrMap.exchange,
          });
        }
      } else {
        // CSV parse — Flex Query CSV has a header row with field names
        const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          return res.status(400).json({ error: "CSV appears empty or missing header row" });
        }
        const splitCsv = (line: string): string[] => {
          // Minimal CSV splitter handling quoted fields
          const out: string[] = [];
          let cur = "";
          let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQ = !inQ; continue; }
            if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
            cur += c;
          }
          out.push(cur);
          return out.map(s => s.trim());
        };
        const header = splitCsv(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const idx = (names: string[]): number => {
          for (const n of names) {
            const i = header.indexOf(n);
            if (i >= 0) return i;
          }
          return -1;
        };
        const iSymbol = idx(["symbol", "underlyingsymbol"]);
        const iQty = idx(["quantity", "shares"]);
        const iPrice = idx(["tradeprice", "price"]);
        const iSide = idx(["buysell", "side"]);
        const iDate = idx(["tradedate", "datetime", "date", "reportdate"]);
        const iAsset = idx(["assetcategory", "assetclass"]);
        const iOrder = idx(["orderid", "ordernum"]);
        const iExch = idx(["exchange", "listingexchange"]);

        if (iSymbol < 0 || iQty < 0 || iPrice < 0) {
          return res.status(400).json({
            error: `CSV missing required columns (need Symbol, Quantity, TradePrice). Found: ${header.join(", ")}`,
          });
        }
        for (let li = 1; li < lines.length; li++) {
          const row = splitCsv(lines[li]);
          if (row.length < 3) continue;
          const assetClass = iAsset >= 0 ? (row[iAsset] || "").toUpperCase() : "";
          if (assetClass && !["STK", "ETF", "FUND", ""].includes(assetClass)) continue;
          const rawQty = parseFloat(row[iQty] || "0");
          const shares = Math.abs(rawQty);
          const price = parseFloat(row[iPrice] || "0");
          const symbol = row[iSymbol];
          if (!symbol || !shares || !price) continue;
          const sideRaw = iSide >= 0 ? row[iSide] : (rawQty >= 0 ? "BUY" : "SELL");
          trades.push({
            symbol: symbol.toUpperCase(),
            action: normAction(sideRaw),
            shares,
            price,
            date: normDate(iDate >= 0 ? row[iDate] : ""),
            orderId: iOrder >= 0 ? row[iOrder] : undefined,
            exchange: iExch >= 0 ? row[iExch] : undefined,
          });
        }
      }

      res.json({ trades, count: trades.length, format: isXml ? "xml" : "csv" });
    } catch (error: any) {
      console.error("Error parsing Flex Query:", error);
      res.status(500).json({ error: error.message || "Failed to parse Flex Query" });
    }
  });

  app.post("/api/portfolio/scan", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Extract base64 from data URL
      let b64data: string;
      let contentType = "image/png";
      if (image.includes(",")) {
        const [header, data] = image.split(",", 2);
        b64data = data;
        if (header.includes("jpeg") || header.includes("jpg")) contentType = "image/jpeg";
        else if (header.includes("webp")) contentType = "image/webp";
      } else {
        b64data = image;
      }

      const prompt = `Look carefully at this portfolio/brokerage screenshot. It contains a TABLE with MULTIPLE rows of stock holdings.

IMPORTANT: Extract EVERY SINGLE ROW from the table. There are many holdings — do NOT stop at just one.

Read each row and output a JSON array. Each row becomes one object with these fields:
- "symbol": the stock ticker symbol (uppercase, e.g. "AAPL", "MSFT", "GOOGL"). Look in the first column or the column labeled Symbol/Ticker/Description. If a description like "APPLE INC" is shown, convert it to the ticker symbol.
- "qty": number of shares (look for columns like Quantity, Shares, Qty). For cash/money market, use the dollar amount.
- "cost": total cost basis in dollars (look for Cost Basis column). Use 0 if not shown.
- "last": last/current price per share (look for Last Price, Price, Current Price). Use 0 if not shown.
- "value": current market value (look for Market Value, Current Value). Use 0 if not shown.

Rules:
- Extract ALL rows, not just the first one
- For cash or money market funds (FDRXX, SPAXX, etc.), set symbol to the fund ticker
- If you see a row labeled just "Cash" or "CASH", use symbol "CASH" and set qty AND value to the dollar amount shown, last=1, cost=0
- Skip header rows, total rows, and empty rows
- Return ONLY a valid JSON array, no explanation text

Example output format:
[{"symbol":"AAPL","qty":100,"cost":15000,"last":175.50,"value":17550},{"symbol":"MSFT","qty":50,"cost":8000,"last":320.00,"value":16000}]`;

      const errorsLog: string[] = [];

      // Try Anthropic Claude API
      const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
      if (anthropicKey) {
        try {
          console.log("[Scan] Trying Anthropic Claude API");
          const { default: axios } = await import("axios");
          const resp = await axios.post("https://api.anthropic.com/v1/messages", {
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: contentType, data: b64data } },
                { type: "text", text: prompt },
              ]
            }]
          }, {
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            timeout: 120000,
          });

          const content = resp.data?.content?.[0]?.text || "";
          console.log(`[Scan] Claude response (first 300 chars): ${content.slice(0, 300)}`);
          const holdings = parseScanResponse(content);
          if (holdings.length) {
            return res.json({ holdings, method: "anthropic/claude-sonnet", raw: content });
          }
          errorsLog.push("Claude API: parsed 0 holdings");
        } catch (e: any) {
          errorsLog.push(`Claude API: ${e.message}`);
          console.warn(`[Scan] Claude API failed: ${e.message}`);
        }
      } else {
        errorsLog.push("No ANTHROPIC_API_KEY set");
      }

      const errorDetail = errorsLog.join("; ") || "No models tried";
      return res.json({ holdings: [], error: `Vision scan failed. Details: ${errorDetail}` });
    } catch (error: any) {
      console.error("Error scanning portfolio image:", error);
      res.status(500).json({ error: "Failed to scan portfolio image" });
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
      // Convert tradeDate string to Date object if needed (Zod expects Date for timestamp fields)
      const body = { ...req.body, userId: 1 };
      if (body.tradeDate && typeof body.tradeDate === "string") {
        body.tradeDate = new Date(body.tradeDate);
      }
      // Coerce numeric fields to strings (schema expects strings) — defensive safeguard
      if (typeof body.shares === "number") body.shares = String(body.shares);
      if (typeof body.price === "number") body.price = String(body.price);
      if (typeof body.totalValue === "number") body.totalValue = String(body.totalValue);
      const data = insertTradeJournalEntrySchema.parse(body);
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
      const body = { ...req.body };
      if (body.tradeDate && typeof body.tradeDate === "string") {
        body.tradeDate = new Date(body.tradeDate);
      }
      if (typeof body.shares === "number") body.shares = String(body.shares);
      if (typeof body.price === "number") body.price = String(body.price);
      if (typeof body.totalValue === "number") body.totalValue = String(body.totalValue);
      const entry = await storage.updateTradeJournalEntry(id, body);
      res.json(entry);
    } catch (error) {
      console.error(`Error updating trade journal entry ${req.params.id}:`, error);
      res.status(500).json({ message: `Error updating trade journal entry ${req.params.id}` });
    }
  });

  // Delete all trade journal entries (or filtered by portfolioId)
  app.delete("/api/journal", async (req, res) => {
    try {
      const userId = 1;
      const entries = await storage.getTradeJournalEntriesByUserId(userId);
      const rawPid = req.query.portfolioId as string | undefined;
      // "null" (literal string) → unassigned filter (portfolioId === null)
      // "123"                   → specific portfolio
      // missing                 → all entries
      const portfolioId =
        rawPid === undefined ? undefined :
        rawPid === "null" ? null :
        parseInt(rawPid);
      const toDelete =
        portfolioId === undefined ? entries :
        entries.filter(e => (e.portfolioId ?? null) === portfolioId);
      for (const entry of toDelete) {
        await storage.deleteTradeJournalEntry(entry.id);
      }
      res.json({ deleted: toDelete.length });
    } catch (error) {
      console.error("Error deleting all journal entries:", error);
      res.status(500).json({ message: "Error deleting journal entries" });
    }
  });

  // Bulk reassign trade journal entries to a portfolio
  // Body: { toPortfolioId: number | null, fromPortfolioId?: number | null }
  // If fromPortfolioId is provided, only entries currently matching it are moved (null = unassigned).
  // If omitted, ALL entries for the user are moved to toPortfolioId.
  app.patch("/api/journal/bulk-assign", async (req, res) => {
    try {
      const userId = 1;
      const toPortfolioId = req.body.toPortfolioId === null || req.body.toPortfolioId === undefined
        ? null
        : Number(req.body.toPortfolioId);
      const hasFromFilter = Object.prototype.hasOwnProperty.call(req.body, "fromPortfolioId");
      const fromPortfolioId = hasFromFilter
        ? (req.body.fromPortfolioId === null ? null : Number(req.body.fromPortfolioId))
        : undefined;

      const entries = await storage.getTradeJournalEntriesByUserId(userId);
      const toUpdate = hasFromFilter
        ? entries.filter(e => (e.portfolioId ?? null) === fromPortfolioId)
        : entries;

      for (const entry of toUpdate) {
        await storage.updateTradeJournalEntry(entry.id, { portfolioId: toPortfolioId });
      }
      res.json({ updated: toUpdate.length });
    } catch (error) {
      console.error("Error bulk-assigning journal entries:", error);
      res.status(500).json({ message: "Error bulk-assigning journal entries" });
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

  // ============================================
  // TRADE JOURNAL IMAGE SCAN
  // ============================================

  app.post("/api/journal/scan", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      let b64data: string;
      let contentType = "image/png";
      if (image.includes(",")) {
        const [header, data] = image.split(",", 2);
        b64data = data;
        if (header.includes("jpeg") || header.includes("jpg")) contentType = "image/jpeg";
        else if (header.includes("webp")) contentType = "image/webp";
      } else {
        b64data = image;
      }

      const prompt = `Look carefully at this trade history/order fill screenshot from a brokerage. It contains a TABLE with MULTIPLE rows of executed trades.

IMPORTANT: Extract EVERY SINGLE ROW from the table. There are many trades — do NOT stop at just one.

Read each row and output a JSON array. Each row becomes one object with these fields:
- "symbol": the stock ticker symbol (uppercase, e.g. "AAPL", "MSFT")
- "action": either "buy" or "sell" (look for columns like Side, Action, B/S, Buy/Sell)
- "shares": number of shares traded
- "price": price per share
- "totalValue": total dollar value of the trade (shares × price). Calculate if not shown.
- "tradeDate": the date of the trade in YYYY-MM-DD format

Rules:
- Extract ALL rows, not just the first one
- Convert date formats to YYYY-MM-DD (e.g. "03/15/2024" → "2024-03-15")
- If action is "BOT" or "BUY" or "B", set action to "buy"
- If action is "SLD" or "SELL" or "S", set action to "sell"
- Skip header rows, total rows, and empty rows
- Return ONLY a valid JSON array, no explanation text

Example output:
[{"symbol":"AAPL","action":"buy","shares":100,"price":175.50,"totalValue":17550,"tradeDate":"2024-03-15"},{"symbol":"MSFT","action":"sell","shares":50,"price":420.00,"totalValue":21000,"tradeDate":"2024-03-14"}]`;

      const errorsLog: string[] = [];

      const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
      if (anthropicKey) {
        try {
          console.log("[Trade Scan] Trying Anthropic Claude API");
          const { default: axios } = await import("axios");
          const resp = await axios.post("https://api.anthropic.com/v1/messages", {
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: contentType, data: b64data } },
                { type: "text", text: prompt },
              ]
            }]
          }, {
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            timeout: 120000,
          });

          const content = resp.data?.content?.[0]?.text || "";
          console.log(`[Trade Scan] Claude response (first 300 chars): ${content.slice(0, 300)}`);

          // Parse the response
          let trades: any[] = [];
          try {
            const parsed = JSON.parse(content.trim());
            trades = Array.isArray(parsed) ? parsed : [];
          } catch {
            const match = content.match(/\[[\s\S]*\]/);
            if (match) {
              try { trades = JSON.parse(match[0]); } catch {}
            }
          }

          // Normalize trades
          trades = trades.filter(t => t && (t.symbol || t.ticker)).map(t => ({
            symbol: (t.symbol || t.ticker || "").toUpperCase().trim(),
            action: (t.action || t.side || "buy").toLowerCase().includes("sell") ||
                    (t.action || t.side || "").toLowerCase() === "sld" ||
                    (t.action || t.side || "").toLowerCase() === "s" ? "sell" : "buy",
            shares: String(parseFloat(t.shares || t.qty || t.quantity || 0)),
            price: String(parseFloat(t.price || t.last || 0)),
            totalValue: String(parseFloat(t.totalValue || t.total || t.value || 0) ||
                        (parseFloat(t.shares || t.qty || 0) * parseFloat(t.price || 0))),
            tradeDate: t.tradeDate || t.date || t.trade_date || new Date().toISOString().split("T")[0],
          }));

          if (trades.length) {
            return res.json({ trades, method: "anthropic/claude-sonnet" });
          }
          errorsLog.push("Claude API: parsed 0 trades from response");
        } catch (e: any) {
          errorsLog.push(`Claude API: ${e.message}`);
          console.warn(`[Trade Scan] Claude API failed: ${e.message}`);
        }
      } else {
        errorsLog.push("No ANTHROPIC_API_KEY set");
      }

      const errorDetail = errorsLog.join("; ");
      return res.json({ trades: [], error: `Trade scan failed. ${errorDetail}` });
    } catch (error: any) {
      console.error("Error scanning trade image:", error);
      res.status(500).json({ error: "Failed to scan trade image" });
    }
  });

  // ============================================
  // TRADE JOURNAL TEXT PASTE IMPORT
  // ============================================

  app.post("/api/journal/paste", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "No text provided" });
      }

      const prompt = `You are parsing pasted account history from a brokerage (e.g. Interactive Brokers, Charles Schwab, Fidelity). Extract EVERY transaction from the text below into a JSON array, including stock trades AND cash movements. Do NOT stop at just one or a few.

For each transaction, output an object with these fields:
- "symbol": the stock ticker symbol (uppercase). Use "CASH" for deposits/withdrawals/transfers/dividends/interest.
- "action": one of "buy", "sell", "deposit", "withdrawal"
- "shares": number of shares, OR the dollar amount for cash entries (use absolute value)
- "price": price per share (use 1 for cash entries)
- "totalValue": total dollar value. Calculate as shares × price if not explicit.
- "tradeDate": the trade/transaction date in YYYY-MM-DD format

Classification rules for action:
- Stock buys: "BOT", "BUY", "B", "Buy" → "buy"
- Stock sells: "SLD", "SELL", "S", "Sell" → "sell"
- Cash IN (symbol=CASH): deposits, incoming transfers, wire in, ACH in, "MoneyLink Deposit", "Journaled Shares In", dividends, interest received, credits → "deposit"
- Cash OUT (symbol=CASH): withdrawals, outgoing transfers, wire out, ACH out, checks written, fees, debits → "withdrawal"
- Negative quantity typically means "sell" for stocks, or "withdrawal" for cash
- Positive usually means "buy" or "deposit"

Other rules:
- Extract ALL transactions in the text, not just the first few
- Convert any date format to YYYY-MM-DD
- Skip headers, column labels, subtotals, summary/total rows, balances, and non-transaction lines
- Skip currency-conversion rows (symbol like "USD.CAD") unless explicitly trades
- For cash entries, the "shares" field should be the dollar amount, "price" should be 1
- Return ONLY a valid JSON array. No markdown code fences, no explanation text.

Text to parse:
"""
${text}
"""`;

      const errorsLog: string[] = [];
      const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
      if (!anthropicKey) {
        return res.json({ trades: [], error: "No ANTHROPIC_API_KEY set on the server" });
      }

      try {
        console.log(`[Trade Paste] Sending ${text.length} chars to Claude`);
        const { default: axios } = await import("axios");
        const resp = await axios.post("https://api.anthropic.com/v1/messages", {
          model: "claude-sonnet-4-20250514",
          max_tokens: 16384,
          messages: [{
            role: "user",
            content: [{ type: "text", text: prompt }]
          }]
        }, {
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          timeout: 120000,
        });

        const content = resp.data?.content?.[0]?.text || "";
        console.log(`[Trade Paste] Claude response (first 300 chars): ${content.slice(0, 300)}`);

        let trades: any[] = [];
        try {
          const parsed = JSON.parse(content.trim());
          trades = Array.isArray(parsed) ? parsed : [];
        } catch {
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            try { trades = JSON.parse(match[0]); } catch {}
          }
        }

        // Normalize
        trades = trades.filter(t => t && (t.symbol || t.ticker)).map(t => {
          const rawQty = parseFloat(t.shares || t.qty || t.quantity || 0);
          const qtyIsNegative = rawQty < 0;
          const actionRaw = (t.action || t.side || "").toLowerCase();
          const symbolRaw = (t.symbol || t.ticker || "").toUpperCase().trim();
          const isCashEntry =
            symbolRaw === "CASH" || symbolRaw === "USD" ||
            actionRaw === "deposit" || actionRaw.includes("withdraw");

          let action: string;
          if (isCashEntry) {
            // Cash flow: deposit (in) or withdrawal (out)
            if (actionRaw === "deposit" || (!qtyIsNegative && !actionRaw.includes("withdraw"))) {
              action = "deposit";
            } else {
              action = "withdrawal";
            }
          } else {
            const isSell = actionRaw.includes("sell") || actionRaw === "sld" || actionRaw === "s" || qtyIsNegative;
            action = isSell ? "sell" : "buy";
          }

          const shares = Math.abs(rawQty);
          const price = parseFloat(t.price || t.last || (isCashEntry ? 1 : 0));
          return {
            symbol: isCashEntry ? "CASH" : symbolRaw,
            action,
            shares: String(shares),
            price: String(price || (isCashEntry ? 1 : 0)),
            totalValue: String(parseFloat(t.totalValue || t.total || t.value || 0) || (shares * (price || 1))),
            tradeDate: t.tradeDate || t.date || t.trade_date || new Date().toISOString().split("T")[0],
          };
        });

        console.log(`[Trade Paste] Parsed ${trades.length} trades`);
        return res.json({ trades, method: "anthropic/claude-sonnet" });
      } catch (e: any) {
        errorsLog.push(`Claude API: ${e.message}`);
        console.warn(`[Trade Paste] Claude API failed: ${e.message}`);
        return res.json({ trades: [], error: `Paste parse failed: ${errorsLog.join("; ")}` });
      }
    } catch (error: any) {
      console.error("Error parsing pasted trades:", error);
      res.status(500).json({ error: "Failed to parse pasted trades" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
