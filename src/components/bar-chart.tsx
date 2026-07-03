"use client"

import { SquareArrowOutUpRight, TrendingUp } from "lucide-react"
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export const description = "A stacked bar chart"

const chartData = [
  { branch: "Jakarta", desktop: 186, mobile: 80, tablet: 60 },
  { branch: "Bandung", desktop: 305, mobile: 200, tablet: 95 },
  { branch: "Palembang", desktop: 237, mobile: 120, tablet: 80 },
  { branch: "Surabaya", desktop: 273, mobile: 190, tablet: 110 },
  { branch: "Yogyakarta", desktop: 209, mobile: 130, tablet: 75 },
  { branch: "Malang", desktop: 214, mobile: 140, tablet: 85 },
  { branch: "Other", desktop: 170, mobile: 120, tablet: 90 },

]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
  tablet: {
    label: "Tablet",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function ChartBarMixed({ className }: { className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Distribusi Unit</CardTitle>
          <CardDescription>Alokasi unit di berbagai lokasi</CardDescription>
        </div>
        <div className="rounded-full p-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-secondary">
          <SquareArrowOutUpRight size={16} className="text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
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
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="desktop" stackId="a" fill="var(--color-mobile)" radius={8} stroke="var(--card)" strokeWidth={6} isAnimationActive={false} />
            <Bar dataKey="mobile" stackId="a" fill="var(--color-desktop)" radius={8} stroke="var(--card)" strokeWidth={6} isAnimationActive={false}>
              <LabelList
                dataKey="mobile"
                position="right"
                offset={8}
                className="fill-muted-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
