"use client"

import { ArrowUpRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
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
import { cn } from "@/lib/utils"

const chartConfig = {
  tersedia: {
    label: "Tersedia",
    color: "hsl(var(--foreground))",
  },
  diluar: {
    label: "Terpakai",
    color: "hsl(var(--muted-foreground))",
  }
} satisfies ChartConfig

interface ChartBarMixedProps {
  className?: string;
  data: { mitra: string; tersedia: number; diluar: number; total: number }[];
}

export function ChartBarMixed({ className, data }: ChartBarMixedProps) {
  // Urutkan mitra secara menaik (ascending) berdasarkan total aset (mitra kritis)
  const sortedData = [...data].sort((a, b) => a.total - b.total);
  const bottom5 = sortedData.slice(0, 5);
  const others = sortedData.slice(5);

  const displayData = [...bottom5];
  if (others.length > 0) {
    displayData.push({
      mitra: "Other",
      tersedia: others.reduce((sum, item) => sum + item.tersedia, 0),
      diluar: others.reduce((sum, item) => sum + item.diluar, 0),
      total: others.reduce((sum, item) => sum + item.total, 0),
    });
  }

  return (
    <Card className={cn("flex flex-col shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Distribusi Aset</CardTitle>
        </div>
        <div className="rounded-full p-1.5 cursor-pointer bg-muted transition-colors hover:bg-muted/80">
          <ArrowUpRight size={14} className="text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-2 sm:px-6">
        {displayData.length === 0 ? (
          <div className="aspect-auto h-[260px] w-full flex items-center justify-center text-sm text-muted-foreground">
            Belum ada data distribusi
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart
              accessibilityLayer
              data={displayData}
              layout="vertical"
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="mitra"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={85}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(value) =>
                  typeof value === "string" && value.length > 12
                    ? `${value.substring(0, 11)}...`
                    : value
                }
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <ChartLegend
                content={<ChartLegendContent />}
                verticalAlign="bottom"
                align="center"
              />
              <Bar
                dataKey="tersedia"
                stackId="a"
                fill="var(--foreground)"
                radius={8}
                stroke="var(--card)"
                strokeWidth={6}
                barSize={24}
                isAnimationActive={false}
              />
              <Bar
                dataKey="diluar"
                name="Terpakai"
                stackId="a"
                fill="var(--muted-foreground)"
                radius={8}
                stroke="var(--card)"
                strokeWidth={6}
                barSize={24}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="total"
                  position="right"
                  offset={8}
                  className="fill-foreground font-semibold"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
