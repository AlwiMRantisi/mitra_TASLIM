import {
	Archive,
	ArchiveX,
	ArrowsUpFromLine,
	Boxes,
	HelpCircle,
	TrendingUp,
	TrendingDown,
} from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import type { InventoryStats } from "@/types/dashboard";

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
			percent: 12.5,
		},
		{
			key: "tersedia",
			label: "Tersedia",
			value: tersedia,
			icon: Archive,
			direction: "up" as const,
			percent: 8.2,
		},
		{
			key: "diluar",
			label: "Diluar",
			value: diluar,
			icon: ArrowsUpFromLine,
			direction: "down" as const,
			percent: 4.1,
		},
		{
			key: "rusak",
			label: "Rusak",
			value: rusak,
			icon: ArchiveX,
			direction: "down" as const,
			percent: 1.2,
		},
		{
			key: "hilang",
			label: "Hilang",
			value: hilang,
			icon: HelpCircle,
			direction: "down" as const,
			percent: 0.5,
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
			{cards.map(
				({ key, label, value, icon: Icon, direction, percent }) => {
					return (
						<Card
							key={key}
							className="@container/card relative overflow-hidden flex flex-col justify-between gap-0 border-border">
							<CardHeader className="flex flex-col w-full justify-between space-y-0">
								<div className="flex w-full items-center justify-between gap-2">
									<CardDescription className="font-medium text-muted-foreground">{label}</CardDescription>
									<div className="rounded-lg p-2 bg-muted/50">
										<Icon className="text-muted-foreground w-4 h-4" />
									</div>
								</div>
								<CardTitle className="flex items-end gap-2 text-2xl font-bold tabular-nums @[250px]/card:text-3xl pt-2">
									<div>
										{value}{" "}
									</div>
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<div
									className={`inline-flex items-center gap-1 text-xs font-medium ${direction === "up"
										? "text-emerald-600 dark:text-emerald-500"
										: "text-destructive dark:text-destructive"
										}`}>
									{direction === "up" ? (
										<TrendingUp className="h-3.5 w-3.5" />
									) : (
										<TrendingDown className="h-3.5 w-3.5" />
									)}
									<span>{direction === "up" ? "+" : "-"}{percent}% <span className="text-muted-foreground font-normal ml-0.5">dari bulan lalu</span></span>
								</div>
							</CardContent>
						</Card>
					);
				},
			)}
		</div>
	);
}
