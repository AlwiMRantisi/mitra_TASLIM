import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FilePlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  ArrowRightLeft,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api, getBaseUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { normalizePartnerList } from "@/lib/partner-options"
import { openUrl } from "@tauri-apps/plugin-opener"
import { DigitalSignatureDialog } from "@/app/request/components/DigitalSignatureDialog"

const PAGE_SIZE = 10

type StatusKey =
  | "menunggu"
  | "disetujui"
  | "siap"
  | "selesai"
  | "diterima"
  | "ditolak"
  | "dibatalkan"
  | "menunggu_persetujuan"
  | "menunggu_scan_pemberi"
  | "menunggu_scan_penerima"

const STATUS_STYLE: Record<StatusKey, string> = {
  menunggu: "text-neutral-400 bg-neutral-500/20 border-0",
  disetujui: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  siap: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  selesai: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  diterima: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  ditolak: "text-destructive bg-red-500/10 border-0",
  dibatalkan: "text-destructive bg-red-500/10 border-0",
  menunggu_persetujuan: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  menunggu_scan_pemberi: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  menunggu_scan_penerima: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
}

const STATUS_LABEL: Record<StatusKey, string> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  siap: "Siap Serah Terima",
  selesai: "Selesai",
  diterima: "Diterima",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  menunggu_persetujuan: "Menunggu Persetujuan Admin",
  menunggu_scan_pemberi: "Menunggu Scan Pemberi",
  menunggu_scan_penerima: "Menunggu Scan Penerima",
}

const resolveApprovalStatus = (rec: RawRecord): StatusKey => {
  const rawValue = readFirstText(
    rec.status,
    rec.state,
    rec.approvalStatus,
    rec.approval_status,
    rec.approvalState,
    rec.adminApprovalStatus,
    rec.admin_status
  )

  const normalized = normalizeKey(rawValue)
  const providerScanned = Boolean(
    rec.providerScannedAt ||
      rec.provider_scanned_at ||
      rec.providerScanAt ||
      rec.providerScanned ||
      rec.provider_scanned ||
      ["provider_scanned", "provider scanned", "pemberi scan", "pemberi_scan"].includes(normalized)
  )
  const receiverScanned = Boolean(
    rec.receiverScannedAt ||
      rec.receiver_scanned_at ||
      rec.receiverScanAt ||
      rec.receiverScanned ||
      rec.receiver_scanned ||
      ["receiver_scanned", "receiver scanned", "penerima scan", "penerima_scan"].includes(normalized)
  )
  const isApproved = Boolean(rec.isApproved || rec.approved || rec.adminApproved || ["approved", "disetujui", "approved_by_admin"].includes(normalized))
  const isRejected = Boolean(rec.isRejected || rec.rejected || rec.adminRejected || ["rejected", "ditolak"].includes(normalized))

  if (["ditolak", "rejected", "tolak", "declined"].includes(normalized)) return "ditolak"
  if (["dibatalkan", "cancelled", "canceled", "cancel"].includes(normalized)) return "dibatalkan"
  if (receiverScanned || ["selesai", "completed", "done", "received", "diterima"].includes(normalized)) return "selesai"
  if (providerScanned || ["provider_scan", "pemberi_scan", "pemberi scan"].includes(normalized)) return "menunggu_scan_penerima"
  if (isApproved || ["disetujui", "approved", "setuju", "accepted", "approved_by_admin", "acc"].includes(normalized)) return "menunggu_scan_pemberi"
  if (["menunggu", "pending", "waiting", "waiting approval", "menunggu persetujuan", "pending approval"].includes(normalized)) {
    return "menunggu_persetujuan"
  }
  if (["siap", "ready", "siap serah terima"].includes(normalized)) return "siap"
  if (["diterima", "received", "accepted_by_receiver"].includes(normalized)) return "diterima"

  if (isRejected) return "ditolak"

  return "menunggu_persetujuan"
}

type RawRecord = Record<string, unknown>

const asRecord = (value: unknown): RawRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {}

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined || typeof value === "object") return ""
  return String(value).trim()
}

const normalizeKey = (value: unknown) => normalizeText(value).toLowerCase()

const getStatusKey = (status: unknown): StatusKey => {
  const key = normalizeKey(status) as StatusKey
  return key in STATUS_STYLE ? key : "menunggu"
}

