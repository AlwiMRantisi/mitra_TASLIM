import  { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download, Loader2 } from "lucide-react"

export interface ExportColumnDef {
  key: string
  label: string
  defaultChecked: boolean
}

export const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: "serialNumber", label: "Serial Number (SN)", defaultChecked: true },
  { key: "kategori", label: "Kategori Material", defaultChecked: true },
  { key: "merek", label: "Merek", defaultChecked: true },
  { key: "tipe", label: "Model / Tipe", defaultChecked: true },
  { key: "status", label: "Status Barang", defaultChecked: true },
  { key: "lokasiPenyimpanan", label: "Lokasi Penyimpanan", defaultChecked: true },
  { key: "tanggalMasuk", label: "Tanggal Masuk", defaultChecked: true },
  { key: "tanggalKeluar", label: "Tanggal Keluar", defaultChecked: false },
  { key: "paNumber", label: "Property Asset (PA)", defaultChecked: false },
  { key: "createdBy", label: "Pembuat / Owner", defaultChecked: false },
]

interface ExportExcelModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onExport: (selectedColumnKeys: string[]) => Promise<void>
  isExporting: boolean
}

export function ExportExcelModal({
  isOpen,
  onOpenChange,
  onExport,
  isExporting,
}: ExportExcelModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  // Load preferences when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedPrefs = localStorage.getItem("arxiva-export-columns-pref")
      if (savedPrefs) {
        try {
          const parsed = JSON.parse(savedPrefs)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedColumns(parsed)
            return
          }
        } catch (e) {
          console.error("Failed to parse export preferences", e)
        }
      }
      // Fallback to defaults
      setSelectedColumns(EXPORT_COLUMNS.filter((c) => c.defaultChecked).map((c) => c.key))
    }
  }, [isOpen])

  const handleToggleColumn = (key: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const newCols = checked ? [...prev, key] : prev.filter((c) => c !== key)
      return newCols
    })
  }

  const handleSelectAll = () => {
    setSelectedColumns(EXPORT_COLUMNS.map((c) => c.key))
  }

  const handleReset = () => {
    setSelectedColumns(EXPORT_COLUMNS.filter((c) => c.defaultChecked).map((c) => c.key))
  }

  const handleDownload = async () => {
    // Save preferences
    localStorage.setItem("arxiva-export-columns-pref", JSON.stringify(selectedColumns))
    await onExport(selectedColumns)
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="min-w-lg max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Data ke Excel
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Konfigurasi kolom dan cakupan data yang ingin diunduh.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-2">
          {/* Columns Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Kolom Ditampilkan</Label>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={handleSelectAll}>
                  Pilih Semua
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border rounded-md p-3 bg-muted/30">
              {EXPORT_COLUMNS.map((col) => (
                <div key={col.key} className="flex items-start space-x-2">
                  <Checkbox
                    id={`col-${col.key}`}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={(checked) => handleToggleColumn(col.key, !!checked)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`col-${col.key}`}
                    className="text-[11px] leading-tight cursor-pointer font-medium"
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
            {selectedColumns.length === 0 && (
              <p className="text-[10px] text-destructive">Minimal satu kolom harus dipilih.</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="h-8 text-xs cursor-pointer" disabled={isExporting}>Batal</AlertDialogCancel>
          <Button
            className="h-8 text-xs cursor-pointer"
            onClick={handleDownload}
            disabled={selectedColumns.length === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Download className="w-3 h-3 mr-1" />
                Download Excel
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
