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
  // Helper function to get timeframe-specific market data
  // This is used by both getMarketIndices and getMarketIndexHistory
  private getTimeframeSensitiveMarketData(timeframe: string): MarketIndex[] {
    // Base market data with very different values for easier debugging
    let baseIndices = [
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
    
    // Create completely different data sets for each timeframe
    // This ensures we can clearly see the timeframe changes working
    const getTimeframeData = (index: any, timeframe: string) => {
      switch (timeframe) {
        case "1D":
          return {
            ...index,
            // No changes for "1D" timeframe
          };
        case "1W":
          return {
            ...index,
            price: parseFloat((index.price * 1.05).toFixed(2)),
            change: parseFloat((index.change * 5).toFixed(2)),
            changePercent: parseFloat((index.changePercent * 5).toFixed(1)),
            sparkline: [
              index.price * 0.97, 
              index.price * 0.98, 
              index.price * 0.99, 
              index.price * 1.02, 
              index.price * 1.04, 
              index.price * 1.05
            ],
          };
        case "1M":
          return {
            ...index,
            price: parseFloat((index.price * 1.10).toFixed(2)),
            change: parseFloat((index.change * 8).toFixed(2)),
            changePercent: parseFloat((index.changePercent * 8).toFixed(1)),
            sparkline: [
              index.price * 0.94, 
              index.price * 0.97, 
              index.price * 1.01, 
              index.price * 1.05, 
              index.price * 1.08, 
              index.price * 1.10
            ],
          };
        case "3M":
          return {
            ...index,
            price: parseFloat((index.price * 1.15).toFixed(2)),
            change: parseFloat((index.change * 12).toFixed(2)),
            changePercent: parseFloat((index.changePercent * 12).toFixed(1)),
            sparkline: [
              index.price * 0.90, 
              index.price * 0.95, 
              index.price * 1.02, 
              index.price * 1.08, 
              index.price * 1.12, 
              index.price * 1.15
            ],
          };
        case "1Y":
          return {
            ...index,
            price: parseFloat((index.price * 1.25).toFixed(2)),
            change: parseFloat((index.change * 20).toFixed(2)),
            changePercent: parseFloat((index.changePercent * 20).toFixed(1)),
            sparkline: [
              index.price * 0.85, 
              index.price * 0.95, 
              index.price * 1.05, 
              index.price * 1.15, 
              index.price * 1.20, 
              index.price * 1.25
            ],
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
        // Get current hour in ET to determine how much of the trading day to show
        // Trading hours typically 9:30 AM - 4:00 PM ET
        const currentHourET = new Date().getHours();
        
        // For demonstration, let's limit to actual market hours
        // In a real app, we'd check if market is open and use the actual current time
        const marketOpen = 9; // 9:30 AM ET
        const marketClose = 16; // 4:00 PM ET
        
        // Calculate how many hours of trading day have passed
        let tradingHoursPassed = Math.min(currentHourET - marketOpen, marketClose - marketOpen);
        
        // If after market hours, show full day
        if (currentHourET >= marketClose) {
          tradingHoursPassed = marketClose - marketOpen;
        }
        
        // If before market hours, show a small amount of pre-market
        if (currentHourET < marketOpen) {
          tradingHoursPassed = 2; // Show 2 hours of pre-market
        }
        
        // Ensure at least some data points
        tradingHoursPassed = Math.max(tradingHoursPassed, 2);
        
        // Create appropriate number of data points (2 per hour = 30min intervals)
        dataPoints = tradingHoursPassed * 2;
        
        console.log(`Generating 1D data with ${dataPoints} points (${tradingHoursPassed} hours of trading)`);
        
        // Use TODAY's date (not 'date' parameter which might be yesterday)
        // This ensures intraday data is for today and not yesterday
        const today = new Date();
        
        dateDelta = (date, i) => {
          // Start with today's date
          const newDate = new Date(today);
          // Set date to today but with specific time
          newDate.setHours(marketOpen + Math.floor(i / 2));
          newDate.setMinutes((i % 2) * 30);
          newDate.setSeconds(0);
          newDate.setMilliseconds(0);
          return newDate;
        };
        break;
      case "1W":
        // Weekly view - moderate changes with more volatility
        dataPoints = 30;
        volatility *= 2;
        trend *= 3;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          newDate.setDate(date.getDate() - 7 + i);
          return newDate;
        };
        break;
      case "1M":
        // Monthly view - larger changes, clear trend
        dataPoints = 30;
        volatility *= 3;
        trend *= 5;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          newDate.setDate(date.getDate() - 30 + i);
          return newDate;
        };
        break;
      case "3M":
        // Quarterly view - significant changes
        dataPoints = 45;
        volatility *= 4;
        trend *= 8;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          newDate.setDate(date.getDate() - 90 + (i * 2));
          return newDate;
        };
        break;
      case "1Y":
        // Yearly view - major changes
        dataPoints = 52;
        volatility *= 5;
        trend *= 12;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          newDate.setDate(date.getDate() - 365 + (i * 7));
          return newDate;
        };
        break;
      case "5Y":
        // 5 Year view - dramatic changes
        dataPoints = 60;
        volatility *= 7;
        trend *= 20;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          newDate.setMonth(date.getMonth() - 60 + i);
          return newDate;
        };
        break;
      default:
        dataPoints = 30;
        dateDelta = (date, i) => {
          const newDate = new Date(date);
          newDate.setDate(date.getDate() - 30 + i);
          return newDate;
        };
    }
    
    // Generate data with appropriate pattern for the timeframe
    let currentPrice = basePrice * (1 - (trend * dataPoints / 2)); // Start below and trend up
    
    for (let i = 0; i < dataPoints; i++) {
      const date = dateDelta(now, i);
      
      const dailyChange = (Math.random() - 0.5) * basePrice * volatility;
      currentPrice = currentPrice + dailyChange + (basePrice * trend);
      
      // For 1D view, include time in timestamp
      const timestamp = timeframe === "1D" 
        ? date.toISOString().replace('T', ' ').substring(0, 19) // Include time
        : date.toISOString().split('T')[0]; // Just date for other timeframes
      
      history.push({
        timestamp,
        close: parseFloat(currentPrice.toFixed(2)),
        high: parseFloat((currentPrice + (currentPrice * volatility * 0.5)).toFixed(2)),
        low: parseFloat((currentPrice - (currentPrice * volatility * 0.5)).toFixed(2)),
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