const unwrapList = (value: unknown) => {
  if (Array.isArray(value)) return value
  const payload = asRecord(value)
  for (const key of ["data", "requests", "items", "results"]) {
    const nested = payload[key]
    if (Array.isArray(nested)) return nested
  }
  return []
}

const normalizePartnerRecord = (value: unknown): Record<string, unknown> => {
  const record = asRecord(value)
  const profile = asRecord(record.profile)
  const partner = asRecord(record.partner)

  return {
    ...record,
    ...profile,
    ...partner,
    id: readFirstText(record.id, record.partnerId, profile.id, partner.id),
    partnerId: readFirstText(record.partnerId, record.partner_id, profile.partnerId, partner.partnerId),
    identityCode: readFirstText(record.identityCode, record.identity_code, profile.identityCode, partner.identityCode),
    name: readFirstText(record.name, record.fullName, profile.name, profile.fullName, partner.name),
    displayName: readFirstText(record.displayName, record.display_name, profile.displayName, profile.display_name, partner.displayName),
    username: readFirstText(record.username, profile.username, partner.username),
    partnerName: readFirstText(record.partnerName, record.partner_name, profile.partnerName, partner.partnerName, record.name, profile.name, partner.name),
  }
}

const findUserMatch = (users: RawRecord[], candidates: unknown[]) => {
  const normalizedCandidates = candidates
    .map((candidate) => normalizeKey(candidate))
    .filter(Boolean)

  if (normalizedCandidates.length === 0) return null

  return users.find((user) => {
    const normalizedUser = normalizePartnerRecord(user)
    const userKeys = [
      normalizedUser.id,
      normalizedUser.partnerId,
      normalizedUser.identityCode,
      normalizedUser.username,
      normalizedUser.displayName,
      normalizedUser.name,
      normalizedUser.partnerName,
    ].map(normalizeKey).filter(Boolean)

    return normalizedCandidates.some((candidate) => userKeys.includes(candidate))
  }) ?? null
}

const readFirstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = normalizeText(value)
    if (text) return text
  }
  return ""
}

