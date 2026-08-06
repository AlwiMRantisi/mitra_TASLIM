import { useState, useEffect, useCallback, type FormEvent } from "react"
import { toast } from "sonner"
import {
  Plus, Trash2, Loader2, Send
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

// ─── Component ───────────────────────────────────────────────────────────────

type RequestFormModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RequestFormModal({ isOpen, onClose, onSuccess }: RequestFormModalProps) {
  const { user } = useAuth()

  // Form state
  const [items, setItems] = useState<ItemRow[]>([createEmptyRow(Date.now())])
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<FormErrors>({ items: {} })
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  useEffect(() => {
    if (isOpen) {
      fetchDropdowns()
    }
  }, [isOpen, fetchDropdowns])

  // ── Reset form saat ditutup ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setItems([createEmptyRow(Date.now())])
        setNotes("")
        setErrors({ items: {} })
      }, 300)
    }
  }, [isOpen])

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
        rowErrors.quantity = "Jumlah harus > 0"; valid = false
      }
      if (Object.keys(rowErrors).length > 0) newErrors.items[row.id] = rowErrors
    })

    setErrors(newErrors)
    return valid
  }

  // ── Submit ───────────────────────────────────────────────────────────────
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
      toast.success("Permintaan berhasil diajukan!")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(getSubmitErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl">Ajukan Permintaan Material</DialogTitle>
          <DialogDescription>
            Tambahkan satu atau lebih item material yang dibutuhkan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <form id="request-form" onSubmit={handleSubmit} className="flex flex-col gap-8">
            
            {/* Item List */}
            <div className="flex flex-col gap-4">
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
                      <Button type="button" variant="outline" size="sm" onClick={fetchDropdowns}>
                        Muat Ulang
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {items.map((row, idx) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-4 items-end border rounded-lg p-5 bg-card relative shadow-sm"
                      >
                        <span className="absolute -top-2.5 -left-2 text-[11px] text-muted-foreground font-semibold bg-background border px-2 py-0.5 rounded-md shadow-sm">
                          #{idx + 1}
                        </span>

                        {/* Category */}
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-sm font-semibold">Kategori</Label>
                          <Select value={row.categoryId} onValueChange={(v) => updateRow(row.id, "categoryId", v)}>
                            <SelectTrigger className={errors.items[row.id]?.categoryId ? "border-destructive" : ""}>
                              <SelectValue placeholder="Pilih..." />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.length > 0 ? (
                                categories.map((c) => (
                                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada data</div>
                              )}
                            </SelectContent>
                          </Select>
                          {errors.items[row.id]?.categoryId && (
                            <p className="text-xs text-destructive">{errors.items[row.id].categoryId}</p>
                          )}
                        </div>

                        {/* Brand */}
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-sm font-semibold">Merek</Label>
                          <Select value={row.brandId} onValueChange={(v) => updateRow(row.id, "brandId", v)}>
                            <SelectTrigger className={errors.items[row.id]?.brandId ? "border-destructive" : ""}>
                              <SelectValue placeholder="Pilih..." />
                            </SelectTrigger>
                            <SelectContent>
                              {brands.length > 0 ? (
                                brands.map((b) => (
                                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada data</div>
                              )}
                            </SelectContent>
                          </Select>
                          {errors.items[row.id]?.brandId && (
                            <p className="text-xs text-destructive">{errors.items[row.id].brandId}</p>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-sm font-semibold">Jumlah</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                            className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.items[row.id]?.quantity ? "border-destructive" : ""}`}
                          />
                          {errors.items[row.id]?.quantity && (
                            <p className="text-xs text-destructive">{errors.items[row.id].quantity}</p>
                          )}
                        </div>

                        {/* Remove */}
                        <div className="flex justify-end sm:justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={items.length <= 1}
                            onClick={() => removeRow(row.id)}
                            aria-label="Hapus item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button type="button" variant="outline" size="sm" className="self-start gap-1.5" onClick={addRow}>
                    <Plus className="h-4 w-4" />
                    Tambah Item
                  </Button>
                </>
              )}
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2 pt-2 border-t">
              <Label htmlFor="notes" className="text-sm font-semibold">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                placeholder="Tambahkan catatan atau keterangan tambahan untuk admin..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            
          </form>
        </div>

        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="request-form"
            className="gap-2"
            disabled={isSubmitting || loadingDropdowns || categories.length === 0 || brands.length === 0}
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Mengirim...</>
            ) : (
              <><Send className="h-4 w-4" />Kirim Permintaan</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
