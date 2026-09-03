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
import {
  PeminjamanMitraService,
  isPendingApproval,
  unwrapList,
  readFirstText,
  readNumber,
  resolveStatusKey,
  normalizeKey,
} from "@/services/peminjamanMitraService"
import { openUrl } from "@tauri-apps/plugin-opener"
import { DigitalSignatureDialog } from "@/app/request/components/DigitalSignatureDialog"
import { InterPartnerScanModal } from "@/app/peminjaman-mitra/components/InterPartnerScanModal"
import { InterPartnerStatusBadge } from "@/app/peminjaman-mitra/components/InterPartnerStatusBadge"
import { ApproveRejectModal } from "@/app/peminjaman-mitra/components/ApproveRejectModal"
import type { InterPartnerRequest } from "@/app/peminjaman-mitra/types"

const PAGE_SIZE = 10

// ─── Modal Form Permintaan Antar Mitra ──────────────────────────────────────

type ItemRow = {
  id: number
  categoryId: string
  brandId: string
  quantity: string
}

type PartnerOption = { id: string; name: string; code?: string }
type CategoryOption = { id: number | string; name: string }
type BrandOption = { id: number | string; name: string }

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
  const [partnerSearch, setPartnerSearch] = useState("")
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
        const rec = c as Record<string, unknown>
        return { id: rec.id as number | string, name: readFirstText(rec.name, rec.nama) }
      })

      const bOptions: BrandOption[] = unwrapList(brandRes.data).map((b) => {
        const rec = b as Record<string, unknown>
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

  const filteredPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase()
    if (!q) return partners

    return partners.filter((partner) => {
      const haystack = `${partner.name} ${partner.code ?? ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [partners, partnerSearch])

  const selectedPartner = partners.find((partner) => partner.id === targetPartnerId)

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

              <Input
                placeholder="Cari mitra tujuan..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                className="mb-2"
              />

              <div className="max-h-56 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/50">
                {filteredPartners.length > 0 ? (
                  filteredPartners.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTargetPartnerId(p.id)
                        setPartnerSearch(p.name)
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
                        targetPartnerId === p.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-neutral-800/80 text-neutral-200"
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.code ? <span className="text-xs text-muted-foreground">{p.code}</span> : null}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada mitra yang cocok</div>
                )}
              </div>

              {selectedPartner && (
                <div className="mt-2 text-xs text-emerald-400">
                  Dipilih: {selectedPartner.name}
                  {selectedPartner.code ? ` (${selectedPartner.code})` : ""}
                </div>
              )}
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
  const isAdmin = user?.role === "admin"

  const [allRequests, setAllRequests] = useState<InterPartnerRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null)
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null)

  // State untuk ApproveRejectModal
  const [approvalState, setApprovalState] = useState<{
    open: boolean
    decision: "approve" | "reject"
    request: InterPartnerRequest | null
  }>({ open: false, decision: "approve", request: null })
  const [submittingDecision, setSubmittingDecision] = useState(false)

  const [scanTarget, setScanTarget] = useState<{
    request: InterPartnerRequest
    party: "provider" | "receiver"
  } | null>(null)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const normalized = await PeminjamanMitraService.getInterPartnerRequests()
      setAllRequests(normalized)
    } catch (err) {
      console.error("Gagal memuat permintaan antar mitra:", err)
      setLoadError("Gagal memuat data permintaan antar mitra.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleAdminDecision = useCallback(
    async (requestId: string, decision: "approve" | "reject", rejectionNotes?: string) => {
      if (!isAdmin || !requestId) return
      setSubmittingDecision(true)
      try {
        await PeminjamanMitraService.updateApproval(requestId, decision, rejectionNotes)

        setAllRequests((prev) =>
          prev.map((req) =>
            req.id === requestId
              ? {
                  ...req,
                  status: decision === "approve" ? "menunggu_scan_pemberi" : "ditolak",
                  notes: decision === "reject" && rejectionNotes ? rejectionNotes : req.notes,
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
      } finally {
        setSubmittingDecision(false)
        setApprovalState((prev) => ({ ...prev, open: false, request: null }))
      }
    },
    [isAdmin]
  )

  const handleProviderScan = useCallback((request: InterPartnerRequest) => {
    setScanTarget({ request, party: "provider" })
  }, [])

  const handleReceiverScan = useCallback((request: InterPartnerRequest) => {
    setScanTarget({ request, party: "receiver" })
  }, [])

  const handleScanSuccess = useCallback(
    (party: "provider" | "receiver") => {
      if (!scanTarget) return
      const targetRequestId = scanTarget.request.id

      setAllRequests((prev) =>
        prev.map((req) => {
          if (req.id !== targetRequestId) return req
          return {
            ...req,
            status: party === "provider" ? "menunggu_scan_penerima" : "selesai",
          }
        })
      )
    },
    [scanTarget]
  )

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

  // Akses: admin melihat semua, mitra hanya melihat yang melibatkan dia.
  const isMine = useCallback(
    (r: InterPartnerRequest): boolean => {
      if (!user) return false
      const providerMatches = Boolean(
        user.partnerId &&
          (normalizeKey(user.partnerId) === normalizeKey(r.providerPartnerId) ||
            normalizeKey(user.identityCode) === normalizeKey(r.providerPartnerId) ||
            normalizeKey(user.displayName) === normalizeKey(r.providerName) ||
            normalizeKey(user.username) === normalizeKey(r.providerName))
      )
      const requesterMatches = Boolean(
        user.partnerId &&
          (normalizeKey(user.partnerId) === normalizeKey(r.requesterPartnerId) ||
            normalizeKey(user.identityCode) === normalizeKey(r.requesterPartnerId) ||
            normalizeKey(user.displayName) === normalizeKey(r.requesterName) ||
            normalizeKey(user.username) === normalizeKey(r.requesterName))
      )
      return providerMatches || requesterMatches
    },
    [user]
  )

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const baseList = allRequests.filter((r) => {
      if (user?.role === "admin") return true
      if (user?.role !== "mitra") return true
      return isMine(r)
    })

    if (!q) return baseList
    return baseList.filter(
      (r) =>
        r.requestNumber.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        r.providerName.toLowerCase().includes(q) ||
        r.itemsDetail.toLowerCase().includes(q)
    )
  }, [allRequests, searchTerm, user, isMine])

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
        {user?.role === "mitra" && (
          <Button className="shrink-0 gap-2 cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <FilePlus className="h-4 w-4" />
            Ajukan Permintaan Mitra
          </Button>
        )}
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
              {isAdmin && <TableHead className="text-center text-neutral-400">Persetujuan</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
                    <span>Memuat data permintaan antar mitra...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-48 text-center">
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
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 text-neutral-500">
                    <ClipboardList className="h-10 w-10 text-neutral-600 mb-2" />
                    <p className="text-sm font-medium">Belum ada permintaan antar mitra</p>
                    {user?.role === "mitra" && (
                      <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                        <FilePlus className="h-4 w-4" /> Buat Permintaan
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRequests.map((req, idx) => {
                const statusKey = resolveStatusKey(req.status)
                const statusUpper = statusKey.toUpperCase()
                const hasBast = ["SIAP", "SELESAI", "DITERIMA", "MENUNGGU_SCAN_PEMBERI", "MENUNGGU_SCAN_PENERIMA"].includes(statusUpper)
                const canSign = statusKey === "siap" && !req.deliveryDocument?.picSignedById
                const isSigned = !!req.deliveryDocument?.picSignedById
                const isWaitingProviderScan = statusKey === "menunggu_scan_pemberi"
                const isWaitingReceiverScan = statusKey === "menunggu_scan_penerima"
                const isCurrentProvider = Boolean(
                  user?.partnerId &&
                    (normalizeKey(user.partnerId) === normalizeKey(req.providerPartnerId) ||
                      normalizeKey(user.identityCode) === normalizeKey(req.providerPartnerId))
                )
                const isCurrentReceiver = Boolean(
                  user?.partnerId &&
                    (normalizeKey(user.partnerId) === normalizeKey(req.requesterPartnerId) ||
                      normalizeKey(user.identityCode) === normalizeKey(req.requesterPartnerId))
                )
                const canProviderScan = user?.role === "mitra" && isCurrentProvider && isWaitingProviderScan
                const canReceiverScan = user?.role === "mitra" && isCurrentReceiver && isWaitingReceiverScan

                const clickToScan = canProviderScan && user?.role === "mitra"

                return (
                  <TableRow
                    key={req.id}
                    className={`border-neutral-800 hover:bg-neutral-900/80 ${clickToScan ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (clickToScan) handleProviderScan(req)
                    }}
                  >
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
                      <InterPartnerStatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {canProviderScan ? (
                        <Button size="sm" variant="default" onClick={() => handleProviderScan(req)}>
                          Scan Pemberi
                        </Button>
                      ) : canReceiverScan ? (
                        <Button size="sm" variant="default" onClick={() => handleReceiverScan(req)}>
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
                    {isAdmin && (
                      <TableCell className="text-center">
                        {isPendingApproval(req.status) ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setApprovalState({ open: true, decision: "approve", request: req })}
                            >
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setApprovalState({ open: true, decision: "reject", request: req })}
                            >
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

      <ApproveRejectModal
        open={approvalState.open}
        onOpenChange={(open) => {
          if (!open) setApprovalState((prev) => ({ ...prev, open: false, request: null }))
        }}
        decision={approvalState.decision}
        requestNumber={approvalState.request?.requestNumber ?? ""}
        requesterName={approvalState.request?.requesterName ?? ""}
        providerName={approvalState.request?.providerName ?? ""}
        isSubmitting={submittingDecision}
        onConfirm={(rejectionNotes) => {
          if (approvalState.request) {
            void handleAdminDecision(approvalState.request.id, approvalState.decision, rejectionNotes)
          }
        }}
      />

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

      <InterPartnerScanModal
        open={scanTarget !== null}
        onOpenChange={(open) => {
          if (!open) setScanTarget(null)
        }}
        requestId={scanTarget?.request.id ?? ""}
        requestNumber={scanTarget?.request.requestNumber ?? ""}
        party={scanTarget?.party ?? "provider"}
        title={
          scanTarget?.party === "provider"
            ? "Scan Barang oleh Mitra Pemberi"
            : "Scan Barang oleh Mitra Penerima"
        }
        description={
          scanTarget?.party === "provider"
            ? "Scan serial number setiap barang yang akan dikirim kepada mitra peminjam."
            : "Scan serial number setiap barang yang diterima untuk validasi akhir."
        }
        items={
          scanTarget?.request.requestItems.length
            ? scanTarget.request.requestItems
            : []
        }
        onSuccess={() => {
          if (scanTarget) handleScanSuccess(scanTarget.party)
        }}
      />

      <InterPartnerRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchRequests}
      />
    </div>
  )
}
