import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock } from "lucide-react";
import type { MitraPerformanceMetrics } from "@/types/dashboard";

interface LeaderboardCardProps {
  metrics: MitraPerformanceMetrics[];
  isLoading: boolean;
  className?: string;
}

export function LeaderboardCard({ metrics, isLoading, className }: LeaderboardCardProps) {
  // Sort by averageLifespanDays ascending, keeping only those with valid data
  const topPerformers = metrics
    .filter(m => m.averageLifespanDays !== null && m.averageLifespanDays > 0)
    .sort((a, b) => (a.averageLifespanDays as number) - (b.averageLifespanDays as number))
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card className={`flex h-full w-full flex-col ${className}`}>
        <CardHeader>
          <CardTitle>Top Velocity Mitra</CardTitle>
          <CardDescription>Loading data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={`flex h-full w-full flex-col ${className}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Top Velocity Mitra</CardTitle>
        </div>
        <CardDescription>Mitra dengan perputaran BAST tercepat</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {topPerformers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground p-4">
            <Clock className="mb-2 h-8 w-8 opacity-20" />
            <p>Belum ada data metrik perputaran BAST yang memadai.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topPerformers.map((mitra, index) => (
              <div key={mitra.id} className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">{mitra.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {mitra.requestCount} Request • {mitra.totalItems} Items
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    {mitra.averageLifespanDays} Hari
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">Rata-rata habis</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
