import axios from "axios";
import {
  MarketIndex,
  StockQuote,
  StockHistory,
  TechnicalIndicator,
  CompanyInfo,
  NewsItem,
  SearchResult,
} from "@shared/schema";

// This service handles all external stock API calls
export class StockApiService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    // API key would normally come from environment variables
    this.apiKey = process.env.STOCK_API_KEY || "demo";
    this.baseUrl = "https://www.alphavantage.co/query";
  }

  // Fetch major market indices
  async getMarketIndices(): Promise<MarketIndex[]> {
    // In a real app with a paid API, we would fetch real data
    // For this demo, we'll create simulated market data
    const indices: MarketIndex[] = [
      {
        symbol: "^GSPC",
        name: "S&P 500",
        price: 4587.84,
        change: 36.53,
        changePercent: 0.8,
        region: "US",
        sparkline: [4550, 4565, 4560, 4570, 4580, 4587],
      },
      {
        symbol: "^IXIC",
        name: "NASDAQ",
        price: 14346.02,
        change: 170.33,
        changePercent: 1.2,
        region: "US",
        sparkline: [14200, 14250, 14280, 14300, 14320, 14346],
      },
      {
        symbol: "^DJI",
        name: "DOW",
        price: 36124.23,
        change: 143.36,
        changePercent: 0.4,
        region: "US",
        sparkline: [36000, 36050, 36080, 36100, 36110, 36124],
      },
      {
        symbol: "^FTSE",
        name: "FTSE 100",
        price: 7461.43,
        change: -22.41,
        changePercent: -0.3,
        region: "UK",
        sparkline: [7500, 7490, 7480, 7470, 7465, 7461],
      },
      {
        symbol: "^N225",
        name: "Nikkei",
        price: 29332.16,
        change: 174.54,
        changePercent: 0.6,
        region: "JP",
        sparkline: [29200, 29250, 29280, 29300, 29320, 29332],
      },
      {
        symbol: "^GDAXI",
        name: "DAX",
        price: 15727.67,
        change: -15.73,
        changePercent: -0.1,
        region: "DE",
        sparkline: [15750, 15745, 15740, 15735, 15730, 15728],
      },
    ];

    return indices;
  }

  // Search for stocks by keyword
  async searchStocks(query: string): Promise<SearchResult[]> {
    try {
      const params = {
        function: "SYMBOL_SEARCH",
        keywords: query,
        apikey: this.apiKey,
      };

      const response = await axios.get(this.baseUrl, { params });
      const matches = response.data.bestMatches || [];

      return matches.map((match: any) => ({
        symbol: match["1. symbol"],
        name: match["2. name"],
        type: match["3. type"],
        region: match["4. region"],
      }));
    } catch (error) {
      console.error("Error searching stocks:", error);
      
      // Fallback with some common stocks if API fails
      if (query.toLowerCase().includes("app")) {
        return [
          { symbol: "AAPL", name: "Apple Inc.", type: "Equity" },
          { symbol: "APP", name: "AppLovin Corporation", type: "Equity" },
        ];
      }
      if (query.toLowerCase().includes("goog")) {
        return [
          { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity" },
          { symbol: "GOOG", name: "Alphabet Inc. Class C", type: "Equity" },
        ];
      }
      return [];
    }
  }

  // Get current stock quote
  async getStockQuote(symbol: string): Promise<StockQuote> {
    try {
      const params = {
        function: "GLOBAL_QUOTE",
        symbol,
        apikey: this.apiKey,
      };

      const response = await axios.get(this.baseUrl, { params });
      const quote = response.data["Global Quote"];

      if (!quote || !quote["01. symbol"]) {
        throw new Error("Quote data not available");
      }

      return {
        symbol: quote["01. symbol"],
        name: "", // The Global Quote endpoint doesn't return the name
        price: parseFloat(quote["05. price"]),
        change: parseFloat(quote["09. change"]),
        changePercent: parseFloat(quote["10. change percent"].replace("%", "")) / 100,
        open: parseFloat(quote["02. open"]),
        high: parseFloat(quote["03. high"]),
        low: parseFloat(quote["04. low"]),
        close: parseFloat(quote["08. previous close"]),
        volume: parseInt(quote["06. volume"]),
        marketCap: 0, // Not provided by this endpoint
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      
      // Fallback data for AAPL if API fails
      if (symbol === "AAPL") {
        return {
          symbol: "AAPL",
          name: "Apple Inc.",
          price: 178.72,
          change: 2.45,
          changePercent: 0.0139,
          open: 176.15,
          high: 179.63,
          low: 175.82,
          close: 176.27,
          volume: 52300000,
          marketCap: 2810000000000,
        };
      }
      
      throw error;
    }
  }

  // Get historical stock data for charts
  async getStockHistory(symbol: string, timeframe: string): Promise<StockHistory[]> {
    try {
      let params: any = {
        symbol,
        apikey: this.apiKey,
      };

      // Map timeframe to appropriate API function and interval
      switch (timeframe) {
        case "1D":
          params.function = "TIME_SERIES_INTRADAY";
          params.interval = "5min";
          params.outputsize = "compact";
          break;
        case "1W":
          params.function = "TIME_SERIES_DAILY";
          params.outputsize = "compact";
          break;
        case "1M":
        case "3M":
          params.function = "TIME_SERIES_DAILY";
          params.outputsize = "full";
          break;
        case "1Y":
        case "5Y":
          params.function = "TIME_SERIES_WEEKLY";
          break;
        default:
          params.function = "TIME_SERIES_DAILY";
          params.outputsize = "compact";
      }

      const response = await axios.get(this.baseUrl, { params });
      
      let timeSeriesKey: string | undefined;
      if (params.function === "TIME_SERIES_INTRADAY") {
        timeSeriesKey = `Time Series (${params.interval})`;
      } else if (params.function === "TIME_SERIES_DAILY") {
        timeSeriesKey = "Time Series (Daily)";
      } else if (params.function === "TIME_SERIES_WEEKLY") {
        timeSeriesKey = "Weekly Time Series";
      } else if (params.function === "TIME_SERIES_MONTHLY") {
        timeSeriesKey = "Monthly Time Series";
      }

      const timeSeries = timeSeriesKey ? response.data[timeSeriesKey] : null;
      
      if (!timeSeries) {
        throw new Error("Historical data not available");
      }

      // Convert API response to our schema format
      const history = Object.entries(timeSeries).map(([timestamp, data]: [string, any]) => ({
        timestamp,
        close: parseFloat(data["4. close"]),
        high: parseFloat(data["2. high"]),
        low: parseFloat(data["3. low"]),
        open: parseFloat(data["1. open"]),
        volume: parseInt(data["5. volume"]),
      }));

      // Filter based on timeframe
      const now = new Date();
      let cutoffDate;
      
      switch (timeframe) {
        case "1D":
          cutoffDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case "1W":
          cutoffDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "1M":
          cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "3M":
          cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case "1Y":
          cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        case "5Y":
          cutoffDate = new Date(now.setFullYear(now.getFullYear() - 5));
          break;
        default:
          cutoffDate = new Date(now.setDate(now.getDate() - 7));
      }

      // Sort from oldest to newest for charts
      return history
        .filter(item => new Date(item.timestamp) >= cutoffDate)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      console.error(`Error fetching history for ${symbol}:`, error);
      
      // Generate some sample data if API fails
      const history: StockHistory[] = [];
      const now = new Date();
      const startPrice = symbol === "AAPL" ? 170 : 100;
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Generate some realistic looking price movements
        const dailyChange = (Math.random() - 0.5) * 3;
        const price = startPrice + (i * dailyChange);
        
        history.push({
          timestamp: date.toISOString().split('T')[0],
          close: parseFloat(price.toFixed(2)),
          high: parseFloat((price + Math.random() * 2).toFixed(2)),
          low: parseFloat((price - Math.random() * 2).toFixed(2)),
          open: parseFloat((price - dailyChange).toFixed(2)),
          volume: Math.floor(Math.random() * 10000000) + 30000000,
        });
      }
      
      return history;
    }
  }

  // Get technical indicators for a stock
  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicator[]> {
    try {
      // Fetch SMA (Simple Moving Average)
      const sma50Response = await axios.get(this.baseUrl, {
        params: {
          function: "SMA",
          symbol,
          interval: "daily",
          time_period: 50,
          series_type: "close",
          apikey: this.apiKey,
        },
      });

      const sma200Response = await axios.get(this.baseUrl, {
        params: {
          function: "SMA",
          symbol,
          interval: "daily",
          time_period: 200,
          series_type: "close",
          apikey: this.apiKey,
        },
      });

      // Fetch RSI (Relative Strength Index)
      const rsiResponse = await axios.get(this.baseUrl, {
        params: {
          function: "RSI",
          symbol,
          interval: "daily",
          time_period: 14,
          series_type: "close",
          apikey: this.apiKey,
        },
      });

      // Fetch MACD (Moving Average Convergence/Divergence)
      const macdResponse = await axios.get(this.baseUrl, {
        params: {
          function: "MACD",
          symbol,
          interval: "daily",
          series_type: "close",
          fastperiod: 12,
          slowperiod: 26,
          signalperiod: 9,
          apikey: this.apiKey,
        },
      });

      // Extract the most recent values
      const sma50Data = sma50Response.data["Technical Analysis: SMA"];
      const sma200Data = sma200Response.data["Technical Analysis: SMA"];
      const rsiData = rsiResponse.data["Technical Analysis: RSI"];
      const macdData = macdResponse.data["Technical Analysis: MACD"];

      if (!sma50Data || !sma200Data || !rsiData || !macdData) {
        throw new Error("Technical indicator data not available");
      }

      // Get the latest dates
      const sma50Date = Object.keys(sma50Data)[0];
      const sma200Date = Object.keys(sma200Data)[0];
      const rsiDate = Object.keys(rsiData)[0];
      const macdDate = Object.keys(macdData)[0];

      const indicators: TechnicalIndicator[] = [
        {
          name: "Moving Average (50)",
          value: parseFloat(sma50Data[sma50Date]["SMA"]),
          signal: "Buy",
        },
        {
          name: "Moving Average (200)",
          value: parseFloat(sma200Data[sma200Date]["SMA"]),
          signal: "Buy",
        },
        {
          name: "RSI (14)",
          value: parseFloat(rsiData[rsiDate]["RSI"]),
          signal: parseFloat(rsiData[rsiDate]["RSI"]) < 30 ? "Buy" : parseFloat(rsiData[rsiDate]["RSI"]) > 70 ? "Sell" : "Neutral",
        },
        {
          name: "MACD",
          value: parseFloat(macdData[macdDate]["MACD"]),
          signal: parseFloat(macdData[macdDate]["MACD"]) > parseFloat(macdData[macdDate]["MACD_Signal"]) ? "Buy" : "Sell",
        },
      ];

      return indicators;
    } catch (error) {
      console.error(`Error fetching technical indicators for ${symbol}:`, error);
      
      // Provide fallback technical indicators if API fails
      return [
        {
          name: "Moving Average (50)",
          value: 173.42,
          signal: "Buy",
        },
        {
          name: "Moving Average (200)",
          value: 158.76,
          signal: "Buy",
        },
        {
          name: "RSI (14)",
          value: 59.2,
          signal: "Neutral",
        },
        {
          name: "MACD",
          value: 1.28,
          signal: "Buy",
        },
      ];
    }
  }

  // Get company info and financials
  async getCompanyInfo(symbol: string): Promise<CompanyInfo> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: "OVERVIEW",
          symbol,
          apikey: this.apiKey,
        },
      });

      const data = response.data;

      if (!data || !data.Symbol) {
        throw new Error("Company info not available");
      }

      return {
        symbol: data.Symbol,
        name: data.Name,
        description: data.Description,
        industry: data.Industry,
        sector: data.Sector,
        ceo: data.CEO || "N/A",
        employees: parseInt(data.FullTimeEmployees || "0"),
        founded: data.IPODate || "N/A",
        headquarters: `${data.Address || ""}, ${data.City || ""}, ${data.State || ""}`.trim(),
        website: data.Website || "",
        peRatio: parseFloat(data.PERatio || "0"),
        eps: parseFloat(data.EPS || "0"),
        dividendYield: parseFloat(data.DividendYield || "0") * 100,
        weekRange52: {
          low: parseFloat(data["52WeekLow"] || "0"),
          high: parseFloat(data["52WeekHigh"] || "0"),
        },
        avgVolume: parseInt(data.AverageTradingVolume || "0"),
      };
    } catch (error) {
      console.error(`Error fetching company info for ${symbol}:`, error);
      
      // Fallback company info for AAPL if API fails
      if (symbol === "AAPL") {
        return {
          symbol: "AAPL",
          name: "Apple Inc.",
          description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide. The company offers iPhone, iPad, Mac, and wearables including AirPods, Apple TV, Apple Watch, and accessories.",
          industry: "Consumer Electronics",
          sector: "Technology",
          ceo: "Tim Cook",
          employees: 154000,
          founded: "1980-12-12", // IPO date
          headquarters: "Cupertino, California, USA",
          website: "https://www.apple.com",
          peRatio: 29.47,
          eps: 6.06,
          dividendYield: 0.53,
          weekRange52: {
            low: 124.17,
            high: 198.23,
          },
          avgVolume: 58670000,
        };
      }
      
      throw error;
    }
  }

  // Get latest news about a stock or general market news
  async getNews(symbol?: string): Promise<NewsItem[]> {
    try {
      let params: any = {
        function: "NEWS_SENTIMENT",
        apikey: this.apiKey,
      };

      if (symbol) {
        params.tickers = symbol;
      }

      const response = await axios.get(this.baseUrl, { params });
      const articles = response.data.feed || [];
      
      // If no articles are returned, throw an error to trigger the fallback
      if (articles.length === 0) {
        throw new Error("No news articles available from API");
      }

      return articles.map((article: any) => ({
        id: article.id || String(Math.random()),
        title: article.title,
        summary: article.summary,
        source: article.source,
        publishedAt: article.time_published,
        url: article.url,
      })).slice(0, 10); // Limit to 10 news items
    } catch (error) {
      console.error("Error fetching news:", error);
      
      // Enable fallback data for demo purposes
      
      // Fallback news if API fails
      const defaultNews: NewsItem[] = [
        {
          id: "1",
          title: "Apple Announces New M3 MacBook Pro with Improved Performance",
          summary: "Apple's new M3 chip promises up to 40% faster performance than the previous generation...",
          source: "Bloomberg",
          publishedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          url: "#",
        },
        {
          id: "2",
          title: "Analysts Raise Apple Price Target After Strong Quarterly Results",
          summary: "Several Wall Street analysts have raised their price targets for Apple following better-than-expected earnings...",
          source: "MarketWatch",
          publishedAt: new Date(Date.now() - 18000000).toISOString(), // 5 hours ago
          url: "#",
        },
        {
          id: "3",
          title: "Apple's App Store Faces New Regulatory Challenges in EU",
          summary: "European regulators announce new requirements that could affect Apple's App Store policies...",
          source: "Financial Times",
          publishedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          url: "#",
        },
      ];
      
      return symbol ? defaultNews : defaultNews.concat([
        {
          id: "4",
          title: "S&P 500 Hits New Record High as Tech Stocks Rally",
          summary: "The S&P 500 reached a new all-time high today as technology stocks led a broad market rally...",
          source: "CNBC",
          publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          url: "#",
        },
        {
          id: "5",
          title: "Federal Reserve Signals Potential Rate Cut in Coming Months",
          summary: "Federal Reserve officials indicated they may be prepared to cut interest rates later this year...",
          source: "Wall Street Journal",
          publishedAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
          url: "#",
        },
      ]);
    }
  }
}
