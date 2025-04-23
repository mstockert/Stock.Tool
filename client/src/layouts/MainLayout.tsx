import { useState } from "react";
import { Link, useLocation } from "wouter";
import { SearchBar } from "@/components/SearchBar";
import { cn } from "@/lib/utils";
import { MenuIcon, LineChart, LayoutDashboard, Star, PieChart, BarChart2, Filter, Calculator, Newspaper, Settings, Bell, Plus } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";

type SidebarLinkProps = {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
};

const SidebarLink = ({ icon, label, href, active, badge, onClick }: SidebarLinkProps) => {
  return (
    <Link 
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center px-4 py-2.5 text-text-primary hover:bg-dark-surface-2",
        active && "text-primary bg-dark-surface-2 border-l-2 border-primary"
      )}
    >
      <div className="flex items-center flex-1">
        <span className="mr-3">{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span className="text-xs rounded-full bg-primary bg-opacity-20 text-primary px-2 py-0.5">
          {badge}
        </span>
      )}
    </Link>
  );
};

type MainLayoutProps = {
  children: React.ReactNode;
};

// Define watchlist type for the sidebar
type SidebarWatchlist = {
  id: number;
  name: string;
  symbols: Array<{ id: number; symbol: string; }>;
};

const MainLayout = ({ children }: MainLayoutProps) => {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // Fetch watchlists for the sidebar
  const { data: watchlists } = useQuery<SidebarWatchlist[]>({
    queryKey: ["/api/watchlists"],
    initialData: [],
    refetchInterval: 30000, // Refresh every 30s
  });

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebarOnMobile = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };
  
  const goToWatchlistsPage = () => {
    // Redirect to watchlists page
    window.location.href = '/watchlists';
    closeSidebarOnMobile();
  };

  return (
    <div className="flex flex-col h-screen bg-dark-bg text-text-primary">
      {/* Header */}
      <header className="bg-dark-surface border-b border-gray-800 py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={toggleSidebar} className="md:hidden mr-2 text-text-primary">
              <MenuIcon className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center">
                <LineChart className="text-primary h-6 w-6 mr-2" />
                <span className="text-xl font-semibold">Stock.Tool</span>
            </Link>
          </div>

          <div className="hidden md:flex flex-1 mx-8">
            <SearchBar />
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-dark-surface-2" title="Settings">
              <Settings className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-dark-surface-2" title="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="font-medium text-white">U</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            "bg-dark-surface border-r border-gray-800 overflow-y-auto scrollbar-hide",
            "w-60 fixed md:relative h-full z-20 transition-all duration-300 ease-in-out transform",
            isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"
          )}
        >
          <nav className="py-4">
            <div className="px-4 mb-2">
              <h2 className="text-text-secondary text-xs uppercase font-medium tracking-wider">Main</h2>
            </div>
            <ul>
              <li>
                <SidebarLink 
                  icon={<LayoutDashboard className="h-5 w-5" />} 
                  label="Dashboard" 
                  href="/" 
                  active={location === "/"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
              <li>
                <SidebarLink 
                  icon={<LineChart className="h-5 w-5" />} 
                  label="Markets" 
                  href="/markets" 
                  active={location === "/markets"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
              <li>
                <SidebarLink 
                  icon={<Star className="h-5 w-5" />} 
                  label="Watchlist" 
                  href="/watchlists" 
                  active={location === "/watchlists"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
              <li>
                <SidebarLink 
                  icon={<PieChart className="h-5 w-5" />} 
                  label="Portfolio" 
                  href="/portfolio" 
                  active={location === "/portfolio"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
              <li>
                <SidebarLink 
                  icon={<BarChart2 className="h-5 w-5" />} 
                  label="Screener" 
                  href="/screener" 
                  active={location === "/screener"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
            </ul>

            <div className="px-4 mt-6 mb-2">
              <h2 className="text-text-secondary text-xs uppercase font-medium tracking-wider">Watchlists</h2>
            </div>
            <ul>
              {watchlists && watchlists.length > 0 ? (
                watchlists.map(list => (
                  <li key={list.id}>
                    <SidebarLink 
                      icon={<Filter className="h-5 w-5" />} 
                      label={list.name} 
                      href="/watchlists" 
                      active={location === "/watchlists"} 
                      badge={list.symbols?.length || 0}
                      onClick={closeSidebarOnMobile}
                    />
                  </li>
                ))
              ) : (
                <li className="px-4 py-2 text-text-secondary text-sm">No watchlists found</li>
              )}
              <li>
                <a 
                  href="#" 
                  className="flex items-center px-4 py-2.5 text-text-secondary hover:bg-dark-surface-2"
                  onClick={(e) => {
                    e.preventDefault();
                    goToWatchlistsPage();
                  }}
                >
                  <span className="mr-3"><Plus className="h-4 w-4" /></span>
                  <span>New Watchlist</span>
                </a>
              </li>
            </ul>

            <div className="px-4 mt-6 mb-2">
              <h2 className="text-text-secondary text-xs uppercase font-medium tracking-wider">Tools</h2>
            </div>
            <ul>
              <li>
                <SidebarLink 
                  icon={<Filter className="h-5 w-5" />} 
                  label="Technical Analysis" 
                  href="/tools/technical" 
                  active={location === "/tools/technical"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
              <li>
                <SidebarLink 
                  icon={<Calculator className="h-5 w-5" />} 
                  label="Risk Calculator" 
                  href="/tools/risk" 
                  active={location === "/tools/risk"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
              <li>
                <SidebarLink 
                  icon={<Newspaper className="h-5 w-5" />} 
                  label="News Feed" 
                  href="/news" 
                  active={location === "/news"} 
                  onClick={closeSidebarOnMobile}
                />
              </li>
            </ul>
          </nav>
        </div>

        {/* Overlay to close sidebar on mobile */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-10"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-dark-bg p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
