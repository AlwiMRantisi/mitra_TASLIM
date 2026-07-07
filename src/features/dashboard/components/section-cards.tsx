import {
	Archive,
	ArchiveX,
	ArrowsUpFromLine,
	Boxes,
	HelpCircle,
	TrendingUp,
	TrendingDown,
} from "lucide-react";
import { Area, AreaChart, XAxis } from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";

import type { InventoryStats } from "@/types/dashboard";

const createTrendSeries = (direction: "up" | "down") => {
	// Dummy data untuk chart, agar grafik tetap terlihat bagus meskipun value = 0
	const points =
		direction === "up"
			? [20, 35, 30, 50, 70, 65, 85, 100]
			: [100, 85, 90, 70, 50, 55, 30, 20];

	return points.map((point, index) => ({
		index,
		value: point,
	}));
};

export function SectionCards({
	stats,
	totalLabel = "Total Barang",
}: {
	stats: InventoryStats;
	totalLabel?: string;
}) {
	const { totalItems, tersedia, diluar, rusak, hilang } = stats;

	const cards = [
		{
			key: "total",
			label: totalLabel,
			value: totalItems,
			icon: Boxes,
			direction: "up" as const,
			percent: 12,
		},
		{
			key: "tersedia",
			label: "Tersedia",
			value: tersedia,
			icon: Archive,
			direction: "up" as const,
			percent: 8,
		},
		{
			key: "diluar",
			label: "Diluar",
			value: diluar,
			icon: ArrowsUpFromLine,
			direction: "down" as const,
			percent: 6,
		},
		{
			key: "rusak",
			label: "Rusak",
			value: rusak,
			icon: ArchiveX,
			direction: "down" as const,
			percent: 3,
		},
		{
			key: "hilang",
			label: "Hilang",
			value: hilang,
			icon: HelpCircle,
			direction: "up" as const,
			percent: 4,
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5 dark:*:data-[slot=card]:bg-card">
			{cards.map(
				({ key, label, value, icon: Icon, direction, percent }) => {
					const color = direction === "up" ? "oklch(0.696 0.17 162.48)" : "oklch(0.645 0.246 16.439)";
					const chartConfig = {
						value: {
							label: "Trend",
							color,
						},
					} satisfies ChartConfig;

					return (
						<Card
							key={key}
							className="@container/card relative overflow-hidden flex flex-col justify-between gap-0">
							<CardHeader className="flex flex-col w-full justify-between space-y-0">
								<div className="flex w-full items-center justify-between gap-2">
									<CardDescription className="">{label}</CardDescription>
									<div className="bg-primary/10 rounded-lg p-2">
										<Icon className="text-muted-foreground w-5 h-5" />
									</div>
								</div>
								<CardTitle className="flex items-end-safe gap-4 text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
									<div>
										{value}{" "}
										<span className="text-sm font-normal text-muted-foreground">
											Unit
										</span>
									</div>
									<div
										className={`inline-flex items-center gap-1 rounded-full px-2 py-1 max-h-5 text-xs font-medium ${direction === "up"
											? "text-emerald-600"
											: "text-rose-600"
											}`}>
										{direction === "up" ? (
											<TrendingUp className="h-4 w-4" />
										) : (
											<TrendingDown className="h-4 w-4" />
										)}
										<span>{percent}%</span>
									</div>
								</CardTitle>
							</CardHeader>
							<CardContent className="pb-0">
								<ChartContainer config={chartConfig} className="mt-2 h-[60px] w-full">
									<AreaChart
										accessibilityLayer
										data={createTrendSeries(direction)}
										margin={{
											left: 0,
											right: 0,
											top: 5,
											bottom: 0,
										}}>
										<defs>
											<linearGradient id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
												<stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.0} />
											</linearGradient>
										</defs>
										<XAxis dataKey="index" hide />
										<ChartTooltip
											cursor={false}
											content={<ChartTooltipContent indicator="line" hideLabel />}
										/>
										<Area
											dataKey="value"
											type="natural"
											fill={`url(#fill-${key})`}
											stroke="var(--color-value)"
											strokeWidth={2}
											dot={false}
											activeDot={false}
											isAnimationActive={false}
										/>
									</AreaChart>
								</ChartContainer>
							</CardContent>
						</Card>
					);
				},
			)}
		</div>
	);
}
