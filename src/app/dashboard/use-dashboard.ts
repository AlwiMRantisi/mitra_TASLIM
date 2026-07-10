import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DashboardService } from '@/services/dashboard.service';
import type { Transaction, DashboardTransaction, RequestSummary, ActivityItem } from "@/types/transaction"
import type { InventoryStats } from "@/types/dashboard"
import { useAuth } from "@/lib/auth"

const DASHBOARD_TRANSACTION_LIMIT = 6;
const DASHBOARD_REFRESH_INTERVAL = 5000;

const getRangeDays = (timeRange: string) => {
    if (timeRange === "30d") return 30;
    if (timeRange === "7d") return 7;
    if (timeRange === "90d") return 90;
    return 30;
}
const toDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
}
const parseDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`)
const addDays = (date: Date, days: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

export function useDashboard() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [chartTransactions, setChartTransactions] = useState<Transaction[]>([]);
    const [mitraOptions, setMitraOptions] = useState<string[]>([]);
    const [selectedMitra, setSelectedMitra] = useState("all");
    const [timeRange, setTimeRange] = useState("30d");

    const [inventoryStats, setInventoryStats] = useState<InventoryStats>({
        totalItems: 0, tersedia: 0, diluar: 0, rusak: 0, hilang: 0,
    });
    const [mitraDistribution, setMitraDistribution] = useState<{ mitra: string; tersedia: number; diluar: number; total: number }[]>([]);

    const [allRequests, setAllRequests] = useState<RequestSummary[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<ActivityItem[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [isLoadingActivity, setIsLoadingActivity] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    const isFetchingRef = useRef(false);

    const fetchDashboardData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const [transactionData, itemData, requestData] = await Promise.all([
                DashboardService.fetchTransactions(),
                DashboardService.fetchItems(),
                DashboardService.fetchRequests(),
            ]);

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

            // Grouping by Mitra
            const mitraMap = new Map<string, { tersedia: number; diluar: number }>();
            visibleItems.forEach((item: any) => {
                const mitra = (item.mitra || "Lainnya").trim();
                const status = (item.status || "").trim().toLowerCase();

                if (!mitraMap.has(mitra)) {
                    mitraMap.set(mitra, { tersedia: 0, diluar: 0 });
                }
                const current = mitraMap.get(mitra)!;
                if (status === "tersedia") {
                    current.tersedia += 1;
                } else {
                    current.diluar += 1;
                }
            });
            const distribution = Array.from(mitraMap.entries())
                .map(([mitra, counts]) => ({
                    mitra,
                    ...counts,
                    total: counts.tersedia + counts.diluar
                }))
                .sort((a, b) => b.total - a.total);
            setMitraDistribution(distribution);

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

            const mappedRequests: RequestSummary[] = (visibleRequests as any[]).map((r) => ({
                id: r.id,
                requestNumber: r.requestNumber,
                requesterName: r.requesterName || "Unknown",
                partnerCategory: r.partnerCategory,
                status: r.status,
                requestedAt: r.requestedAt || r.createdAt,
                itemsCount: r.itemsCount ?? 0,
            }));
            setAllRequests(mappedRequests);
            setIsLoadingRequests(false);

            const mappedActivities: ActivityItem[] = (visibleTransactions as any[])
                .slice(0, 10)
                .map((t) => ({
                    id: t.id,
                    type: (t.kategori?.toUpperCase() as ActivityItem["type"]) || "MASUK",
                    serialNumber: t.sn || t.serialNumber || "-",
                    mitra: t.mitra || "KP Tasikmalaya",
                    createdAt: t.createdAt || t.tanggal,
                }));
            setRecentTransactions(mappedActivities);
            setIsLoadingActivity(false);

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
            setIsLoading(false);
        } catch (error) {
            console.error("Gagal mengambil data dashboard:", error);
            setIsLoadingRequests(false);
            setIsLoadingActivity(false);
            setIsLoading(false);
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

    const requestCounts = {
        menunggu: allRequests.filter((r) => r.status === "MENUNGGU").length,
        disetujui: allRequests.filter((r) => r.status === "DISETUJUI").length,
        siap: allRequests.filter((r) => r.status === "SIAP").length,
    };

    const recentRequests = [...allRequests]
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
        .slice(0, 5);

    const transactionSeries = useMemo(() => {
        const rangeDays = getRangeDays(timeRange);
        if (!chartTransactions.length) {
            // Generate empty series
            const referenceDate = new Date();
            const startDate = addDays(referenceDate, -(rangeDays - 1));
            const points = [];
            for (let day = 0; day < rangeDays; day += 1) {
                points.push({ date: toDateKey(addDays(startDate, day)), masuk: 0, keluar: 0 });
            }
            return points;
        }

        const validDates = chartTransactions
            .map((t) => t.tanggal)
            .filter((date) => !Number.isNaN(parseDateKey(date).getTime()))
            .sort();

        const referenceDate = validDates.length
            ? parseDateKey(validDates[validDates.length - 1])
            : new Date();
        const startDate = addDays(referenceDate, -(rangeDays - 1));

        const points = new Map<string, { date: string; masuk: number; keluar: number }>();
        for (let day = 0; day < rangeDays; day += 1) {
            const date = addDays(startDate, day);
            const dateKey = toDateKey(date);
            points.set(dateKey, { date: dateKey, masuk: 0, keluar: 0 });
        }

        for (const transaction of chartTransactions) {
            if (selectedMitra !== "all" && transaction.mitra?.trim().toLowerCase() !== selectedMitra.trim().toLowerCase()) {
                continue;
            }
            const date = parseDateKey(transaction.tanggal);
            if (Number.isNaN(date.getTime()) || date < startDate || date > referenceDate) {
                continue;
            }
            const dateKey = toDateKey(date);
            const point = points.get(dateKey);
            if (!point) continue;

            const kategori = (transaction.kategori || "").toLowerCase();
            if (kategori === "masuk") point.masuk += 1;
            else if (kategori === "keluar") point.keluar += 1;
        }
        return Array.from(points.values());
    }, [chartTransactions, timeRange, selectedMitra]);

    return {
        user,
        transactions,
        requests,
        chartTransactions,
        mitraOptions,
        selectedMitra,
        setSelectedMitra,
        timeRange,
        setTimeRange,
        mitraDistribution,
        transactionSeries,
        inventoryStats,
        requestCounts,
        recentRequests,
        recentTransactions,
        isLoadingRequests,
        isLoadingActivity,
        isLoading,
    };
}
