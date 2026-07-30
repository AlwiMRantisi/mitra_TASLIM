import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { MitraPerformanceMetrics } from "@/types/dashboard";

interface IdleStockAlertProps {
  metrics: MitraPerformanceMetrics[];
  isLoading: boolean;
  className?: string;
}

export function IdleStockAlert({ metrics, isLoading, className }: IdleStockAlertProps) {
  if (isLoading) return null;

  const idleMitras = metrics.filter(m => m.isIdleStock);

  if (idleMitras.length === 0) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Peringatan Potensi Idle Stock!</AlertTitle>
      <AlertDescription>
        Terdapat <strong>{idleMitras.length} Mitra</strong> yang belum mengajukan request baru dalam lebih dari 30 hari. Ini mungkin menandakan penumpukan stok.
      </AlertDescription>
    </Alert>
  );
}
