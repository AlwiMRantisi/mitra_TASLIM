"use client"

import { ArrowUpRight, SquareArrowOutUpRight, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export const description = "A stacked bar chart"

const chartData = [
  { branch: "Jakarta", tersedia: 186, terpakai: 80 },
  { branch: "Bandung", tersedia: 305, terpakai: 200 },
  { branch: "Palembang", tersedia: 237, terpakai: 120 },
  { branch: "Surabaya", tersedia: 273, terpakai: 190 },
  { branch: "Yogyakarta", tersedia: 209, terpakai: 130 },
  { branch: "Malang", tersedia: 214, terpakai: 140 },
  // { branch: "Makassar", tersedia: 214, terpakai: 140, tablet: 85 },
  { branch: "Ciamis", tersedia: 170, terpakai: 120 },

]

const chartConfig = {
  tersedia: {
    label: "Tersedia",
    color: "var(--chart-1)",
  },
  terpakai: {
    label: "Terpakai",
    color: "var(--chart-2)",
  }
} satisfies ChartConfig

const dataWithTotal = chartData
  .map(item => ({
    ...item,
    total: item.tersedia + item.terpakai
  }))
  .sort((a, b) => a.tersedia - b.tersedia)

export function ChartBarMixed({ className }: { className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Distribusi Unit</CardTitle>
          <CardDescription>Alokasi unit di berbagai lokasi</CardDescription>
        </div>
        <div className="rounded-full p-1.5 cursor-pointer transition-colors duration-300 ease-in-out bg-foreground">
          <ArrowUpRight size={16} className="text-secondary" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart
            accessibilityLayer
            data={dataWithTotal}
            layout="vertical"
            margin={{
              left: 20,
              right: 40,
            }}
            barCategoryGap={5}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />

            <XAxis type="number" hide />
            <YAxis
              dataKey="branch"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              alignmentBaseline="after-edge"
              tickFormatter={(value) =>
                typeof value === "string" && value.length > 12
                  ? `${value.substring(0, 12)}...`
                  : value
              }
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <ChartLegend
              content={<ChartLegendContent />}
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ bottom: 0 }}
            />
            <Bar dataKey="tersedia" stackId="a" fill="var(--color-tersedia)" radius={8} stroke="var(--card)" strokeWidth={6} isAnimationActive={false} />
            <Bar dataKey="terpakai" stackId="a" fill="var(--color-terpakai)" radius={8} stroke="var(--card)" strokeWidth={6} isAnimationActive={false}>
              <LabelList
                dataKey="total"
                position="right"
                offset={8}
                className="fill-foreground font-semibold"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
