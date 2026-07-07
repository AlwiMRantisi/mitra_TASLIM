import { DataTable } from "@/components/transaction-table"
import { SectionCards } from "@/components/section-cards"
import { SectionCharts } from "@/components/section-charts"
import { ChartBarMixed } from "@/components/bar-chart"
import { ChartBarPositiveNegative } from "@/components/chart-bar-positive-negative"
import { useDashboard } from "./use-dashboard"
import requestsData from "@/data/request.json"

/**
 * Komponen DashboardPage
 * 
 * Halaman utama (dashboard) yang hanya bertanggung jawab untuk View/Presentation Layer.
 * Semua state dan logika bisnis dipisahkan ke dalam custom hook `useDashboard`.
 *
 * @returns {JSX.Element} Antarmuka halaman Dashboard.
 */
export default function DashboardPage() {
    const {
        user,
        chartTransactions,
        mitraOptions,
        selectedMitra,
        setSelectedMitra,
        inventoryStats,
        safetyStockAlerts
    } = useDashboard();

    const normalizeOwner = (owner?: string | null) => (owner || "").trim().toLowerCase();

    return (
        <div className="@container/main flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards
                stats={inventoryStats}
                totalLabel={
                    user?.role === "mitra"
                        ? "Total"
                        : "Total"
                }
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 lg:px-6 pb-0">
                <ChartBarMixed className="h-full" />
                <ChartBarPositiveNegative
                    className="h-full"
                    transactions={
                        selectedMitra === "all"
                            ? chartTransactions
                            : chartTransactions.filter((transaction) =>
                                normalizeOwner(transaction.mitra) === normalizeOwner(selectedMitra)
                            )
                    }
                    showMitraFilter={user?.role === "admin"}
                    mitraOptions={mitraOptions}
                    selectedMitra={selectedMitra}
                    onMitraChange={setSelectedMitra}
                />
            </div>
            <SectionCharts 
                stats={{
                    totalItems: 0,
                    tersedia: 0,
                    diluar: 0,
                    rusak: 0,
                    hilang: 0
                }} 
                safetyStockAlerts={[]} 
            />
            {/* <div className="pb-6">
                <DataTable data={requestsData} />
            </div> */}
        </div>
    )
}
