import { useState, useEffect, useCallback, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Plus, Trash2, Loader2, Send, ArrowLeft,
  FileText, Check, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryOption = { id: number | string; name: string }
type BrandOption = { id: number | string; name: string }

type ItemRow = {
  id: number
  categoryId: string
  brandId: string
  quantity: string
}

type FormErrors = {
  items: Record<number, { categoryId?: string; brandId?: string; quantity?: string }>
}

type PreviewItem = {
  categoryName: string
  brandName: string
  quantity: string
}

// ─── Helper Functions ────────────────────────────────────────────────────────

const createEmptyRow = (id: number): ItemRow => ({
  id,
  categoryId: "",
  brandId: "",
  quantity: "",
})

const getOptionName = (opt: Record<string, unknown>): string => {
  for (const key of ["name", "nama", "title", "label"]) {
    if (typeof opt[key] === "string") return opt[key] as string
  }
  return ""
}

const unwrapArray = (val: unknown, keyName: string): unknown[] => {
  if (Array.isArray(val)) return val
  if (val && typeof val === "object") {
    const payload = val as Record<string, unknown>
    if (Array.isArray(payload[keyName])) return payload[keyName] as unknown[]
    for (const key of ["data", "items", "results"]) {
      if (Array.isArray(payload[key])) return payload[key] as unknown[]
    }
  }
  return []
}

const getSubmitErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object") {
    const payload = error as Record<string, unknown>
    const data = payload.response && typeof payload.response === "object"
      ? (payload.response as Record<string, unknown>).data
      : null
    if (data && typeof data === "object") {
      const errObj = data as Record<string, unknown>
      for (const key of ["message", "error", "err"]) {
        if (typeof errObj[key] === "string") return errObj[key] as string
      }
    }
    for (const key of ["message", "error"]) {
      if (typeof payload[key] === "string") return payload[key] as string
    }
  }
  if (error instanceof Error && error.message && error.message !== "Failed to fetch")
    return error.message
  return "Gagal mengirim permintaan. Periksa koneksi Anda."
}
// ─── Success Dialog ───────────────────────────────────────────────────────────

type SuccessDialogProps = {
  open: boolean
  onGoToHistory: () => void
  onClose: () => void
  items: PreviewItem[]
  requesterName: string
  notes: string
}

