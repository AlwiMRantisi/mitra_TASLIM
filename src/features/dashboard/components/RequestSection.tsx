import { useNavigate } from "react-router-dom"
import { ArrowUpRight, InboxIcon, Clock, CheckCircle2, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { RequestSummary } from "@/types/transaction"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface RequestCounts {
    menunggu: number
    disetujui: number
    siap: number
}

interface RequestSectionProps {
    requests: RequestSummary[]
    counts: RequestCounts
    isLoading: boolean
    className?: string
}

function getStatusBadgeClass(status: string): string {
    switch (status.toUpperCase()) {
        case "MENUNGGU":
            return "bg-gray-500 text-gray-500"
        case "DISETUJUI":
            return "bg-blue-500 text-blue-500"
        case "SIAP":
            return "bg-purple-500 text-purple-500"
        case "DITERIMA":
        case "SELESAI":
            return "bg-emerald-500 text-emerald-500"
        case "DITOLAK":
        case "DIBATALKAN":
            return "bg-rose-500 text-rose-500"
        default:
            return "bg-muted-foreground text-muted-foreground"
    }
}

// Komponen StatusBadge dengan variant outline dan dot warna
function StatusBadge({ status }: { status: string }) {
    const colorClass = getStatusBadgeClass(status)
    const label = getStatusLabel(status)
    return (
        <Badge variant={"outline"}>
            <span className={cn("size-2 rounded-full mr-1", colorClass.split(' ')[0])} />
            {label}
        </Badge>
    )
}

function getStatusLabel(status: string): string {
    const map: Record<string, string> = {
        MENUNGGU: "Menunggu",
        DISETUJUI: "Disetujui",
        SIAP: "Siap",
        DITERIMA: "Diterima",
        SELESAI: "Selesai",
        DITOLAK: "Ditolak",
        DIBATALKAN: "Dibatalkan",
        DRAFT: "Draft",
    }
    return map[status.toUpperCase()] ?? status
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
    } catch {
        return "-"
    }
}

export function RequestSection({ requests, counts, isLoading, className }: RequestSectionProps) {
    const navigate = useNavigate()
    const waitingRequests = requests.filter(req => req.status.toUpperCase() === "MENUNGGU")

    return (
        <Card className={cn("flex flex-col h-full shadow-sm", className)}>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Request Masuk</CardTitle>
                <div
                    onClick={() => navigate("/request")}
                    className="rounded-full p-1.5 cursor-pointer bg-muted transition-colors hover:bg-muted/80"
                >
                    <ArrowUpRight size={14} className="text-muted-foreground" />
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col">
                {/* 3 Mini KPI Cards */}
                <div className="grid grid-cols-3 gap-2.5 px-4 pb-4">
                    {[
                        { label: "Menunggu", count: counts.menunggu, icon: Clock },
                        { label: "Disetujui", count: counts.disetujui, icon: CheckCircle2 },
                        { label: "Siap", count: counts.siap, icon: Package },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            onClick={() => navigate(`/request?tab=${kpi.label}`)}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border border-input bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all"
                            )}
                        >
                            <div className="rounded-full p-2 bg-muted text-muted-foreground shrink-0">
                                <kpi.icon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                                <span className="text-xl font-bold tracking-tight mt-0.5 tabular-nums">
                                    {isLoading ? "-" : kpi.count}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table Request */}
                <div className="flex-1 overflow-x-auto px-4 pb-4">
                    {isLoading ? (
                        <div className="flex flex-col space-y-3 py-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-8 w-full" />
                            ))}
                        </div>
                    ) : waitingRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                            <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                                <InboxIcon className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Belum ada request terbaru</p>
                        </div>
                    ) : (
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[50px] text-xs h-9">No</TableHead>
                                        <TableHead className="text-xs h-9">No. Permintaan</TableHead>
                                        <TableHead className="text-xs h-9">Tanggal Masuk</TableHead>
                                        <TableHead className="text-xs h-9">Mitra</TableHead>
                                        <TableHead className="text-xs h-9">Kategori</TableHead>
                                        <TableHead className="text-right text-xs h-9">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {waitingRequests.map((req, index) => (
                                        <TableRow
                                            key={req.id}
                                            className="cursor-pointer group"
                                            onClick={() => navigate(`/request?tab=${getStatusLabel(req.status)}`)}
                                        >
                                            <TableCell className="text-[13px] text-muted-foreground py-2.5">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="text-[13px] font-medium py-2.5 group-hover:text-primary transition-colors">
                                                {req.requestNumber}
                                            </TableCell>
                                            <TableCell className="text-[13px] text-muted-foreground py-2.5 whitespace-nowrap">
                                                {formatDate(req.requestedAt)}
                                            </TableCell>
                                            <TableCell className="text-[13px] py-2.5 truncate max-w-[150px]" title={req.requesterName}>
                                                {req.requesterName}
                                            </TableCell>
                                            <TableCell className="text-[13px] py-2.5 text-muted-foreground">
                                                {req.partnerCategory}
                                            </TableCell>
                                            <TableCell className="text-right py-2.5">
                                                <StatusBadge status={req.status} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
