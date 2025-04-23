import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import StockPage from "@/pages/StockPage";
import WatchlistPage from "@/pages/WatchlistPage";
import MarketsPage from "@/pages/MarketsPage";
import MainLayout from "@/layouts/MainLayout";
import NotFound from "@/pages/not-found";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <TooltipProvider>
      <MainLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/stock/:symbol" component={StockPage} />
          <Route path="/watchlists" component={WatchlistPage} />
          <Route path="/markets" component={MarketsPage} />
          <Route component={NotFound} />
        </Switch>
      </MainLayout>
    </TooltipProvider>
  );
}

export default App;