function SuccessDialog({ open, onGoToHistory, onClose, items, requesterName, notes }: SuccessDialogProps) {
  const todayFormatted = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-2xl rounded-3xl" showCloseButton={false}>
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
          
          {/* Left Panel: Status & Congratulations */}
          <div className="md:col-span-5 bg-white dark:bg-zinc-950 p-8 flex flex-col items-center justify-center text-center space-y-6">
            
            {/* Circular Green Tick */}
            <div className="relative flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 flex items-center justify-center shadow-lg shadow-emerald-500/5 animate-in zoom-in-75 duration-300">
                <div className="h-16 w-16 rounded-full bg-[#008060] flex items-center justify-center">
                  <Check className="h-8 w-8 text-white stroke-[3px]" />
                </div>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-3">
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
                Permintaan material Anda sedang diajukan!
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 px-2 leading-relaxed">
                Kami telah mengirimkannya ke sistem admin dan sedang menunggu konfirmasi/persetujuan.
              </DialogDescription>
            </div>

            {/* Actions Stack */}
            <div className="w-full space-y-3 pt-4">
              <Button
                className="w-full h-11 bg-[#008060] hover:bg-[#006b50] text-white font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                onClick={onGoToHistory}
              >
                Lihat Riwayat Permintaan
              </Button>
              <Button
                variant="ghost"
                className="w-full h-11 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all cursor-pointer"
                onClick={onClose}
              >
                Ajukan Permintaan Baru
              </Button>
            </div>

          </div>

          {/* Right Panel: Timecard/Request Summary (Mockup Style) */}
          <div className="md:col-span-7 bg-[#f8f9fa] dark:bg-zinc-900/50 p-8 relative flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 dark:border-zinc-800">
            
            {/* Close Button X */}
            <button
              className="absolute right-4 top-4 rounded-full p-1 hover:bg-slate-200/50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              onClick={onClose}
            >
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
            </button>

            <div className="space-y-6">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-none">
                Ringkasan Permintaan
              </h4>

              {/* Metadata Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Pengaju (Mitra)
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {requesterName}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Keterangan
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 line-clamp-2 truncate max-w-full">
                    {notes || "Tidak ada catatan"}
                  </p>
                </div>
              </div>

              {/* Items Card List (Mockup box) */}
              <div className="rounded-2xl border border-slate-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
                <div className="max-h-[160px] overflow-y-auto pr-1 space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-sm pb-2 border-b border-slate-100 dark:border-zinc-800/80 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.categoryName}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{item.brandName}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.quantity} Unit</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-zinc-800 font-bold text-[#008060] dark:text-emerald-500 text-sm">
                  <span>Total</span>
                  <span>{totalQuantity} Unit</span>
                </div>
              </div>

              {/* Secondary Statistics Details */}
              <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Kategori Material</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{items.length} Kategori</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal Diajukan</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{todayFormatted}</span>
                </div>
              </div>

            </div>

            {/* Large Highlighted Status (Equivalent to "Take Home" section in mockup) */}
            <div className="flex flex-col items-end border-t border-slate-200/60 dark:border-zinc-800/80 pt-4 mt-6">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                Status Permintaan
              </span>
              <span className="text-3xl font-black text-[#008060] dark:text-emerald-500 mt-1 tracking-tight">
                MENUNGGU
              </span>
            </div>

          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PartnerRequestNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Form state
  const [items, setItems] = useState<ItemRow[]>([createEmptyRow(1)])
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<FormErrors>({ items: {} })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog state — untuk preview BAST draft sebelum dikirim
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Dropdown data
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(true)
  const [dropdownError, setDropdownError] = useState<string | null>(null)

  // ── Fetch dropdowns ──────────────────────────────────────────────────────
  const fetchDropdowns = useCallback(async () => {
    setLoadingDropdowns(true)
    setDropdownError(null)
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get("/categories"),
        api.get("/brands"),
      ])

      const categoryOptions = unwrapArray(catRes.data, "categories")
        .map((raw) => {
          const o = raw as Record<string, unknown>
          return { id: o.id as number | string, name: getOptionName(o) }
        })
        .filter((o) => o.id !== undefined && o.id !== null && o.name)

      const brandOptions = unwrapArray(brandRes.data, "brands")
        .map((raw) => {
          const o = raw as Record<string, unknown>
          return { id: o.id as number | string, name: getOptionName(o) }
        })
        .filter((o) => o.id !== undefined && o.id !== null && o.name)

      setCategories(categoryOptions)
      setBrands(brandOptions)

      if (categoryOptions.length === 0 || brandOptions.length === 0)
        setDropdownError("Data kategori atau merek belum tersedia. Muat ulang data sebelum mengirim permintaan.")
    } catch {
      setCategories([])
      setBrands([])
      setDropdownError("Gagal memuat data kategori / merek. Silakan coba lagi.")
      toast.error("Gagal memuat data kategori / merek. Silakan coba lagi.")
    } finally {
      setLoadingDropdowns(false)
    }
  }, [])

  useEffect(() => { fetchDropdowns() }, [fetchDropdowns])

  // ── Item row handlers ────────────────────────────────────────────────────
  const addRow = () => setItems((prev) => [...prev, createEmptyRow(Date.now())])

  const removeRow = (id: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((r) => r.id !== id))
    setErrors((prev) => {
      const next = { ...prev.items }
      delete next[id]
      return { ...prev, items: next }
    })
  }

  const updateRow = (id: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
    if (field === "categoryId" || field === "brandId" || field === "quantity") {
      setErrors((prev) => ({
        ...prev,
        items: { ...prev.items, [id]: { ...prev.items[id], [field]: undefined } },
      }))
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: FormErrors = { items: {} }
    let valid = true

    items.forEach((row) => {
      const rowErrors: { categoryId?: string; brandId?: string; quantity?: string } = {}
      if (!row.categoryId) {
        rowErrors.categoryId = "Kategori wajib dipilih"; valid = false
      } else if (!Number.isFinite(Number(row.categoryId))) {
        rowErrors.categoryId = "Kategori tidak valid"; valid = false
      }
      if (!row.brandId) {
        rowErrors.brandId = "Merek wajib dipilih"; valid = false
      } else if (!Number.isFinite(Number(row.brandId))) {
        rowErrors.brandId = "Merek tidak valid"; valid = false
      }
      const qty = Number(row.quantity)
      if (!row.quantity || !Number.isFinite(qty) || qty <= 0) {
        rowErrors.quantity = "Jumlah harus lebih dari 0"; valid = false
      }
      if (Object.keys(rowErrors).length > 0) newErrors.items[row.id] = rowErrors
    })

    setErrors(newErrors)
    return valid
  }

  // ── Submit: Validasi → POST /requests → tampilkan success popup ───────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.id) {
      toast.error("Sesi pengguna tidak valid. Silakan login ulang.")
      return
    }
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const payload = {
        requesterId: user.id,
        notes: notes.trim(),
        items: items.map((row) => ({
          materialCategoryId: Number(row.categoryId),
          brandId: Number(row.brandId),
          quantity: Number(row.quantity),
        })),
      }

      await api.post("/requests", payload)
      setShowSuccessModal(true)
    } catch (err) {
      toast.error(getSubmitErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Reset form untuk ajukan permintaan baru ──────────────────────────────
  const handleResetForm = () => {
    setItems([createEmptyRow(Date.now())])
    setNotes("")
    setErrors({ items: {} })
    setShowSuccessModal(false)
  }

  // Generate item preview list
  const previewItems: PreviewItem[] = items.map((row) => {
    const cat = categories.find((c) => String(c.id) === String(row.categoryId))
    const brand = brands.find((b) => String(b.id) === String(row.brandId))
    return {
      categoryName: cat?.name || "-",
      brandName: brand?.name || "-",
      quantity: row.quantity,
    }
  })

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 cursor-pointer"
          onClick={() => navigate("/partner-request/history")}
          aria-label="Kembali ke riwayat"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajukan Permintaan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Isi formulir di bawah untuk mengajukan permintaan material
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Item rows */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daftar Item</CardTitle>
            <CardDescription>Tambahkan satu atau lebih item yang dibutuhkan</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loadingDropdowns ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Memuat data kategori &amp; merek...</span>
              </div>
            ) : (
              <>
                {dropdownError && (
                  <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                    <span>{dropdownError}</span>
                    <Button type="button" variant="outline" size="sm" className="self-start cursor-pointer sm:self-auto" onClick={fetchDropdowns}>
                      Muat Ulang
                    </Button>
                  </div>
                )}

                {items.map((row, idx) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-3 items-start border rounded-lg p-3 bg-muted/30 relative"
                  >
                    <span className="absolute top-3 left-3.5 text-xs text-muted-foreground font-medium select-none">
                      {idx + 1}
                    </span>

                    {/* Category */}
                    <div className="flex flex-col gap-1.5 sm:pl-5">
                      <Label className="text-xs text-muted-foreground">
                        Kategori <span className="text-destructive">*</span>
                      </Label>
                      <Select value={row.categoryId} onValueChange={(v) => updateRow(row.id, "categoryId", v)}>
                        <SelectTrigger id={`cat-${row.id}`} className={errors.items[row.id]?.categoryId ? "border-destructive" : ""}>
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.length > 0 ? (
                            categories.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada kategori</div>
                          )}
                        </SelectContent>
                      </Select>
                      {errors.items[row.id]?.categoryId && (
                        <p className="text-xs text-destructive">{errors.items[row.id].categoryId}</p>
                      )}
                    </div>

                    {/* Brand */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Merek <span className="text-destructive">*</span>
                      </Label>
                      <Select value={row.brandId} onValueChange={(v) => updateRow(row.id, "brandId", v)}>
                        <SelectTrigger id={`brand-${row.id}`} className={errors.items[row.id]?.brandId ? "border-destructive" : ""}>
                          <SelectValue placeholder="Pilih merek..." />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.length > 0 ? (
                            brands.map((b) => (
                              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada merek</div>
                          )}
                        </SelectContent>
                      </Select>
                      {errors.items[row.id]?.brandId && (
                        <p className="text-xs text-destructive">{errors.items[row.id].brandId}</p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`qty-${row.id}`} className="text-xs text-muted-foreground">
                        Jumlah <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`qty-${row.id}`}
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                        className={errors.items[row.id]?.quantity ? "border-destructive" : ""}
                      />
                      {errors.items[row.id]?.quantity && (
                        <p className="text-xs text-destructive">{errors.items[row.id].quantity}</p>
                      )}
                    </div>

                    {/* Remove */}
                    <div className="flex items-end justify-end sm:justify-center pb-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        disabled={items.length <= 1}
                        onClick={() => removeRow(row.id)}
                        aria-label="Hapus item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="self-start gap-1.5 cursor-pointer" onClick={addRow}>
                  <Plus className="h-4 w-4" />
                  Tambah Item
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detail Permintaan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                placeholder="Tambahkan catatan atau keterangan tambahan untuk admin..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => navigate("/partner-request/history")}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="gap-2 cursor-pointer"
              disabled={isSubmitting || loadingDropdowns || categories.length === 0 || brands.length === 0}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Mengirim...</>
              ) : (
                <><Send className="h-4 w-4" />Kirim Permintaan</>
              )}
            </Button>
          </div>
        </div>
      </form>
      {/* Success Dialog — muncul SETELAH request berhasil dikirim */}
      <SuccessDialog
        open={showSuccessModal}
        onGoToHistory={() => navigate("/partner-request/history")}
        onClose={handleResetForm}
        items={previewItems}
        requesterName={user?.displayName || user?.username || "Mitra"}
        notes={notes.trim()}
      />
    </div>
  )
}
