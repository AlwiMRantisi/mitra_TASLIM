import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FilePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, getBaseUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { openUrl } from "@tauri-apps/plugin-opener"
import { DigitalSignatureDialog } from "@/app/request/components/DigitalSignatureDialog"
import type { AuthUser } from "@/types/auth"
import type { DashboardRequest, RequestItem } from "@/types/transaction"

const PAGE_SIZE = 10

type StatusKey =
  | "menunggu"
  | "disetujui"
  | "siap"
  | "selesai"
  | "diterima"
  | "ditolak"
  | "dibatalkan"
  | "tolak"

const STATUS_STYLE: Record<StatusKey, string> = {
  menunggu: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  disetujui: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  siap: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  selesai: "bg-muted text-muted-foreground border-border",
  diterima: "bg-muted text-muted-foreground border-border",
  ditolak: "bg-red-500/10 text-red-600 border-red-500/20",
  dibatalkan: "bg-red-500/10 text-red-600 border-red-500/20",
  tolak: "bg-red-500/10 text-red-600 border-red-500/20",
}

const STATUS_LABEL: Record<StatusKey, string> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  siap: "Siap",
  selesai: "Selesai",
  diterima: "Diterima",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  tolak: "Ditolak",
}

type RawRecord = Record<string, unknown>

const asRecord = (value: unknown): RawRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {}

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined || typeof value === "object") return ""
  return String(value).trim()
}

const normalizeKey = (value: unknown) => normalizeText(value).toLowerCase()

const getStatusKey = (status: unknown): StatusKey | undefined => {
  const key = normalizeKey(status) as StatusKey
  return key in STATUS_STYLE ? key : undefined
}

const unwrapRequestList = (value: unknown) => {
  if (Array.isArray(value)) return value

  const payload = asRecord(value)
  for (const key of ["data", "requests", "items", "results"]) {
    const nested = payload[key]
    if (Array.isArray(nested)) return nested
  }

  return []
}

const readFirstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = normalizeText(value)
    if (text) return text
  }

  return ""
}

