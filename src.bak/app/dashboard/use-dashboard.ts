import { useState, useCallback, useRef, useEffect } from 'react';
import { DashboardService } from '@/services/dashboard.service';
import type { Transaction, DashboardTransaction } from "@/types/transaction"
import type { InventoryItem, Category } from "@/types/inventory"
import type { InventoryStats, SafetyStockAlert } from "@/types/dashboard"
import { useAuth } from "@/lib/auth"

const DASHBOARD_TRANSACTION_LIMIT = 6;
const DASHBOARD_REFRESH_INTERVAL = 5000;

export function useDashboard() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [chartTransactions, setChartTransactions] = useState<Transaction[]>([]);
    const [mitraOptions, setMitraOptions] = useState<string[]>([]);
    const [selectedMitra, setSelectedMitra] = useState("all");
    const [safetyStockAlerts, setSafetyStockAlerts] = useState<SafetyStockAlert[]>([]);
    const [inventoryStats, setInventoryStats] = useState<InventoryStats>({
        totalItems: 0, tersedia: 0, diluar: 0, rusak: 0, hilang: 0,
    });
    const isFetchingRef = useRef(false);

    const fetchDashboardData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        
        try {
            const [transactionData, itemData, categoriesList, requestData] = await Promise.all([
                DashboardService.fetchTransactions(),
                DashboardService.fetchItems(),
                DashboardService.fetchCategories(),
                DashboardService.fetchRequests(),
            ]);

            const categoryData: Category[] = categoriesList.map((c: any) => ({
                ...c,
                name: c.nama || c.name || "",
                safetyStock: c.safetyStock !== undefined ? c.safetyStock : (c.safety_stock || 5),
            }));

            const visibleTransactions = transactionData.filter(
                (transaction: any) =>
                    user?.role !== "mitra" ||
                    transaction.mitra?.trim().toLowerCase() === user?.displayName?.trim().toLowerCase()
            );
            const visibleItems = itemData.filter(
                (item: any) =>
                    user?.role !== "mitra" ||
                    item.mitra?.trim().toLowerCase() === user?.displayName?.trim().toLowerCase()
            );
            const visibleRequests = requestData.filter(
                (req: any) =>
                    user?.role !== "mitra" ||
                    req.requesterName?.trim().toLowerCase() === user?.displayName?.trim().toLowerCase()
            );

            const flattened = visibleTransactions
                .slice(0, DASHBOARD_TRANSACTION_LIMIT)
                .map((transaction: any) => ({
                    id: transaction.id,
                    tanggal: transaction.tanggal,
                    nomor: transaction.nomor,
                    kategori: transaction.kategori,
                    status: transaction.status,
                    sn: transaction.sn,
                    merek: transaction.merek,
                    asal: transaction.asal || "-",
                    tujuan: transaction.tujuan || "-",
                    mitra: transaction.mitra || "-",
                    keterangan: transaction.keterangan || "-",
                }));
            
            setTransactions(flattened);
            setRequests(visibleRequests.slice(0, DASHBOARD_TRANSACTION_LIMIT));

            const uniqueMitras = Array.from(new Set(visibleTransactions.map((trx: any) => trx.mitra || "-").filter(Boolean))) as string[];
            setMitraOptions([
                "all",
                ...uniqueMitras.sort((a, b) => a.localeCompare(b))
            ]);
            
            setChartTransactions(visibleTransactions);
            
            setInventoryStats({
                totalItems: visibleItems.length,
                tersedia: visibleItems.filter((item: any) => item.status.trim().toLowerCase() === "tersedia").length,
                diluar: visibleItems.filter((item: any) => item.status.trim().toLowerCase() === "diluar").length,
                rusak: visibleItems.filter((item: any) => item.status.trim().toLowerCase() === "rusak").length,
                hilang: visibleItems.filter((item: any) => item.status.trim().toLowerCase() === "hilang").length,
            });

            const availableByCategory = new Map<string, number>();
            const ownedCategories = new Set<string>();
            
            visibleItems.forEach((item: any) => {
                const categoryKey = item.kategori.trim().toLowerCase();
                ownedCategories.add(categoryKey);
                if (item.status.trim().toLowerCase() === "tersedia") {
                    availableByCategory.set(categoryKey, (availableByCategory.get(categoryKey) || 0) + 1);
                }
            });

            const relevantCategories = categoryData.filter(
                (category) => user?.role === "admin" || ownedCategories.has(category.name.trim().toLowerCase())
            );

            setSafetyStockAlerts(
                relevantCategories.flatMap<SafetyStockAlert>((category) => {
                    const available = availableByCategory.get(category.name.trim().toLowerCase()) || 0;
                    const safetyStock = Math.max(0, Number(category.safetyStock ?? 5));
                    
                    if (available === 0) return [{ category: category.name, available, safetyStock, status: "Habis" as const }];
                    if (available <= safetyStock) return [{ category: category.name, available, safetyStock, status: "Menipis" as const }];
                    return [];
                })
            );
        } catch (error) {
            console.error("Gagal mengambil data dashboard:", error);
        } finally {
            isFetchingRef.current = false;
        }
    }, [user]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") fetchDashboardData();
        };

        fetchDashboardData();
        const refreshInterval = window.setInterval(fetchDashboardData, DASHBOARD_REFRESH_INTERVAL);

        window.addEventListener("focus", fetchDashboardData);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearInterval(refreshInterval);
            window.removeEventListener("focus", fetchDashboardData);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [fetchDashboardData]);

    return {
        user,
        transactions,
        requests,
        chartTransactions,
        mitraOptions,
        selectedMitra,
        setSelectedMitra,
        safetyStockAlerts,
        inventoryStats,
    };
}
