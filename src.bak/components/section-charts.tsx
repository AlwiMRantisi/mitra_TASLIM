"use client"

import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { ArrowRight, BadgeCheck, Check, Info, AlertTriangle, PackagePlus, PackageMinus, Lightbulb, X } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import {
    Label,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    RadialBar,
    RadialBarChart,
} from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    type ChartConfig,
} from "@/components/ui/chart"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { InventoryStats, NotificationItem, SafetyStockAlert } from "@/types/dashboard"
import { ChartBarMixed } from "./bar-chart"
import { DataTable } from "./transaction-table"
import requestData from "@/data/request.json"

const getBaseUrl = () => {
    const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const getHeaders = () => {
    const token = localStorage.getItem("arxiva-auth-token");
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `${token}`;
    }
    return headers;
};

const chartConfig = {
    visitors: {
        label: "Terisi",
    },
    safari: {
        label: "Terisi",
        color: "var(--chart-2)",
    },
} satisfies ChartConfig

export function SectionCharts({
    isMitra = false,
    displayName,
    stats,
    safetyStockAlerts,
}: {
    isMitra?: boolean
    displayName?: string
    stats: InventoryStats
    safetyStockAlerts: SafetyStockAlert[]
}) {
    const navigate = useNavigate()
    const [items, setItems] = React.useState<NotificationItem[]>([
        {
            id: "dummy-1",
            title: "Stok Barang Masuk",
            message: "50 unit 'Kabel UTP' berhasil ditambahkan ke gudang utama.",
            type: "success",
            date: new Date().toISOString(),
            isRead: false,
            generated: false,
        },
        {
            id: "dummy-2",
            title: "Peringatan Safety Stock",
            message: "Stok 'Router MikroTik' tersisa 5 unit (batas minimum 10).",
            type: "warning",
            date: new Date(Date.now() - 3600000).toISOString(),
            isRead: true,
            generated: false,
            targetUrl: "/data-barang",
        },
        {
            id: "dummy-3",
            title: "Barang Keluar",
            message: "10 unit 'Switch Hub' telah dikeluarkan untuk project Alpha.",
            type: "info",
            date: new Date(Date.now() - 7200000).toISOString(),
            isRead: false,
            generated: false,
        },
        {
            id: "dummy-4",
            title: "Barang Rusak",
            message: "2 unit 'Monitor 24 inch' dilaporkan rusak.",
            type: "error",
            date: new Date(Date.now() - 86400000).toISOString(),
            isRead: true,
            generated: false,
        }
    ])

    const fetchNotifications = React.useCallback(async () => {
        if (isMitra) return

        try {
            // const data = await invoke<NotificationItem[]>("get_notifications")
            // setItems(data)
        } catch (error) {
            console.error("Failed to fetch notifications:", error)
        }
    }, [isMitra])

    React.useEffect(() => {
        if (isMitra) return

        fetchNotifications()
        const interval = setInterval(fetchNotifications, 10000)
        return () => clearInterval(interval)
    }, [fetchNotifications, isMitra])

    const mitraNotifications = React.useMemo<NotificationItem[]>(
        () => [
            {
                id: "log-1",
                title: "PT Naratas",
                message: "Router MikroTik RB750 (SN: 12345) dipindahkan dari KP Tasikmalaya ke PT Naratas.",
                type: "success",
                date: new Date(Date.now() - 1800000).toISOString(),
                isRead: true,
                generated: false,
            },
            {
                id: "log-2",
                title: "PT Naratas",
                message: "Switch Hub (SN: 54321) ditransfer dari KP Tasikmalaya ke PT Naratas.",
                type: "info",
                date: new Date(Date.now() - 7200000).toISOString(),
                isRead: true,
                generated: false,
            },
            {
                id: "log-3",
                title: "PT Alpha Indonesia",
                message: "Menerima 2 unit Monitor 24 inch dari KP Tasikmalaya (Rusak).",
                type: "warning",
                date: new Date(Date.now() - 86400000).toISOString(),
                isRead: true,
                generated: false,
            },
            {
                id: "log-4",
                title: "Penerimaan Barang",
                message: "Batch baru: 50 unit Kabel UTP diterima di KP Tasikmalaya.",
                type: "success",
                date: new Date(Date.now() - 172800000).toISOString(),
                isRead: true,
                generated: false,
            }
        ],
        []
    )
    const safetyStockNotifications = React.useMemo<NotificationItem[]>(
        () =>
            safetyStockAlerts.map((alert) => ({
                id: `safety-stock-${alert.category}`,
                title: `Safety stock ${alert.status.toLowerCase()}`,
                message:
                    alert.status === "Habis"
                        ? `${alert.category} tidak memiliki stok tersedia. Batas minimum ${alert.safetyStock} unit.`
                        : `${alert.category} tersisa ${alert.available} unit dari batas minimum ${alert.safetyStock} unit.`,
                type: alert.status === "Habis" ? "error" : "warning",
                date: "",
                isRead: true,
                generated: true,
                targetUrl: "/data-barang",
            })),
        [safetyStockAlerts]
    )
    const displayedNotifications = [...safetyStockNotifications, ...items]
    const unreadCount = displayedNotifications.filter((n) => !n.isRead).length

    // Storage capacity from DB
    const [totalCapacity, setTotalCapacity] = React.useState(0)
    const [usedCapacity, setUsedCapacity] = React.useState(0)
    const displayedTotal = isMitra ? stats.totalItems : totalCapacity
    const displayedUsed = isMitra ? stats.tersedia : usedCapacity
    const displayedRemaining = isMitra ? stats.diluar : totalCapacity - usedCapacity
    const capacityPercent = displayedTotal > 0
        ? Math.round((displayedUsed / displayedTotal) * 100)
        : 0

    const chartData = React.useMemo(() => [
        { browser: "safari", visitors: capacityPercent, fill: "var(--color-safari)" },
    ], [capacityPercent])

    React.useEffect(() => {
        const fetchCapacity = async () => {
            if (isMitra) return

            try {
                const res = await fetch(`${getBaseUrl()}/locations`, {
                    method: "GET",
                    headers: getHeaders(),
                })
                if (!res.ok) throw new Error("Gagal mengambil data lokasi")
                const locations = await res.json()

                let total = 0
                let used = 0
                for (const loc of locations) {
                    if (loc.name === "Keluar" || loc.name === "Diluar") {
                        continue
                    }
                    if (
                        (loc.owner || "KP Tasikmalaya").trim().toLowerCase() !== "kp tasikmalaya"
                    ) {
                        continue
                    }

                    if (loc.type === "Rak" && loc.levels) {
                        for (const lvl of loc.levels) {
                            total += lvl.capacity || 0
                            used += lvl.usedCapacity || 0
                        }
                    } else {
                        total += loc.capacity || 0
                        used += loc.usedCapacity || 0
                    }
                }
                setTotalCapacity(total)
                setUsedCapacity(used)
            } catch (error) {
                console.error("Gagal mengambil data kapasitas:", error)
            }
        }
        fetchCapacity()
    }, [isMitra])

    const markAsRead = async (id: string) => {
        if (isMitra) return

        try {
            // await invoke("mark_notification_read", { id })
            setItems(prev => prev.map(item => item.id === id ? { ...item, isRead: true } : item))
            fetchNotifications()
        } catch (error) {
            console.error("Failed to mark as read:", error)
        }
    }

    const markAllAsRead = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (isMitra) return

        try {
            // await invoke("mark_all_notifications_read")
            setItems(prev => prev.map(item => ({ ...item, isRead: true })))
            fetchNotifications()
        } catch (error) {
            console.error("Failed to mark all as read:", error)
        }
    }

    const deleteNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (isMitra) return

        try {
            // await invoke("delete_notification", { id })
            setItems(prev => prev.filter(item => item.id !== id))
            fetchNotifications()
        } catch (error) {
            console.error("Failed to delete notification:", error)
        }
    }
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="flex flex-col gap-4 px-4 lg:px-6">

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[380px]">

                {/* Card 1: Tabel Permintaan */}
                <DataTable data={requestData.filter(req => req.status.toLowerCase() === 'menunggu')} className="flex-1 w-full lg:col-span-2" />

                {/* Card 2: Update Terbaru / Log Sistem */}
                <Card className="flex flex-col h-full lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="space-y-1">
                            <CardTitle>Latest Updates</CardTitle>
                            <CardDescription>
                                Histori perpindahan aset antar cabang dan mitra
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-full max-h-[350px] lg:max-h-none w-full px-6">
                            <div className="py-4 space-y-6">
                                {mitraNotifications.length > 0 ? (
                                    mitraNotifications.map((item) => {
                                        return (
                                            <div key={item.id} className="flex flex-row gap-3">
                                                <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5 shrink-0">
                                                </div>
                                                <div className="flex flex-col space-y-1 flex-1">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                                                        <p className="text-sm font-semibold leading-none">{item.title}</p>
                                                        {item.date && (
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {formatTime(item.date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground leading-snug">
                                                        {item.message}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <Info className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">Tidak ada log aktivitas</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