const readNumber = (value: unknown, fallback = 0) => {
  const numberValue = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const getTimestamp = (value?: string) => {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

const normalizeRequestItem = (value: unknown, index: number): RequestItem => {
  const item = asRecord(value)
  const category = asRecord(item.materialCategory)
  const brand = asRecord(item.brand)
  const model = asRecord(item.model)

  return {
    id: readNumber(item.id, index),
    category: readFirstText(item.category, category.nama, category.name, "-"),
    brand: readFirstText(item.brand, brand.nama, brand.name, "-"),
    model: readFirstText(item.model, model.nama, model.name),
    quantity: readNumber(item.quantity),
    unit: readFirstText(item.unit, "Unit"),
  }
}

const normalizeRequest = (value: unknown): DashboardRequest => {
  const request = asRecord(value)
  const requester = asRecord(request.requester)
  const requesterProfile = asRecord(requester.profile)
  const rawItems = Array.isArray(request.requestItems) ? request.requestItems : []
  const requestItems = rawItems.map(normalizeRequestItem)
  const adminRemarks = readFirstText(
    request.adminRemarks,
    request.adminNotes,
    request.adminNote,
    request.remarks,
    request.rejectionReason,
    request.rejectionNotes,
    request.cancelReason
  )

  // Normalize deliveryDocument for BAST signing status
  const rawDoc = asRecord(request.deliveryDocument)
  const deliveryDocument =
    request.deliveryDocument != null
      ? {
          kpSignedById: normalizeText(rawDoc.kpSignedById) || null,
          picSignedById: normalizeText(rawDoc.picSignedById) || null,
        }
      : null

  return {
    id: readFirstText(request.id),
    requestNumber: readFirstText(request.requestNumber, request.nomor, request.id, "-"),
    requesterName: readFirstText(
      request.requesterName,
      requesterProfile.nama,
      requesterProfile.name,
      requester.username
    ),
    partnerCategory: readFirstText(request.partnerCategory, requesterProfile.partnerType),
    itemsCount:
      typeof request.itemsCount === "number"
        ? request.itemsCount
        : requestItems.reduce((total, item) => total + item.quantity, 0),
    itemsDetail: readFirstText(request.itemsDetail),
    status: readFirstText(request.status, "Menunggu"),
    notes: readFirstText(request.notes),
    adminRemarks: adminRemarks || undefined,
    requestedAt: readFirstText(request.requestedAt, request.createdAt, request.updatedAt),
    requestedDeliveryDate: readFirstText(request.requestedDeliveryDate),
    requestItems,
    deliveryDocument,
  }
}

const requestBelongsToUser = (
  rawValue: unknown,
  request: DashboardRequest,
  user: AuthUser | null
) => {
  if (!user) return false

  const raw = asRecord(rawValue)
  const requester = asRecord(raw.requester)
  const requesterProfile = asRecord(requester.profile)
  const partner = asRecord(raw.partner)

  const userIds = [user.id, user.partnerId, user.identityCode].map(normalizeKey).filter(Boolean)
  const requestIds = [
    raw.requesterId,
    raw.userId,
    raw.partnerId,
    raw.mitraId,
    requester.id,
    requesterProfile.id,
    requesterProfile.identityCode,
    requesterProfile.kode,
    partner.id,
  ]
    .map(normalizeKey)
    .filter(Boolean)

  if (userIds.some((id) => requestIds.includes(id))) return true

  const requesterName = normalizeKey(request.requesterName)
  const identityCode = normalizeKey(user.identityCode)

  return (
    requesterName === normalizeKey(user.displayName) ||
    requesterName === normalizeKey(user.username) ||
    Boolean(identityCode && requesterName.includes(identityCode))
  )
}

const getItemsSummary = (request: DashboardRequest) => {
  if (request.itemsDetail) return request.itemsDetail

  if (request.requestItems && request.requestItems.length > 0) {
    return request.requestItems
      .map((item) => {
        const brand = item.brand && item.brand !== "-" ? ` / ${item.brand}` : ""
        const unit = item.unit ? ` ${item.unit}` : ""
        return `${item.category}${brand} x${item.quantity}${unit}`
      })
      .join(", ")
  }

  return request.itemsCount ? `${request.itemsCount} item` : "-"
}

const getAdminRemarks = (request: DashboardRequest) => {
  if (request.adminRemarks?.trim()) return request.adminRemarks

  const statusKey = getStatusKey(request.status)
  if (statusKey && ["ditolak", "dibatalkan", "tolak"].includes(statusKey)) {
    return request.notes?.trim() || "-"
  }

  return "-"
}

const getSearchText = (request: DashboardRequest) =>
  [
    request.requestNumber,
    request.status,
    request.requesterName,
    request.partnerCategory,
    request.notes,
    request.adminRemarks,
    request.requestedDeliveryDate,
    getItemsSummary(request),
    request.requestItems
      ?.map((item) => [item.category, item.brand, item.model, item.quantity, item.unit].join(" "))
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

function StatusBadge({ status }: { status: string }) {
  const key = getStatusKey(status)
  const styleClass = key ? STATUS_STYLE[key] : "bg-muted text-muted-foreground border-border"
  const label = key ? STATUS_LABEL[key] : normalizeText(status) || "-"

  return (
    <Badge variant="outline" className={`px-2 py-1 text-xs font-medium ${styleClass}`}>
      {label}
    </Badge>
  )
}

export default function PartnerRequestHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [allRequests, setAllRequests] = useState<DashboardRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  // BAST state
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null)
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setAllRequests([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const res = await api.get("/requests")
      const rawRequests = unwrapRequestList(res.data)
      const myRequests = rawRequests
        .map((raw) => ({ raw, request: normalizeRequest(raw) }))
        .filter(({ raw, request }) => requestBelongsToUser(raw, request, user))
        .map(({ request }) => request)
        .sort((a, b) => getTimestamp(b.requestedAt) - getTimestamp(a.requestedAt))

      setAllRequests(myRequests)
    } catch (error) {
      console.error("Gagal memuat riwayat permintaan:", error)
      setLoadError("Gagal memuat riwayat permintaan.")
      toast.error("Gagal memuat riwayat permintaan.")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // ── BAST handlers ─────────────────────────────────────────────────────────

  const handleOpenBastPdf = useCallback(async (requestId: string) => {
    setOpeningPdfId(requestId)
    try {
      const token = localStorage.getItem("arxiva-auth-token") || ""
      const url = `${getBaseUrl()}/requests/${requestId}/bast-pdf?token=${token}`
      await openUrl(url)
    } catch {
      toast.error("Gagal membuka PDF BAST")
    } finally {
      setOpeningPdfId(null)
    }
  }, [])

  const handleOpenSignDialog = useCallback((requestId: string) => {
    setSigningRequestId(requestId)
    setSignDialogOpen(true)
  }, [])

  const handleSignComplete = useCallback(async () => {
    if (!signingRequestId) return
    try {
      await api.post(`/requests/${signingRequestId}/sign`)
      toast.success("Dokumen BAST berhasil ditandatangani")
      setSignDialogOpen(false)
      setSigningRequestId(null)
      // Update local state so the sign button reflects the change
      setAllRequests((prev) =>
        prev.map((req) =>
          req.id === signingRequestId
            ? {
                ...req,
                deliveryDocument: {
                  ...req.deliveryDocument,
                  picSignedById: user?.id ?? "signed",
                },
              }
            : req
        )
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menandatangani dokumen BAST"
      toast.error(msg)
    }
  }, [signingRequestId, user?.id])

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return allRequests
    return allRequests.filter((request) => getSearchText(request).includes(query))
  }, [allRequests, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(page, 1), totalPages))
  }, [totalPages])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-"

    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return "-"

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Riwayat Permintaan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pantau status semua permintaan material yang telah Anda ajukan
          </p>
        </div>
        <Button
          id="btn-ajukan-request-baru"
          className="shrink-0 gap-2 cursor-pointer"
          onClick={() => navigate("/partner-request/new")}
        >
          <FilePlus className="h-4 w-4" />
          Ajukan Request Baru
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-[9px] size-4 text-muted-foreground" />
          <Input
            id="search-request-history"
            placeholder="Cari no. request atau item..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="cursor-pointer"
          onClick={fetchRequests}
          disabled={isLoading}
          aria-label="Muat ulang riwayat permintaan"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 pl-4">No</TableHead>
              <TableHead>No. Request</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Catatan Admin</TableHead>
              <TableHead className="text-center">Dokumen BAST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memuat riwayat permintaan...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <AlertTriangle className="h-10 w-10 text-destructive/70" />
                    <p className="text-sm font-medium">{loadError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 gap-1.5 cursor-pointer"
                      onClick={fetchRequests}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Muat Ulang
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 opacity-30" />
                    {searchTerm ? (
                      <p className="text-sm">Tidak ada hasil untuk pencarian ini</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Belum ada permintaan</p>
                        <p className="text-xs">Ajukan permintaan material pertama Anda</p>
                        <Button
                          size="sm"
                          className="mt-1 gap-1.5 cursor-pointer"
                          onClick={() => navigate("/partner-request/new")}
                        >
                          <FilePlus className="h-4 w-4" />
                          Ajukan Request
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRequests.map((req, idx) => {
                const itemSummary = getItemsSummary(req)
                const adminRemarks = getAdminRemarks(req)
                const statusUpper = req.status?.toUpperCase?.()?.trim() ?? ""
                const hasBast = ["SIAP", "SELESAI", "DITERIMA"].includes(statusUpper)
                const canSign =
                  statusUpper === "SIAP" && !req.deliveryDocument?.picSignedById
                const isSigned = !!req.deliveryDocument?.picSignedById
                const isOpeningPdf = openingPdfId === req.id

                return (
                  <TableRow key={req.id || req.requestNumber} className="hover:bg-muted/40">
                    <TableCell className="pl-4 text-muted-foreground">
                      {(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {req.requestNumber || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(req.requestedAt)}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <span className="block truncate text-sm" title={itemSummary}>
                        {itemSummary}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {req.itemsCount ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                      <span className="block truncate" title={adminRemarks}>
                        {adminRemarks}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasBast ? (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Open PDF */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                            title="Buka PDF BAST"
                            disabled={isOpeningPdf}
                            onClick={() => handleOpenBastPdf(req.id)}
                          >
                            {isOpeningPdf ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            BAST
                          </Button>

                          {/* PIC Sign button — only on SIAP */}
                          {canSign && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                              title="Tanda tangani BAST"
                              onClick={() => handleOpenSignDialog(req.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Tanda Tangan
                            </Button>
                          )}

                          {/* Already signed indicator */}
                          {!canSign && isSigned && (
                            <Badge
                              variant="outline"
                              className="h-8 gap-1 px-2 text-xs font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                              <Pencil className="h-3 w-3" />
                              Signed
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && filteredRequests.length > PAGE_SIZE && (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} dari{" "}
            {filteredRequests.length} permintaan
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => page - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="rounded border px-3 py-1 text-xs font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => page + 1)}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* BAST Digital Signature Dialog */}
      <DigitalSignatureDialog
        open={signDialogOpen}
        onOpenChange={(open) => {
          setSignDialogOpen(open)
          if (!open) setSigningRequestId(null)
        }}
        title="Tanda Tangan Digital BAST"
        description="Berikan tanda tangan Anda sebagai pihak penerima untuk dokumen BAST ini."
        onSignComplete={handleSignComplete}
      />
    </div>
  )
}
