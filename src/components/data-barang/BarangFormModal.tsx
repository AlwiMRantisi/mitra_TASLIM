import React from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { StatusUnit, StorageLocationOption } from "@/types/inventory"

interface BarangFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  formMode: "add" | "edit"
  formData: {
    serialNumber: string
    kategori: string
    merek: string
    tipe: string
    status: StatusUnit
    lokasiPenyimpanan: string
    tanggalMasuk: string
    tanggalKeluar: string
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    serialNumber: string
    kategori: string
    merek: string
    tipe: string
    status: StatusUnit
    lokasiPenyimpanan: string
    tanggalMasuk: string
    tanggalKeluar: string
  }>>
  formErrors: Record<string, string>
  isSaving: boolean
  onSubmit: (e: React.FormEvent) => void
  categories: string[]
  availableFormLocations: StorageLocationOption[]
  STATUS_OPTIONS: StatusUnit[]
}

export function BarangFormModal({
  isOpen,
  onOpenChange,
  formMode,
  formData,
  setFormData,
  formErrors,
  isSaving,
  onSubmit,
  categories,
  availableFormLocations,
  STATUS_OPTIONS,
}: BarangFormModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              {formMode === "add" ? "Tambah Unit Baru" : "Edit Data Unit"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Isi parameter unit barang di bawah ini. Pastikan Serial Number unik dan belum pernah terdaftar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-xs">
            {/* Serial Number */}
            <div className="space-y-1">
              <Label className="text-xs">Serial Number (SN) *</Label>
              <Input
                placeholder="SN-XXXX-XXXX"
                value={formData.serialNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, serialNumber: e.target.value.toUpperCase() }))}
                className="h-8 uppercase font-mono text-xs"
              />
              {formErrors.serialNumber && <p className="text-[11px] text-rose-500">{formErrors.serialNumber}</p>}
            </div>

            {/* Kategori & Merek */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kategori *</Label>
                <Select
                  value={formData.kategori}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, kategori: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.kategori && <p className="text-[11px] text-rose-500">{formErrors.kategori}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Merek *</Label>
                <Input
                  placeholder="Merek barang"
                  value={formData.merek}
                  onChange={(e) => setFormData((prev) => ({ ...prev, merek: e.target.value }))}
                  className="h-8 text-xs"
                />
                {formErrors.merek && <p className="text-[11px] text-rose-500">{formErrors.merek}</p>}
              </div>
            </div>

            {/* Tipe / Model */}
            <div className="space-y-1">
              <Label className="text-xs">Tipe / Model (Opsional)</Label>
              <Input
                placeholder="Model / Varian barang"
                value={formData.tipe}
                onChange={(e) => setFormData((prev) => ({ ...prev, tipe: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            {/* Status & Lokasi */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status Unit *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val as StatusUnit }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Lokasi Penyimpanan *</Label>
                <Select
                  value={formData.lokasiPenyimpanan}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, lokasiPenyimpanan: val }))}
                  disabled={formData.status === "Terdistribusi"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih Lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFormLocations.map((loc) => (
                      <SelectItem key={loc.name} value={loc.name}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.lokasiPenyimpanan && (
                  <p className="text-[11px] text-rose-500">{formErrors.lokasiPenyimpanan}</p>
                )}
              </div>
            </div>

            {/* Tanggal Masuk & Keluar */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tanggal Masuk *</Label>
                <Input
                  type="date"
                  value={formData.tanggalMasuk}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tanggalMasuk: e.target.value }))}
                  className="h-8 text-xs"
                />
                {formErrors.tanggalMasuk && <p className="text-[11px] text-rose-500">{formErrors.tanggalMasuk}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tanggal Keluar (Opsional)</Label>
                <Input
                  type="date"
                  value={formData.tanggalKeluar}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tanggalKeluar: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <AlertDialogFooter className="pt-3 border-t">
            <AlertDialogCancel
              type="button"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <Button type="submit" disabled={isSaving} size="sm" className="h-8 text-xs gap-1.5">
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              {formMode === "add" ? "Simpan Unit" : "Perbarui Unit"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
