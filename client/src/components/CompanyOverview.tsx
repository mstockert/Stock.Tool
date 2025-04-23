import { useQuery } from "@tanstack/react-query";
import { CompanyInfo } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CompanyOverviewProps = {
  symbol: string;
};

export default function CompanyOverview({ symbol }: CompanyOverviewProps) {
  const { data: company, isLoading, error } = useQuery<CompanyInfo>({
    queryKey: [`/api/stocks/company/${symbol}`],
    enabled: !!symbol,
  });

  if (error) {
    return (
      <Card className="bg-dark-surface">
        <CardHeader>
          <CardTitle>Company Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading company information. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-surface">
      <CardHeader className="px-4 py-3 border-b border-gray-800">
        <CardTitle className="text-base font-semibold">Company Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <p className="text-sm text-text-secondary">{company?.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-text-secondary text-xs mb-1">Industry</p>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm">{company?.industry || "N/A"}</p>
            )}
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-1">Sector</p>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm">{company?.sector || "N/A"}</p>
            )}
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-1">CEO</p>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm">{company?.ceo || "N/A"}</p>
            )}
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-1">Employees</p>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm">
                {company?.employees ? company.employees.toLocaleString() : "N/A"}
              </p>
            )}
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-1">Founded</p>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm">
                {company?.founded
                  ? new Date(company.founded).getFullYear().toString()
                  : "N/A"}
              </p>
            )}
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-1">Headquarters</p>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm">{company?.headquarters || "N/A"}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Key Financials</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between py-1 border-b border-gray-800">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-text-secondary text-sm">P/E Ratio</span>
                <span className="font-mono text-sm">
                  {company?.peRatio ? company.peRatio.toFixed(2) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-text-secondary text-sm">EPS</span>
                <span className="font-mono text-sm">
                  ${company?.eps ? company.eps.toFixed(2) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-text-secondary text-sm">Dividend Yield</span>
                <span className="font-mono text-sm">
                  {company?.dividendYield ? company.dividendYield.toFixed(2) + "%" : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-text-secondary text-sm">52 Week Range</span>
                <span className="font-mono text-sm">
                  {company?.weekRange52
                    ? `$${company.weekRange52.low.toFixed(2)} - $${company.weekRange52.high.toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-secondary text-sm">Avg Volume</span>
                <span className="font-mono text-sm">
                  {company?.avgVolume
                    ? (company.avgVolume / 1000000).toFixed(2) + "M"
                    : "N/A"}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