const readNumber = (value: unknown, fallback = 0) => {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

type PartnerOption = { id: string; name: string; code?: string }
type CategoryOption = { id: number | string; name: string }
type BrandOption = { id: number | string; name: string }

type RequestItem = {
  id: number
  category: string
  brand: string
  quantity: number
  unit: string
}

type InterPartnerRequest = {
  id: string
  requestNumber: string
  requesterPartnerId: string
  providerPartnerId: string
  requesterName: string
  providerName: string
  itemsCount: number
  itemsDetail: string
  status: string
  notes?: string
  requestedAt: string
  requestItems: RequestItem[]
  deliveryDocument?: {
    kpSignedById?: string | null
    picSignedById?: string | null
    driveViewUrl?: string | null
  } | null
}

function StatusBadge({ status }: { status: string }) {
  const key = getStatusKey(status)
  const styleClass = STATUS_STYLE[key]
  const label = STATUS_LABEL[key] || normalizeText(status) || "-"

  return (
    <Badge variant="outline" className={`flex items-center justify-center gap-1 px-2 py-1 ${styleClass}`}>
      <span>{label}</span>
    </Badge>
  )
}

// ─── Modal Form Permintaan Antar Mitra ──────────────────────────────────────

type ItemRow = {
  id: number
  categoryId: string
  brandId: string
  quantity: string
}

function InterPartnerRequestModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [targetPartnerId, setTargetPartnerId] = useState("")
  const [items, setItems] = useState<ItemRow[]>([{ id: Date.now(), categoryId: "", brandId: "", quantity: "1" }])
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(true)

  const fetchDropdowns = useCallback(async () => {
    setLoadingDropdowns(true)
    try {
      const [partnersRes, catRes, brandRes] = await Promise.all([
        api.get("/users").catch(() => ({ data: [] })),
        api.get("/categories").catch(() => ({ data: [] })),
        api.get("/brands").catch(() => ({ data: [] })),
      ])

      const normalizeForCurrentUser = (source: unknown): PartnerOption[] =>
        normalizePartnerList(source, {
          activeOnly: true,
          requireMitraRole: true,
          excludeIds: [user?.id, user?.partnerId, user?.identityCode],
          excludeNames: [user?.displayName, user?.username],
        }).map((partner) => ({
          id: partner.id,
          name: partner.name,
          code: partner.code,
        }))

      const pOptions = normalizeForCurrentUser(partnersRes.data)

      const cOptions: CategoryOption[] = unwrapList(catRes.data).map((c) => {
        const rec = asRecord(c)
        return { id: rec.id as number | string, name: readFirstText(rec.name, rec.nama) }
      })

      const bOptions: BrandOption[] = unwrapList(brandRes.data).map((b) => {
        const rec = asRecord(b)
        return { id: rec.id as number | string, name: readFirstText(rec.name, rec.nama) }
      })

      setPartners(pOptions)
      setCategories(cOptions)
      setBrands(bOptions)
    } catch (err) {
      console.error("Gagal memuat dropdown:", err)
    } finally {
      setLoadingDropdowns(false)
    }
  }, [user])

  useEffect(() => {
    if (isOpen) fetchDropdowns()
  }, [isOpen, fetchDropdowns])

  const addRow = () => setItems((prev) => [...prev, { id: Date.now(), categoryId: "", brandId: "", quantity: "1" }])

  const removeRow = (id: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRow = (id: number, field: keyof ItemRow, val: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!targetPartnerId) {
      toast.error("Pilih mitra tujuan terlebih dahulu.")
      return
    }
    for (const item of items) {
      if (!item.categoryId || !item.brandId || readNumber(item.quantity) <= 0) {
        toast.error("Lengkapi data barang dengan benar.")
        return
      }
    }

    setIsSubmitting(true)
    try {
      const payload = {
        requesterId: user?.id,
        providerPartnerId: targetPartnerId,
        notes: notes.trim(),
        items: items.map((r) => ({
          materialCategoryId: Number(r.categoryId),
          brandId: Number(r.brandId),
          quantity: Number(r.quantity),
        })),
      }

      await api.post("/requests", { ...payload, isInterPartner: true })
      toast.success("Permintaan antar mitra berhasil diajukan!")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengajukan permintaan"
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Permintaan Barang Antar Mitra
          </DialogTitle>
          <DialogDescription>
            Ajukan peminjaman atau permintaan material kepada sesama mitra.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <form id="inter-partner-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Target Partner Selection */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Pilih Mitra Tujuan (Pemberi)</Label>
              <Select value={targetPartnerId} onValueChange={setTargetPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mitra..." />
                </SelectTrigger>
                <SelectContent>
                  {partners.length > 0 ? (
                    partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada data mitra</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-semibold">Daftar Barang yang Diminta</Label>
              {loadingDropdowns ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Memuat opsi barang...</span>
                </div>
              ) : (
                items.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-3 items-end border rounded-lg p-4 bg-neutral-900/50 relative">
                    <span className="absolute -top-2.5 left-3 text-[10px] text-muted-foreground font-semibold bg-background border px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <div>
                      <Label className="text-xs mb-1 block">Kategori</Label>
                      <Select value={row.categoryId} onValueChange={(v) => updateRow(row.id, "categoryId", v)}>
                        <SelectTrigger><SelectValue placeholder="Kategori..." /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Merek</Label>
                      <Select value={row.brandId} onValueChange={(v) => updateRow(row.id, "brandId", v)}>
                        <SelectTrigger><SelectValue placeholder="Merek..." /></SelectTrigger>
                        <SelectContent>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Jumlah</Label>
                      <Input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={items.length <= 1}
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              <Button type="button" variant="outline" size="sm" className="self-start gap-1.5 mt-1" onClick={addRow}>
                <Plus className="h-4 w-4" /> Tambah Barang
              </Button>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes" className="text-sm font-semibold">Catatan Keperluan</Label>
              <Textarea
                id="notes"
                placeholder="Jelaskan keperluan peminjaman / permintaan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t bg-neutral-900/40 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="inter-partner-form" disabled={isSubmitting || loadingDropdowns} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Kirim Permintaan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function PeminjamanMitraPage() {
  const { user } = useAuth()

  const [allRequests, setAllRequests] = useState<InterPartnerRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null)
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const [requestsRes, usersRes] = await Promise.all([
        api.get("/requests?type=inter-partner").catch(() => api.get("/requests")),
        api.get("/users").catch(() => ({ data: [] })),
      ])

      const rawList = unwrapList(requestsRes.data)
      const users = unwrapList(usersRes.data).map(normalizePartnerRecord)

      const normalized: InterPartnerRequest[] = rawList
        .filter((raw) => {
          const rec = asRecord(raw)
          return rec.isInterPartner === true || rec.type === "inter-partner" || rec.requestType === "inter-partner"
        })
        .map((raw, idx) => {
        const rec = asRecord(raw)
        const req = asRecord(rec.requester || rec.requesterParty)
        const prov = asRecord(rec.provider || rec.providerParty)
        const rawItems = Array.isArray(rec.items || rec.requestItems) ? (rec.items || rec.requestItems) as unknown[] : []
        const rawDoc = asRecord(rec.deliveryDocument)

        const requesterMatch = findUserMatch(users, [
          rec.requesterId,
          rec.requesterPartnerId,
          raw.requesterId,
          raw.requesterPartnerId,
          req.id,
          req.partnerId,
          req.identityCode,
          req.username,
          req.name,
          req.partnerName,
          req.displayName,
        ])

        const providerMatch = findUserMatch(users, [
          rec.providerPartnerId,
          rec.providerId,
          raw.providerId,
          raw.providerPartnerId,
          prov.id,
          prov.partnerId,
          prov.identityCode,
          prov.username,
          prov.name,
          prov.partnerName,
          prov.displayName,
        ])

        const requesterName = readFirstText(
          requesterMatch?.partnerName,
          requesterMatch?.name,
          requesterMatch?.displayName,
          requesterMatch?.username,
          req.partnerName,
          req.name,
          req.username,
          "Mitra Peminta"
        )

        const providerName = readFirstText(
          providerMatch?.partnerName,
          providerMatch?.name,
          providerMatch?.displayName,
          providerMatch?.username,
          prov.partnerName,
          prov.name,
          prov.username,
          "Mitra Pemberi"
        )

        return {
          id: readFirstText(rec.id, rec._id, String(idx)),
          requestNumber: readFirstText(rec.requestNumber, rec.nomorRequest, `REQ-MITRA-${idx + 1}`),
          requesterPartnerId: readFirstText(rec.requesterPartnerId, rec.requesterId, req.partnerId, req.id, req.identityCode),
          providerPartnerId: readFirstText(rec.providerPartnerId, rec.providerId, prov.partnerId, prov.id, prov.identityCode),
          requesterName,
          providerName,
          itemsCount: rawItems.length || readNumber(rec.itemsCount, 1),
          itemsDetail: rawItems
            .map((it) => {
              const itemRec = asRecord(it)
              return `${readFirstText(itemRec.itemName, itemRec.category, "Barang")} x${readNumber(itemRec.quantity, 1)}`
            })
            .join(", ") || "Item Permintaan",
          status: resolveApprovalStatus(rec),
          notes: readFirstText(rec.purpose, rec.notes, rec.adminRemarks),
          requestedAt: readFirstText(rec.requestedAt, rec.createdAt),
          requestItems: rawItems.map((it, i) => {
            const itemRec = asRecord(it)
            return {
              id: readNumber(itemRec.id, i),
              category: readFirstText(itemRec.categoryName, itemRec.category, "-"),
              brand: readFirstText(itemRec.brandName, itemRec.brand, "-"),
              quantity: readNumber(itemRec.quantity, 1),
              unit: readFirstText(itemRec.unit, "Unit"),
            }
          }),
          deliveryDocument:
            rec.deliveryDocument != null
              ? {
                  kpSignedById: rawDoc.kpSignedById ? String(rawDoc.kpSignedById) : null,
                  picSignedById: rawDoc.picSignedById ? String(rawDoc.picSignedById) : null,
                  driveViewUrl: rawDoc.driveViewUrl ? String(rawDoc.driveViewUrl) : null,
                }
              : null,
        }
      })

      setAllRequests(normalized)
    } catch (err) {
      console.error("Gagal memuat permintaan antar mitra:", err)
      setLoadError("Gagal memuat data permintaan antar mitra.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleAdminDecision = useCallback(async (requestId: string, decision: "approve" | "reject") => {
    if (!user || user.role !== "admin") return

    try {
      const payload = {
        status: decision === "approve" ? "APPROVED" : "REJECTED",
      }

      await api.put(`/requests/${requestId}/status`, payload).catch(() =>
        api.put(`/requests/${requestId}`, payload)
      )

      setAllRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: decision === "approve" ? "menunggu_scan_pemberi" : "ditolak",
              }
            : req
        )
      )

      toast.success(
        decision === "approve"
          ? "Permintaan berhasil disetujui. Mitra pemberi sekarang wajib melakukan scan barang."
          : "Permintaan antar mitra berhasil ditolak."
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status persetujuan"
      toast.error(msg)
    }
  }, [user])

  const handleProviderScan = useCallback(async (requestId: string) => {
    try {
      const payload = {
        status: "PEMBERI_SCAN",
        providerScannedAt: new Date().toISOString(),
      }

      await api.put(`/requests/${requestId}/status`, payload).catch(() =>
        api.put(`/requests/${requestId}`, payload)
      )

      setAllRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: "menunggu_scan_penerima",
              }
            : req
        )
      )

      toast.success("Scan oleh mitra pemberi selesai. Mitra penerima menunggu validasi akhir.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan scan pemberi"
      toast.error(msg)
    }
  }, [])

  const handleReceiverScan = useCallback(async (requestId: string) => {
    try {
      const payload = {
        status: "SELESAI",
        receiverScannedAt: new Date().toISOString(),
      }

      await api.put(`/requests/${requestId}/status`, payload).catch(() =>
        api.put(`/requests/${requestId}`, payload)
      )

      setAllRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: "selesai",
              }
            : req
        )
      )

      toast.success("Validasi akhir oleh mitra penerima berhasil dilakukan.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan validasi akhir"
      toast.error(msg)
    }
  }, [])

  const handleOpenBastPdf = useCallback(async (requestId: string, useSignedPdf = false) => {
    setOpeningPdfId(requestId)
    try {
      const token = localStorage.getItem("arxiva-auth-token") || ""
      const endpoint = useSignedPdf ? `/requests/${requestId}/pdf-signed` : `/requests/${requestId}/pdf-draft`
      const url = `${getBaseUrl()}${endpoint}?token=${token}`
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

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return allRequests
    return allRequests.filter(
      (r) =>
        r.requestNumber.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        r.providerName.toLowerCase().includes(q) ||
        r.itemsDetail.toLowerCase().includes(q)
    )
  }, [allRequests, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-"
    const d = new Date(dateStr)
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-medium flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Permintaan Barang Antar Mitra
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola pengajuan peminjaman dan transfer material antar sesama mitra
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-[9px] size-4 text-muted-foreground" />
          <Input
            placeholder="Cari no. request, mitra, atau barang..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button className="shrink-0 gap-2 cursor-pointer" onClick={() => setIsModalOpen(true)}>
          <FilePlus className="h-4 w-4" />
          Ajukan Permintaan Mitra
        </Button>
      </div>

      <div className="rounded-sm border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <Table className="min-w-200">
          <TableHeader className="bg-neutral-900/80">
            <TableRow className="border-neutral-800 hover:bg-transparent">
              <TableHead className="w-12 pl-4 text-neutral-400">No</TableHead>
              <TableHead className="text-neutral-400">No. Request</TableHead>
              <TableHead className="text-neutral-400">Tanggal</TableHead>
              <TableHead className="text-neutral-400">Peminta → Pemberi</TableHead>
              <TableHead className="text-neutral-400">Barang</TableHead>
              <TableHead className="text-center text-neutral-400">Status</TableHead>
              <TableHead className="text-center text-neutral-400">BAST</TableHead>
              {user?.role === "admin" && <TableHead className="text-center text-neutral-400">Persetujuan</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={user?.role === "admin" ? 8 : 7} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
                    <span>Memuat data permintaan antar mitra...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={user?.role === "admin" ? 8 : 7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-neutral-500">
                    <AlertTriangle className="h-10 w-10 text-destructive/70" />
                    <p className="text-sm font-medium">{loadError}</p>
                    <Button size="sm" variant="outline" onClick={fetchRequests} className="gap-1.5">
                      <RefreshCw className="h-4 w-4" /> Muat Ulang
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedRequests.length === 0 ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={user?.role === "admin" ? 8 : 7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-neutral-500">
                    <ClipboardList className="h-10 w-10 text-neutral-600 mb-2" />
                    <p className="text-sm font-medium">Belum ada permintaan antar mitra</p>
                    <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                      <FilePlus className="h-4 w-4" /> Buat Permintaan
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRequests.map((req, idx) => {
                const statusUpper = String(req.status || "").toUpperCase()
                const hasBast = ["SIAP", "SELESAI", "DITERIMA", "MENUNGGU_SCAN_PEMBERI", "MENUNGGU_SCAN_PENERIMA"].includes(statusUpper)
                const canSign = statusUpper === "SIAP" && !req.deliveryDocument?.picSignedById
                const isSigned = !!req.deliveryDocument?.picSignedById
                const isWaitingProviderScan = normalizeKey(req.status) === "menunggu_scan_pemberi"
                const isWaitingReceiverScan = normalizeKey(req.status) === "menunggu_scan_penerima"
                const isCurrentProvider = Boolean(
                  user?.partnerId &&
                  (
                    normalizeKey(user.partnerId) === normalizeKey(req.providerPartnerId) ||
                    normalizeKey(user.identityCode) === normalizeKey(req.providerPartnerId)
                  )
                )
                const isCurrentReceiver = Boolean(
                  user?.partnerId &&
                  (
                    normalizeKey(user.partnerId) === normalizeKey(req.requesterPartnerId) ||
                    normalizeKey(user.identityCode) === normalizeKey(req.requesterPartnerId)
                  )
                )
                const canProviderScan = user?.role === "mitra" && isCurrentProvider && isWaitingProviderScan
                const canReceiverScan = user?.role === "mitra" && isCurrentReceiver && isWaitingReceiverScan

                return (
                  <TableRow key={req.id} className="border-neutral-800 hover:bg-neutral-900/80">
                    <TableCell className="pl-4 text-neutral-400">
                      {(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-neutral-200 font-mono">
                      {req.requestNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-neutral-400">
                      {formatDate(req.requestedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-200">
                      <span>{req.requesterName}</span>
                      <span className="text-neutral-500 mx-1.5">→</span>
                      <span className="text-neutral-400">{req.providerName}</span>
                    </TableCell>
                    <TableCell className="max-w-[260px] text-neutral-400 text-sm">
                      <span className="block truncate" title={req.itemsDetail}>
                        {req.itemsDetail}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {canProviderScan ? (
                        <Button size="sm" variant="default" onClick={() => handleProviderScan(req.id)}>
                          Scan Pemberi
                        </Button>
                      ) : canReceiverScan ? (
                        <Button size="sm" variant="default" onClick={() => handleReceiverScan(req.id)}>
                          Scan Validasi Akhir
                        </Button>
                      ) : hasBast ? (
                        <div className="flex items-center justify-center gap-2">
                          {!isSigned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenBastPdf(req.id, false)}
                              disabled={openingPdfId === req.id}
                            >
                              {openingPdfId === req.id ? "..." : "BAST Draft"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenBastPdf(req.id, true)}
                              disabled={openingPdfId === req.id}
                            >
                              {openingPdfId === req.id ? "..." : "Lihat BAST"}
                            </Button>
                          )}
                          {canSign && (
                            <Button size="sm" variant="default" onClick={() => handleOpenSignDialog(req.id)}>
                              TTD
                            </Button>
                          )}
                          {!canSign && isSigned && (
                            <span className="text-[10px] text-emerald-400">Signed</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {user?.role === "admin" && (
                      <TableCell className="text-center">
                        {normalizeKey(req.status) === "menunggu_persetujuan" || normalizeKey(req.status) === "menunggu" ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="default" onClick={() => handleAdminDecision(req.id, "approve")}>
                              Setujui
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminDecision(req.id, "reject")}>
                              Tolak
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
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
            {Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} dari {filteredRequests.length} permintaan
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="rounded border px-3 py-1 text-xs font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DigitalSignatureDialog
        open={signDialogOpen}
        onOpenChange={(open) => {
          setSignDialogOpen(open)
          if (!open) setSigningRequestId(null)
        }}
        title="Tanda Tangan Digital BAST"
        description="Berikan tanda tangan Anda sebagai pihak penerima untuk dokumen BAST permintaan antar mitra ini."
        onSignComplete={handleSignComplete}
      />

      <InterPartnerRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchRequests}
      />
    </div>
  )
}
