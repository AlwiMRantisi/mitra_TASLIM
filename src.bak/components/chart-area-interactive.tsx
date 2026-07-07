"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Grafik aktivitas transaksi barang"

import type { ChartTransaction } from "@/types/transaction"
import type { ChartDataPoint } from "@/types/dashboard"

const chartConfig = {
    masuk: {
        label: "Barang Masuk",
        color: "oklch(0.696 0.17 162.48)",
    },
    keluar: {
        label: "Barang Keluar",
        color: "oklch(0.685 0.169 237.323)",
    },
    rusak: {
        label: "Rusak",
        color: "oklch(0.645 0.246 16.439)",
    },
} satisfies ChartConfig

const getRangeDays = (timeRange: string) => {
    if (timeRange === "30d") return 30
    if (timeRange === "7d") return 7
    return 90
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

const buildDailyTransactionData = (
    transactions: ChartTransaction[],
    timeRange: string
): ChartDataPoint[] => {
    const rangeDays = getRangeDays(timeRange)
    const validDates = transactions
        .map((transaction) => transaction.tanggal)
        .filter((date) => !Number.isNaN(parseDateKey(date).getTime()))
        .sort()

    const referenceDate = validDates.length
        ? parseDateKey(validDates[validDates.length - 1])
        : new Date()
    const startDate = addDays(referenceDate, -(rangeDays - 1))

    const points = new Map<string, ChartDataPoint>()
    for (let day = 0; day < rangeDays; day += 1) {
        const date = addDays(startDate, day)
        const dateKey = toDateKey(date)
        points.set(dateKey, {
            date: dateKey,
            masuk: 0,
            keluar: 0,
            rusak: 0,
        })
    }

    for (const transaction of transactions) {
        const date = parseDateKey(transaction.tanggal)
        if (Number.isNaN(date.getTime()) || date < startDate || date > referenceDate) {
            continue
        }

        const dateKey = toDateKey(date)
        const point = points.get(dateKey)
        if (!point) continue

        const kategori = transaction.kategori.toLowerCase()
        if (kategori === "masuk") {
            point.masuk += 1
        } else if (kategori === "keluar") {
            point.keluar += 1
        } else if (kategori === "rusak") {
            point.rusak += 1
        }
    }

    return Array.from(points.values())
}

export function ChartAreaInteractive({
    transactions,
    showMitraFilter = false,
    mitraOptions = [],
    selectedMitra = "all",
    onMitraChange,
    className,
}: {
    transactions: ChartTransaction[]
    showMitraFilter?: boolean
    mitraOptions?: string[]
    selectedMitra?: string
    onMitraChange?: (value: string) => void
    className?: string
}) {
    const isMobile = useIsMobile()
    const [timeRange, setTimeRange] = React.useState("7d")

    React.useEffect(() => {
        if (isMobile) {
            setTimeRange("7d")
        }
    }, [isMobile])

    const chartData = React.useMemo(
        () => buildDailyTransactionData(transactions, timeRange),
        [transactions, timeRange]
    )

    const totalTransaksi = React.useMemo(
        () =>
            chartData.reduce(
                (total, item) => total + item.masuk + item.keluar + item.rusak,
                0
            ),
        [chartData]
    )

    return (
        <Card className={`@container/card flex flex-col ${className || ""}`}>
            <CardHeader>
                <CardTitle>Aktivitas Transaksi</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">
                        {totalTransaksi} transaksi dalam {getRangeDays(timeRange)} hari terakhir
                    </span>
                    <span className="@[540px]/card:hidden">
                        {totalTransaksi} transaksi
                    </span>
                </CardDescription>
                <CardAction className="flex flex-wrap items-center justify-end gap-2">
                    <div>{showMitraFilter ? (
                        <Select
                            value={selectedMitra}
                            onValueChange={(value) => onMitraChange?.(value)}
                        >
                            <SelectTrigger
                                className="hidden min-w-[200px] @[767px]/card:flex"
                                size="sm"
                                aria-label="Filter Mitra"
                            >
                                <SelectValue placeholder="Semua Mitra" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {mitraOptions.map((mitra) => (
                                    <SelectItem key={mitra} value={mitra} className="rounded-lg">
                                        {mitra === "all" ? "Semua Mitra" : mitra}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : null}
                    </div>
                    <ToggleGroup
                        type="single"
                        value={timeRange}
                        onValueChange={(value) => {
                            if (value) setTimeRange(value)
                        }}
                        variant="outline"
                        className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
                    >
                        <ToggleGroupItem value="7d">7 hari</ToggleGroupItem>
                        <ToggleGroupItem value="30d">30 hari</ToggleGroupItem>
                        <ToggleGroupItem value="90d">3 bulan</ToggleGroupItem>
                    </ToggleGroup>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger
                            className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                            size="sm"
                            aria-label="Pilih rentang waktu"
                        >
                            <SelectValue placeholder="3 bulan" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="7d" className="rounded-lg">
                                7 hari
                            </SelectItem>
                            <SelectItem value="30d" className="rounded-lg">
                                30 hari
                            </SelectItem>
                            <SelectItem value="90d" className="rounded-lg">
                                3 bulan
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </CardAction>
            </CardHeader>
            <CardContent className="flex-1 px-2 pt-4 sm:px-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="fillMasuk" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-masuk)"
                                    stopOpacity={0.65}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-masuk)"
                                    stopOpacity={0.08}
                                />
                            </linearGradient>
                            <linearGradient id="fillKeluar" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-keluar)"
                                    stopOpacity={0.55}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-keluar)"
                                    stopOpacity={0.08}
                                />
                            </linearGradient>
                            <linearGradient id="fillRusak" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-rusak)"
                                    stopOpacity={0.45}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-rusak)"
                                    stopOpacity={0.06}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <YAxis
                            type="number"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            width={48}
                            domain={[0, "dataMax"]}
                            tickFormatter={(value) =>
                                typeof value === "number"
                                    ? value.toLocaleString("id-ID")
                                    : String(value)
                            }
                        />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = parseDateKey(value)
                                return date.toLocaleDateString("id-ID", {
                                    month: "short",
                                    day: "numeric",
                                })
                            }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => {
                                        return parseDateKey(String(value)).toLocaleDateString("id-ID", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="masuk"
                            type="linear"
                            fill="url(#fillMasuk)"
                            stroke="var(--color-masuk)"
                            strokeWidth={2}
                        />
                        <Area
                            dataKey="keluar"
                            type="linear"
                            fill="url(#fillKeluar)"
                            stroke="var(--color-keluar)"
                            strokeWidth={2}
                        />
                        <Area
                            dataKey="rusak"
                            type="linear"
                            fill="url(#fillRusak)"
                            stroke="var(--color-rusak)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
