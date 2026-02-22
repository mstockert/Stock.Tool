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
import { ibkrApi } from "./ibkrApi";

// This service handles all external stock API calls
export class StockApiService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly ibkrEnabled: boolean;

  constructor() {
    // API key would normally come from environment variables
    this.apiKey = process.env.STOCK_API_KEY || "demo";
    this.baseUrl = "https://www.alphavantage.co/query";
    // Check if IBKR is enabled
    this.ibkrEnabled = process.env.IBKR_ENABLED === "true";

    if (this.ibkrEnabled) {
      console.log("🔗 Interactive Brokers API enabled - will use real-time data from IB Gateway");
    }
  }

  /**
   * Check IBKR connection status
   */
  async getIBKRStatus(): Promise<{ enabled: boolean; authenticated: boolean; connected: boolean; message: string }> {
    if (!this.ibkrEnabled) {
      return {
        enabled: false,
        authenticated: false,
        connected: false,
        message: "IBKR integration is not enabled. Set IBKR_ENABLED=true in .env to enable.",
      };
    }

    const status = await ibkrApi.checkAuthStatus();
    return {
      enabled: true,
      ...status,
    };
  }

  // Fetch major market indices
  // Helper function to get timeframe-specific market data
  // This is used by both getMarketIndices and getMarketIndexHistory
  private getTimeframeSensitiveMarketData(timeframe: string): MarketIndex[] {
    // Base market data - changePercent is already in percentage form (0.8 = 0.8%)
    let baseIndices = [
      {
        symbol: "^GSPC",
        name: "S&P 500",
        price: 4587.84,
        change: 36.53,
        changePercent: 0.8,
        region: "US",
        sparkline: [4520, 4535, 4550, 4540, 4560, 4555, 4570, 4565, 4580, 4575, 4590, 4587],
      },
      {
        symbol: "^IXIC",
        name: "NASDAQ",
        price: 14346.02,
        change: 170.33,
        changePercent: 1.2,
        region: "US",
        sparkline: [14150, 14180, 14200, 14220, 14250, 14230, 14280, 14300, 14290, 14320, 14340, 14346],
      },
      {
        symbol: "^DJI",
        name: "DOW",
        price: 36124.23,
        change: 143.36,
        changePercent: 0.4,
        region: "US",
        sparkline: [35950, 35980, 36000, 36020, 36050, 36030, 36080, 36060, 36100, 36090, 36110, 36124],
      },
      {
        symbol: "^FTSE",
        name: "FTSE 100",
        price: 7461.43,
        change: -22.41,
        changePercent: -0.3,
        region: "UK",
        sparkline: [7490, 7485, 7500, 7495, 7480, 7485, 7475, 7470, 7465, 7468, 7460, 7461],
      },
      {
        symbol: "^N225",
        name: "Nikkei",
        price: 29332.16,
        change: 174.54,
        changePercent: 0.6,
        region: "JP",
        sparkline: [29150, 29180, 29200, 29220, 29250, 29230, 29280, 29260, 29300, 29290, 29320, 29332],
      },
      {
        symbol: "^GDAXI",
        name: "DAX",
        price: 15727.67,
        change: -15.73,
        changePercent: -0.1,
        region: "DE",
        sparkline: [15745, 15750, 15740, 15745, 15735, 15738, 15730, 15735, 15728, 15732, 15725, 15728],
      },
    ];
    
    // Generate realistic sparkline data with more data points
    const generateSparkline = (basePrice: number, changePercent: number, points: number = 12) => {
      const data: number[] = [];
      const trend = changePercent > 0 ? 1 : -1;
      const volatility = Math.abs(changePercent) * 0.3;

      // Start from a point that will end near the current price
      let price = basePrice * (1 - (changePercent / 100));

      for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        const trendComponent = (changePercent / 100) * progress * basePrice;
        const noise = (Math.random() - 0.5) * volatility * basePrice * 0.01;
        price = basePrice * (1 - (changePercent / 100)) + trendComponent + noise;
        data.push(parseFloat(price.toFixed(2)));
      }

      // Ensure last point is close to current price
      data[data.length - 1] = basePrice;
      return data;
    };

    // Create data sets for each timeframe with realistic percentage changes
    const getTimeframeData = (index: any, timeframe: string) => {
      // Keep price the same, just vary the change percent based on timeframe
      switch (timeframe) {
        case "1D":
          return {
            ...index,
            sparkline: generateSparkline(index.price, index.changePercent, 12),
          };
        case "1W":
          const weekChange = parseFloat((index.changePercent * 2.5).toFixed(2));
          return {
            ...index,
            change: parseFloat((index.change * 2.5).toFixed(2)),
            changePercent: weekChange,
            sparkline: generateSparkline(index.price, weekChange, 14),
          };
        case "1M":
          const monthChange = parseFloat((index.changePercent * 4).toFixed(2));
          return {
            ...index,
            change: parseFloat((index.change * 4).toFixed(2)),
            changePercent: monthChange,
            sparkline: generateSparkline(index.price, monthChange, 20),
          };
        case "3M":
          const quarterChange = parseFloat((index.changePercent * 8).toFixed(2));
          return {
            ...index,
            change: parseFloat((index.change * 8).toFixed(2)),
            changePercent: quarterChange,
            sparkline: generateSparkline(index.price, quarterChange, 24),
          };
        case "1Y":
          const yearChange = parseFloat((index.changePercent * 15).toFixed(2));
          return {
            ...index,
            change: parseFloat((index.change * 15).toFixed(2)),
            changePercent: yearChange,
            sparkline: generateSparkline(index.price, yearChange, 30),
          };
        default:
          return index;
      }
    };

    // Get the right data set based on timeframe
    return baseIndices.map(index => getTimeframeData(index, timeframe));
  }

  async getMarketIndices(timeframe: string = "1D"): Promise<MarketIndex[]> {
    // In a real app with a paid API, we would fetch real data
    // For this demo, we'll create simulated market data with different 
    // values based on the timeframe
    
    console.log(`⚡ getMarketIndices called with timeframe: ${timeframe}`);
    
    // Get data for the requested timeframe
    const indices = this.getTimeframeSensitiveMarketData(timeframe);
    
    // Log it for debugging
    console.log(`Generated market indices for timeframe ${timeframe}:`, 
      indices.map(idx => `${idx.name}: ${idx.price.toFixed(2)} (${(idx.changePercent * 100).toFixed(1)}%)`).join(', ')
    );

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
      // For market indices, use the market index data
      if (symbol.startsWith('^')) {
        return await this.getMarketIndexQuote(symbol);
      }

      // Try IBKR first if enabled
      if (this.ibkrEnabled) {
        const ibkrQuote = await ibkrApi.getStockQuote(symbol);
        if (ibkrQuote) {
          console.log(`✅ IBKR quote for ${symbol}: $${ibkrQuote.price}`);
          return ibkrQuote;
        }
        console.log(`⚠️ IBKR quote failed for ${symbol}, falling back to Alpha Vantage`);
      }

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
      
      // For market indices, use special data if API fails
      if (symbol.startsWith('^')) {
        return await this.getMarketIndexQuote(symbol);
      }
      
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
  
  // Generate quote data for market indices
  private async getMarketIndexQuote(symbol: string): Promise<StockQuote> {
    // First get the index from our market data function with 1D timeframe
    const indices = await this.getMarketIndices("1D");
    const index = indices.find((idx: MarketIndex) => idx.symbol === symbol);
    
    if (index) {
      return {
        symbol: index.symbol,
        name: index.name,
        price: index.price,
        change: index.change,
        changePercent: index.changePercent,
        open: index.price - (index.change * 0.8),
        high: index.price + (Math.abs(index.change) * 0.2),
        low: index.price - (Math.abs(index.change) * 0.3),
        close: index.price - index.change,
        volume: Math.floor(Math.random() * 500000000) + 300000000,
        marketCap: 0, // Not applicable for indices
      };
    }
    
    // Fallback data if the symbol is not found in our indices
    switch (symbol) {
      case "^GSPC": // S&P 500
        return {
          symbol: "^GSPC",
          name: "S&P 500",
          price: 4587.84,
          change: 36.53,
          changePercent: 0.008,
          open: 4551.31,
          high: 4590.24,
          low: 4549.85,
          close: 4551.31,
          volume: 3800000000,
          marketCap: 0,
        };
      case "^IXIC": // NASDAQ
        return {
          symbol: "^IXIC",
          name: "NASDAQ Composite",
          price: 14346.02,
          change: 170.33,
          changePercent: 0.012,
          open: 14175.69,
          high: 14352.45,
          low: 14160.32,
          close: 14175.69,
          volume: 5200000000,
          marketCap: 0,
        };
      default:
        // Generic index data
        return {
          symbol: symbol,
          name: "Market Index",
          price: 1000.00,
          change: 5.00,
          changePercent: 0.005,
          open: 995.00,
          high: 1002.50,
          low: 994.00,
          close: 995.00,
          volume: 1000000000,
          marketCap: 0,
        };
    }
  }

  // Get historical stock data for charts
  async getStockHistory(symbol: string, timeframe: string): Promise<StockHistory[]> {
    try {
      // Check if this is a market index symbol (starts with ^)
      if (symbol.startsWith('^')) {
        return this.getMarketIndexHistory(symbol, timeframe);
      }

      // Try IBKR first if enabled
      if (this.ibkrEnabled) {
        const ibkrHistory = await ibkrApi.getStockHistory(symbol, timeframe);
        if (ibkrHistory && ibkrHistory.length > 0) {
          console.log(`✅ IBKR history for ${symbol}: ${ibkrHistory.length} bars`);
          return ibkrHistory;
        }
        console.log(`⚠️ IBKR history failed for ${symbol}, falling back to Alpha Vantage`);
      }

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
      
      // If it's a market index, use the special method
      if (symbol.startsWith('^')) {
        return this.getMarketIndexHistory(symbol, timeframe);
      }
      
      // Generate some sample data if API fails
      const history: StockHistory[] = [];
      const now = new Date();
      const startPrice = symbol === "AAPL" ? 178 : symbol === "MSFT" ? 415 : symbol === "GOOGL" ? 175 : symbol === "AMZN" ? 185 : symbol === "NVDA" ? 125 : symbol === "META" ? 510 : symbol === "TSLA" ? 245 : 100;

      if (timeframe === "1D") {
        // Generate intraday data with 30-minute intervals up to current time
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
        const marketCloseMinutes = 16 * 60; // 4:00 PM

        // Calculate number of data points based on current time
        let dataPoints: number;
        if (currentTimeInMinutes < marketOpenMinutes) {
          dataPoints = 1; // Before market open
        } else if (currentTimeInMinutes >= marketCloseMinutes) {
          dataPoints = 13; // After market close - full day
        } else {
          const elapsedMinutes = currentTimeInMinutes - marketOpenMinutes;
          dataPoints = Math.max(1, Math.floor(elapsedMinutes / 30) + 1);
        }

        let currentPrice = startPrice * 0.995; // Start slightly below current price

        for (let i = 0; i < dataPoints; i++) {
          // Calculate time: 9:30 AM + i * 30 minutes
          const minutesFromMidnight = 570 + (i * 30);
          const hours = Math.floor(minutesFromMidnight / 60);
          const minutes = minutesFromMidnight % 60;

          // Format timestamp
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hoursStr = String(hours).padStart(2, '0');
          const minutesStr = String(minutes).padStart(2, '0');
          const timestamp = `${year}-${month}-${day} ${hoursStr}:${minutesStr}:00`;

          // Generate realistic price movement
          const change = (Math.random() - 0.48) * startPrice * 0.003; // Slight upward bias
          currentPrice = currentPrice + change;

          history.push({
            timestamp,
            close: parseFloat(currentPrice.toFixed(2)),
            high: parseFloat((currentPrice + Math.random() * 0.5).toFixed(2)),
            low: parseFloat((currentPrice - Math.random() * 0.5).toFixed(2)),
            open: parseFloat((currentPrice - change).toFixed(2)),
            volume: Math.floor(Math.random() * 10000000) + 30000000,
          });
        }
      } else {
        // Generate daily data for other timeframes
        const days = timeframe === "1W" ? 7 : timeframe === "1M" ? 30 : timeframe === "3M" ? 90 : 365;
        let currentPrice = startPrice * (1 - 0.001 * days / 10); // Start lower and trend up

        for (let i = days; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);

          // Generate realistic looking price movements
          const dailyChange = (Math.random() - 0.48) * startPrice * 0.01;
          currentPrice = currentPrice + dailyChange;

          history.push({
            timestamp: date.toISOString().split('T')[0],
            close: parseFloat(currentPrice.toFixed(2)),
            high: parseFloat((currentPrice + Math.random() * 2).toFixed(2)),
            low: parseFloat((currentPrice - Math.random() * 2).toFixed(2)),
            open: parseFloat((currentPrice - dailyChange).toFixed(2)),
            volume: Math.floor(Math.random() * 10000000) + 30000000,
          });
        }
      }

      return history;
    }
  }
  
  // Generate simulated historical data for market indices with different patterns for each timeframe
  private getMarketIndexHistory(symbol: string, timeframe: string): StockHistory[] {
    const history: StockHistory[] = [];
    const now = new Date();
    
    console.log(`Generating market index history for ${symbol} with timeframe ${timeframe}`);
    
    // Set base parameters based on the market index
    let basePrice: number;
    let volatility: number;
    let trend: number;
    
    // Get base price from getMarketIndices for the given timeframe
    // This ensures the price is consistent with what's shown in the market overview
    let baseIndices = this.getTimeframeSensitiveMarketData(timeframe);
    let indexData = baseIndices.find(idx => idx.symbol === symbol);
    
    if (indexData) {
      basePrice = indexData.price;
      // Trend should match the direction of changePercent
      trend = indexData.changePercent >= 0 ? 0.002 : -0.002;
      volatility = Math.abs(indexData.changePercent * 0.1) + 0.005;
      
      console.log(`Using timeframe-specific data for ${symbol}: price=${basePrice}, trend=${trend}, volatility=${volatility}`);
    } else {
      // Fallback if index not found
      switch (symbol) {
        case "^GSPC": // S&P 500
          basePrice = 4587.84;
          volatility = 0.005;
          trend = 0.002;
          break;
        case "^IXIC": // NASDAQ
          basePrice = 14346.02;
          volatility = 0.008;
          trend = 0.003;
          break;
        case "^DJI": // DOW
          basePrice = 36124.23;
          volatility = 0.004;
          trend = 0.001;
          break;
        case "^FTSE": // FTSE 100
          basePrice = 7461.43;
          volatility = 0.006;
          trend = -0.001;
          break;
        case "^N225": // Nikkei
          basePrice = 29332.16;
          volatility = 0.007;
          trend = 0.002;
          break;
        case "^GDAXI": // DAX
          basePrice = 15727.67;
          volatility = 0.006;
          trend = -0.0005;
          break;
        default:
          basePrice = 100;
          volatility = 0.005;
          trend = 0.001;
      }
    }
    
    // Adjust parameters based on timeframe to create visibly different charts
    let dataPoints: number;
    let dateDelta: (date: Date, i: number) => Date;
    
    switch (timeframe) {
      case "1D":
        // Trading hours: 9:30 AM - 4:00 PM (6.5 hours)
        // Calculate how many 30-minute intervals have passed since market open
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM = 570 minutes
        const marketCloseMinutes = 16 * 60; // 4:00 PM = 960 minutes

        // Calculate elapsed trading minutes (capped at market hours)
        let elapsedMinutes = currentTimeInMinutes - marketOpenMinutes;

        if (currentTimeInMinutes < marketOpenMinutes) {
          // Before market open - show previous day's data or minimal data
          elapsedMinutes = 0;
          dataPoints = 1;
        } else if (currentTimeInMinutes >= marketCloseMinutes) {
          // After market close - show full day
          elapsedMinutes = marketCloseMinutes - marketOpenMinutes;
          dataPoints = Math.floor(elapsedMinutes / 30) + 1; // 13 points for full day
        } else {
          // During market hours - show up to current time
          dataPoints = Math.max(1, Math.floor(elapsedMinutes / 30) + 1);
        }

        console.log(`Generating 1D data with ${dataPoints} points (current time: ${currentHour}:${currentMinute})`);

        dateDelta = (date, i) => {
          // Create timestamps for each 30-minute interval starting at 9:30 AM
          const newDate = new Date(date);
          // Set to today's date
          newDate.setHours(0, 0, 0, 0);
          // 9:30 AM = 9 hours + 30 minutes = 570 minutes from midnight
          // Each interval is 30 minutes
          const minutesFromMidnight = 570 + (i * 30);
          const hours = Math.floor(minutesFromMidnight / 60);
          const minutes = minutesFromMidnight % 60;
          newDate.setHours(hours, minutes, 0, 0);
          return newDate;
        };
        break;
      case "1W":
        // Weekly view - 7 days of data ending today
        dataPoints = 7;
        volatility *= 2;
        trend *= 3;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          // Start from 7 days ago, end at today
          newDate.setDate(date.getDate() - (dataPoints - 1 - i));
          return newDate;
        };
        break;
      case "1M":
        // Monthly view - 30 days of data ending today
        dataPoints = 30;
        volatility *= 3;
        trend *= 5;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          // Start from 30 days ago, end at today
          newDate.setDate(date.getDate() - (dataPoints - 1 - i));
          return newDate;
        };
        break;
      case "3M":
        // Quarterly view - 90 days of data ending today (every 2 days)
        dataPoints = 45;
        volatility *= 4;
        trend *= 8;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          // Start from 90 days ago, end at today
          newDate.setDate(date.getDate() - (90 - (i * 2)));
          return newDate;
        };
        break;
      case "1Y":
        // Yearly view - 52 weeks of data ending today
        dataPoints = 52;
        volatility *= 5;
        trend *= 12;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          // Start from 365 days ago, end at today
          newDate.setDate(date.getDate() - (365 - (i * 7)));
          return newDate;
        };
        break;
      case "5Y":
        // 5 Year view - 60 months of data ending today
        dataPoints = 60;
        volatility *= 7;
        trend *= 20;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          // Start from 60 months ago, end at today
          newDate.setMonth(date.getMonth() - (dataPoints - 1 - i));
          return newDate;
        };
        break;
      default:
        dataPoints = 30;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          // Start from 30 days ago, end at today
          newDate.setDate(date.getDate() - (dataPoints - 1 - i));
          return newDate;
        };
    }
    
    // Generate data with appropriate pattern for the timeframe
    // Calculate a reasonable starting price that will trend toward basePrice
    // Use a much smaller adjustment to prevent negative prices
    const trendAdjustment = Math.min(0.1, Math.abs(trend * dataPoints * 0.01)); // Cap at 10%
    let currentPrice = trend >= 0
      ? basePrice * (1 - trendAdjustment)  // Start lower if trending up
      : basePrice * (1 + trendAdjustment); // Start higher if trending down

    for (let i = 0; i < dataPoints; i++) {
      const date = dateDelta(now, i);

      // Use much smaller volatility to prevent wild swings
      const scaledVolatility = Math.min(volatility, 0.02); // Cap volatility at 2%
      const dailyChange = (Math.random() - 0.5) * basePrice * scaledVolatility;
      const trendComponent = (basePrice * trend) / dataPoints; // Spread trend across all points
      currentPrice = currentPrice + dailyChange + trendComponent;

      // Ensure price never goes negative or too far from base price
      currentPrice = Math.max(currentPrice, basePrice * 0.5);
      currentPrice = Math.min(currentPrice, basePrice * 1.5);
      
      // For 1D view, include time in timestamp using local time format
      let timestamp: string;
      if (timeframe === "1D") {
        // Format as local time: "2025-01-25 09:30:00"
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        timestamp = `${year}-${month}-${day} ${hours}:${minutes}:00`;
      } else {
        // Just date for other timeframes
        timestamp = date.toISOString().split('T')[0];
      }
      
      history.push({
        timestamp,
        close: parseFloat(currentPrice.toFixed(2)),
        high: parseFloat((currentPrice + (currentPrice * scaledVolatility * 0.5)).toFixed(2)),
        low: parseFloat((currentPrice - (currentPrice * scaledVolatility * 0.5)).toFixed(2)),
        open: parseFloat((currentPrice - dailyChange).toFixed(2)),
        volume: Math.floor(Math.random() * 10000000) + 30000000,
      });
    }
    
    // Sort by date (oldest to newest)
    return history.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  // Get technical indicators for a stock
  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicator[]> {
    try {
      // For market indices, generate special technical indicators
      if (symbol.startsWith('^')) {
        return this.getMarketIndexIndicators(symbol);
      }
      
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
      
      // For market indices, use special method if API fails
      if (symbol.startsWith('^')) {
        return this.getMarketIndexIndicators(symbol);
      }
      
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
  
  // Generate simulated technical indicators for market indices
  private getMarketIndexIndicators(symbol: string): TechnicalIndicator[] {
    let basePrice: number;
    let trend: number;
    
    switch (symbol) {
      case "^GSPC": // S&P 500
        basePrice = 4587.84;
        trend = 0.002;
        break;
      case "^IXIC": // NASDAQ
        basePrice = 14346.02;
        trend = 0.003;
        break;
      case "^DJI": // DOW
        basePrice = 36124.23;
        trend = 0.001;
        break;
      case "^FTSE": // FTSE 100
        basePrice = 7461.43;
        trend = -0.001;
        break;
      case "^N225": // Nikkei
        basePrice = 29332.16;
        trend = 0.002;
        break;
      case "^GDAXI": // DAX
        basePrice = 15727.67;
        trend = -0.0005;
        break;
      default:
        basePrice = 100;
        trend = 0.001;
    }
    
    // Determine signals based on trend
    const ma50Value = basePrice * 0.97;
    const ma200Value = basePrice * 0.92;
    const rsiValue = trend > 0 ? 60 + (Math.random() * 10) : 40 - (Math.random() * 10);
    const macdValue = trend > 0 ? 2.5 + (Math.random() * 1.5) : -1.5 - (Math.random() * 1.5);
    
    return [
      {
        name: "Moving Average (50)",
        value: parseFloat(ma50Value.toFixed(2)),
        signal: basePrice > ma50Value ? "Buy" : "Sell",
      },
      {
        name: "Moving Average (200)",
        value: parseFloat(ma200Value.toFixed(2)),
        signal: basePrice > ma200Value ? "Buy" : "Sell",
      },
      {
        name: "RSI (14)",
        value: parseFloat(rsiValue.toFixed(2)),
        signal: rsiValue < 30 ? "Buy" : rsiValue > 70 ? "Sell" : "Neutral",
      },
      {
        name: "MACD",
        value: parseFloat(macdValue.toFixed(2)),
        signal: macdValue > 0 ? "Buy" : "Sell",
      },
    ];
  }

  // Get company info and financials
  async getCompanyInfo(symbol: string): Promise<CompanyInfo> {
    try {
      // For market indices, provide special market index information
      if (symbol.startsWith('^')) {
        return this.getMarketIndexInfo(symbol);
      }
      
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
      
      // For market indices, use special info if API fails
      if (symbol.startsWith('^')) {
        return this.getMarketIndexInfo(symbol);
      }
      
      // Fallback company info for common stocks
      const fallbackCompanies: Record<string, CompanyInfo> = {
        "AAPL": {
          symbol: "AAPL",
          name: "Apple Inc.",
          description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide. The company offers iPhone, iPad, Mac, and wearables including AirPods, Apple TV, Apple Watch, and accessories.",
          industry: "Consumer Electronics",
          sector: "Technology",
          ceo: "Tim Cook",
          employees: 164000,
          founded: "1980-12-12",
          headquarters: "Cupertino, California, USA",
          website: "https://www.apple.com",
          peRatio: 29.47,
          eps: 6.06,
          dividendYield: 0.53,
          weekRange52: { low: 164.08, high: 199.62 },
          avgVolume: 58670000,
        },
        "MSFT": {
          symbol: "MSFT",
          name: "Microsoft Corporation",
          description: "Microsoft Corporation develops and supports software, services, devices, and solutions worldwide. The company operates through Productivity and Business Processes, Intelligent Cloud, and More Personal Computing segments.",
          industry: "Software - Infrastructure",
          sector: "Technology",
          ceo: "Satya Nadella",
          employees: 221000,
          founded: "1986-03-13",
          headquarters: "Redmond, Washington, USA",
          website: "https://www.microsoft.com",
          peRatio: 35.12,
          eps: 11.80,
          dividendYield: 0.72,
          weekRange52: { low: 309.45, high: 430.82 },
          avgVolume: 21450000,
        },
        "GOOGL": {
          symbol: "GOOGL",
          name: "Alphabet Inc.",
          description: "Alphabet Inc. provides various products and platforms in the United States, Europe, and internationally. It operates through Google Services, Google Cloud, and Other Bets segments. The company offers search, advertising, maps, YouTube, and cloud services.",
          industry: "Internet Content & Information",
          sector: "Communication Services",
          ceo: "Sundar Pichai",
          employees: 182502,
          founded: "2004-08-19",
          headquarters: "Mountain View, California, USA",
          website: "https://abc.xyz",
          peRatio: 24.85,
          eps: 5.80,
          dividendYield: 0.0,
          weekRange52: { low: 120.21, high: 191.75 },
          avgVolume: 24680000,
        },
        "AMZN": {
          symbol: "AMZN",
          name: "Amazon.com Inc.",
          description: "Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions through online and physical stores in North America and internationally. It operates through three segments: North America, International, and Amazon Web Services (AWS).",
          industry: "Internet Retail",
          sector: "Consumer Cyclical",
          ceo: "Andy Jassy",
          employees: 1541000,
          founded: "1997-05-15",
          headquarters: "Seattle, Washington, USA",
          website: "https://www.amazon.com",
          peRatio: 60.24,
          eps: 2.90,
          dividendYield: 0.0,
          weekRange52: { low: 118.35, high: 201.20 },
          avgVolume: 47230000,
        },
        "NVDA": {
          symbol: "NVDA",
          name: "NVIDIA Corporation",
          description: "NVIDIA Corporation provides graphics, computing and networking solutions in the United States, Taiwan, China, and internationally. The company operates through Graphics and Compute & Networking segments, offering GPUs for gaming, data centers, and AI applications.",
          industry: "Semiconductors",
          sector: "Technology",
          ceo: "Jensen Huang",
          employees: 29600,
          founded: "1999-01-22",
          headquarters: "Santa Clara, California, USA",
          website: "https://www.nvidia.com",
          peRatio: 65.32,
          eps: 1.92,
          dividendYield: 0.03,
          weekRange52: { low: 47.32, high: 152.89 },
          avgVolume: 41250000,
        },
        "META": {
          symbol: "META",
          name: "Meta Platforms Inc.",
          description: "Meta Platforms, Inc. engages in the development of products that enable people to connect and share through mobile devices, personal computers, virtual reality headsets, and wearables worldwide. It operates through Family of Apps and Reality Labs segments.",
          industry: "Internet Content & Information",
          sector: "Communication Services",
          ceo: "Mark Zuckerberg",
          employees: 67317,
          founded: "2012-05-18",
          headquarters: "Menlo Park, California, USA",
          website: "https://about.meta.com",
          peRatio: 28.45,
          eps: 14.87,
          dividendYield: 0.36,
          weekRange52: { low: 274.38, high: 542.81 },
          avgVolume: 14850000,
        },
        "TSLA": {
          symbol: "TSLA",
          name: "Tesla Inc.",
          description: "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems in the United States, China, and internationally. It operates through Automotive and Energy Generation and Storage segments.",
          industry: "Auto Manufacturers",
          sector: "Consumer Cyclical",
          ceo: "Elon Musk",
          employees: 140473,
          founded: "2010-06-29",
          headquarters: "Austin, Texas, USA",
          website: "https://www.tesla.com",
          peRatio: 72.15,
          eps: 3.12,
          dividendYield: 0.0,
          weekRange52: { low: 138.80, high: 299.29 },
          avgVolume: 98450000,
        },
      };

      if (fallbackCompanies[symbol]) {
        return fallbackCompanies[symbol];
      }

      // Generic fallback for unknown symbols
      return {
        symbol: symbol,
        name: symbol,
        description: "Company information is currently unavailable. Please try again later.",
        industry: "N/A",
        sector: "N/A",
        ceo: "N/A",
        employees: 0,
        founded: "N/A",
        headquarters: "N/A",
        website: "",
        peRatio: 0,
        eps: 0,
        dividendYield: 0,
        weekRange52: { low: 0, high: 0 },
        avgVolume: 0,
      };
    }
  }
  
  // Generate company info for market indices
  private getMarketIndexInfo(symbol: string): CompanyInfo {
    switch (symbol) {
      case "^GSPC":
        return {
          symbol: "^GSPC",
          name: "S&P 500",
          description: "The Standard and Poor's 500, or simply the S&P 500, is a stock market index tracking the stock performance of 500 large companies listed on exchanges in the United States. It is widely regarded as the best gauge of large-cap U.S. equities.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "1957-03-04",
          headquarters: "New York, NY, USA",
          website: "https://www.spglobal.com",
          peRatio: 23.45,
          eps: 195.64,
          dividendYield: 1.38,
          weekRange52: {
            low: 4200.54,
            high: 4850.32,
          },
          avgVolume: 3800000000,
        };
      
      case "^IXIC":
        return {
          symbol: "^IXIC",
          name: "NASDAQ Composite",
          description: "The Nasdaq Composite is a stock market index that includes almost all stocks listed on the Nasdaq stock exchange. It is heavily weighted towards technology and growth companies, particularly those in the information technology sector.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "1971-02-05",
          headquarters: "New York, NY, USA",
          website: "https://www.nasdaq.com",
          peRatio: 31.72,
          eps: 452.27,
          dividendYield: 0.82,
          weekRange52: {
            low: 12600.32,
            high: 14790.41,
          },
          avgVolume: 5200000000,
        };
      
      case "^DJI":
        return {
          symbol: "^DJI",
          name: "Dow Jones Industrial Average",
          description: "The Dow Jones Industrial Average (DJIA), or simply the Dow, is a stock market index of 30 prominent companies listed on stock exchanges in the United States. It is one of the oldest and most-watched indices in the world.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "1896-05-26",
          headquarters: "New York, NY, USA",
          website: "https://www.dowjones.com",
          peRatio: 22.18,
          eps: 1628.69,
          dividendYield: 2.01,
          weekRange52: {
            low: 32800.45,
            high: 37200.34,
          },
          avgVolume: 320000000,
        };
      
      case "^FTSE":
        return {
          symbol: "^FTSE",
          name: "FTSE 100 Index",
          description: "The FTSE 100 Index, also known as the Financial Times Stock Exchange 100 Index, is a share index of the 100 companies listed on the London Stock Exchange with the highest market capitalization.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "1984-01-03",
          headquarters: "London, UK",
          website: "https://www.ftse.com",
          peRatio: 14.35,
          eps: 520.66,
          dividendYield: 3.45,
          weekRange52: {
            low: 7100.65,
            high: 7900.32,
          },
          avgVolume: 890000000,
        };
        
      case "^N225":
        return {
          symbol: "^N225",
          name: "Nikkei 225",
          description: "The Nikkei 225, more commonly called the Nikkei, is a stock market index for the Tokyo Stock Exchange. It is the most widely quoted average of Japanese equities, representing a broad cross-section of Japanese industry.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "1950-09-07",
          headquarters: "Tokyo, Japan",
          website: "https://www.nikkei.com",
          peRatio: 17.62,
          eps: 1664.71,
          dividendYield: 1.76,
          weekRange52: {
            low: 27500.34,
            high: 31200.56,
          },
          avgVolume: 720000000,
        };
        
      case "^GDAXI":
        return {
          symbol: "^GDAXI",
          name: "DAX Performance Index",
          description: "The DAX (Deutscher Aktienindex) is a blue chip stock market index consisting of the 30 major German companies trading on the Frankfurt Stock Exchange. It is the equivalent of the FT 30 and the Dow Jones Industrial Average.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "1988-07-01",
          headquarters: "Frankfurt, Germany",
          website: "https://www.deutsche-boerse.com",
          peRatio: 16.25,
          eps: 968.47,
          dividendYield: 2.83,
          weekRange52: {
            low: 14800.43,
            high: 16400.67,
          },
          avgVolume: 680000000,
        };
        
      default:
        return {
          symbol: symbol,
          name: "Market Index",
          description: "A stock market index is a measurement of a section of the stock market, calculated from the prices of selected stocks.",
          industry: "Financial Services",
          sector: "Index",
          ceo: "N/A",
          employees: 0,
          founded: "N/A",
          headquarters: "N/A",
          website: "N/A",
          peRatio: 0,
          eps: 0,
          dividendYield: 0,
          weekRange52: {
            low: 0,
            high: 0,
          },
          avgVolume: 0,
        };
    }
  }

  // Get latest news about a stock or general market news
  async getNews(symbol?: string): Promise<NewsItem[]> {
    // Try Finnhub API first (free tier available)
    const finnhubKey = process.env.FINNHUB_API_KEY;

    if (finnhubKey) {
      try {
        let url: string;
        if (symbol) {
          // Company news endpoint
          const today = new Date();
          const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const fromDate = lastWeek.toISOString().split('T')[0];
          const toDate = today.toISOString().split('T')[0];
          url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
        } else {
          // General market news
          url = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`;
        }

        const response = await axios.get(url);
        const articles = response.data || [];

        if (articles.length > 0) {
          return articles.slice(0, 10).map((article: any, index: number) => ({
            id: String(article.id || index),
            title: article.headline,
            summary: article.summary,
            source: article.source,
            publishedAt: new Date(article.datetime * 1000).toISOString(),
            url: article.url,
          }));
        }
      } catch (error) {
        console.error("Finnhub API error:", error);
      }
    }

    // Try Alpha Vantage as fallback
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

      if (articles.length > 0) {
        return articles.map((article: any) => ({
          id: article.id || String(Math.random()),
          title: article.title,
          summary: article.summary,
          source: article.source,
          publishedAt: article.time_published,
          url: article.url,
        })).slice(0, 10);
      }
    } catch (error) {
      console.error("Alpha Vantage news error:", error);
    }

    // Fallback to generated demo news with current timestamps
    console.log("Using fallback news data");
    const now = Date.now();
    const defaultNews: NewsItem[] = [
      {
        id: "1",
        title: "Tech Stocks Rally on Strong Earnings Reports",
        summary: "Major technology companies reported better-than-expected quarterly results, driving a broad market rally...",
        source: "MarketWatch",
        publishedAt: new Date(now - 1800000).toISOString(), // 30 min ago
        url: "#",
      },
      {
        id: "2",
        title: "Federal Reserve Maintains Current Interest Rate Policy",
        summary: "The Federal Reserve kept interest rates unchanged at their latest meeting, signaling a data-dependent approach...",
        source: "Bloomberg",
        publishedAt: new Date(now - 3600000).toISOString(), // 1 hour ago
        url: "#",
      },
      {
        id: "3",
        title: "AI Investments Continue to Drive Market Momentum",
        summary: "Companies across sectors are increasing their artificial intelligence investments, boosting related stocks...",
        source: "CNBC",
        publishedAt: new Date(now - 7200000).toISOString(), // 2 hours ago
        url: "#",
      },
    ];

    if (symbol) {
      // Add symbol-specific mock news
      const symbolNews: NewsItem[] = [
        {
          id: "s1",
          title: `${symbol} Reports Strong Quarter Amid Market Volatility`,
          summary: `${symbol} exceeded analyst expectations with revenue growth driven by new product launches and expanding market share...`,
          source: "Reuters",
          publishedAt: new Date(now - 5400000).toISOString(), // 1.5 hours ago
          url: "#",
        },
        {
          id: "s2",
          title: `Analysts Upgrade ${symbol} on Positive Growth Outlook`,
          summary: `Several Wall Street firms have raised their price targets following the company's strong performance guidance...`,
          source: "Financial Times",
          publishedAt: new Date(now - 10800000).toISOString(), // 3 hours ago
          url: "#",
        },
      ];
      return [...symbolNews, ...defaultNews].slice(0, 5);
    }

    return defaultNews;
  }
}
