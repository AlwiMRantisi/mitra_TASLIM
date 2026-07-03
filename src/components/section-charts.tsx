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
    const [items, setItems] = React.useState<NotificationItem[]>([])

    const fetchNotifications = React.useCallback(async () => {
        if (isMitra) return

        try {
            const data = await invoke<NotificationItem[]>("get_notifications")
            setItems(data)
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
                id: "mitra-tersedia",
                title: "Barang tersedia",
                message: `${stats.tersedia} unit milik ${displayName || "mitra"} saat ini berstatus Tersedia.`,
                type: "success",
                date: "",
                isRead: true,
                generated: true,
            },
            {
                id: "mitra-diluar",
                title: "Barang diluar",
                message: `${stats.diluar} unit tercatat berstatus Diluar.`,
                type: "info",
                date: "",
                isRead: true,
                generated: true,
            },
            ...(stats.rusak > 0
                ? [{
                    id: "mitra-rusak",
                    title: "Perhatian barang rusak",
                    message: `${stats.rusak} unit tercatat berstatus Rusak.`,
                    type: "warning",
                    date: "",
                    isRead: true,
                    generated: true,
                }]
                : []),
            ...(stats.hilang > 0
                ? [{
                    id: "mitra-hilang",
                    title: "Perhatian barang hilang",
                    message: `${stats.hilang} unit tercatat berstatus Hilang.`,
                    type: "error",
                    date: "",
                    isRead: true,
                    generated: true,
                }]
                : []),
        ],
        [displayName, stats]
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
    const displayedNotifications = isMitra
        ? [...safetyStockNotifications, ...mitraNotifications]
        : [...safetyStockNotifications, ...items]
    const unreadCount = isMitra
        ? 0
        : displayedNotifications.filter((n) => !n.isRead).length

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
            await invoke("mark_notification_read", { id })
            fetchNotifications()
        } catch (error) {
            console.error("Failed to mark as read:", error)
        }
    }

    const markAllAsRead = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (isMitra) return

        try {
            await invoke("mark_all_notifications_read")
            fetchNotifications()
        } catch (error) {
            console.error("Failed to mark all as read:", error)
        }
    }

    const deleteNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (isMitra) return

        try {
            await invoke("delete_notification", { id })
            fetchNotifications()
        } catch (error) {
            console.error("Failed to delete notification:", error)
        }
    }

    const getIconProps = (type: string) => {
        switch (type) {
            case "warning":
                return { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" }
            case "success":
                return { icon: Check, color: "text-emerald-500", bg: "bg-emerald-500/10" }
            case "error":
                return { icon: X, color: "text-red-600", bg: "bg-red-600/10" }
            case "info":
            default:
                return { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 lg:px-6">
            {/* Card 1 */}
            <ChartBarMixed className="col-span-2 h-full pb-0" />

            {/* Card 3 */}
            <Card className="flex flex-col h-full">
                <CardHeader className="items-center pb-0">
                    <CardTitle>
                        {isMitra ? "Komposisi Barang Mitra" : "Kapasitas Penyimpanan"}
                    </CardTitle>
                    <CardDescription>
                        {isMitra ? displayName : "Kapasitas gudang aktif"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square w-full max-w-[250px]"
                        initialDimension={{ width: 250, height: 250 }}
                    >
                        <RadialBarChart
                            data={chartData}
                            startAngle={90}
                            endAngle={-270}
                            outerRadius={90}
                            innerRadius={80}
                        >
                            <PolarGrid
                                gridType="circle"
                                radialLines={false}
                                stroke="none"
                                className="first:fill-muted last:fill-background"
                                polarRadius={[90, 80]}
                            />
                            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                            <RadialBar dataKey="visitors" background cornerRadius={10} isAnimationActive={false} />
                            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                            return (
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        className="fill-foreground text-4xl font-bold"
                                                    >
                                                        {capacityPercent}%
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 24}
                                                        className="fill-muted-foreground"
                                                    >
                                                        {isMitra ? "Tersedia" : "Terisi"}
                                                    </tspan>
                                                </text>
                                            )
                                        }
                                    }}
                                />
                            </PolarRadiusAxis>
                        </RadialBarChart>
                    </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm bg-card mt-auto">
                    <div className="grid grid-cols-3 gap-2 w-full">
                        <div className="flex flex-col text-center">
                            <p className="text-muted-foreground font-normal text-xs">
                                {isMitra ? "Total" : "Kapasitas"}
                            </p>
                            <p className="font-bold text-md">{displayedTotal}</p>
                        </div>
                        <div className="flex flex-col text-center">
                            <p className="text-muted-foreground font-normal text-xs">
                                {isMitra ? "Tersedia" : "Digunakan"}
                            </p>
                            <p className="font-bold text-md">{displayedUsed}</p>
                        </div>
                        <div className="flex flex-col text-center">
                            <p className="text-muted-foreground font-normal text-xs">
                                {isMitra ? "Diluar" : "Tersisa"}
                            </p>
                            <p className="font-bold text-md">{displayedRemaining}</p>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
