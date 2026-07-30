import { SectionCards } from "@/features/dashboard/components/section-cards"
import { ChartBarMixed } from "@/features/dashboard/components/bar-chart"
import { ChartInboundOutbound } from "@/features/dashboard/components/chart-inbound-outbound"
import { RequestSection } from "@/features/dashboard/components/RequestSection"
import { ActivityFeedCard } from "@/features/dashboard/components/ActivityFeedCard"
import { LeaderboardCard } from "@/features/dashboard/components/LeaderboardCard"
import { IdleStockAlert } from "@/features/dashboard/components/IdleStockAlert"
import { ProductivityTable } from "@/features/dashboard/components/ProductivityTable"
import { useDashboard } from "./use-dashboard"

export default function DashboardPage() {
    const {
        user,
        inventoryStats,
        mitraDistribution,
        transactionSeries,
        timeRange,
        setTimeRange,
        requestCounts,
        recentRequests,
        recentTransactions,
        mitraPerformanceMetrics,
        isLoadingRequests,
        isLoadingActivity,
        isLoading,
    } = useDashboard();

    return (
        <div className="@container/main flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {/* Row 1: Inventory KPI cards */}
            <SectionCards
                stats={inventoryStats}
                totalLabel={
                    user?.role === "mitra"
                        ? "Total"
                        : "Total Aset"
                }
            />

            {/* Idle Stock Alert (Admin only) */}
            {user?.role !== "mitra" && (
                <div className="px-4 lg:px-6">
                    <IdleStockAlert metrics={mitraPerformanceMetrics} isLoading={isLoading} />
                </div>
            )}

            {/* Row 4: Mitra Performance (Admin only) */}
            {user?.role !== "mitra" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 lg:px-6">
                    <LeaderboardCard
                        metrics={mitraPerformanceMetrics}
                        isLoading={isLoading}
                        className="lg:col-span-1"
                    />
                    <ProductivityTable
                        metrics={mitraPerformanceMetrics}
                        isLoading={isLoading}
                        className="lg:col-span-2"
                    />
                </div>
            )}

            {/* Row 2: Charts (50/50) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 lg:px-6">
                <ChartBarMixed
                    data={mitraDistribution}
                    isLoading={isLoading}
                    className="h-full"
                />
                <ChartInboundOutbound
                    data={transactionSeries}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    className="h-full"
                />
            </div>

            {/* Row 3: Request Section (2/3) + Recent Activities (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 lg:px-6 pb-4">
                <RequestSection
                    requests={recentRequests}
                    counts={requestCounts}
                    isLoading={isLoadingRequests}
                    variant={user?.role === "mitra" ? "mitra" : "admin"}
                    className="lg:col-span-2"
                />
                <ActivityFeedCard
                    activities={recentTransactions}
                    isLoading={isLoadingActivity}
                    className="lg:col-span-1"
                />
            </div>
        </div>
    )
}
