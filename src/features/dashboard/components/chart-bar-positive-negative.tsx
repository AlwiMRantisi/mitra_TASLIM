"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"

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
    ChartLegend,
    ChartLegendContent,
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

import type { ChartTransaction } from "@/types/transaction"

const chartConfig = {
    masuk: {
        label: "Receives",
        color: "oklch(0.696 0.17 162.48)", // emerald/green
    },
    keluar: {
        label: "Orders",
        color: "oklch(0.685 0.169 237.323)", // blue/negative color
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
) => {
    const rangeDays = getRangeDays(timeRange)
    const validDates = transactions
        .map((transaction) => transaction.tanggal)
        .filter((date) => !Number.isNaN(parseDateKey(date).getTime()))
        .sort()

    const referenceDate = validDates.length
        ? parseDateKey(validDates[validDates.length - 1])
        : new Date()
    const startDate = addDays(referenceDate, -(rangeDays - 1))

    const points = new Map<string, { date: string; masuk: number; keluar: number }>()
    for (let day = 0; day < rangeDays; day += 1) {
        const date = addDays(startDate, day)
        const dateKey = toDateKey(date)
        points.set(dateKey, {
            date: dateKey,
            masuk: 0,
            keluar: 0,
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
            point.keluar -= 1 // Negative for outgoing
        }
    }

    return Array.from(points.values())
}

export function ChartBarPositiveNegative({
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

    const chartData = React.useMemo(() => {
        const rangeDays = getRangeDays(timeRange)
        const referenceDate = new Date()
        const startDate = addDays(referenceDate, -(rangeDays - 1))

        const dummy = []
        for (let day = 0; day < rangeDays; day += 1) {
            const date = addDays(startDate, day)
            const dateKey = toDateKey(date)

            // Data dummy: Masuk (10 - 60), Keluar (-50 - -5)
            const masuk = Math.floor(Math.random() * 50) + 10
            const keluar = -(Math.floor(Math.random() * 45) + 5)

            dummy.push({
                date: dateKey,
                masuk,
                keluar,
            })
        }
        return dummy
    }, [timeRange])

    const totalTransaksi = React.useMemo(
        () =>
            chartData.reduce(
                (total, item) => total + item.masuk + Math.abs(item.keluar),
                0
            ),
        [chartData]
    )

    return (
        <Card className={`@container/card flex flex-col ${className || ""}`}>
            <CardHeader>
                <CardTitle>Receives vs Orders</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">
                        {totalTransaksi} aktivitas dalam {getRangeDays(timeRange)} hari terakhir
                    </span>
                    <span className="@[540px]/card:hidden">
                        {totalTransaksi} aktivitas
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
                    <BarChart
                        data={chartData}
                        stackOffset="sign"
                        barCategoryGap={4}
                        margin={{ top: 20, right: 12, left: 12, bottom: 0 }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => {
                                const date = parseDateKey(value)
                                return date.toLocaleDateString("id-ID", {
                                    month: "short",
                                    day: "numeric",
                                })
                            }}
                        />
                        <YAxis type="number" hide />
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
                        <ChartLegend
                            content={<ChartLegendContent />}
                            verticalAlign="bottom"
                            align="center"
                            wrapperStyle={{ bottom: 0 }}
                        />
                        <ReferenceLine y={0} stroke="var(--border)" />
                        <Bar dataKey="masuk" stackId="a" fill="var(--color-masuk)" radius={[5, 5, 0, 0]} barSize={40} />
                        <Bar dataKey="keluar" stackId="a" fill="var(--color-keluar)" radius={[5, 5, 0, 0]} barSize={40} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}