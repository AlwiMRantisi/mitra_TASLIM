import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Trophy, Zap, Award, Info } from "lucide-react";
import type { MitraPerformanceMetrics } from "@/types/dashboard";

interface LeaderboardCardProps {
  metrics: MitraPerformanceMetrics[];
  isLoading: boolean;
  className?: string;
  activeHoverId?: string | null;
  onHoverMitra?: (id: string | null) => void;
}

export function LeaderboardCard({
  metrics,
  isLoading,
  className,
  activeHoverId,
  onHoverMitra,
}: LeaderboardCardProps) {
  // Sort by averageLifespanDays ascending, keeping only those with valid data
  const topPerformers = metrics
    .filter((m) => m.averageLifespanDays !== null && m.averageLifespanDays > 0)
    .sort((a, b) => (a.averageLifespanDays as number) - (b.averageLifespanDays as number))
    .slice(0, 5);

  const maxLifespan = topPerformers.length > 0
    ? Math.max(...topPerformers.map((m) => m.averageLifespanDays as number))
    : 1;

  if (isLoading) {
    return (
      <Card className={`flex h-full w-full flex-col ${className}`}>
        <CardHeader>
          <Skeleton className="h-6 w-40 mb-1" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getPodiumBadge = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 font-bold shadow-xs">
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
        );
      case 1:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-400/15 text-slate-600 border border-slate-400/30 dark:bg-slate-400/20 dark:text-slate-300 font-bold shadow-xs">
            <Award className="h-4 w-4 text-slate-400" />
          </div>
        );
      case 2:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700/15 text-amber-800 border border-amber-700/30 dark:bg-amber-700/20 dark:text-amber-400 font-bold shadow-xs">
            <Award className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {index + 1}
          </div>
        );
    }
  };

  return (
    <Card className={`flex h-full w-full flex-col ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Top Velocity Mitra</CardTitle>
            <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-normal px-2 py-0.5">
              <Zap className="h-3 w-3 fill-emerald-500/20" /> Tercepat
            </Badge>
          </div>
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
          <TooltipProvider>
            <div className="space-y-3">
              {topPerformers.map((mitra, index) => {
                const isHovered = activeHoverId === mitra.id;
                // Higher percentage = faster velocity (inverted from days)
                const relativeVelocityPercent = maxLifespan > 0
                  ? Math.max(15, Math.round((1 - (mitra.averageLifespanDays! / (maxLifespan * 1.2))) * 100))
                  : 50;

                return (
                  <div
                    key={mitra.id}
                    onMouseEnter={() => onHoverMitra?.(mitra.id)}
                    onMouseLeave={() => onHoverMitra?.(null)}
                    className={`flex flex-col gap-2 rounded-lg p-2.5 border transition-all duration-200 ${
                      isHovered
                        ? "bg-primary/5 border-primary/30 shadow-xs ring-1 ring-primary/20 scale-[1.01]"
                        : "border-border/40 hover:bg-muted/40 hover:border-border"
                    }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {getPodiumBadge(index)}
                        <div>
                          <p className="text-sm font-medium leading-tight">{mitra.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {mitra.requestCount} Request • {mitra.totalItems} Items
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold text-xs px-2 py-0.5">
                          {mitra.averageLifespanDays} Hari
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 cursor-help hover:text-foreground transition-colors">
                              Rata-rata habis <Info className="h-2.5 w-2.5 opacity-60" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-[200px]">
                            Rata-rata durasi stok sejak BAST diterima mitra hingga terpakai seluruhnya.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Relative Velocity Bar Indicator */}
                    <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden flex items-center">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${relativeVelocityPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
