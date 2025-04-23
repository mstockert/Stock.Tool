import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { SearchResult } from "@shared/schema";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export function SearchBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading } = useQuery<SearchResult[]>({
    queryKey: [`/api/stocks/search`, debouncedQuery],
    enabled: debouncedQuery.length >= 1,
  });

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelectStock = (symbol: string) => {
    setLocation(`/stock/${symbol}`);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search stocks, indices, ETFs..."
          className="bg-dark-surface-2 w-full rounded-lg py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={searchQuery}
          onChange={handleSearchInput}
          onFocus={() => searchQuery.length > 0 && setIsOpen(true)}
        />
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-dark-surface-2 rounded-lg shadow-lg border border-gray-800 max-h-80 overflow-y-auto"
        >
          {isLoading ? (
            // Loading state
            <div className="p-2 border-b border-gray-800">
              <Skeleton className="h-6 w-full" />
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            // Results
            searchResults.map((result, index) => (
              <div
                key={`${result.symbol}-${index}`}
                className="p-2 hover:bg-dark-surface hover:bg-opacity-70 cursor-pointer border-b border-gray-800"
                onClick={() => handleSelectStock(result.symbol)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{result.symbol}</span>
                    <span className="text-text-secondary text-sm ml-2">{result.name}</span>
                  </div>
                  {result.changePercent !== undefined && (
                    <span
                      className={`font-mono text-sm ${
                        result.changePercent >= 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      {result.changePercent >= 0 ? "+" : ""}
                      {(result.changePercent * 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : debouncedQuery.length > 0 ? (
            // No results
            <div className="p-4 text-center text-text-secondary">
              <p>No results found for "{debouncedQuery}"</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
