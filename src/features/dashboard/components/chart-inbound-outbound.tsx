"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const chartConfig = {
    masuk: {
        label: "Inbound",
        color: "var(--chart-1)",
    },
    keluar: {
        label: "Outbound",
        color: "var(--chart-2)",
    },
} satisfies ChartConfig

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`)

interface ChartInboundOutboundProps {
    data: { date: string; masuk: number; keluar: number }[];
    timeRange: string;
    onTimeRangeChange: (val: string) => void;
    className?: string;
}

export function ChartInboundOutbound({
    data,
    timeRange,
    onTimeRangeChange,
    className,
}: ChartInboundOutboundProps) {
    const totalTransaksi = React.useMemo(
        () =>
            data.reduce(
                (total, item) => total + item.masuk + item.keluar,
                0
            ),
        [data]
    )

    return (
        <Card className={`@container/card flex flex-col shadow-sm ${className || ""}`}>
            <CardHeader className="">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base">Inbound vs Outbound</CardTitle>
                        <CardDescription className="text-xs mt-1">
                            {totalTransaksi} aktivitas transaksi
                        </CardDescription>
                    </div>
                    <CardAction className="flex items-center gap-2 m-0 p-0">
                        <ToggleGroup
                            type="single"
                            value={timeRange}
                            onValueChange={(value) => {
                                if (value) onTimeRangeChange(value)
                            }}
                            variant="outline"
                            className="hidden *:data-[slot=toggle-group-item]:px-3 *:data-[slot=toggle-group-item]:text-xs @[400px]/card:flex"
                        >
                            <ToggleGroupItem value="7d">7 Hari</ToggleGroupItem>
                            <ToggleGroupItem value="30d">30 Hari</ToggleGroupItem>
                            <ToggleGroupItem value="90d">90 Hari</ToggleGroupItem>
                        </ToggleGroup>
                        <Select value={timeRange} onValueChange={onTimeRangeChange}>
                            <SelectTrigger
                                className="flex w-24 h-8 text-xs @[400px]/card:hidden"
                                aria-label="Pilih rentang waktu"
                            >
                                <SelectValue placeholder="30 Hari" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="7d" className="text-xs">7 Hari</SelectItem>
                                <SelectItem value="30d" className="text-xs">30 Hari</SelectItem>
                                <SelectItem value="90d" className="text-xs">90 Hari</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardAction>
                </div>
            </CardHeader>
            <CardContent className="flex-1 px-2 pt-4 sm:px-6">
                {data.length === 0 ? (
                    <div className="aspect-auto h-[260px] w-full flex items-center justify-center text-sm text-muted-foreground">
                        Belum ada aktivitas
                    </div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[260px] w-full"
                    >
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="fillMasuk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-masuk)" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="var(--color-masuk)" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="fillKeluar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-keluar)" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="var(--color-keluar)" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.4} />
                            <XAxis
                                dataKey="date"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                tickFormatter={(value) => {
                                    const date = parseDateKey(value)
                                    return date.toLocaleDateString("id-ID", {
                                        month: "short",
                                        day: "numeric",
                                    })
                                }}
                            />
                            <YAxis
                                type="number"
                                hide={true}
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
                            <ChartLegend
                                content={<ChartLegendContent />}
                                verticalAlign="bottom"
                                align="center"
                            />
                            <Area
                                dataKey="keluar"
                                type="step"
                                fill="url(#fillKeluar)"
                                fillOpacity={1}
                                stroke="var(--color-keluar)"
                                strokeWidth={2}
                                stackId="1"
                                isAnimationActive={true}
                            />
                            <Area
                                dataKey="masuk"
                                type="step"
                                fill="url(#fillMasuk)"
                                fillOpacity={1}
                                stroke="var(--color-masuk)"
                                strokeWidth={2}
                                stackId="2"
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}
