import { Badge } from "@/components/ui/badge"
import {
  INTER_PARTNER_STATUS_LABEL,
  type InterPartnerStatus,
} from "@/app/peminjaman-mitra/types"
import { resolveStatusKey } from "@/services/peminjamanMitraService"

const STATUS_STYLE: Record<string, string> = {
  menunggu_persetujuan: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  menunggu_scan_pemberi: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  menunggu_scan_penerima: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  siap: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  selesai: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  diterima: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  ditolak: "text-destructive bg-red-500/10 border-0",
  dibatalkan: "text-destructive bg-red-500/10 border-0",
}

export function InterPartnerStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const key = resolveStatusKey(status) as InterPartnerStatus
  const label = INTER_PARTNER_STATUS_LABEL[key] ?? status
  const styleClass = STATUS_STYLE[key] ?? "text-muted-foreground bg-muted border-0"

  return (
    <Badge
      variant="outline"
      className={`flex items-center justify-center gap-1 px-2 py-1 ${styleClass} ${className ?? ""}`.trim()}
    >
      <span>{label}</span>
    </Badge>
  )
}
