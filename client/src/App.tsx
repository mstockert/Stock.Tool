import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import StockPage from "@/pages/StockPage";
import WatchlistPage from "@/pages/WatchlistPage";
import MarketsPage from "@/pages/MarketsPage";
import TechnicalAnalysisPage from "@/pages/TechnicalAnalysisPage";
import RiskCalculatorPage from "@/pages/RiskCalculatorPage";
import NewsFeedPage from "@/pages/NewsFeedPage";
import ScreenerPage from "@/pages/ScreenerPage";
import PortfolioPage from "@/pages/PortfolioPage";
import PortfolioAnalysisPage from "@/pages/PortfolioAnalysisPage";
import AlertsPage from "@/pages/AlertsPage";
import JournalPage from "@/pages/JournalPage";
import SettingsPage from "@/pages/SettingsPage";
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
          <Route path="/technical" component={TechnicalAnalysisPage} />
          <Route path="/risk-calculator" component={RiskCalculatorPage} />
          <Route path="/news" component={NewsFeedPage} />
          <Route path="/screener" component={ScreenerPage} />
          <Route path="/portfolio" component={PortfolioPage} />
          <Route path="/portfolio-analysis" component={PortfolioAnalysisPage} />
          <Route path="/alerts" component={AlertsPage} />
          <Route path="/journal" component={JournalPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </MainLayout>
    </TooltipProvider>
  );
}

export default App;
