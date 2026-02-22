import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

export default function RiskCalculatorPage() {
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("2");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [positionType, setPositionType] = useState("long");

  const calculateRisk = () => {
    const account = parseFloat(accountSize) || 0;
    const risk = parseFloat(riskPercent) || 0;
    const entry = parseFloat(entryPrice) || 0;
    const stop = parseFloat(stopLoss) || 0;
    const target = parseFloat(targetPrice) || 0;

    const riskAmount = account * (risk / 100);
    const priceDiff = positionType === "long" ? entry - stop : stop - entry;
    const shares = priceDiff > 0 ? Math.floor(riskAmount / priceDiff) : 0;
    const positionSize = shares * entry;
    const potentialLoss = shares * priceDiff;
    const potentialGain = positionType === "long"
      ? shares * (target - entry)
      : shares * (entry - target);
    const riskRewardRatio = potentialLoss > 0 ? potentialGain / potentialLoss : 0;

    return {
      riskAmount: riskAmount.toFixed(2),
      shares,
      positionSize: positionSize.toFixed(2),
      potentialLoss: potentialLoss.toFixed(2),
      potentialGain: potentialGain.toFixed(2),
      riskRewardRatio: riskRewardRatio.toFixed(2),
    };
  };

  const results = calculateRisk();

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Risk Calculator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Position Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountSize">Account Size ($)</Label>
                <Input
                  id="accountSize"
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(e.target.value)}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="riskPercent">Risk per Trade (%)</Label>
                <Input
                  id="riskPercent"
                  type="number"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  placeholder="2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="positionType">Position Type</Label>
              <Select value={positionType} onValueChange={setPositionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long (Buy)</SelectItem>
                  <SelectItem value="short">Short (Sell)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price ($)</Label>
              <Input
                id="entryPrice"
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="150.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss ($)</Label>
              <Input
                id="stopLoss"
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="145.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target Price ($)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="165.00"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calculation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Risk Amount</p>
                <p className="text-2xl font-bold">${results.riskAmount}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Shares to Buy</p>
                <p className="text-2xl font-bold">{results.shares}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Position Size</p>
              <p className="text-2xl font-bold">${results.positionSize}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-muted-foreground">Potential Loss</p>
                </div>
                <p className="text-2xl font-bold text-red-500">-${results.potentialLoss}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-muted-foreground">Potential Gain</p>
                </div>
                <p className="text-2xl font-bold text-green-500">+${results.potentialGain}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Risk/Reward Ratio</p>
              <p className={`text-2xl font-bold ${parseFloat(results.riskRewardRatio) >= 2 ? 'text-green-500' : parseFloat(results.riskRewardRatio) >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>
                1:{results.riskRewardRatio}
              </p>
              {parseFloat(results.riskRewardRatio) < 2 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  A ratio of at least 1:2 is recommended
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk Management Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-medium mb-2">Position Sizing</h3>
                <p className="text-sm text-muted-foreground">
                  Never risk more than 1-2% of your account on a single trade. This helps protect your capital during losing streaks.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-medium mb-2">Stop Loss Placement</h3>
                <p className="text-sm text-muted-foreground">
                  Place your stop loss at a technical level (support/resistance) rather than an arbitrary dollar amount.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-medium mb-2">Risk/Reward Ratio</h3>
                <p className="text-sm text-muted-foreground">
                  Aim for trades with at least a 1:2 risk/reward ratio. This means you can be wrong 50% of the time and still be profitable.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
