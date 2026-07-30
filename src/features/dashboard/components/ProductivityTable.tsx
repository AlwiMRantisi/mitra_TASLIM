import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import type { MitraPerformanceMetrics } from "@/types/dashboard";

interface ProductivityTableProps {
  metrics: MitraPerformanceMetrics[];
  isLoading: boolean;
  className?: string;
}

const getBadgeVariant = (status: MitraPerformanceMetrics["status"]) => {
  switch (status) {
    case "Fast":
      return "default";
    case "Steady":
      return "secondary";
    case "Slow":
      return "outline";
    case "Idle":
      return "destructive";
    default:
      return "secondary";
  }
};

const getBadgeColor = (status: MitraPerformanceMetrics["status"]) => {
  switch (status) {
    case "Fast":
      return "bg-green-500 hover:bg-green-600 text-white";
    case "Steady":
      return "bg-blue-500 hover:bg-blue-600 text-white";
    case "Slow":
      return "bg-yellow-500 hover:bg-yellow-600 text-white";
    case "Idle":
      return "bg-red-500 hover:bg-red-600 text-white";
    default:
      return "bg-gray-200 text-gray-800";
  }
};

export function ProductivityTable({ metrics, isLoading, className }: ProductivityTableProps) {
  // Sort primarily by status priority, then by lifespan
  const sortedMetrics = [...metrics].sort((a, b) => {
    if (a.isIdleStock && !b.isIdleStock) return -1;
    if (!a.isIdleStock && b.isIdleStock) return 1;

    // Valid lifespan comes before null
    if (a.averageLifespanDays !== null && b.averageLifespanDays === null) return -1;
    if (a.averageLifespanDays === null && b.averageLifespanDays !== null) return 1;

    if (a.averageLifespanDays !== null && b.averageLifespanDays !== null) {
      return a.averageLifespanDays - b.averageLifespanDays;
    }

    return b.requestCount - a.requestCount;
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Analisis Produktivitas Mitra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Memuat data performa mitra...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Analisis Produktivitas Mitra</CardTitle>
        </div>
        <CardDescription>Rincian kecepatan perputaran (depletion rate) per mitra</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Mitra</TableHead>
                <TableHead className="text-center">Total BAST</TableHead>
                <TableHead className="text-center">Total Item</TableHead>
                <TableHead className="text-center">Avg. Lifespan (Hari)</TableHead>
                <TableHead className="text-center">Days Idle</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMetrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    Belum ada data metrik mitra.
                  </TableCell>
                </TableRow>
              ) : (
                sortedMetrics.map((mitra) => (
                  <TableRow key={mitra.id}>
                    <TableCell className="font-medium">{mitra.name}</TableCell>
                    <TableCell className="text-center">{mitra.requestCount}</TableCell>
                    <TableCell className="text-center">{mitra.totalItems}</TableCell>
                    <TableCell className="text-center">
                      {mitra.averageLifespanDays !== null ? mitra.averageLifespanDays : "-"}
                    </TableCell>
                    <TableCell className="text-center">{mitra.daysSinceLastRequest}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={getBadgeColor(mitra.status)} variant={getBadgeVariant(mitra.status)}>
                        {mitra.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
