import { 
  users, 
  type User, 
  type InsertUser, 
  type Watchlist, 
  type InsertWatchlist, 
  type WatchlistSymbol, 
  type InsertWatchlistSymbol, 
  type UserPreference, 
  type InsertUserPreference 
} from "@shared/schema";

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
  addSymbolToWatchlist(symbol: InsertWatchlistSymbol): Promise<WatchlistSymbol>;
  removeSymbolFromWatchlist(symbolId: number, watchlistId: number): Promise<void>;
  
  // User preferences methods
  getUserPreferences(userId: number): Promise<UserPreference | undefined>;
  updateUserPreferences(userId: number, preferences: Partial<UserPreference>): Promise<UserPreference>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private watchlists: Map<number, Watchlist>;
  private watchlistSymbols: Map<number, WatchlistSymbol>;
  private userPreferences: Map<number, UserPreference>;
  
  private userIdCounter: number;
  private watchlistIdCounter: number;
  private symbolIdCounter: number;
  private preferenceIdCounter: number;

  constructor() {
    this.users = new Map();
    this.watchlists = new Map();
    this.watchlistSymbols = new Map();
    this.userPreferences = new Map();
    
    this.userIdCounter = 1;
    this.watchlistIdCounter = 1;
    this.symbolIdCounter = 1;
    this.preferenceIdCounter = 1;

    // Add demo user
    this.users.set(1, {
      id: 1,
      username: "demo",
      email: "demo@example.com",
      fullName: "Demo User"
    });
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
    return newWatchlist;
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
    return symbol;
  }

  async removeSymbolFromWatchlist(symbolId: number, watchlistId: number): Promise<void> {
    this.watchlistSymbols.delete(symbolId);
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
    return userPrefs;
  }
}

export const storage = new MemStorage();
